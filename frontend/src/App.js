import { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";
const APP_BASE = process.env.REACT_APP_APP_URL || window.location.origin;
const api = {
  async post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    if (!res.ok) { const e = await res.json().catch(()=>({detail:res.statusText})); throw new Error(e.detail||`HTTP ${res.status}`); }
    return res.json();
  },
  async postForm(path, fd) {
    const res = await fetch(`${API_BASE}${path}`, { method:"POST", body:fd });
    if (!res.ok) { const e = await res.json().catch(()=>({detail:res.statusText})); throw new Error(e.detail||`HTTP ${res.status}`); }
    return res.json();
  },
  async get(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function detectLanguage(code) {
  if (!code.trim()) return "python";
  if (/def |import |print\(|:\s*$/.test(code)) return "python";
  if (/interface |: string|: number|tsx?/.test(code)) return "typescript";
  if (/async function|const |let |var |=>|require\(/.test(code)) return "javascript";
  if (/func |package main|:=/.test(code)) return "go";
  if (/public class|System\.out|void |import java/.test(code)) return "java";
  if (/fn |let mut|println!|use std/.test(code)) return "rust";
  return "python";
}
const SESSION_KEY = "devpilot_sessions";
const FIX_HIST_KEY = "devpilot_fix_history";
function loadSessions() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)||"[]"); } catch { return []; } }
function saveSessions(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s.slice(-20))); } catch {} }
function loadFixHistory() { try { return JSON.parse(localStorage.getItem(FIX_HIST_KEY)||"[]"); } catch { return []; } }
function saveFixHistory(h) { try { localStorage.setItem(FIX_HIST_KEY, JSON.stringify(h.slice(-100))); } catch {} }
function buildShareUrl(shareId) { return `${APP_BASE}?share=${shareId}`; }
function getShareIdFromLocation() {
  try { return new URLSearchParams(window.location.search).get("share"); } catch { return null; }
}
const severityClass = s => ({CRITICAL:"sev-critical",HIGH:"sev-high",MEDIUM:"sev-medium",LOW:"sev-low"}[s]||"sev-low");
const scoreColor = s => s >= 8 ? "#00d4aa" : s >= 5 ? "#f59e0b" : "#ef4444";
const now = () => new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const confidenceForSeverity = s => ({CRITICAL:96,HIGH:88,MEDIUM:74,LOW:61}[s]||70);
const confidenceColor = c => c >= 90 ? "#f87171" : c >= 75 ? "#fbbf24" : "#8b91a0";
function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = useCallback((id, text) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(id); setTimeout(()=>setCopied(null),1500); });
  }, []);
  return [copied, copy];
}
function exportMarkdown(code, lang, result) {
  const lines = [`# DevPilot AI Review\n**Language:** ${lang}  **Score:** ${result.score}/10  **Date:** ${new Date().toLocaleString()}`,`\n## Summary\n${result.summary}`,`\n## Issues (${result.issues?.length??0})`, ...(result.issues?.map(i=>`\n### [${i.severity}] ${i.title}\n${i.description}\n\`\`\`\n${i.fix}\n\`\`\``)??[]),`\n## Positives\n${result.positives?.map(p=>`- ${p}`).join("\n")??""}`,`\n## Refactored\n\`\`\`${lang}\n${result.refactored}\n\`\`\``];
  const a = Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/markdown"})),download:`devpilot-review-${Date.now()}.md`});
  a.click();
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#0a0c10;--bg2:#0f1218;--bg3:#151a22;--bg4:#1c2230;
    --border:rgba(255,255,255,0.07);--border2:rgba(255,255,255,0.12);
    --text:#e8eaf0;--text2:#8b91a0;--text3:#555d6e;
    --accent:#00d4aa;--accent2:#00a882;--accent-bg:rgba(0,212,170,0.08);
    --amber:#f59e0b;--amber-bg:rgba(245,158,11,0.08);
    --red:#ef4444;--red-bg:rgba(239,68,68,0.08);
    --blue:#60a5fa;--blue-bg:rgba(96,165,250,0.08);
    --green:#22c55e;--green-bg:rgba(34,197,94,0.08);
    --purple:#a78bfa;--purple-bg:rgba(167,139,250,0.08);
    --radius:10px;--radius-lg:16px;
    --mono:'JetBrains Mono',monospace;--sans:'DM Sans',sans-serif;
  }
  html,body,#root{height:100%;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;}
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:4px;}
  .app{display:grid;grid-template-columns:220px 1fr;grid-template-rows:52px 1fr;height:100vh;overflow:hidden;}
  .topbar{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:0 20px;background:var(--bg2);border-bottom:1px solid var(--border);z-index:10;}
  .logo{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:15px;font-weight:600;color:var(--accent);}
  .logo-dot{width:7px;height:7px;background:var(--accent);border-radius:50%;animation:pulse 2.4s ease-in-out infinite;}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.8)}}
  .topbar-badge{font-family:var(--mono);font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:var(--accent-bg);color:var(--accent);border:1px solid rgba(0,212,170,0.2);}
  .topbar-right{margin-left:auto;display:flex;align-items:center;gap:8px;}
  .status-pill{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text2);padding:4px 10px;border-radius:20px;background:var(--bg3);border:1px solid var(--border);cursor:pointer;transition:border-color 0.15s;}
  .status-pill:hover{border-color:var(--border2);}
  .status-dot{width:5px;height:5px;border-radius:50%;}
  .dot-green{background:var(--accent);}
  .dot-amber{background:var(--amber);animation:pulse 1.5s infinite;}
  .dot-red{background:var(--red);}
  .sidebar{background:var(--bg2);border-right:1px solid var(--border);padding:16px 10px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;}
  .nav-section{font-size:10px;font-weight:600;color:var(--text3);letter-spacing:1px;text-transform:uppercase;padding:8px 10px 4px;}
  .nav-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:var(--radius);font-size:13px;color:var(--text2);cursor:pointer;transition:all 0.15s;border:1px solid transparent;user-select:none;}
  .nav-item:hover{background:var(--bg3);color:var(--text);}
  .nav-item.active{background:var(--accent-bg);color:var(--accent);border-color:rgba(0,212,170,0.15);font-weight:500;}
  .nav-icon{font-size:15px;width:18px;text-align:center;flex-shrink:0;}
  .nav-badge{margin-left:auto;font-size:10px;font-family:var(--mono);background:var(--bg4);color:var(--text3);padding:1px 6px;border-radius:8px;}
  .nav-item.active .nav-badge{background:rgba(0,212,170,0.15);color:var(--accent);}
  .sidebar-footer{margin-top:auto;padding-top:12px;border-top:1px solid var(--border);}
  .main{overflow:hidden;display:flex;flex-direction:column;min-height:0;}
  .panel-header{padding:18px 24px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-shrink:0;}
  .panel-title{font-size:15px;font-weight:600;color:var(--text);}
  .panel-sub{font-size:12px;color:var(--text3);margin-top:1px;}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:var(--radius);font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;border:1px solid transparent;user-select:none;outline:none;}
  .btn-primary{background:var(--accent);color:#0a0c10;border-color:var(--accent);}
  .btn-primary:hover{background:var(--accent2);}
  .btn-primary:disabled{opacity:0.4;cursor:not-allowed;}
  .btn-ghost{background:transparent;color:var(--text2);border-color:var(--border2);}
  .btn-ghost:hover{background:var(--bg3);color:var(--text);}
  .btn-success{background:var(--green-bg);color:var(--green);border-color:rgba(34,197,94,0.2);}
  .btn-purple{background:var(--purple-bg);color:var(--purple);border-color:rgba(167,139,250,0.2);}
  .btn-sm{padding:4px 10px;font-size:12px;}
  .review-layout{display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden;min-height:0;}
  .code-pane{display:flex;flex-direction:column;border-right:1px solid var(--border);overflow:hidden;min-height:0;}
  .results-pane{display:flex;flex-direction:column;overflow:hidden;min-height:0;}
  .pane-toolbar{display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--bg2);border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap;}
  .code-editor{flex:1;padding:16px;resize:none;outline:none;border:none;background:var(--bg);color:var(--text);font-family:var(--mono);font-size:13px;line-height:1.7;overflow-y:auto;min-height:0;}
  .code-editor::placeholder{color:var(--text3);}
  .results-scroll{flex:1;overflow-y:auto;padding:16px 16px 28px;display:flex;flex-direction:column;gap:12px;min-height:0;scroll-padding-bottom:28px;}
  .issue-card{border-radius:var(--radius);border:1px solid var(--border);background:var(--bg2);overflow:visible;transition:border-color 0.15s;}
  .issue-card:hover{border-color:var(--border2);}
  .issue-card.applied{border-color:rgba(34,197,94,0.3);background:rgba(34,197,94,0.04);}
  .issue-header{display:flex;align-items:center;gap:8px;padding:12px 14px;min-height:46px;cursor:pointer;}
  .severity-badge{display:inline-flex;align-items:center;font-family:var(--mono);font-size:10px;font-weight:600;line-height:1.2;min-height:24px;padding:3px 9px;border-radius:4px;flex-shrink:0;}
  .sev-critical{background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.25);}
  .sev-high{background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.25);}
  .sev-medium{background:rgba(96,165,250,0.15);color:#93c5fd;border:1px solid rgba(96,165,250,0.25);}
  .sev-low{background:rgba(139,145,160,0.12);color:#8b91a0;border:1px solid rgba(139,145,160,0.2);}
  .issue-title{font-size:13px;font-weight:500;line-height:1.4;color:var(--text);flex:1;}
  .issue-line{font-family:var(--mono);font-size:11px;line-height:1.2;color:var(--text3);}
  .issue-body{padding:0 14px 16px;display:flex;flex-direction:column;gap:8px;overflow:visible;}
  .issue-desc{font-size:12px;color:var(--text2);line-height:1.6;}
  .issue-fix{background:var(--bg);border-radius:6px;border:1px solid var(--border);overflow:visible;min-height:0;}
  .fix-header{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--border);background:var(--bg2);}
  .fix-label{font-family:var(--mono);font-size:10px;color:var(--accent);letter-spacing:0.5px;}
  .fix-actions{display:flex;gap:4px;}
  .fix-code{font-family:var(--mono);font-size:12px;color:#a8d8b0;padding:10px;line-height:1.6;white-space:pre-wrap;overflow:auto;max-height:320px;}
  .confidence-bar{height:3px;border-radius:2px;margin-top:4px;transition:width 0.6s ease;}
  .confidence-label{font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:2px;}
  .score-card{border-radius:var(--radius);background:var(--bg2);border:1px solid var(--border);padding:14px 16px;display:flex;align-items:center;gap:14px;}
  .score-ring{width:52px;height:52px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:18px;font-weight:600;border:2px solid;}
  .score-title{font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px;}
  .score-summary{font-size:12px;color:var(--text2);line-height:1.6;}
  .diff-view{display:grid;grid-template-columns:1fr 1fr;gap:0;border-radius:6px;border:1px solid var(--border);overflow:hidden;min-height:0;}
  .diff-header{font-family:var(--mono);font-size:10px;padding:6px 10px;border-bottom:1px solid var(--border);letter-spacing:0.5px;}
  .diff-code{font-family:var(--mono);font-size:12px;padding:10px;line-height:1.7;white-space:pre-wrap;overflow:auto;max-height:320px;}
  .diff-old{background:rgba(239,68,68,0.06);color:#fca5a5;}
  .diff-new{background:rgba(34,197,94,0.06);color:#a8d8b0;border-left:1px solid var(--border);}
  .filter-bar{display:flex;gap:6px;flex-wrap:wrap;}
  .filter-btn{font-family:var(--mono);font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;transition:all 0.15s;}
  .filter-btn.active{border-color:var(--accent);color:var(--accent);background:var(--accent-bg);}
  .error-banner{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:var(--radius);background:var(--red-bg);border:1px solid rgba(239,68,68,0.25);font-size:12px;color:#f87171;line-height:1.6;}
  .warn-banner{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:var(--radius);background:var(--amber-bg);border:1px solid rgba(245,158,11,0.25);font-size:12px;color:#fbbf24;line-height:1.6;}
  .empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--text3);text-align:center;padding:40px;}
  .empty-icon{font-size:36px;opacity:0.4;}
  .empty-title{font-size:14px;font-weight:500;color:var(--text2);}
  .empty-sub{font-size:12px;line-height:1.6;max-width:260px;}
  .voice-layout{display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;}
  .chat-scroll{flex:1;overflow-y:auto;padding:20px 24px 28px;display:flex;flex-direction:column;gap:14px;scroll-padding-bottom:28px;}
  .msg{display:flex;gap:10px;animation:fadeUp 0.2s ease;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .msg-avatar{width:28px;height:28px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;margin-top:2px;}
  .msg-avatar.user{background:var(--bg4);}
  .msg-avatar.bot{background:var(--accent-bg);border:1px solid rgba(0,212,170,0.2);}
  .msg-name{font-size:11px;color:var(--text3);margin-bottom:4px;font-weight:500;}
  .msg-text{font-size:13px;line-height:1.7;color:var(--text);background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;display:inline-block;max-width:100%;}
  .msg.user .msg-text{background:var(--bg3);}
  .msg-code{font-family:var(--mono);font-size:12px;color:#a8d8b0;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:8px;white-space:pre-wrap;overflow-x:auto;line-height:1.6;}
  .msg-follow-up{font-size:11px;color:var(--text3);margin-top:6px;font-style:italic;}
  .voice-controls{padding:16px 24px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:10px;flex-shrink:0;}
  .voice-input-row{display:flex;gap:8px;align-items:flex-end;}
  .text-input{flex:1;background:var(--bg2);border:1px solid var(--border2);color:var(--text);border-radius:var(--radius);padding:9px 14px;font-family:var(--sans);font-size:13px;outline:none;resize:none;line-height:1.5;min-height:38px;max-height:100px;transition:border-color 0.15s;}
  .text-input:focus{border-color:var(--accent);}
  .text-input::placeholder{color:var(--text3);}
  .mic-btn{width:38px;height:38px;border-radius:var(--radius);border:1px solid var(--border2);background:var(--bg2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;flex-shrink:0;font-size:16px;}
  .mic-btn:hover{border-color:var(--accent);background:var(--accent-bg);}
  .mic-btn.recording{background:var(--red-bg);border-color:rgba(239,68,68,0.4);animation:micPulse 1s ease-in-out infinite;}
  @keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.3)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}
  .voice-hint{font-size:11px;color:var(--text3);text-align:center;}
  .research-layout{display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;}
  .research-input-zone{padding:20px 24px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:10px;flex-shrink:0;}
  .research-input{background:var(--bg2);border:1px solid var(--border2);color:var(--text);border-radius:var(--radius);padding:10px 14px;font-family:var(--sans);font-size:13px;outline:none;resize:none;line-height:1.6;min-height:72px;transition:border-color 0.15s;width:100%;}
  .research-input:focus{border-color:var(--accent);}
  .research-input::placeholder{color:var(--text3);}
  .research-row{display:flex;gap:8px;align-items:center;}
  .stack-select{flex:1;background:var(--bg2);border:1px solid var(--border2);color:var(--text);border-radius:var(--radius);padding:7px 12px;font-family:var(--sans);font-size:13px;outline:none;}
  .research-scroll{flex:1;overflow-y:auto;padding:20px 24px 28px;display:flex;flex-direction:column;gap:14px;scroll-padding-bottom:28px;}
  .research-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:visible;}
  .research-card-header{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;}
  .research-card-title{font-size:13px;font-weight:600;color:var(--text);}
  .research-card-body{padding:14px 16px 18px;overflow:visible;overflow-wrap:anywhere;}
  .research-step{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text2);line-height:1.6;}
  .research-step:last-child{border-bottom:none;}
  .step-num{width:20px;height:20px;border-radius:50%;background:var(--accent-bg);color:var(--accent);font-family:var(--mono);font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
  .source-link{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg);margin-top:8px;font-size:12px;color:var(--blue);cursor:pointer;transition:background 0.15s;text-decoration:none;}
  .source-link:hover{background:var(--bg3);}
  .source-domain{font-family:var(--mono);font-size:10px;color:var(--text3);margin-left:auto;}
  .history-layout{display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;}
  .history-scroll{flex:1;overflow-y:auto;padding:16px 16px 28px;display:flex;flex-direction:column;gap:10px;scroll-padding-bottom:28px;}
  .history-item{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;cursor:pointer;transition:all 0.15s;}
  .history-item:hover{border-color:var(--border2);background:var(--bg3);}
  .history-meta{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
  .history-type{font-size:11px;font-weight:600;font-family:var(--mono);}
  .history-time{font-size:11px;color:var(--text3);margin-left:auto;}
  .history-preview{font-size:12px;color:var(--text2);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
  .drop-zone{border:2px dashed var(--border2);border-radius:var(--radius-lg);padding:40px;text-align:center;cursor:pointer;transition:all 0.15s;}
  .drop-zone:hover,.drop-zone.drag-over{border-color:var(--accent);background:var(--accent-bg);}
  .loading-row{display:flex;align-items:center;gap:8px;padding:12px;color:var(--text3);font-size:13px;}
  .spinner{width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;}
  @keyframes spin{to{transform:rotate(360deg)}}
  .chip{font-size:11px;font-family:var(--mono);padding:2px 7px;border-radius:4px;background:var(--bg4);color:var(--text3);border:1px solid var(--border);}
  .chip.accent{background:var(--accent-bg);color:var(--accent);border-color:rgba(0,212,170,0.2);}
  .chip.green{background:var(--green-bg);color:var(--green);border-color:rgba(34,197,94,0.2);}
  .chip.red{background:var(--red-bg);color:var(--red);border-color:rgba(239,68,68,0.2);}
  .chip.purple{background:var(--purple-bg);color:var(--purple);border-color:rgba(167,139,250,0.2);}
  .lang-badge{font-family:var(--mono);font-size:11px;font-weight:500;padding:2px 8px;border-radius:4px;background:var(--bg4);color:var(--text2);border:1px solid var(--border2);}
  .toast{position:fixed;bottom:24px;right:24px;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px;font-size:13px;color:var(--text);z-index:1000;animation:fadeUp 0.2s ease;box-shadow:0 4px 24px rgba(0,0,0,0.4);}
  .share-box{background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 14px;display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--accent);}
  .share-url{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .repo-file-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;margin-bottom:8px;overflow:visible;}
  .repo-file-path{font-family:var(--mono);font-size:12px;color:var(--accent);margin-bottom:6px;}
  .repo-file-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;}
  .translate-layout{display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden;gap:0;min-height:0;}
`;

function Toast({ message, onDone }) {
  useEffect(()=>{const t=setTimeout(onDone,2000);return()=>clearTimeout(t);},[onDone]);
  return <div className="toast">{message}</div>;
}

function IssueCard({ issue, onApplyFix, applied, onFixHistoryAdd }) {
  const [open, setOpen] = useState(issue.severity==="CRITICAL");
  const [copied, copy] = useCopy();
  const conf = confidenceForSeverity(issue.severity);
  return (
    <div className={`issue-card ${applied?"applied":""}`}>
      <div className="issue-header" onClick={()=>setOpen(o=>!o)}>
        <span className={`severity-badge ${severityClass(issue.severity)}`}>{issue.severity}</span>
        <span className="issue-title">{issue.title}</span>
        {applied && <span className="chip green" style={{fontSize:10}}>✓ applied</span>}
        {issue.line && <span className="issue-line">L{issue.line}</span>}
        <span style={{color:"var(--text3)",fontSize:11,marginLeft:8}}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div className="issue-body">
          <div>
            <div className="confidence-label">Confidence: {conf}%</div>
            <div className="confidence-bar" style={{width:`${conf}%`,background:confidenceColor(conf)}}/>
          </div>
          <p className="issue-desc">{issue.description}</p>
          {issue.fix && (
            <div className="issue-fix">
              <div className="fix-header">
                <span className="fix-label">SUGGESTED FIX</span>
                <div className="fix-actions">
                  <button className="btn btn-ghost btn-sm" onClick={()=>copy(issue.id, issue.fix)}>{copied===issue.id?"✓ Copied":"Copy"}</button>
                  {!applied && <button className="btn btn-success btn-sm" onClick={()=>{onApplyFix(issue.fix);onFixHistoryAdd&&onFixHistoryAdd({action:"accepted",issue:issue.title,severity:issue.severity,time:now()});}}>Apply Fix</button>}
                  {!applied && <button className="btn btn-ghost btn-sm" onClick={()=>onFixHistoryAdd&&onFixHistoryAdd({action:"rejected",issue:issue.title,severity:issue.severity,time:now()})}>Reject</button>}
                </div>
              </div>
              <pre className="fix-code">{issue.fix}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── REVIEW PANEL ─────────────────────────────────────────────────────────────
function ReviewPanel({ onAnalyze, addHistory, sharedReview, sharedLoading, sharedError }) {
  const [code, setCode]         = useState("");
  const [lang, setLang]         = useState("python");
  const [focus, setFocus]       = useState("");
  const [filter, setFilter]     = useState("ALL");
  const [showDiff, setShowDiff] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [appliedFixes, setAppliedFixes] = useState(new Set());
  const [toast, setToast]       = useState(null);
  const [shareId, setShareId]   = useState(null);
  const [sharing, setSharing]   = useState(false);
  const [fixHistory, setFixHistory] = useState(loadFixHistory);
  const sessions = loadSessions();

  useEffect(() => {
    if (!sharedReview) return;
    setCode(sharedReview.code || "");
    setLang(sharedReview.language || detectLanguage(sharedReview.code || ""));
    setResult(sharedReview.result || null);
    setFixHistory(sharedReview.fix_history || []);
    setAppliedFixes(new Set());
    setError(null);
    setShowDiff(false);
    setShareId(sharedReview.id || null);
  }, [sharedReview]);

  const handleCodeChange = (val) => { setCode(val); setLang(detectLanguage(val)); };

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    setLoading(true); setResult(null); setError(null); setAppliedFixes(new Set()); setShowDiff(false); setShareId(null);
    try {
      const data = await api.post("/api/review", {code, language:lang, focus:focus||undefined});
      setResult(data);
      const s = loadSessions(); s.push({code,lang,result:data,time:new Date().toISOString()}); saveSessions(s);
      onAnalyze?.({code,lang,result:data});
      addHistory?.("REVIEW",`${lang} — ${data.issues?.length??0} issues${data.issues?.find(i=>i.severity==="CRITICAL")?" (CRITICAL)":""}`);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleApplyFix = (fix, issueId) => {
    setCode(fix);
    setAppliedFixes(s=>new Set([...s,issueId]));
    setToast("✓ Fix applied to editor");
  };

  const handleApplyAll = () => {
    if (result?.refactored) { setCode(result.refactored); setAppliedFixes(new Set(result.issues?.map((_,i)=>i)??[])); setToast("✓ All fixes applied"); }
  };

  const handleShare = async () => {
    if (!result) return;
    setSharing(true);
    try {
      const data = await api.post("/api/share", {code, language:lang, result, fix_history:fixHistory});
      setShareId(data.share_id);
      setToast("✓ Share link created!");
    } catch(e) { setToast(`⚠ Share failed: ${e.message}`); }
    finally { setSharing(false); }
  };

  const addFixHistory = (entry) => {
    const h = [...fixHistory, entry]; setFixHistory(h); saveFixHistory(h);
  };

  const filteredIssues = result?.issues?.filter(i=>filter==="ALL"||i.severity===filter)??[];
  const langs = ["python","javascript","typescript","go","java","rust","c++","ruby","php"];

  return (
    <div className="review-layout">
      {toast && <Toast message={toast} onDone={()=>setToast(null)}/>}
      <div className="code-pane">
        <div className="pane-toolbar">
          <select value={lang} onChange={e=>setLang(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border2)",color:"var(--text2)",borderRadius:6,padding:"3px 8px",fontFamily:"var(--mono)",fontSize:12,outline:"none",cursor:"pointer"}}>
            {langs.map(l=><option key={l}>{l}</option>)}
          </select>
          <select value={focus} onChange={e=>setFocus(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border2)",color:"var(--text2)",borderRadius:6,padding:"3px 8px",fontFamily:"var(--mono)",fontSize:12,outline:"none",cursor:"pointer"}}>
            <option value="">All issues</option>
            <option value="security">Security</option>
            <option value="performance">Performance</option>
            <option value="bugs">Bugs</option>
          </select>
          <span className="lang-badge">{code.split("\n").length} lines</span>
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>{setCode("");setResult(null);setError(null);setShareId(null);}}>Clear</button>
            <button className="btn btn-primary btn-sm" onClick={handleAnalyze} disabled={loading||!code.trim()}>
              {loading?<><span className="spinner" style={{width:11,height:11}}/>Analyzing…</>:"▶ Analyze"}
            </button>
          </div>
        </div>
        {sessions.length>0 && !code && (
          <div style={{padding:"8px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:"var(--text3)"}}>Recent:</span>
            {sessions.slice(-3).reverse().map((s,i)=>(
              <button key={i} className="btn btn-ghost btn-sm" onClick={()=>{setCode(s.code);setLang(s.lang);setResult(s.result);}}>
                {s.lang} · {new Date(s.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
              </button>
            ))}
          </div>
        )}
        <textarea className="code-editor" value={code} onChange={e=>handleCodeChange(e.target.value)}
          placeholder={`# Paste your code here\n# Language auto-detects on paste\n# Nova 2 Lite finds bugs, security issues,\n# and suggests fixes with confidence scores`}
          spellCheck={false}/>
      </div>

      <div className="results-pane">
        <div className="pane-toolbar">
          <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>Analysis Results</span>
          {result && (
            <>
              <div className="filter-bar" style={{marginLeft:8}}>
                {["ALL","CRITICAL","HIGH","MEDIUM","LOW"].map(f=>(
                  <button key={f} className={`filter-btn ${filter===f?"active":""}`} onClick={()=>setFilter(f)}>{f}</button>
                ))}
              </div>
              <div style={{marginLeft:"auto",display:"flex",gap:6,flexWrap:"wrap"}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>setShowDiff(d=>!d)}>{showDiff?"Hide Diff":"Diff"}</button>
                <button className="btn btn-ghost btn-sm" onClick={handleApplyAll}>Apply All</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>exportMarkdown(code,lang,result)}>Export</button>
                <button className="btn btn-purple btn-sm" onClick={handleShare} disabled={sharing}>{sharing?"Sharing…":"🔗 Share"}</button>
              </div>
            </>
          )}
        </div>

        <div className="results-scroll">
          {loading && <div className="loading-row"><span className="spinner"/>Nova 2 Lite analyzing…</div>}
          {error && <div className="error-banner">⚠ {error}</div>}
          {sharedLoading && <div className="loading-row"><span className="spinner"/>Loading shared review…</div>}
          {!sharedLoading && sharedError && <div className="error-banner">⚠ {sharedError}</div>}
          {!loading && !result && !error && !sharedLoading && !sharedError && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">No analysis yet</div>
              <div className="empty-sub">Paste code and click Analyze. Language auto-detects. Confidence scores on every issue.</div>
            </div>
          )}
          {result && (
            <>
              <div className="score-card">
                <div className="score-ring" style={{borderColor:scoreColor(result.score),color:scoreColor(result.score)}}>{result.score}/10</div>
                <div><div className="score-title">Code Quality Score</div><div className="score-summary">{result.summary}</div></div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["CRITICAL","HIGH","MEDIUM","LOW"].map(s=>{
                  const c=result.issues?.filter(i=>i.severity===s).length??0;
                  return c>0?<span key={s} className={`severity-badge ${severityClass(s)}`}>{c} {s}</span>:null;
                })}
                {appliedFixes.size>0 && <span className="chip green">{appliedFixes.size} fixed</span>}
              </div>
              {shareId && (
                <div className="share-box">
                  <span style={{fontSize:13}}>🔗</span>
                  <span className="share-url">{buildShareUrl(shareId)}</span>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{navigator.clipboard.writeText(buildShareUrl(shareId));setToast("✓ URL copied!");}}>Copy URL</button>
                </div>
              )}
              {showDiff && result.refactored && (
                <div className="diff-view">
                  <div><div className="diff-header" style={{background:"rgba(239,68,68,0.1)",color:"#f87171"}}>− Original</div><pre className="diff-code diff-old">{code}</pre></div>
                  <div><div className="diff-header" style={{background:"rgba(34,197,94,0.1)",color:"#4ade80"}}>+ Refactored</div><pre className="diff-code diff-new">{result.refactored}</pre></div>
                </div>
              )}
              {filteredIssues.map((issue,i)=>(
                <IssueCard key={i} issue={{...issue,id:i}} applied={appliedFixes.has(i)}
                  onApplyFix={fix=>handleApplyFix(fix,i)} onFixHistoryAdd={addFixHistory}/>
              ))}
              {filteredIssues.length===0 && filter!=="ALL" && (
                <div style={{textAlign:"center",color:"var(--text3)",fontSize:13,padding:20}}>No {filter} issues found</div>
              )}
              {result.positives?.length>0 && (
                <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"12px 14px"}}>
                  <div style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--accent)",marginBottom:6}}>POSITIVES</div>
                  {result.positives.map((p,i)=><div key={i} style={{fontSize:12,color:"var(--text2)",lineHeight:1.6,marginBottom:3}}>✓ {p}</div>)}
                </div>
              )}
              {result.refactored && (
                <div className="issue-fix">
                  <div className="fix-header">
                    <span className="fix-label">FULL REFACTORED VERSION</span>
                    <div className="fix-actions">
                      <button className="btn btn-ghost btn-sm" onClick={()=>navigator.clipboard.writeText(result.refactored)}>Copy</button>
                      <button className="btn btn-success btn-sm" onClick={()=>{setCode(result.refactored);setToast("✓ Refactored code applied");}}>Apply</button>
                    </div>
                  </div>
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
  const [messages, setMessages] = useState([{id:1,role:"bot",text:"Hi! Ask me anything about your code by typing or voice.",code:null,followUp:null}]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const historyRef = useRef([]);

  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},[messages]);

  const sendMessage = async (text) => {
    if (!text.trim()||loading) return;
    setMessages(m=>[...m,{id:Date.now(),role:"user",text,code:null,followUp:null}]);
    setInput(""); setLoading(true);
    historyRef.current=[...historyRef.current,{role:"user",content:text}].slice(-6);
    try {
      const data = await api.post("/api/voice",{message:text,code_context:context?.code?.slice(0,3000)||null,history:historyRef.current});
      setMessages(m=>[...m,{id:Date.now()+1,role:"bot",text:data.text,code:(data.code&&data.code!=="null")?data.code:null,followUp:data.follow_up||null}]);
      historyRef.current=[...historyRef.current,{role:"assistant",content:data.text}].slice(-6);
    } catch(e) { setMessages(m=>[...m,{id:Date.now()+1,role:"bot",text:`⚠ ${e.message}`,code:null,followUp:null}]); }
    finally { setLoading(false); }
  };

  const toggleMic = () => {
    if (!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){alert("Use Chrome for voice input.");return;}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const r=new SR(); r.lang='en-US'; r.interimResults=false;
    setRecording(true); r.start();
    r.onresult=e=>{setRecording(false);sendMessage(e.results[0][0].transcript);};
    r.onerror=()=>setRecording(false); r.onend=()=>setRecording(false);
  };

  return (
    <div className="voice-layout">
      <div className="chat-scroll" ref={scrollRef}>
        {messages.map(msg=>(
          <div key={msg.id} className={`msg ${msg.role}`}>
            <div className={`msg-avatar ${msg.role}`}>{msg.role==="user"?"👤":"🤖"}</div>
            <div style={{flex:1}}>
              <div className="msg-name">{msg.role==="user"?"You":"DevPilot Voice"}</div>
              <div className="msg-text">{msg.text}</div>
              {msg.code && msg.code !== "null" && <pre className="msg-code">{msg.code}</pre>}
              {msg.followUp && <div className="msg-follow-up">💬 {msg.followUp}</div>}
            </div>
          </div>
        ))}
        {loading && <div className="msg bot"><div className="msg-avatar bot">🤖</div><div style={{flex:1}}><div className="msg-name">DevPilot Voice</div><div className="msg-text" style={{color:"var(--text3)"}}><span className="spinner" style={{display:"inline-block",marginRight:8}}/>Thinking…</div></div></div>}
      </div>
      <div className="voice-controls">
        {context?.code && <div style={{fontSize:11,color:"var(--text3)",display:"flex",alignItems:"center",gap:6}}><span className="chip accent">Code context loaded</span>DevPilot can see your reviewed code</div>}
        <div className="voice-input-row">
          <button className={`mic-btn ${recording?"recording":""}`} onClick={toggleMic}>{recording?"⏹":"🎙"}</button>
          <textarea className="text-input" value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(input);}}}
            placeholder="Ask about your code… (Enter to send)" rows={1}/>
          <button className="btn btn-primary" onClick={()=>sendMessage(input)} disabled={!input.trim()||loading}>Send</button>
        </div>
        <div className="voice-hint">Powered by Nova 2 Sonic · Multi-turn · Code-aware</div>
      </div>
    </div>
  );
}

