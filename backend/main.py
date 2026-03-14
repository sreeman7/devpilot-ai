"""
DevPilot AI backend.

Hackathon MVP routes:
  POST /api/review          Nova 2 Lite code review
  POST /api/voice           Voice-oriented debugging response
  POST /api/research        Source-backed research response
  POST /api/route           Intent classifier
  POST /api/review/screenshot  Stretch screenshot analysis
  GET  /api/health          Health check
"""
from __future__ import annotations
from dotenv import load_dotenv
load_dotenv()

import base64
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger("devpilot")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
NOVA_LITE = os.getenv("NOVA_LITE_MODEL", "amazon.nova-lite-v1:0")
NOVA_SONIC = os.getenv("NOVA_SONIC_MODEL", "amazon.nova-sonic-v1:0")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    if origin.strip()
]


def create_bedrock_client():
    try:
        session = boto3.Session(region_name=AWS_REGION)
        credentials = session.get_credentials()
        if credentials is None:
            logger.warning("AWS credentials not found. Backend will run in mock mode.")
            return None
        return session.client("bedrock-runtime")
    except (BotoCoreError, ClientError) as exc:
        logger.warning("Failed to initialize Bedrock client. Falling back to mock mode: %s", exc)
        return None


bedrock = create_bedrock_client()


class ReviewRequest(BaseModel):
    code: str
    language: str = "python"
    focus: str | None = None
    context: str | None = None


class VoiceTurn(BaseModel):
    role: str
    content: str


class VoiceRequest(BaseModel):
    message: str
    code_context: str | None = None
    history: list[VoiceTurn] = Field(default_factory=list)


class ResearchRequest(BaseModel):
    query: str
    stack: str = "python"
    error_message: str | None = None


class RouteRequest(BaseModel):
    input: str


REVIEW_SYSTEM = """You are DevPilot, a senior software engineer specializing in security, correctness, performance, and maintainability.

Review order:
1. CRITICAL: security flaws and dangerous data handling
2. HIGH: correctness bugs and crash paths
3. MEDIUM: performance issues and unnecessary complexity
4. LOW: maintainability, style, and readability

Respond with JSON only:
{
  "score": 1,
  "summary": "one sentence",
  "issues": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "category": "Security|Bug|Performance|Maintainability|Style",
      "line": 1,
      "title": "short issue title",
      "description": "what is wrong",
      "fix": "complete corrected code snippet"
    }
  ],
  "positives": ["brief positive"],
  "refactored": "optional improved version"
}
"""

VOICE_SYSTEM = """You are DevPilot Voice, a senior engineer answering a spoken developer question.

Rules:
- Keep the spoken answer concise and practical
- No markdown formatting in the spoken text
- Put code only in the code field
- End with at most one short follow-up question

Respond with JSON only:
{
  "text": "spoken answer",
  "code": "code snippet or null",
  "follow_up": "optional question or null"
}
"""

RESEARCH_SYSTEM = """You are DevPilot Research, a source-grounded software engineering assistant.

Provide a concise answer based on authoritative sources. Favor official docs over secondary sources.

Respond with JSON only:
{
  "problem_understood": "one sentence",
  "solution": {
    "explanation": "plain English explanation",
    "code": "complete code snippet",
    "steps": ["step 1", "step 2"]
  },
  "warnings": ["gotcha"],
  "sources": [
    {
      "title": "page title",
      "url": "https://example.com",
      "domain": "example.com"
    }
  ]
}
"""

ROUTER_SYSTEM = """Classify the developer input into exactly one category.
Return only one token:
CODE_REVIEW
VOICE_CHAT
DOC_RESEARCH
GENERAL
"""

VISION_SYSTEM = """You are DevPilot Vision.

Analyze a developer screenshot and return JSON only:
{
  "screen_type": "IDE|Browser|Terminal|AppUI|Diagram|Other",
  "what_i_see": "brief description",
  "context": "what the user appears to be doing",
  "issues": [
    {
      "type": "Bug|Layout|Performance|UX|Code|Other",
      "description": "issue description",
      "recommendation": "how to improve it"
    }
  ],
  "suggestions": ["proactive improvement"]
}
"""


