"""
DevPilot AI — FastAPI Backend v2
Amazon Nova AI Hackathon 2026

Routes:
  POST /api/review              — Nova 2 Lite code review
  POST /api/voice               — Nova 2 Sonic voice Q&A
  POST /api/research            — Nova Act doc research
  POST /api/route               — Intent classifier
  POST /api/share               — Save review, return share ID
  GET  /api/share/{id}          — Load shared review
  POST /api/translate           — Rewrite code in another language
  POST /api/repo                — Review all files in a GitHub repo
  POST /api/review/screenshot   — Screenshot analysis
  GET  /api/health              — Health check
"""

from __future__ import annotations
from dotenv import load_dotenv
load_dotenv()

import json
import uuid
import base64
import logging
import os
import re
import asyncio
from typing import Optional
from contextlib import asynccontextmanager
from pathlib import Path

import boto3
import httpx
from botocore.exceptions import ClientError, NoCredentialsError
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("devpilot")

# ─── AWS CLIENT ───────────────────────────────────────────────────────────────
try:
    bedrock = boto3.client("bedrock-runtime", region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
    mock_mode = False
    logger.info("AWS Bedrock client initialised")
except NoCredentialsError:
    logger.warning("AWS credentials not found — mock mode")
    bedrock = None
    mock_mode = True

NOVA_LITE  = "amazon.nova-lite-v1:0"
NOVA_SONIC = "amazon.nova-sonic-v1:0"

# ─── SHARED REVIEWS STORE (in-memory + disk) ──────────────────────────────────
SHARES_DIR = Path("./shares")
SHARES_DIR.mkdir(exist_ok=True)

# ─── PYDANTIC MODELS ─────────────────────────────────────────────────────────
class ReviewRequest(BaseModel):
    code: str
    language: str = "python"
    focus: Optional[str] = None
    context: Optional[str] = None

class VoiceRequest(BaseModel):
    message: str
    code_context: Optional[str] = None
    history: Optional[list] = []

class ResearchRequest(BaseModel):
    query: str
    stack: str = "python"
    error_message: Optional[str] = None

class RouteRequest(BaseModel):
    input: str

class ShareRequest(BaseModel):
    code: str
    language: str
    result: dict
    fix_history: Optional[list] = []

class TranslateRequest(BaseModel):
    code: str
    from_lang: str
    to_lang: str

class RepoRequest(BaseModel):
    repo_url: str
    github_token: Optional[str] = None

# ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────────
REVIEW_SYSTEM = """You are DevPilot, an elite senior software engineer specializing in security, performance, and clean code.

ANALYSIS ORDER:
1. CRITICAL: Security vulnerabilities (SQL injection, XSS, auth bypass)
2. HIGH: Logic bugs, null risks, race conditions, resource leaks
3. MEDIUM: Performance issues (N+1 queries, unnecessary loops)
4. LOW: Style, naming, missing docs, dead code

OUTPUT — respond ONLY with valid JSON:
{
  "score": <integer 1-10>,
  "summary": "<one sentence assessment>",
  "issues": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "category": "Security|Bug|Performance|Maintainability|Style",
      "line": <integer or null>,
      "title": "<short title>",
      "description": "<detailed explanation>",
      "fix": "<complete runnable fix>"
    }
  ],
  "positives": ["<what code does well>"],
  "refactored": "<complete improved version>"
}

RULES: Always provide runnable fix. Score 10=perfect, 1=dangerous. Pure JSON only."""

VOICE_SYSTEM = """You are DevPilot Voice, a senior software engineer answering spoken developer questions.

RULES: Under 100 words. No markdown. Speak like a colleague. End with ONE optional follow-up question.

OUTPUT — respond ONLY with valid JSON:
{
  "text": "<conversational answer, no markdown>",
  "code": "<code snippet or null>",
  "follow_up": "<one follow-up question or null>"
}"""

RESEARCH_SYSTEM = """You are DevPilot Research, an autonomous software engineering research assistant.

OUTPUT — respond ONLY with valid JSON:
{
  "problem_understood": "<one sentence restatement>",
  "solution": {
    "explanation": "<plain English>",
    "code": "<complete working snippet>",
    "steps": ["<step 1>", "..."]
  },
  "warnings": ["<gotcha>"],
  "sources": [{"title": "<title>", "url": "<real URL>", "domain": "<domain>"}]
}

RULES: Only real authoritative URLs. Mark deprecated patterns. Pure JSON only."""

TRANSLATE_SYSTEM = """You are DevPilot Translate, an expert polyglot programmer.
Rewrite the given code in the target language, preserving all logic and functionality.

OUTPUT — respond ONLY with valid JSON:
{
  "translated_code": "<complete rewritten code in target language>",
  "key_differences": ["<important difference 1>", "<important difference 2>"],
  "notes": "<any important migration notes>"
}

RULES: Preserve all logic. Use idiomatic patterns for the target language. Pure JSON only."""

REPO_SYSTEM = """You are DevPilot, reviewing a file from a larger codebase.
Be concise — focus only on issues that matter at the file level.

OUTPUT — respond ONLY with valid JSON:
{
  "score": <integer 1-10>,
  "summary": "<one sentence>",
  "critical_count": <integer>,
  "high_count": <integer>,
  "issues": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "title": "<short title>",
      "line": <integer or null>,
      "fix": "<fix>"
    }
  ]
}

Keep response under 800 tokens. Pure JSON only."""

ROUTER_SYSTEM = """Classify into ONE category. Respond with ONLY the category name.
Categories: CODE_REVIEW | VOICE_CHAT | DOC_RESEARCH | GENERAL"""

# ─── CORE BEDROCK CALLER ─────────────────────────────────────────────────────
def call_nova_lite(system_prompt: str, user_message: str, temperature: float = 0.1, max_tokens: int = 4096) -> str:
    if bedrock is None:
        raise HTTPException(status_code=503, detail="AWS credentials not configured")
    body = {
        "system": [{"text": system_prompt}],
        "messages": [{"role": "user", "content": [{"text": user_message}]}],
        "inferenceConfig": {"temperature": temperature, "maxTokens": max_tokens, "topP": 0.9}
    }
    try:
        response = bedrock.invoke_model(modelId=NOVA_LITE, body=json.dumps(body), contentType="application/json", accept="application/json")
        result = json.loads(response["body"].read())
        return result["output"]["message"]["content"][0]["text"]
    except ClientError as e:
        code = e.response["Error"]["Code"]
        logger.error(f"Bedrock error: {code}")
        if code == "AccessDeniedException": raise HTTPException(status_code=403, detail="Bedrock access denied.")
        if code == "ThrottlingException": raise HTTPException(status_code=429, detail="Rate limit. Retry shortly.")
        raise HTTPException(status_code=500, detail=f"Bedrock error: {code}")

def parse_json_response(raw: str) -> dict:
    clean = raw.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        clean = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse failed: {e}\nRaw: {raw[:500]}")
        raise HTTPException(status_code=500, detail="Model returned malformed JSON. Try again.")

# ─── MOCK DATA ────────────────────────────────────────────────────────────────
MOCK_REVIEW = {
    "score": 4, "summary": "Critical SQL injection vulnerability detected.",
    "issues": [
        {"severity":"CRITICAL","category":"Security","line":8,"title":"SQL Injection","description":"User input concatenated directly into SQL query.","fix":"cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))"},
        {"severity":"HIGH","category":"Bug","line":14,"title":"Unhandled None","description":"fetchone() can return None causing TypeError.","fix":"result = cursor.fetchone()\nif result is None:\n    return None\nreturn result['name']"}
    ],
    "positives": ["Clear single responsibility"], "refactored": "def get_user(conn, user_id: int):\n    with conn.cursor() as cur:\n        cur.execute('SELECT id, name FROM users WHERE id = %s', (user_id,))\n        return cur.fetchone()"
}
MOCK_VOICE = {"text": "That SQL injection is serious — you're concatenating user input directly. Use parameterized queries instead.", "code": "cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))", "follow_up": "Want me to explain parameterized queries in more detail?"}
MOCK_RESEARCH = {
    "problem_understood": "How to prevent SQL injection in Python.",
    "solution": {"explanation": "Use parameterized queries.", "code": "cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))", "steps": ["Replace string concat with %s", "Pass data as tuple to execute()"]},
    "warnings": ["Never use f-strings to build SQL"],
    "sources": [{"title":"psycopg2 docs","url":"https://www.psycopg.org/docs/usage.html","domain":"psycopg.org"}]
}
MOCK_TRANSLATE = {
    "translated_code": "async function getUser(userId: number): Promise<User | null> {\n  const result = await db.query(\n    'SELECT id, name FROM users WHERE id = $1',\n    [userId]\n  );\n  return result.rows[0] ?? null;\n}",
    "key_differences": ["TypeScript uses async/await instead of synchronous calls", "PostgreSQL uses $1 placeholders instead of %s", "Returns typed User object instead of tuple"],
    "notes": "Use node-postgres (pg) library for database connections in Node.js/TypeScript."
}

# ─── APP INIT ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"DevPilot API starting. AWS configured: {bedrock is not None}")
    yield
    logger.info("DevPilot API shutting down")

app = FastAPI(title="DevPilot AI API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "mock_mode": bedrock is None, "region": os.getenv("AWS_DEFAULT_REGION","us-east-1"), "models": {"nova_lite": NOVA_LITE, "nova_sonic": NOVA_SONIC}}


@app.post("/api/review")
async def review_code(req: ReviewRequest):
    if not req.code.strip(): raise HTTPException(status_code=422, detail="Code required")
    focus_line = f"\nFocus on: {req.focus}" if req.focus else ""
    msg = f"Review this {req.language} code:{focus_line}\n\n```{req.language}\n{req.code}\n```"
    if bedrock is None: return MOCK_REVIEW
    return parse_json_response(call_nova_lite(REVIEW_SYSTEM, msg, temperature=0.1))


@app.post("/api/voice")
async def voice_chat(req: VoiceRequest):
    if not req.message.strip(): raise HTTPException(status_code=422, detail="Message required")
    parts = []
    if req.code_context: parts.append(f"Current code:\n```\n{req.code_context[:3000]}\n```\n")
    if req.history:
        parts.append("Recent conversation:\n" + "\n".join([f"{t['role'].upper()}: {t['content']}" for t in req.history[-6:]]) + "\n")
    parts.append(f"Developer says: \"{req.message}\"")
    if bedrock is None: return MOCK_VOICE
    return parse_json_response(call_nova_lite(VOICE_SYSTEM, "\n".join(parts), temperature=0.7, max_tokens=512))


@app.post("/api/research")
async def research_docs(req: ResearchRequest):
    if not req.query.strip(): raise HTTPException(status_code=422, detail="Query required")
    err = f"\nError: {req.error_message}" if req.error_message else ""
    msg = f"Problem: {req.query}\nStack: {req.stack}{err}\n\nFind the best solution with real authoritative URLs."
    if bedrock is None: return MOCK_RESEARCH
    return parse_json_response(call_nova_lite(RESEARCH_SYSTEM, msg, temperature=0.1, max_tokens=2048))


@app.post("/api/route")
async def route_intent(req: RouteRequest):
    if bedrock is None: return {"intent": "CODE_REVIEW"}
    raw = call_nova_lite(ROUTER_SYSTEM, req.input, temperature=0.0, max_tokens=20)
    intent = raw.strip().upper()
    return {"intent": intent if intent in {"CODE_REVIEW","VOICE_CHAT","DOC_RESEARCH","GENERAL"} else "GENERAL"}


# ─── FEATURE 9: SHARE REVIEW ─────────────────────────────────────────────────

@app.post("/api/share")
async def create_share(req: ShareRequest):
    """Save a review and return a shareable ID."""
    share_id = str(uuid.uuid4())[:8]
    share_data = {
        "id": share_id,
        "code": req.code,
        "language": req.language,
        "result": req.result,
        "fix_history": req.fix_history,
        "created_at": __import__("datetime").datetime.utcnow().isoformat()
    }
    share_file = SHARES_DIR / f"{share_id}.json"
    share_file.write_text(json.dumps(share_data))
    logger.info(f"Created share: {share_id}")
    return {"share_id": share_id, "url": f"http://localhost:8000/api/share/{share_id}"}


@app.get("/api/share/{share_id}")
async def get_share(share_id: str):
    """Load a shared review by ID."""
    # sanitize
    if not re.match(r'^[a-f0-9\-]{8}$', share_id):
        raise HTTPException(status_code=400, detail="Invalid share ID")
    share_file = SHARES_DIR / f"{share_id}.json"
    if not share_file.exists():
        raise HTTPException(status_code=404, detail="Share not found or expired")
    return json.loads(share_file.read_text())


# ─── FEATURE 10: FIX HISTORY ─────────────────────────────────────────────────
# Fix history is stored client-side in localStorage (see frontend).
# This endpoint accepts a batch save for persistence across devices.

@app.post("/api/fix-history")
async def save_fix_history(payload: dict):
    """Accept fix history entries for optional server-side logging."""
    logger.info(f"Fix history received: {len(payload.get('entries',[]))} entries")
    return {"saved": True}


# ─── FEATURE 11: MULTI-LANGUAGE TRANSLATION ──────────────────────────────────

@app.post("/api/translate")
async def translate_code(req: TranslateRequest):
    """Rewrite code from one language to another using Nova 2 Lite."""
    if not req.code.strip(): raise HTTPException(status_code=422, detail="Code required")
    if req.from_lang == req.to_lang: raise HTTPException(status_code=422, detail="Source and target language must differ")

    msg = f"""Rewrite this {req.from_lang} code in {req.to_lang}.
Preserve all logic and functionality. Use idiomatic {req.to_lang} patterns.

```{req.from_lang}
{req.code}
```"""

    if bedrock is None: return MOCK_TRANSLATE
    return parse_json_response(call_nova_lite(TRANSLATE_SYSTEM, msg, temperature=0.2, max_tokens=4096))


# ─── FEATURE 12: REPO-LEVEL REVIEW ───────────────────────────────────────────

def parse_github_url(url: str):
    """Extract owner and repo from a GitHub URL."""
    match = re.search(r'github\.com/([^/]+)/([^/]+?)(?:\.git)?(?:/|$)', url)
    if not match: raise HTTPException(status_code=422, detail="Invalid GitHub URL. Use: https://github.com/owner/repo")
    return match.group(1), match.group(2)

REVIEWABLE_EXTENSIONS = {".py",".js",".ts",".jsx",".tsx",".go",".java",".rs",".rb",".php",".cpp",".c",".cs"}
MAX_FILES = 10
MAX_FILE_SIZE = 8000  # chars

async def fetch_github_files(owner: str, repo: str, token: Optional[str] = None):
    """Fetch all reviewable source files from a GitHub repo."""
    headers = {"Accept": "application/vnd.github+json"}
    if token: headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=20) as client:
        # Get file tree
        r = await client.get(f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1", headers=headers)
        if r.status_code == 404: raise HTTPException(status_code=404, detail="Repo not found or private")
        if r.status_code == 403: raise HTTPException(status_code=403, detail="GitHub rate limit. Provide a token.")
        tree = r.json().get("tree", [])

        # Filter to reviewable files
        files = [f for f in tree if f["type"] == "blob" and Path(f["path"]).suffix in REVIEWABLE_EXTENSIONS and f.get("size", 0) < 50000]
        files = files[:MAX_FILES]

        # Fetch file contents
        results = []
        for f in files:
            rc = await client.get(f"https://api.github.com/repos/{owner}/{repo}/contents/{f['path']}", headers=headers)
            if rc.status_code != 200: continue
            content_b64 = rc.json().get("content","").replace("\n","")
            try:
                content = base64.b64decode(content_b64).decode("utf-8", errors="ignore")
                results.append({"path": f["path"], "content": content[:MAX_FILE_SIZE]})
            except Exception: continue

        return results

@app.post("/api/repo")
async def review_repo(req: RepoRequest):
    """Review all source files in a GitHub repo."""
    owner, repo = parse_github_url(req.repo_url)
    logger.info(f"Reviewing repo: {owner}/{repo}")

    # Fetch files
    try:
        files = await fetch_github_files(owner, repo, req.github_token)
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch repo: {e}")

    if not files:
        raise HTTPException(status_code=422, detail="No reviewable source files found in repo")

    # Review each file
    file_results = []
    for f in files:
        ext = Path(f["path"]).suffix.lstrip(".")
        lang_map = {".py":"python",".js":"javascript",".ts":"typescript",".jsx":"javascript",".tsx":"typescript",".go":"go",".java":"java",".rs":"rust",".rb":"ruby",".php":"php",".cpp":"c++",".c":"c",".cs":"c#"}
        lang = lang_map.get(Path(f["path"]).suffix, "code")

        if bedrock is None:
            file_results.append({"path":f["path"],"language":lang,"score":7,"summary":"Mock review","critical_count":0,"high_count":1,"issues":[{"severity":"HIGH","title":"Mock issue","line":1,"fix":"# fix here"}]})
            continue

        msg = f"Review this {lang} file ({f['path']}):\n\n```{lang}\n{f['content']}\n```"
        try:
            raw = call_nova_lite(REPO_SYSTEM, msg, temperature=0.1, max_tokens=800)
            result = parse_json_response(raw)
            result["path"] = f["path"]
            result["language"] = lang
            file_results.append(result)
        except Exception as e:
            logger.warning(f"Failed to review {f['path']}: {e}")
            file_results.append({"path":f["path"],"language":lang,"score":None,"summary":"Review failed","critical_count":0,"high_count":0,"issues":[]})

    # Aggregate summary
    reviewed = [r for r in file_results if r.get("score") is not None]
    avg_score = round(sum(r["score"] for r in reviewed) / len(reviewed)) if reviewed else 0
    total_critical = sum(r.get("critical_count",0) for r in file_results)
    total_high = sum(r.get("high_count",0) for r in file_results)

    return {
        "repo": f"{owner}/{repo}",
        "files_reviewed": len(file_results),
        "avg_score": avg_score,
        "total_critical": total_critical,
        "total_high": total_high,
        "files": file_results
    }


# ─── SCREENSHOT ANALYSIS ─────────────────────────────────────────────────────

@app.post("/api/review/screenshot")
async def review_screenshot(file: UploadFile = File(...), context: str = ""):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="File must be an image")
    image_bytes = await file.read()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    fmt = file.content_type.split("/")[1]
    if bedrock is None:
        return {"screen_type":"IDE","what_i_see":"Mock screenshot analysis","context":"Developer working on code","issues":[],"suggestions":["Connect AWS to enable real analysis"]}
    body = {
        "system": [{"text": "You are DevPilot Vision. Analyze this developer screenshot. Return JSON: {screen_type, what_i_see, context, issues: [{type, description, recommendation}], suggestions}"}],
        "messages": [{"role":"user","content":[{"image":{"format":fmt,"source":{"bytes":image_b64}}},{"text":f"Analyze this screenshot.{' Context: '+context if context else ''}"}]}],
        "inferenceConfig": {"temperature":0.2,"maxTokens":2048}
    }
    try:
        response = bedrock.invoke_model(modelId=NOVA_LITE, body=json.dumps(body), contentType="application/json", accept="application/json")
        result = json.loads(response["body"].read())
        return parse_json_response(result["output"]["message"]["content"][0]["text"])
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e))