// ─── RESEARCH PANEL ───────────────────────────────────────────────────────────
function ResearchPanel({ addHistory }) {
  const [query, setQuery] = useState("");
  const [stack, setStack] = useState("python");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [steps, setSteps] = useState([]);
  const [copied, copy] = useCopy();

  const handleResearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setResult(null); setError(null);
    const browseSteps=["Checking official docs…","Searching GitHub issues…","Reading Stack Overflow…","Synthesizing…"];
    setSteps([browseSteps[0]]);
    const timers=browseSteps.slice(1).map((s,i)=>setTimeout(()=>setSteps(p=>[...p,s]),(i+1)*700));
    try {
      const data = await api.post("/api/research",{query,stack});
      setResult(data); addHistory?.("RESEARCH",`${stack} — ${query.slice(0,60)}`);
    } catch(e){setError(e.message);}
    finally{timers.forEach(clearTimeout);setSteps([]);setLoading(false);}
  };

  const stacks=["python","javascript","typescript","go","java","rust","react","node","django","fastapi","nextjs","postgres"];
  return (
    <div className="research-layout">
      <div className="research-input-zone">
        <textarea className="research-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder={"Describe your problem…\ne.g. 'How to prevent SQL injection in Python?'"}/>
        <div className="research-row">
          <select className="stack-select" value={stack} onChange={e=>setStack(e.target.value)}>{stacks.map(s=><option key={s}>{s}</option>)}</select>
          <button className="btn btn-primary" onClick={handleResearch} disabled={!query.trim()||loading} style={{flexShrink:0}}>
            {loading?<><span className="spinner" style={{width:11,height:11}}/>Researching…</>:"🔎 Research"}
          </button>
        </div>
      </div>
      <div className="research-scroll">
        {loading && steps.map((s,i)=><div key={i} className="loading-row" style={{opacity:i===steps.length-1?1:0.5}}><span className="spinner"/>{s}</div>)}
        {error && <div className="error-banner">⚠ {error}</div>}
        {!loading && !result && !error && <div className="empty-state"><div className="empty-icon">📚</div><div className="empty-title">Nova Act will research for you</div><div className="empty-sub">Describe your problem for authoritative solutions with sources.</div></div>}
        {result && (
          <>
            <div className="research-card">
              <div className="research-card-header"><span style={{fontSize:14}}>✅</span><span className="research-card-title">Solution</span><span className="chip accent" style={{marginLeft:"auto"}}>verified</span></div>
              <div className="research-card-body">
                <p style={{fontSize:13,color:"var(--text2)",lineHeight:1.7,marginBottom:10}}>{result.solution?.explanation}</p>
                {result.solution?.code && <div className="issue-fix"><div className="fix-header"><span className="fix-label">CODE</span><button className="btn btn-ghost btn-sm" onClick={()=>copy("sol",result.solution.code)}>{copied==="sol"?"✓ Copied":"Copy"}</button></div><pre className="fix-code">{result.solution.code}</pre></div>}
              </div>
            </div>
            {result.solution?.steps?.length>0 && <div className="research-card"><div className="research-card-header"><span style={{fontSize:14}}>🪜</span><span className="research-card-title">Steps</span></div><div className="research-card-body">{result.solution.steps.map((s,i)=><div key={i} className="research-step"><span className="step-num">{i+1}</span><span>{s}</span></div>)}</div></div>}
            {result.warnings?.length>0 && <div className="research-card" style={{borderColor:"rgba(245,158,11,0.2)"}}><div className="research-card-header" style={{background:"var(--amber-bg)"}}><span style={{fontSize:14}}>⚠️</span><span className="research-card-title" style={{color:"var(--amber)"}}>Gotchas</span></div><div className="research-card-body">{result.warnings.map((w,i)=><div key={i} style={{fontSize:12,color:"var(--text2)",lineHeight:1.6,marginBottom:4}}>• {w}</div>)}</div></div>}
            {result.sources?.length>0 && <div className="research-card"><div className="research-card-header"><span style={{fontSize:14}}>🔗</span><span className="research-card-title">Sources</span></div><div className="research-card-body">{result.sources.map((s,i)=><a key={i} className="source-link" href={s.url} target="_blank" rel="noreferrer"><span style={{fontSize:13}}>📄</span><span>{s.title}</span><span className="source-domain">{s.domain}</span></a>)}</div></div>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── FEATURE 11: MULTI-LANGUAGE TRANSLATION ──────────────────────────────────
function TranslatePanel({ addHistory }) {
  const [code, setCode]       = useState("");
  const [fromLang, setFromLang] = useState("python");
  const [toLang, setToLang]   = useState("typescript");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [copied, copy]        = useCopy();
  const langs = ["python","javascript","typescript","go","java","rust","c++","ruby","php","swift","kotlin"];

  const handleTranslate = async () => {
    if (!code.trim()) return;
    if (fromLang===toLang) { setError("Source and target language must differ"); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await api.post("/api/translate",{code,from_lang:fromLang,to_lang:toLang});
      setResult(data); addHistory?.("TRANSLATE",`${fromLang} → ${toLang}`);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="translate-layout">
      {/* LEFT — input */}
      <div className="code-pane">
        <div className="pane-toolbar">
          <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>Source</span>
          <select value={fromLang} onChange={e=>setFromLang(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border2)",color:"var(--text2)",borderRadius:6,padding:"3px 8px",fontFamily:"var(--mono)",fontSize:12,outline:"none",cursor:"pointer"}}>
            {langs.map(l=><option key={l}>{l}</option>)}
          </select>
          <span style={{color:"var(--text3)"}}>→</span>
          <select value={toLang} onChange={e=>setToLang(e.target.value)} style={{background:"var(--bg3)",border:"1px solid var(--border2)",color:"var(--accent)",borderRadius:6,padding:"3px 8px",fontFamily:"var(--mono)",fontSize:12,outline:"none",cursor:"pointer"}}>
            {langs.map(l=><option key={l}>{l}</option>)}
          </select>
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>{setCode("");setResult(null);}}>Clear</button>
            <button className="btn btn-primary btn-sm" onClick={handleTranslate} disabled={loading||!code.trim()}>
              {loading?<><span className="spinner" style={{width:11,height:11}}/>Translating…</>:"⟹ Translate"}
            </button>
          </div>
        </div>
        <textarea className="code-editor" value={code} onChange={e=>setCode(e.target.value)}
          placeholder={`# Paste your ${fromLang} code here\n# Nova 2 Lite will rewrite it in ${toLang}\n# preserving all logic and using idiomatic patterns`}
          spellCheck={false}/>
      </div>

      {/* RIGHT — output */}
      <div className="results-pane">
        <div className="pane-toolbar">
          <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>Translated to {toLang}</span>
          {result && <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={()=>copy("trans",result.translated_code)}>{copied==="trans"?"✓ Copied":"Copy"}</button>}
        </div>
        <div className="results-scroll">
          {loading && <div className="loading-row"><span className="spinner"/>Nova 2 Lite translating to {toLang}…</div>}
          {error && <div className="error-banner">⚠ {error}</div>}
          {!loading && !result && !error && (
            <div className="empty-state">
              <div className="empty-icon">⟹</div>
              <div className="empty-title">Multi-language translation</div>
              <div className="empty-sub">Paste code on the left and select a target language. Nova rewrites it using idiomatic patterns.</div>
            </div>
          )}
          {result && (
            <>
              <div className="issue-fix">
                <div className="fix-header">
                  <span className="fix-label">{toLang.toUpperCase()} OUTPUT</span>
                  <button className="btn btn-ghost btn-sm" onClick={()=>copy("trans",result.translated_code)}>{copied==="trans"?"✓ Copied":"Copy"}</button>
                </div>
                <pre className="fix-code">{result.translated_code}</pre>
              </div>
              {result.key_differences?.length>0 && (
                <div className="research-card">
                  <div className="research-card-header"><span style={{fontSize:14}}>🔄</span><span className="research-card-title">Key differences</span></div>
                  <div className="research-card-body">
                    {result.key_differences.map((d,i)=><div key={i} style={{fontSize:12,color:"var(--text2)",lineHeight:1.6,marginBottom:4,display:"flex",gap:8}}><span style={{color:"var(--accent)"}}>→</span>{d}</div>)}
                  </div>
                </div>
              )}
              {result.notes && (
                <div className="warn-banner" style={{borderRadius:"var(--radius-lg)"}}>
                  📝 {result.notes}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FEATURE 12: REPO REVIEW ──────────────────────────────────────────────────
function RepoPanel({ addHistory }) {
  const [url, setUrl]         = useState("");
  const [token, setToken]     = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [steps, setSteps]     = useState([]);

  const handleReview = async () => {
    if (!url.trim()) return;
    setLoading(true); setResult(null); setError(null);
    const reviewSteps=["Fetching repo file tree…","Reading source files…","Analyzing with Nova 2 Lite…","Aggregating results…"];
    setSteps([reviewSteps[0]]);
    const timers=reviewSteps.slice(1).map((s,i)=>setTimeout(()=>setSteps(p=>[...p,s]),(i+1)*1200));
    try {
      const data = await api.post("/api/repo",{repo_url:url,github_token:token||undefined});
      setResult(data); addHistory?.("REPO",`${data.repo} — ${data.files_reviewed} files reviewed`);
    } catch(e) { setError(e.message); }
    finally { timers.forEach(clearTimeout); setSteps([]); setLoading(false); }
  };

  return (
    <div className="research-layout">
      <div className="research-input-zone">
        <div style={{display:"flex",gap:8}}>
          <input value={url} onChange={e=>setUrl(e.target.value)}
            style={{flex:1,background:"var(--bg2)",border:"1px solid var(--border2)",color:"var(--text)",borderRadius:"var(--radius)",padding:"9px 14px",fontFamily:"var(--sans)",fontSize:13,outline:"none"}}
            placeholder="https://github.com/owner/repo"/>
          <button className="btn btn-primary" onClick={handleReview} disabled={!url.trim()||loading} style={{flexShrink:0}}>
            {loading?<><span className="spinner" style={{width:11,height:11}}/>Reviewing…</>:"🔍 Review Repo"}
          </button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input value={token} onChange={e=>setToken(e.target.value)}
            style={{flex:1,background:"var(--bg2)",border:"1px solid var(--border2)",color:"var(--text2)",borderRadius:"var(--radius)",padding:"7px 14px",fontFamily:"var(--mono)",fontSize:12,outline:"none"}}
            placeholder="GitHub token (optional — for private repos or rate limits)" type="password"/>
        </div>
        <div style={{fontSize:11,color:"var(--text3)"}}>Reviews up to 10 source files · Supports Python, JS, TS, Go, Java, Rust, and more</div>
      </div>

      <div className="research-scroll">
        {loading && steps.map((s,i)=><div key={i} className="loading-row" style={{opacity:i===steps.length-1?1:0.5}}><span className="spinner"/>{s}</div>)}
        {error && <div className="error-banner">⚠ {error}</div>}
        {!loading && !result && !error && (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-title">Repo-level code review</div>
            <div className="empty-sub">Paste a GitHub URL and Nova 2 Lite reviews every source file, then gives you an aggregate report.</div>
          </div>
        )}
        {result && (
          <>
            {/* Summary card */}
            <div className="research-card">
              <div className="research-card-header">
                <span style={{fontSize:14}}>📦</span>
                <span className="research-card-title">{result.repo}</span>
                <span className="chip accent" style={{marginLeft:"auto"}}>{result.files_reviewed} files</span>
              </div>
              <div className="research-card-body">
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:24,fontWeight:600,fontFamily:"var(--mono)",color:scoreColor(result.avg_score)}}>{result.avg_score}/10</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>avg score</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:24,fontWeight:600,fontFamily:"var(--mono)",color:"#f87171"}}>{result.total_critical}</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>critical</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:24,fontWeight:600,fontFamily:"var(--mono)",color:"#fbbf24"}}>{result.total_high}</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>high</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:24,fontWeight:600,fontFamily:"var(--mono)",color:"var(--text2)"}}>{result.files_reviewed}</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>files</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Per-file results */}
            {result.files?.map((f,i)=>(
              <div key={i} className="repo-file-card">
                <div className="repo-file-path">{f.path}</div>
                <div className="repo-file-meta">
                  <span className="lang-badge">{f.language}</span>
                  {f.score && <span className="chip" style={{color:scoreColor(f.score)}}>{f.score}/10</span>}
                  {f.critical_count>0 && <span className="chip red">{f.critical_count} CRITICAL</span>}
                  {f.high_count>0 && <span className="chip" style={{background:"rgba(245,158,11,0.1)",color:"#fbbf24",borderColor:"rgba(245,158,11,0.2)"}}>{f.high_count} HIGH</span>}
                  <span style={{fontSize:12,color:"var(--text2)",marginLeft:4,flex:1}}>{f.summary}</span>
                </div>
                {f.issues?.slice(0,2).map((issue,j)=>(
                  <div key={j} style={{marginTop:8,padding:"6px 8px",background:"var(--bg)",borderRadius:6,border:"1px solid var(--border)"}}>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
                      <span className={`severity-badge ${severityClass(issue.severity)}`} style={{fontSize:9}}>{issue.severity}</span>
                      <span style={{fontSize:12,color:"var(--text)"}}>{issue.title}</span>
                      {issue.line && <span style={{fontSize:10,color:"var(--text3)",fontFamily:"var(--mono)"}}>L{issue.line}</span>}
                    </div>
                    {issue.fix && <pre style={{fontFamily:"var(--mono)",fontSize:11,color:"#a8d8b0",padding:"4px 6px",background:"var(--bg2)",borderRadius:4,whiteSpace:"pre-wrap"}}>{issue.fix}</pre>}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── FEATURE 10: FIX HISTORY PANEL ────────────────────────────────────────────
function FixHistoryPanel() {
  const [history, setHistory] = useState(loadFixHistory);
  const accepted = history.filter(h=>h.action==="accepted");
  const rejected = history.filter(h=>h.action==="rejected");

  return (
    <div className="history-layout">
      <div className="pane-toolbar">
        <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>Fix History</span>
        <span className="chip green" style={{marginLeft:8}}>{accepted.length} accepted</span>
        <span className="chip red" style={{marginLeft:4}}>{rejected.length} rejected</span>
        <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={()=>{setHistory([]);saveFixHistory([]);}}>Clear</button>
      </div>
      <div className="history-scroll">
        {history.length===0 && <div className="empty-state"><div className="empty-icon">🔧</div><div className="empty-title">No fix history yet</div><div className="empty-sub">Accept or reject fixes in the Code Review panel to track your decisions here.</div></div>}
        {[...history].reverse().map((item,i)=>(
          <div key={i} className="history-item">
            <div className="history-meta">
              <span className="history-type" style={{color:item.action==="accepted"?"var(--green)":"var(--red)"}}>{item.action==="accepted"?"✓ ACCEPTED":"✗ REJECTED"}</span>
              <span className={`severity-badge ${severityClass(item.severity)}`} style={{fontSize:9}}>{item.severity}</span>
              <span className="history-time">{item.time}</span>
            </div>
            <div className="history-preview">{item.issue}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SCREENSHOT PANEL ─────────────────────────────────────────────────────────
function ScreenshotPanel({ addHistory }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = async (file) => {
    if (!file||!file.type.startsWith("image/")) return;
    setPreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setLoading(true); setResult(null); setError(null);
    const fd = new FormData(); fd.append("file",file);
    try {
      const data = await api.postForm("/api/review/screenshot",fd);
      setResult(data); addHistory?.("SCREENSHOT",`${data.screen_type} — ${data.issues?.length??0} issues`);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="research-layout">
      <div className="research-input-zone">
        <div className={`drop-zone ${dragOver?"drag-over":""}`} onClick={()=>inputRef.current?.click()}
          onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0]);}}>
          <div style={{fontSize:32,marginBottom:10}}>📸</div>
          <div style={{fontSize:13,color:"var(--text2)",marginBottom:4}}>Drop a screenshot or click to upload</div>
          <div style={{fontSize:11,color:"var(--text3)"}}>IDE, browser, terminal, app UI — PNG, JPG, WEBP</div>
          <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
        </div>
        {preview && <img src={preview} alt="preview" style={{maxHeight:120,borderRadius:8,border:"1px solid var(--border)",objectFit:"cover"}}/>}
      </div>
      <div className="research-scroll">
        {loading && <div className="loading-row"><span className="spinner"/>Nova analyzing screenshot…</div>}
        {error && <div className="error-banner">⚠ {error}</div>}
        {!loading && !result && !error && <div className="empty-state"><div className="empty-icon">📸</div><div className="empty-title">Screenshot analysis</div><div className="empty-sub">Upload a screenshot of your IDE, browser DevTools, or app UI.</div></div>}
        {result && (
          <>
            <div className="research-card"><div className="research-card-header"><span style={{fontSize:14}}>🖥</span><span className="research-card-title">{result.screen_type}</span><span className="chip accent" style={{marginLeft:"auto"}}>analyzed</span></div><div className="research-card-body"><p style={{fontSize:13,color:"var(--text2)",lineHeight:1.7,marginBottom:8}}>{result.what_i_see}</p><p style={{fontSize:12,color:"var(--text3)",lineHeight:1.6}}>{result.context}</p></div></div>
            {result.issues?.length>0 && <div className="research-card"><div className="research-card-header"><span style={{fontSize:14}}>🔍</span><span className="research-card-title">Issues</span></div><div className="research-card-body">{result.issues.map((issue,i)=><div key={i} style={{borderBottom:"1px solid var(--border)",paddingBottom:10,marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><span className="chip" style={{fontSize:10}}>{issue.type}</span><span style={{fontSize:13,fontWeight:500,color:"var(--text)"}}>{issue.description}</span></div><div style={{fontSize:12,color:"var(--accent)"}}>{issue.recommendation}</div></div>)}</div></div>}
            {result.suggestions?.length>0 && <div className="research-card"><div className="research-card-header"><span style={{fontSize:14}}>💡</span><span className="research-card-title">Suggestions</span></div><div className="research-card-body">{result.suggestions.map((s,i)=><div key={i} style={{fontSize:12,color:"var(--text2)",lineHeight:1.6,marginBottom:4}}>• {s}</div>)}</div></div>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── HISTORY PANEL ────────────────────────────────────────────────────────────
function HistoryPanel({ history, onClear }) {
  const saved = loadSessions();
  if (!history.length&&!saved.length) return <div className="history-layout"><div className="pane-toolbar"><span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>Session History</span></div><div className="empty-state"><div className="empty-icon">🕘</div><div className="empty-title">No history yet</div></div></div>;
  return (
    <div className="history-layout">
      <div className="pane-toolbar">
        <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>Session History</span>
        <span className="chip" style={{marginLeft:8}}>{history.length}</span>
        <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={()=>{onClear();localStorage.removeItem(SESSION_KEY);}}>Clear All</button>
      </div>
      <div className="history-scroll">
        {[...history].reverse().map((item,i)=>(
          <div key={i} className="history-item">
            <div className="history-meta">
              <span className="history-type" style={{color:{REVIEW:"var(--accent)",VOICE:"var(--blue)",RESEARCH:"var(--amber)",SCREENSHOT:"var(--green)",TRANSLATE:"var(--purple)",REPO:"var(--blue)"}[item.type]||"var(--text2)"}}>{item.type}</span>
              <span className="history-time">{item.time}</span>
            </div>
            <div className="history-preview">{item.preview}</div>
          </div>
        ))}
        {saved.length>0 && (
          <>
            <div style={{fontSize:11,color:"var(--text3)",padding:"12px 4px 8px",fontWeight:600,letterSpacing:"0.5px"}}>SAVED SESSIONS</div>
            {[...saved].reverse().map((s,i)=><div key={i} className="history-item"><div className="history-meta"><span className="history-type" style={{color:"var(--accent)"}}>REVIEW</span><span className="history-time">{new Date(s.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span></div><div className="history-preview">{s.lang} · Score {s.result?.score}/10 · {s.result?.issues?.length??0} issues</div></div>)}
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activePanel, setActivePanel] = useState("review");
  const [reviewContext, setReviewContext] = useState(null);
  const [history, setHistory] = useState([]);
  const [apiStatus, setApiStatus] = useState("checking");
  const [sharedReview, setSharedReview] = useState(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState(null);

  useEffect(()=>{
    api.get("/api/health").then(d=>setApiStatus(!d.mock_mode?"ok":"mock")).catch(()=>setApiStatus("error"));
  },[]);

  useEffect(() => {
    const shareId = getShareIdFromLocation();
    if (!shareId) return;

    setActivePanel("review");
    setSharedLoading(true);
    setSharedError(null);

    api.get(`/api/share/${shareId}`)
      .then(data => setSharedReview(data))
      .catch(err => setSharedError(err.message || "Failed to load shared review"))
      .finally(() => setSharedLoading(false));
  }, []);

  const addHistory = (type, preview) => setHistory(h=>[...h,{type,preview,time:now()}]);
  const handleAnalyze = (ctx) => setReviewContext(ctx);

  const navItems = [
    {id:"review",    icon:"🔍",label:"Code Review",  section:"WORKFLOW"},
    {id:"voice",     icon:"🎙",label:"Voice Debug",  section:null},
    {id:"research",  icon:"📚",label:"Doc Research", section:null},
    {id:"translate", icon:"⟹", label:"Translate",    section:null},
    {id:"repo",      icon:"📦",label:"Repo Review",  section:null},
    {id:"screenshot",icon:"📸",label:"Screenshot",   section:null},
    {id:"fixhistory",icon:"🔧",label:"Fix History",  section:"CONTEXT"},
    {id:"history",   icon:"🕘",label:"History",      badge:history.length||null,section:null},
  ];

  const panelInfo = {
    review:    {title:"Code Review",          sub:"Nova 2 Lite — bugs, security, confidence scores, diff view, share, export"},
    voice:     {title:"Voice Debugger",       sub:"Nova 2 Sonic — conversational code Q&A with multi-turn context"},
    research:  {title:"Doc Research Agent",   sub:"Nova Act — autonomous search across official docs and Stack Overflow"},
    translate: {title:"Language Translation", sub:"Nova 2 Lite — rewrite code in any language with idiomatic patterns"},
    repo:      {title:"Repo Review",          sub:"Nova 2 Lite — review all source files in a GitHub repository"},
    screenshot:{title:"Screenshot Analysis",  sub:"Nova 2 Lite Vision — analyze IDE screenshots, errors, and UI issues"},
    fixhistory:{title:"Fix History",          sub:"Track every fix you accepted or rejected across all sessions"},
    history:   {title:"Session History",      sub:"All reviews, voice sessions, research, and saved sessions"},
  };

  const statusLabel={ok:"Connected · Nova Live",mock:"Mock Mode",checking:"Connecting…",error:"Backend Offline"}[apiStatus];
  const dotClass={ok:"dot-green",mock:"dot-amber",checking:"dot-amber",error:"dot-red"}[apiStatus];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="topbar">
          <div className="logo"><div className="logo-dot"/>devpilot</div>
          <span className="topbar-badge">AI</span>
          {apiStatus==="mock"&&<div className="warn-banner" style={{padding:"4px 10px",fontSize:11,marginLeft:8}}>⚡ Mock mode — add AWS credentials to .env</div>}
          {apiStatus==="error"&&<div className="error-banner" style={{padding:"4px 10px",fontSize:11,marginLeft:8}}>✗ Backend offline</div>}
          <div className="topbar-right">
            <div className="status-pill" onClick={()=>api.get("/api/health").then(d=>setApiStatus(!d.mock_mode?"ok":"mock")).catch(()=>setApiStatus("error"))}>
              <div className={`status-dot ${dotClass}`}/>{statusLabel}
            </div>
          </div>
        </header>

        <nav className="sidebar">
          {navItems.map(item=>(
            <div key={item.id}>
              {item.section&&<div className="nav-section">{item.section}</div>}
              <div className={`nav-item ${activePanel===item.id?"active":""}`} onClick={()=>setActivePanel(item.id)}>
                <span className="nav-icon">{item.icon}</span>{item.label}
                {item.badge?<span className="nav-badge">{item.badge}</span>:null}
              </div>
            </div>
          ))}
          <div className="sidebar-footer">
            <div style={{fontSize:11,color:"var(--text3)",padding:"0 10px",lineHeight:1.7}}>Amazon Nova AI<br/>Hackathon 2026</div>
          </div>
        </nav>

        <main className="main">
          <div className="panel-header">
            <div><div className="panel-title">{panelInfo[activePanel].title}</div><div className="panel-sub">{panelInfo[activePanel].sub}</div></div>
          </div>
          {activePanel==="review"     && <ReviewPanel onAnalyze={handleAnalyze} addHistory={addHistory} sharedReview={sharedReview} sharedLoading={sharedLoading} sharedError={sharedError}/>}
          {activePanel==="voice"      && <VoicePanel context={reviewContext}/>}
          {activePanel==="research"   && <ResearchPanel addHistory={addHistory}/>}
          {activePanel==="translate"  && <TranslatePanel addHistory={addHistory}/>}
          {activePanel==="repo"       && <RepoPanel addHistory={addHistory}/>}
          {activePanel==="screenshot" && <ScreenshotPanel addHistory={addHistory}/>}
          {activePanel==="fixhistory" && <FixHistoryPanel/>}
          {activePanel==="history"    && <HistoryPanel history={history} onClear={()=>setHistory([])}/>}
        </main>
      </div>
    </>
  );
}