def invoke_nova(model_id: str, system_prompt: str, user_content: list[dict[str, Any]], *, temperature: float, max_tokens: int) -> str:
    if bedrock is None:
        raise HTTPException(status_code=503, detail="AWS credentials not configured")

    body = {
        "system": [{"text": system_prompt}],
        "messages": [{"role": "user", "content": user_content}],
        "inferenceConfig": {
            "temperature": temperature,
            "maxTokens": max_tokens,
            "topP": 0.9,
        },
    }

    try:
        response = bedrock.invoke_model(
            modelId=model_id,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json",
        )
        parsed = json.loads(response["body"].read())
        return parsed["output"]["message"]["content"][0]["text"]
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        logger.error("Bedrock error %s: %s", code, exc)
        if code == "AccessDeniedException":
            raise HTTPException(status_code=403, detail="Bedrock access denied. Check model access and IAM permissions.") from exc
        if code == "ThrottlingException":
            raise HTTPException(status_code=429, detail="Bedrock rate limit reached. Retry in a moment.") from exc
        raise HTTPException(status_code=500, detail=f"Bedrock error: {code}") from exc


def parse_model_json(raw: str) -> dict[str, Any]:
    clean = raw.strip()
    if clean.startswith("```"):
        lines = clean.splitlines()
        clean = "\n".join(lines[1:-1])
    try:
        return json.loads(clean)
    except json.JSONDecodeError as exc:
        logger.error("Model returned malformed JSON: %s", raw[:600])
        raise HTTPException(status_code=502, detail="Model returned malformed JSON.") from exc


MOCK_REVIEW = {
    "score": 4,
    "summary": "Critical query construction risk detected with additional correctness and performance issues.",
    "issues": [
        {
            "severity": "CRITICAL",
            "category": "Security",
            "line": 8,
            "title": "SQL injection risk in query construction",
            "description": "User input is concatenated directly into the SQL statement, allowing malicious values to alter query behavior.",
            "fix": 'query = "SELECT * FROM users WHERE id = %s"\ncursor.execute(query, (user_id,))',
        },
        {
            "severity": "HIGH",
            "category": "Bug",
            "line": 14,
            "title": "Missing null guard for fetchone()",
            "description": "The result is dereferenced without handling the case where no row is returned.",
            "fix": 'result = cursor.fetchone()\nif result is None:\n    return None\nreturn result["name"]',
        },
        {
            "severity": "MEDIUM",
            "category": "Performance",
            "line": 22,
            "title": "Repeated database lookup inside loop",
            "description": "The code issues one query per item rather than batch loading related records.",
            "fix": 'ids = [u["id"] for u in users]\ncur.execute("SELECT * FROM posts WHERE user_id = ANY(%s)", (ids,))',
        },
    ],
    "positives": ["The function has a narrow responsibility.", "The database access path is easy to follow."],
    "refactored": 'def get_user(conn, user_id: int):\n    with conn.cursor() as cur:\n        cur.execute("SELECT id, name FROM users WHERE id = %s", (user_id,))\n        return cur.fetchone()',
}

MOCK_VOICE = {
    "text": "The dangerous part is direct string concatenation in the SQL query. That lets attacker-controlled input change the query itself. Use a parameterized query so the database treats user_id as data, not executable SQL. You should also guard the no-row case before reading fields. Want me to show both fixes together?",
    "code": 'query = "SELECT * FROM users WHERE id = %s"\ncursor.execute(query, (user_id,))\nresult = cursor.fetchone()',
    "follow_up": "Want the safe full function?",
}

