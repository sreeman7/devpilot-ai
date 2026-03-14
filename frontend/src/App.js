import { useState, useRef, useEffect } from "react";

// ─── API CONFIG ───────────────────────────────────────────────────────────────
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

const api = {
  async post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },
  async postForm(path, formData) {
    const res = await fetch(`${API_BASE}${path}`, { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },
  async get(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0c10; --bg2: #0f1218; --bg3: #151a22; --bg4: #1c2230;
    --border: rgba(255,255,255,0.07); --border2: rgba(255,255,255,0.12);
    --text: #e8eaf0; --text2: #8b91a0; --text3: #555d6e;
    --accent: #00d4aa; --accent2: #00a882; --accent-bg: rgba(0,212,170,0.08);
    --amber: #f59e0b; --amber-bg: rgba(245,158,11,0.08);
    --red: #ef4444; --red-bg: rgba(239,68,68,0.08);
    --blue: #60a5fa; --blue-bg: rgba(96,165,250,0.08);
    --radius: 10px; --radius-lg: 16px;
    --mono: 'JetBrains Mono', monospace; --sans: 'DM Sans', sans-serif;
  }
  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 14px; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }
  .app { display: grid; grid-template-columns: 220px 1fr; grid-template-rows: 52px 1fr; height: 100vh; overflow: hidden; }

  /* TOPBAR */
  .topbar { grid-column: 1/-1; display: flex; align-items: center; gap: 12px; padding: 0 20px; background: var(--bg2); border-bottom: 1px solid var(--border); z-index: 10; }
  .logo { display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 15px; font-weight: 600; color: var(--accent); }
  .logo-dot { width: 7px; height: 7px; background: var(--accent); border-radius: 50%; animation: pulse 2.4s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
  .topbar-badge { font-family: var(--mono); font-size: 10px; font-weight: 500; padding: 2px 7px; border-radius: 4px; background: var(--accent-bg); color: var(--accent); border: 1px solid rgba(0,212,170,0.2); }
  .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .status-pill { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text2); padding: 4px 10px; border-radius: 20px; background: var(--bg3); border: 1px solid var(--border); cursor: pointer; transition: border-color 0.15s; }
  .status-pill:hover { border-color: var(--border2); }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; }
  .dot-green { background: var(--accent); }
  .dot-amber { background: var(--amber); animation: pulse 1.5s infinite; }
  .dot-red   { background: var(--red); }

  /* SIDEBAR */
  .sidebar { background: var(--bg2); border-right: 1px solid var(--border); padding: 16px 10px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
  .nav-section { font-size: 10px; font-weight: 600; color: var(--text3); letter-spacing: 1px; text-transform: uppercase; padding: 8px 10px 4px; }
  .nav-item { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: var(--radius); font-size: 13px; color: var(--text2); cursor: pointer; transition: all 0.15s; border: 1px solid transparent; user-select: none; }
  .nav-item:hover { background: var(--bg3); color: var(--text); }
  .nav-item.active { background: var(--accent-bg); color: var(--accent); border-color: rgba(0,212,170,0.15); font-weight: 500; }
  .nav-icon { font-size: 15px; width: 18px; text-align: center; flex-shrink: 0; }
  .nav-badge { margin-left: auto; font-size: 10px; font-family: var(--mono); background: var(--bg4); color: var(--text3); padding: 1px 6px; border-radius: 8px; }
  .nav-item.active .nav-badge { background: rgba(0,212,170,0.15); color: var(--accent); }
  .sidebar-footer { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border); }

  /* MAIN */
  .main { overflow: hidden; display: flex; flex-direction: column; }
  .panel-header { padding: 18px 24px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .panel-title { font-size: 15px; font-weight: 600; color: var(--text); }
  .panel-sub { font-size: 12px; color: var(--text3); margin-top: 1px; }

  /* BUTTONS */
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: var(--radius); font-family: var(--sans); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; user-select: none; outline: none; }
  .btn-primary { background: var(--accent); color: #0a0c10; border-color: var(--accent); }
  .btn-primary:hover { background: var(--accent2); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: var(--text2); border-color: var(--border2); }
  .btn-ghost:hover { background: var(--bg3); color: var(--text); }
  .btn-sm { padding: 4px 10px; font-size: 12px; }

  /* CODE REVIEW */
  .review-layout { display: grid; grid-template-columns: 1fr 1fr; height: 100%; overflow: hidden; }
  .code-pane { display: flex; flex-direction: column; border-right: 1px solid var(--border); overflow: hidden; }
  .results-pane { display: flex; flex-direction: column; overflow: hidden; }
  .pane-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--bg2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .code-editor { flex: 1; padding: 16px; resize: none; outline: none; border: none; background: var(--bg); color: var(--text); font-family: var(--mono); font-size: 13px; line-height: 1.7; overflow-y: auto; }
  .code-editor::placeholder { color: var(--text3); }
  .results-scroll { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }

  /* ISSUE CARDS */
  .issue-card { border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg2); overflow: hidden; transition: border-color 0.15s; }
  .issue-card:hover { border-color: var(--border2); }
  .issue-header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; min-height: 46px; cursor: pointer; }
  .severity-badge { display: inline-flex; align-items: center; font-family: var(--mono); font-size: 10px; font-weight: 600; line-height: 1.2; min-height: 24px; padding: 3px 9px; border-radius: 4px; flex-shrink: 0; }
  .sev-critical { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }
  .sev-high     { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.25); }
  .sev-medium   { background: rgba(96,165,250,0.15); color: #93c5fd; border: 1px solid rgba(96,165,250,0.25); }
  .sev-low      { background: rgba(139,145,160,0.12); color: #8b91a0; border: 1px solid rgba(139,145,160,0.2); }
  .issue-title { font-size: 13px; font-weight: 500; line-height: 1.4; color: var(--text); flex: 1; }
  .issue-line { font-family: var(--mono); font-size: 11px; line-height: 1.2; color: var(--text3); }
  .issue-body { padding: 0 14px 12px; display: flex; flex-direction: column; gap: 8px; }
  .issue-desc { font-size: 12px; color: var(--text2); line-height: 1.6; }
  .issue-fix { background: var(--bg); border-radius: 6px; border: 1px solid var(--border); overflow: hidden; }
  .fix-label { font-family: var(--mono); font-size: 10px; color: var(--accent); padding: 6px 10px; border-bottom: 1px solid var(--border); background: var(--bg2); letter-spacing: 0.5px; }
  .fix-code { font-family: var(--mono); font-size: 12px; color: #a8d8b0; padding: 10px; line-height: 1.6; white-space: pre-wrap; overflow-x: auto; }
  .score-card { border-radius: var(--radius); background: var(--bg2); border: 1px solid var(--border); padding: 14px 16px; display: flex; align-items: center; gap: 14px; }
  .score-ring { width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-size: 18px; font-weight: 600; border: 2px solid; }
  .score-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
  .score-summary { font-size: 12px; color: var(--text2); line-height: 1.6; }

  /* ERROR BANNER */
  .error-banner { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: var(--radius); background: var(--red-bg); border: 1px solid rgba(239,68,68,0.25); font-size: 12px; color: #f87171; line-height: 1.6; }
  .warn-banner  { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: var(--radius); background: var(--amber-bg); border: 1px solid rgba(245,158,11,0.25); font-size: 12px; color: #fbbf24; line-height: 1.6; }

  /* EMPTY STATE */
  .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text3); text-align: center; padding: 40px; }
  .empty-icon { font-size: 36px; opacity: 0.4; }
  .empty-title { font-size: 14px; font-weight: 500; color: var(--text2); }
  .empty-sub { font-size: 12px; line-height: 1.6; max-width: 260px; }

  /* VOICE */
  .voice-layout { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .chat-scroll { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
  .msg { display: flex; gap: 10px; animation: fadeUp 0.2s ease; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
  .msg-avatar { width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; margin-top: 2px; }
  .msg-avatar.user { background: var(--bg4); }
  .msg-avatar.bot  { background: var(--accent-bg); border: 1px solid rgba(0,212,170,0.2); }
  .msg-name { font-size: 11px; color: var(--text3); margin-bottom: 4px; font-weight: 500; }
  .msg-text { font-size: 13px; line-height: 1.7; color: var(--text); background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; display: inline-block; max-width: 100%; }
  .msg.user .msg-text { background: var(--bg3); }
  .msg-code { font-family: var(--mono); font-size: 12px; color: #a8d8b0; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-top: 8px; white-space: pre-wrap; overflow-x: auto; line-height: 1.6; }
  .msg-follow-up { font-size: 11px; color: var(--text3); margin-top: 6px; font-style: italic; }
  .voice-controls { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; }
  .voice-input-row { display: flex; gap: 8px; align-items: flex-end; }
  .text-input { flex: 1; background: var(--bg2); border: 1px solid var(--border2); color: var(--text); border-radius: var(--radius); padding: 9px 14px; font-family: var(--sans); font-size: 13px; outline: none; resize: none; line-height: 1.5; min-height: 38px; max-height: 100px; transition: border-color 0.15s; }
  .text-input:focus { border-color: var(--accent); }
  .text-input::placeholder { color: var(--text3); }
  .mic-btn { width: 38px; height: 38px; border-radius: var(--radius); border: 1px solid var(--border2); background: var(--bg2); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; flex-shrink: 0; font-size: 16px; }
  .mic-btn:hover { border-color: var(--accent); background: var(--accent-bg); }
  .mic-btn.recording { background: var(--red-bg); border-color: rgba(239,68,68,0.4); animation: micPulse 1s ease-in-out infinite; }
  @keyframes micPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.3)} 50%{box-shadow:0 0 0 6px rgba(239,68,68,0)} }
  .voice-hint { font-size: 11px; color: var(--text3); text-align: center; }

  /* RESEARCH */
  .research-layout { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .research-input-zone { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; }
  .research-input { background: var(--bg2); border: 1px solid var(--border2); color: var(--text); border-radius: var(--radius); padding: 10px 14px; font-family: var(--sans); font-size: 13px; outline: none; resize: none; line-height: 1.6; min-height: 72px; transition: border-color 0.15s; width: 100%; }
  .research-input:focus { border-color: var(--accent); }
  .research-input::placeholder { color: var(--text3); }
  .research-row { display: flex; gap: 8px; align-items: center; }
  .stack-select { flex: 1; background: var(--bg2); border: 1px solid var(--border2); color: var(--text); border-radius: var(--radius); padding: 7px 12px; font-family: var(--sans); font-size: 13px; outline: none; }
  .research-scroll { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
  .research-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
  .research-card-header { padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
  .research-card-title { font-size: 13px; font-weight: 600; color: var(--text); }
  .research-card-body { padding: 14px 16px; }
  .research-step { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text2); line-height: 1.6; }
  .research-step:last-child { border-bottom: none; }
  .step-num { width: 20px; height: 20px; border-radius: 50%; background: var(--accent-bg); color: var(--accent); font-family: var(--mono); font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .source-link { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); margin-top: 8px; font-size: 12px; color: var(--blue); cursor: pointer; transition: background 0.15s; text-decoration: none; }
  .source-link:hover { background: var(--bg3); }
  .source-domain { font-family: var(--mono); font-size: 10px; color: var(--text3); margin-left: auto; }

  /* HISTORY */
  .history-layout { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .history-scroll { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .history-item { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; cursor: pointer; transition: all 0.15s; }
  .history-item:hover { border-color: var(--border2); background: var(--bg3); }
  .history-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
  .history-type { font-size: 11px; font-weight: 600; font-family: var(--mono); }
  .history-time { font-size: 11px; color: var(--text3); margin-left: auto; }
  .history-preview { font-size: 12px; color: var(--text2); line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

  /* MISC */
  .loading-row { display: flex; align-items: center; gap: 8px; padding: 12px; color: var(--text3); font-size: 13px; }
  .spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
  @keyframes spin { to{transform:rotate(360deg)} }
  .chip { font-size: 11px; font-family: var(--mono); padding: 2px 7px; border-radius: 4px; background: var(--bg4); color: var(--text3); border: 1px solid var(--border); }
  .chip.accent { background: var(--accent-bg); color: var(--accent); border-color: rgba(0,212,170,0.2); }
  .lang-badge { font-family: var(--mono); font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; background: var(--bg4); color: var(--text2); border: 1px solid var(--border2); }
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const severityClass = s => ({ CRITICAL:"sev-critical", HIGH:"sev-high", MEDIUM:"sev-medium", LOW:"sev-low" }[s] || "sev-low");
const scoreColor    = s => s >= 8 ? "#00d4aa" : s >= 5 ? "#f59e0b" : "#ef4444";
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── ISSUE CARD ───────────────────────────────────────────────────────────────
function IssueCard({ issue }) {
  const [open, setOpen] = useState(issue.severity === "CRITICAL");
  return (
    <div className="issue-card">
      <div className="issue-header" onClick={() => setOpen(o => !o)}>
        <span className={`severity-badge ${severityClass(issue.severity)}`}>{issue.severity}</span>
        <span className="issue-title">{issue.title}</span>
        {issue.line && <span className="issue-line">L{issue.line}</span>}
        <span style={{ color:"var(--text3)", fontSize:11, marginLeft:8 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="issue-body">
          <p className="issue-desc">{issue.description}</p>
          {issue.fix && (
            <div className="issue-fix">
              <div className="fix-label">SUGGESTED FIX</div>
              <pre className="fix-code">{issue.fix}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── REVIEW PANEL ─────────────────────────────────────────────────────────────
function ReviewPanel({ onAnalyze }) {
  const [code, setCode]     = useState("");
  const [lang, setLang]     = useState("python");
  const [focus, setFocus]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await api.post("/api/review", { code, language: lang, focus: focus || undefined });
      setResult(data);
      onAnalyze?.({ code, lang, result: data });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const langs = ["python","javascript","typescript","go","java","rust","c++","ruby","php"];

  return (
    <div className="review-layout">
      {/* LEFT — editor */}
      <div className="code-pane">
        <div className="pane-toolbar">
          <select value={lang} onChange={e => setLang(e.target.value)}
            style={{ background:"var(--bg3)", border:"1px solid var(--border2)", color:"var(--text2)", borderRadius:6, padding:"3px 8px", fontFamily:"var(--mono)", fontSize:12, outline:"none", cursor:"pointer" }}>
            {langs.map(l => <option key={l}>{l}</option>)}
          </select>
          <select value={focus} onChange={e => setFocus(e.target.value)}
            style={{ background:"var(--bg3)", border:"1px solid var(--border2)", color:"var(--text2)", borderRadius:6, padding:"3px 8px", fontFamily:"var(--mono)", fontSize:12, outline:"none", cursor:"pointer" }}>
            <option value="">All issues</option>
            <option value="security">Security only</option>
            <option value="performance">Performance only</option>
            <option value="bugs">Bugs only</option>
          </select>
          <span className="lang-badge">{code.split("\n").length} lines</span>
          <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setCode(""); setResult(null); setError(null); }}>Clear</button>
            <button className="btn btn-primary btn-sm" onClick={handleAnalyze} disabled={loading || !code.trim()}>
              {loading ? <><span className="spinner" style={{width:11,height:11}} /> Analyzing…</> : "▶ Analyze"}
            </button>
          </div>
        </div>
        <textarea className="code-editor" value={code} onChange={e => setCode(e.target.value)}
          placeholder={`# Paste your ${lang} code here\n# DevPilot will detect bugs, security issues,\n# and suggest fixes using Amazon Nova 2 Lite`}
          spellCheck={false} />
      </div>

      {/* RIGHT — results */}
      <div className="results-pane">
        <div className="pane-toolbar">
          <span style={{ fontSize:12, color:"var(--text2)", fontWeight:500 }}>Analysis Results</span>
          {result && (
            <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
              <span className="chip accent">{result.issues?.length ?? 0} issues</span>
            </div>
          )}
        </div>
        <div className="results-scroll">
          {loading && <div className="loading-row"><span className="spinner" />Nova 2 Lite analyzing your code…</div>}

          {error && (
            <div className="error-banner">
              ⚠ {error}
              {error.includes("credentials") || error.includes("403") ? " — Check your AWS credentials in .env" : ""}
            </div>
          )}

          {!loading && !result && !error && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">No analysis yet</div>
              <div className="empty-sub">Paste code in the editor and click Analyze. Nova 2 Lite will return severity-ranked findings and suggested fixes.</div>
            </div>
          )}

          {result && (
            <>
              {/* Score */}
              <div className="score-card">
                <div className="score-ring" style={{ borderColor: scoreColor(result.score), color: scoreColor(result.score) }}>
                  {result.score}/10
                </div>
                <div>
                  <div className="score-title">Code Quality Score</div>
                  <div className="score-summary">{result.summary}</div>
                </div>
              </div>

              {/* Severity summary */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["CRITICAL","HIGH","MEDIUM","LOW"].map(s => {
                  const count = result.issues?.filter(i => i.severity === s).length ?? 0;
                  return count > 0 ? <span key={s} className={`severity-badge ${severityClass(s)}`}>{count} {s}</span> : null;
                })}
              </div>

              {/* Issues */}
              {result.issues?.map((issue, i) => <IssueCard key={i} issue={issue} />)}

              {/* Positives */}
              {result.positives?.length > 0 && (
                <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"12px 14px" }}>
                  <div style={{ fontSize:11, fontFamily:"var(--mono)", color:"var(--accent)", marginBottom:6, letterSpacing:"0.5px" }}>POSITIVES</div>
                  {result.positives.map((p, i) => <div key={i} style={{ fontSize:12, color:"var(--text2)", lineHeight:1.6, marginBottom:3 }}>✓ {p}</div>)}
                </div>
              )}

              {/* Refactored */}
              {result.refactored && (
                <div className="issue-fix">
                  <div className="fix-label">REFACTORED VERSION</div>
                  <pre className="fix-code">{result.refactored}</pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VOICE PANEL ──────────────────────────────────────────────────────────────
function VoicePanel({ context }) {
  const [messages, setMessages] = useState([
    { id: 1, role:"bot", text:"Hi! I'm DevPilot Voice. Ask me anything about your code by typing or using the mic. I'll explain it conversationally.", code:null, followUp:null }
  ]);
  const [input, setInput]     = useState("");
  const [recording, setRecording] = useState(false);
  const [loading, setLoading]   = useState(false);
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  // History for multi-turn context (last 6 turns)
  const historyRef = useRef([]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
    };
  }, []);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { id: Date.now(), role:"user", text, code:null, followUp:null };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);

    // Append to history
    historyRef.current = [...historyRef.current, { role:"user", content: text }].slice(-6);

    try {
      const data = await api.post("/api/voice", {
        message: text,
        code_context: context?.code?.slice(0, 3000) || null,
        history: historyRef.current,
      });

      const botMsg = { id: Date.now()+1, role:"bot", text: data.text, code: data.code || null, followUp: data.follow_up || null };
      setMessages(m => [...m, botMsg]);
      historyRef.current = [...historyRef.current, { role:"assistant", content: data.text }].slice(-6);
    } catch (e) {
      setMessages(m => [...m, { id:Date.now()+1, role:"bot", text:`⚠ Error: ${e.message}`, code:null, followUp:null }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (recording) {
      recognitionRef.current?.stop?.();
      setRecording(false);
      return;
    }

    if (!SpeechRecognition) {
      setMessages(m => [
        ...m,
        {
          id: Date.now(),
          role:"bot",
          text:"Voice input is not supported in this browser. Type your question instead or use Chrome.",
          code:null,
          followUp:null,
        }
      ]);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setRecording(true);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0]?.transcript || "")
        .join("")
        .trim();
      setInput(transcript);
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setMessages(m => [
          ...m,
          {
            id: Date.now(),
            role:"bot",
            text:`Voice input failed: ${event.error}. Check microphone permission and try again.`,
            code:null,
            followUp:null,
          }
        ]);
      }
      setRecording(false);
    };
    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };

    recognition.start();
  };

  return (
    <div className="voice-layout">
      <div className="chat-scroll" ref={scrollRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`msg ${msg.role}`}>
            <div className={`msg-avatar ${msg.role}`}>{msg.role === "user" ? "👤" : "🤖"}</div>
            <div style={{ flex:1 }}>
              <div className="msg-name">{msg.role === "user" ? "You" : "DevPilot Voice"}</div>
              <div className="msg-text">{msg.text}</div>
              {msg.code && <pre className="msg-code">{msg.code}</pre>}
              {msg.followUp && <div className="msg-follow-up">💬 {msg.followUp}</div>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg bot">
            <div className="msg-avatar bot">🤖</div>
            <div style={{ flex:1 }}>
              <div className="msg-name">DevPilot Voice</div>
              <div className="msg-text" style={{ color:"var(--text3)" }}><span className="spinner" style={{display:"inline-block",marginRight:8}} />Thinking…</div>
            </div>
          </div>
        )}
      </div>
      <div className="voice-controls">
        {context?.code && (
          <div style={{ fontSize:11, color:"var(--text3)", display:"flex", alignItems:"center", gap:6 }}>
            <span className="chip accent">Code context loaded</span>
            DevPilot can see your reviewed code
          </div>
        )}
        <div className="voice-input-row">
          <button className={`mic-btn ${recording ? "recording" : ""}`} onClick={toggleMic} title={recording ? "Stop" : "Voice input"}>
            {recording ? "⏹" : "🎙"}
          </button>
          <textarea className="text-input" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask about your code… (Enter to send)" rows={1} />
          <button className="btn btn-primary" onClick={() => sendMessage(input)} disabled={!input.trim() || loading}>Send</button>
        </div>
        <div className="voice-hint">Powered by Nova 2 Sonic · Aware of your code context · Multi-turn conversation</div>
      </div>
    </div>
  );
}

// ─── RESEARCH PANEL ───────────────────────────────────────────────────────────
function ResearchPanel() {
  const [query, setQuery]   = useState("");
  const [stack, setStack]   = useState("python");
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [steps, setSteps]     = useState([]);

  const handleResearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setResult(null); setError(null);

    // Animated "browsing" steps
    const browseSteps = ["Checking official documentation…", "Searching GitHub issues…", "Reading Stack Overflow…", "Synthesizing findings…"];
    setSteps([browseSteps[0]]);
    const stepTimers = browseSteps.slice(1).map((s, i) => setTimeout(() => setSteps(prev => [...prev, s]), (i+1)*700));

    try {
      const data = await api.post("/api/research", { query, stack });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      stepTimers.forEach(clearTimeout);
      setSteps([]);
      setLoading(false);
    }
  };

  const stacks = ["python","javascript","typescript","go","java","rust","react","node","django","fastapi","nextjs","postgres"];

  return (
    <div className="research-layout">
      <div className="research-input-zone">
        <textarea className="research-input" value={query} onChange={e => setQuery(e.target.value)}
          placeholder={"Describe your problem or error…\ne.g. 'How to prevent SQL injection in Python psycopg2?'"} />
        <div className="research-row">
          <select className="stack-select" value={stack} onChange={e => setStack(e.target.value)}>
            {stacks.map(s => <option key={s}>{s}</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleResearch} disabled={!query.trim() || loading} style={{ flexShrink:0 }}>
            {loading ? <><span className="spinner" style={{width:11,height:11}} /> Researching…</> : "🔎 Research"}
          </button>
        </div>
      </div>

      <div className="research-scroll">
        {loading && steps.map((s, i) => (
          <div key={i} className="loading-row" style={{ opacity: i === steps.length-1 ? 1 : 0.5 }}>
            <span className="spinner" />{s}
          </div>
        ))}

        {error && <div className="error-banner">⚠ {error}</div>}

        {!loading && !result && !error && (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <div className="empty-title">Nova Act will research for you</div>
            <div className="empty-sub">Describe your problem and the agent returns the best solution from official docs, GitHub, and Stack Overflow — with cited sources.</div>
          </div>
        )}

        {result && (
          <>
            {/* Solution */}
            <div className="research-card">
              <div className="research-card-header">
                <span style={{fontSize:14}}>✅</span>
                <span className="research-card-title">Solution</span>
                <span className="chip accent" style={{marginLeft:"auto"}}>verified</span>
              </div>
              <div className="research-card-body">
                <p style={{fontSize:13, color:"var(--text2)", lineHeight:1.7, marginBottom:10}}>{result.solution?.explanation}</p>
                {result.solution?.code && (
                  <pre className="fix-code" style={{background:"var(--bg)", border:"1px solid var(--border)", borderRadius:8, padding:14}}>{result.solution.code}</pre>
                )}
              </div>
            </div>

            {/* Steps */}
            {result.solution?.steps?.length > 0 && (
              <div className="research-card">
                <div className="research-card-header"><span style={{fontSize:14}}>🪜</span><span className="research-card-title">Steps to apply</span></div>
                <div className="research-card-body">
                  {result.solution.steps.map((s, i) => (
                    <div key={i} className="research-step">
                      <span className="step-num">{i+1}</span><span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings?.length > 0 && (
              <div className="research-card" style={{borderColor:"rgba(245,158,11,0.2)"}}>
                <div className="research-card-header" style={{background:"var(--amber-bg)"}}>
                  <span style={{fontSize:14}}>⚠️</span>
                  <span className="research-card-title" style={{color:"var(--amber)"}}>Gotchas</span>
                </div>
                <div className="research-card-body">
                  {result.warnings.map((w, i) => <div key={i} style={{fontSize:12, color:"var(--text2)", lineHeight:1.6, marginBottom:4}}>• {w}</div>)}
                </div>
              </div>
            )}

            {/* Sources */}
            {result.sources?.length > 0 && (
              <div className="research-card">
                <div className="research-card-header"><span style={{fontSize:14}}>🔗</span><span className="research-card-title">Sources</span></div>
                <div className="research-card-body">
                  {result.sources.map((s, i) => (
                    <a key={i} className="source-link" href={s.url} target="_blank" rel="noreferrer">
                      <span style={{fontSize:13}}>📄</span>
                      <span>{s.title}</span>
                      <span className="source-domain">{s.domain}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── HISTORY PANEL ────────────────────────────────────────────────────────────
function HistoryPanel({ history, onClear }) {
  if (!history.length) return (
    <div className="history-layout">
      <div className="pane-toolbar"><span style={{fontSize:12, color:"var(--text2)", fontWeight:500}}>Session History</span></div>
      <div className="empty-state"><div className="empty-icon">🕘</div><div className="empty-title">No history yet</div><div className="empty-sub">Your code reviews, voice chats, and research results will appear here.</div></div>
    </div>
  );

  return (
    <div className="history-layout">
      <div className="pane-toolbar">
        <span style={{fontSize:12, color:"var(--text2)", fontWeight:500}}>Session History</span>
        <span className="chip" style={{marginLeft:8}}>{history.length}</span>
        <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={onClear}>Clear All</button>
      </div>
      <div className="history-scroll">
        {[...history].reverse().map((item, i) => (
          <div key={i} className="history-item">
            <div className="history-meta">
              <span className="history-type" style={{color: item.type==="REVIEW" ? "var(--accent)" : item.type==="VOICE" ? "var(--blue)" : "var(--amber)"}}>{item.type}</span>
              <span className="history-time">{item.time}</span>
            </div>
            <div className="history-preview">{item.preview}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activePanel, setActivePanel] = useState("review");
  const [reviewContext, setReviewContext] = useState(null);
  const [history, setHistory]     = useState([]);
  const [apiStatus, setApiStatus] = useState("checking"); // checking | ok | error

  // Health check on mount
  useEffect(() => {
    api.get("/api/health")
      .then(data => setApiStatus(!data.mock_mode ? "ok" : "mock"))
      .catch(() => setApiStatus("error"));
  }, []);

  const addHistory = (type, preview) => {
    setHistory(h => [...h, { type, preview, time: now() }]);
  };

  const handleAnalyze = (ctx) => {
    setReviewContext(ctx);
    addHistory("REVIEW", `${ctx.lang} code — ${ctx.result?.issues?.length ?? 0} issues found${ctx.result?.issues?.find(i=>i.severity==="CRITICAL") ? " (CRITICAL detected)" : ""}`);
  };

  const navItems = [
    { id:"review",   icon:"🔍", label:"Code Review",  section:"WORKFLOW" },
    { id:"voice",    icon:"🎙", label:"Voice Debug",  section:null },
    { id:"research", icon:"📚", label:"Doc Research", section:null },
    { id:"history",  icon:"🕘", label:"History",      badge: history.length || null, section:"CONTEXT" },
  ];

  const panelInfo = {
    review:   { title:"Code Review",       sub:"Powered by Nova 2 Lite — bug detection, security analysis, severity-ranked fixes" },
    voice:    { title:"Voice Debugger",    sub:"Powered by Nova 2 Sonic — ask questions about your code by voice or text" },
    research: { title:"Doc Research Agent",sub:"Powered by Nova Act — autonomous search across official docs and Stack Overflow" },
    history:  { title:"Session History",   sub:"All reviews, voice sessions, and research from this session" },
  };

  const statusLabel = { ok:"Connected · Nova Live", mock:"Mock Mode · No AWS Creds", checking:"Connecting…", error:"Backend Offline" }[apiStatus];
  const dotClass    = { ok:"dot-green", mock:"dot-amber", checking:"dot-amber", error:"dot-red" }[apiStatus];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="logo"><div className="logo-dot" />devpilot</div>
          <span className="topbar-badge">AI</span>
          {apiStatus === "mock" && (
            <div className="warn-banner" style={{padding:"4px 10px", fontSize:11, marginLeft:8}}>
              ⚡ Mock mode — add AWS credentials to .env to use real Nova models
            </div>
          )}
          {apiStatus === "error" && (
            <div className="error-banner" style={{padding:"4px 10px", fontSize:11, marginLeft:8}}>
              ✗ Backend offline — run: uvicorn devpilot_main:app --reload --port 8000
            </div>
          )}
          <div className="topbar-right">
            <div className="status-pill" onClick={() => api.get("/api/health").then(d => setApiStatus(d.aws_configured ? "ok" : "mock")).catch(() => setApiStatus("error"))}>
              <div className={`status-dot ${dotClass}`} />{statusLabel}
            </div>
          </div>
        </header>

        {/* SIDEBAR */}
        <nav className="sidebar">
          {navItems.map(item => (
            <div key={item.id}>
              {item.section && <div className="nav-section">{item.section}</div>}
              <div className={`nav-item ${activePanel === item.id ? "active" : ""}`} onClick={() => setActivePanel(item.id)}>
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
              </div>
            </div>
          ))}
          <div className="sidebar-footer">
            <div style={{fontSize:11, color:"var(--text3)", padding:"0 10px", lineHeight:1.7}}>
              Amazon Nova AI<br />Hackathon 2026
            </div>
          </div>
        </nav>

        {/* MAIN */}
        <main className="main">
          <div className="panel-header">
            <div>
              <div className="panel-title">{panelInfo[activePanel].title}</div>
              <div className="panel-sub">{panelInfo[activePanel].sub}</div>
            </div>
          </div>
          {activePanel === "review"   && <ReviewPanel onAnalyze={handleAnalyze} />}
          {activePanel === "voice"    && <VoicePanel context={reviewContext} />}
          {activePanel === "research" && <ResearchPanel />}
          {activePanel === "history"  && <HistoryPanel history={history} onClear={() => setHistory([])} />}
        </main>
      </div>
    </>
  );
}