MOCK_RESEARCH = {
    "problem_understood": "The app needs a safe psycopg2 query pattern that avoids SQL injection and handles empty results correctly.",
    "solution": {
        "explanation": "Use parameterized execute() calls and check the fetch result before reading fields.",
        "code": 'def get_user_safe(conn, user_id: int):\n    with conn.cursor() as cur:\n        cur.execute("SELECT id, name FROM users WHERE id = %s", (user_id,))\n        result = cur.fetchone()\n        return result',
        "steps": [
            "Replace string concatenation with parameter placeholders.",
            "Pass user input via the execute() parameter tuple.",
            "Handle the no-result path explicitly.",
        ],
    },
    "warnings": [
        "Do not wrap SQL in f-strings or .format().",
        "Parameterized values do not protect dynamic table or column names.",
    ],
    "sources": [
        {
            "title": "psycopg2 query parameters",
            "url": "https://www.psycopg.org/docs/usage.html#query-parameters",
            "domain": "psycopg.org",
        },
        {
            "title": "OWASP SQL Injection Prevention Cheat Sheet",
            "url": "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html",
            "domain": "owasp.org",
        },
    ],
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("DevPilot API starting. AWS configured: %s", bedrock is not None)
    yield
    logger.info("DevPilot API shutting down")


app = FastAPI(
    title="DevPilot AI API",
    description="Hackathon backend for the DevPilot AI workflow.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "mock_mode": bedrock is None,
        "region": AWS_REGION,
        "models": {
            "nova_lite": NOVA_LITE,
            "nova_sonic": NOVA_SONIC,
        },
    }


@app.post("/api/review")
async def review_code(req: ReviewRequest):
    if not req.code.strip():
        raise HTTPException(status_code=422, detail="Code field is required.")

    if bedrock is None:
        return MOCK_REVIEW

    focus_line = f"\nFocus especially on: {req.focus}" if req.focus else ""
    context_line = f"\nAdditional context: {req.context}" if req.context else ""
    prompt = f"""Review this {req.language} code.{focus_line}{context_line}

```{req.language}
{req.code}
```"""

    raw = invoke_nova(
        NOVA_LITE,
        REVIEW_SYSTEM,
        [{"text": prompt}],
        temperature=0.1,
        max_tokens=4096,
    )
    return parse_model_json(raw)


@app.post("/api/voice")
async def voice_chat(req: VoiceRequest):
    if not req.message.strip():
        raise HTTPException(status_code=422, detail="Message field is required.")

    if bedrock is None:
        return MOCK_VOICE

    parts = []
    if req.code_context:
        parts.append(f"Current code context:\n```\n{req.code_context[:3000]}\n```")
    if req.history:
        history_text = "\n".join(f"{turn.role.upper()}: {turn.content}" for turn in req.history[-6:])
        parts.append(f"Recent conversation:\n{history_text}")
    parts.append(f'Developer says: "{req.message}"')

    raw = invoke_nova(
        NOVA_LITE,
        VOICE_SYSTEM,
        [{"text": "\n\n".join(parts)}],
        temperature=0.7,
        max_tokens=512,
    )
    return parse_model_json(raw)


@app.post("/api/research")
async def research_docs(req: ResearchRequest):
    if not req.query.strip():
        raise HTTPException(status_code=422, detail="Query field is required.")

    if bedrock is None:
        return MOCK_RESEARCH

    error_line = f"\nError message: {req.error_message}" if req.error_message else ""
    prompt = f"""Research this developer problem.

Problem: {req.query}
Stack: {req.stack}{error_line}

Prefer official docs over secondary sources. Return only real URLs."""

    raw = invoke_nova(
        NOVA_LITE,
        RESEARCH_SYSTEM,
        [{"text": prompt}],
        temperature=0.1,
        max_tokens=2048,
    )
    return parse_model_json(raw)


@app.post("/api/route")
async def route_intent(req: RouteRequest):
    if not req.input.strip():
        raise HTTPException(status_code=422, detail="Input field is required.")

    if bedrock is None:
        return {"intent": "CODE_REVIEW"}

    raw = invoke_nova(
        NOVA_LITE,
        ROUTER_SYSTEM,
        [{"text": req.input}],
        temperature=0.0,
        max_tokens=20,
    )
    intent = raw.strip().upper()
    valid = {"CODE_REVIEW", "VOICE_CHAT", "DOC_RESEARCH", "GENERAL"}
    return {"intent": intent if intent in valid else "GENERAL"}


@app.post("/api/review/screenshot")
async def review_screenshot(file: UploadFile = File(...), context: str = ""):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="File must be an image.")

    if bedrock is None:
        return {
            "screen_type": "IDE",
            "what_i_see": "Mock screenshot analysis is active because AWS is not configured.",
            "context": "The user appears to be debugging inside an editor.",
            "issues": [],
            "suggestions": ["Connect Bedrock credentials to enable real screenshot analysis."],
        }

    image_bytes = await file.read()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    file_format = file.content_type.split("/", maxsplit=1)[1]
    user_content = [
        {"image": {"format": file_format, "source": {"bytes": image_b64}}},
        {"text": f"Analyze this screenshot. Additional context: {context}" if context else "Analyze this screenshot."},
    ]

    raw = invoke_nova(
        NOVA_LITE,
        VISION_SYSTEM,
        user_content,
        temperature=0.2,
        max_tokens=2048,
    )
    return parse_model_json(raw)
