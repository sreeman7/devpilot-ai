import { useEffect, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

const navItems = [
  { id: "review", label: "Code Review", model: "Nova 2 Lite" },
  { id: "voice", label: "Voice Debug", model: "Nova 2 Sonic" },
  { id: "research", label: "Doc Research", model: "Nova Act" },
  { id: "history", label: "Workflow", model: "Session context" },
];

const severityClass = {
  CRITICAL: "severity-critical",
  HIGH: "severity-high",
  MEDIUM: "severity-medium",
  LOW: "severity-low",
};

const initialVoiceMessages = [
  {
    id: 1,
    role: "bot",
    text: "I can explain findings from the review panel, turn fixes into plain language, and guide the next debugging step.",
    code: null,
    followUp: null,
  },
];

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function IssueCard({ issue }) {
  const [isOpen, setIsOpen] = useState(issue.severity === "CRITICAL");

  return (
    <article className="issue-card">
      <button className="issue-header" onClick={() => setIsOpen((value) => !value)} type="button">
        <span className={`severity-pill ${severityClass[issue.severity]}`}>{issue.severity}</span>
        <span className="issue-title">{issue.title}</span>
        <span className="issue-line">L{issue.line ?? "?"}</span>
      </button>
      {isOpen ? (
        <div className="issue-body">
          <p>{issue.description}</p>
          {issue.fix ? (
            <div className="code-block">
              <div className="code-block-label">Suggested fix</div>
              <pre>{issue.fix}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ReviewPanel({ onAnalyze }) {
  const [language, setLanguage] = useState("python");
  const [focus, setFocus] = useState("");
  const [code, setCode] = useState(
    `def get_user(user_id):\n    query = "SELECT * FROM users WHERE id = " + user_id\n    cursor.execute(query)\n    return cursor.fetchone()["name"]`,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleAnalyze() {
    if (!code.trim()) {
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await apiRequest("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          focus: focus || undefined,
        }),
      });
      setResult(data);
      onAnalyze({ code, language, result: data });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="split-layout">
      <div className="panel-surface editor-panel">
        <div className="panel-toolbar">
          <select className="select" value={language} onChange={(event) => setLanguage(event.target.value)}>
            {["python", "javascript", "typescript", "go", "java", "rust"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="select" value={focus} onChange={(event) => setFocus(event.target.value)}>
            <option value="">All issues</option>
            <option value="security">Security</option>
            <option value="performance">Performance</option>
            <option value="bugs">Bugs</option>
          </select>
          <span className="small-chip">{code.split("\n").length} lines</span>
          <div className="toolbar-actions">
            <button
              className="button button-secondary"
              onClick={() => {
                setCode("");
                setResult(null);
                setError(null);
              }}
              type="button"
            >
              Clear
            </button>
            <button className="button button-primary" onClick={handleAnalyze} disabled={isLoading} type="button">
              {isLoading ? "Analyzing..." : "Run review"}
            </button>
          </div>
        </div>
        <textarea
          className="editor"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={`Paste ${language} code, a diff, or an error trace here.`}
        />
      </div>

      <div className="panel-surface result-panel">
        <div className="panel-toolbar">
          <span className="toolbar-label">Severity-ranked findings</span>
          {result ? <span className="small-chip accent">{result.issues?.length ?? 0} issues</span> : null}
        </div>
        <div className="scroll-area">
          {!result && !isLoading && !error ? (
            <div className="empty-state">
              <p className="empty-title">No review yet</p>
              <p className="empty-copy">
                This panel shows the hackathon story clearly: score, summary, critical findings, and exact fixes.
              </p>
            </div>
          ) : null}

          {isLoading ? <div className="loading-card">Nova 2 Lite is analyzing the code path, attack surface, and fix candidates.</div> : null}

          {error ? <div className="notice-card notice-error">{error}</div> : null}

          {result ? (
            <div className="review-results">
              <div className="score-card">
                <div className="score-ring">{result.score}/10</div>
                <div>
                  <h3>Code quality score</h3>
                  <p>{result.summary}</p>
                </div>
              </div>

              <div className="pill-row">
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => {
                  const count = result.issues?.filter((issue) => issue.severity === level).length ?? 0;
                  return count ? (
                    <span key={level} className={`severity-pill ${severityClass[level]}`}>
                      {count} {level}
                    </span>
                  ) : null;
                })}
              </div>

              {result.issues?.map((issue, index) => (
                <IssueCard key={`${issue.title}-${index}`} issue={issue} />
              ))}

              {result.positives?.length ? (
                <article className="info-card">
                  <h3>Positives</h3>
                  <ul className="plain-list">
                    {result.positives.map((positive) => (
                      <li key={positive}>{positive}</li>
                    ))}
                  </ul>
                </article>
              ) : null}

              {result.refactored ? (
                <div className="code-block">
                  <div className="code-block-label">Refactored version</div>
                  <pre>{result.refactored}</pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function VoicePanel({ reviewContext, onHistory }) {
  const [messages, setMessages] = useState(initialVoiceMessages);
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const listRef = useRef(null);
  const historyRef = useRef([]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  async function sendMessage(text) {
    if (!text.trim() || isLoading) {
      return;
    }

    const userMessage = { id: Date.now(), role: "user", text, code: null, followUp: null };
    setMessages((current) => [...current, userMessage]);
    setValue("");
    setIsLoading(true);
    historyRef.current = [...historyRef.current, { role: "user", content: text }].slice(-6);

    try {
      const data = await apiRequest("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          code_context: reviewContext?.code?.slice(0, 3000) || null,
          history: historyRef.current,
        }),
      });

      const botMessage = {
        id: Date.now() + 1,
        role: "bot",
        text: data.text,
        code: data.code || null,
        followUp: data.follow_up || null,
      };
      setMessages((current) => [...current, botMessage]);
      historyRef.current = [...historyRef.current, { role: "assistant", content: data.text }].slice(-6);
      onHistory(`Voice debug: ${text}`);
    } catch (requestError) {
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "bot", text: `Error: ${requestError.message}`, code: null, followUp: null },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleRecording() {
    const nextState = !isRecording;
    setIsRecording(nextState);
    if (!nextState) {
      sendMessage("Explain the most serious issue and the safest fix.");
      return;
    }
    setTimeout(() => {
      setIsRecording(false);
      setValue("Explain the most serious issue and the safest fix.");
    }, 1200);
  }

  return (
    <section className="stack-layout">
      <div className="panel-surface voice-surface">
        <div className="context-banner">
          <span className="small-chip accent">{reviewContext ? "Review context loaded" : "No code context yet"}</span>
          <p>{reviewContext ? "Voice mode can now explain the current findings in plain English." : "Run a code review first to make the voice demo more compelling."}</p>
        </div>

        <div className="chat-list" ref={listRef}>
          {messages.map((message) => (
            <div className={`chat-item ${message.role}`} key={message.id}>
              <div className="chat-role">{message.role === "user" ? "You" : "DevPilot Voice"}</div>
              <div className="chat-bubble">
                <p>{message.text}</p>
                {message.code ? (
                  <div className="code-block">
                    <div className="code-block-label">On-screen code</div>
                    <pre>{message.code}</pre>
                  </div>
                ) : null}
                {message.followUp ? <div className="follow-up-line">{message.followUp}</div> : null}
              </div>
            </div>
          ))}
          {isLoading ? <div className="loading-card">Nova 2 Sonic is drafting a concise spoken response.</div> : null}
        </div>

        <div className="voice-controls">
          <button className={`record-button ${isRecording ? "active" : ""}`} onClick={toggleRecording} type="button">
            {isRecording ? "Stop" : "Mic"}
          </button>
          <textarea
            className="message-input"
            rows={2}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage(value);
              }
            }}
            placeholder="Ask the assistant to explain a bug, trace a failure, or summarize a fix."
          />
          <button className="button button-primary" onClick={() => sendMessage(value)} disabled={isLoading} type="button">
            Send
          </button>
        </div>
      </div>
    </section>
  );
}

function ResearchPanel({ onHistory }) {
  const [query, setQuery] = useState("");
  const [stack, setStack] = useState("python");
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [steps, setSteps] = useState([]);

  async function handleResearch() {
    if (!query.trim()) {
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    const browseSteps = [
      "Checking official documentation...",
      "Searching GitHub issues...",
      "Reading trusted secondary sources...",
      "Synthesizing the best answer...",
    ];

    setSteps([browseSteps[0]]);
    const timers = browseSteps.slice(1).map((step, index) =>
      setTimeout(() => {
        setSteps((current) => [...current, step]);
      }, (index + 1) * 650),
    );

    try {
      const data = await apiRequest("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, stack }),
      });
      setResult(data);
      onHistory(`Research: ${query}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      timers.forEach(clearTimeout);
      setSteps([]);
      setIsLoading(false);
    }
  }

  return (
    <section className="stack-layout">
      <div className="panel-surface research-surface">
        <div className="research-hero">
          <h3>Research the fix before you trust it</h3>
          <p>This panel proves the workflow is grounded in sources, not only generated suggestions.</p>
        </div>

        <div className="research-controls">
          <textarea
            className="research-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Describe the bug, migration issue, or API confusion you want researched."
          />
          <div className="research-action-row">
            <select className="select" value={stack} onChange={(event) => setStack(event.target.value)}>
              {["python", "javascript", "typescript", "go", "java", "rust", "react", "node", "fastapi", "postgres"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button className="button button-primary" onClick={handleResearch} disabled={isLoading} type="button">
              {isLoading ? "Researching..." : "Run research"}
            </button>
          </div>
        </div>

        <div className="scroll-area">
          {isLoading
            ? steps.map((step) => (
                <div className="loading-card loading-step" key={step}>
                  {step}
                </div>
              ))
            : null}

          {error ? <div className="notice-card notice-error">{error}</div> : null}

          {!isLoading && !result && !error ? (
            <div className="empty-state">
              <p className="empty-title">No research result yet</p>
              <p className="empty-copy">Use this after review when a fix needs validation, migration guidance, or source-backed alternatives.</p>
            </div>
          ) : null}

          {result ? (
            <div className="research-results">
              <article className="info-card">
                <h3>Problem understood</h3>
                <p>{result.problem_understood}</p>
              </article>

              <article className="info-card">
                <h3>Recommended solution</h3>
                <p>{result.solution?.explanation}</p>
                {result.solution?.code ? (
                  <div className="code-block">
                    <div className="code-block-label">Reference implementation</div>
                    <pre>{result.solution.code}</pre>
                  </div>
                ) : null}
              </article>

              {result.solution?.steps?.length ? (
                <article className="info-card">
                  <h3>Steps to apply</h3>
                  <ol className="numbered-list">
                    {result.solution.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </article>
              ) : null}

              {result.warnings?.length ? (
                <article className="info-card warning-card">
                  <h3>Warnings</h3>
                  <ul className="plain-list">
                    {result.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </article>
              ) : null}

              {result.sources?.length ? (
                <article className="info-card">
                  <h3>Sources</h3>
                  <div className="source-list">
                    {result.sources.map((source) => (
                      <a className="source-item" href={source.url} key={source.url} target="_blank" rel="noreferrer">
                        <span>{source.title}</span>
                        <span className="source-label">{source.domain}</span>
                      </a>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function WorkflowPanel({ reviewContext, history }) {
  const items = [
    {
      title: "1. Review first",
      body: "Paste code or a diff, then surface the highest-severity issue and the exact fix candidate with Nova 2 Lite.",
    },
    {
      title: "2. Explain by voice",
      body: "Use Nova 2 Sonic to turn technical findings into a natural debugging conversation while preserving code context.",
    },
    {
      title: "3. Verify with sources",
      body: "Use Nova Act only when the fix requires external validation, migrations, or official documentation.",
    },
  ];

  return (
    <section className="stack-layout">
      <div className="panel-surface workflow-surface">
        <div className="workflow-grid">
          {items.map((item) => (
            <article className="workflow-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className="panel-divider" />

        <div className="context-summary">
          <h3>Current session</h3>
          <p>
            {reviewContext
              ? `Review ready for handoff in ${reviewContext.language}. The score is ${reviewContext.result.score}/10 with ${reviewContext.result.issues.length} issues surfaced.`
              : "No active review context yet. Start in Code Review to populate the workflow."}
          </p>
        </div>

        <div className="history-feed">
          <h3>Recent activity</h3>
          {history.length ? (
            <div className="history-list">
              {[...history].reverse().map((item, index) => (
                <article className="history-card" key={`${item.preview}-${index}`}>
                  <div className="history-card-header">
                    <span className="small-chip">{item.type}</span>
                    <span className="history-time">{item.time}</span>
                  </div>
                  <p>{item.preview}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="history-empty">No activity yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [activePanel, setActivePanel] = useState("review");
  const [reviewContext, setReviewContext] = useState(null);
  const [history, setHistory] = useState([]);
  const [apiStatus, setApiStatus] = useState("checking");

  useEffect(() => {
    apiRequest("/api/health")
      .then((data) => setApiStatus(data.mock_mode ? "mock" : "ok"))
      .catch(() => setApiStatus("error"));
  }, []);

  function addHistory(type, preview) {
    setHistory((current) => [...current, { type, preview, time: now() }]);
  }

  function handleAnalyze(context) {
    setReviewContext(context);
    addHistory(
      "REVIEW",
      `${context.language} code - ${context.result?.issues?.length ?? 0} issues found${context.result?.issues?.some((issue) => issue.severity === "CRITICAL") ? " (critical detected)" : ""}`,
    );
  }

  const headerText = {
    review: "Find the bug path fast",
    voice: "Turn fixes into conversation",
    research: "Ground answers in trusted sources",
    history: "Show the workflow, not isolated features",
  };

  const statusLabel = {
    ok: "Connected",
    mock: "Mock mode",
    checking: "Checking backend",
    error: "Backend offline",
  }[apiStatus];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-kicker">Amazon Nova Hackathon</p>
          <h1>DevPilot AI</h1>
          <p className="brand-copy">A developer copilot with one workflow: review, explain, verify.</p>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-button ${activePanel === item.id ? "active" : ""}`}
              onClick={() => setActivePanel(item.id)}
              type="button"
            >
              <span>{item.label}</span>
              <small>{item.model}</small>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>Backend: {statusLabel}</p>
          <p>API: {API_BASE_URL}</p>
        </div>
      </aside>

      <main className="main-shell">
        <header className="hero-header">
          <div>
            <p className="eyebrow">Frontend demo</p>
            <h2>{headerText[activePanel]}</h2>
          </div>
          <div className="status-row">
            <span className="status-pill">Nova 2 Lite</span>
            <span className="status-pill">Nova 2 Sonic</span>
            <span className="status-pill">Nova Act</span>
            <span className={`status-pill status-${apiStatus}`}>{statusLabel}</span>
          </div>
        </header>

        {apiStatus === "mock" ? (
          <div className="notice-card notice-warning">The backend is running in mock mode. Add AWS credentials to the backend environment to use real Nova responses.</div>
        ) : null}

        {apiStatus === "error" ? (
          <div className="notice-card notice-error">The frontend cannot reach the backend at {API_BASE_URL}. Start FastAPI on port 8000 or set `VITE_API_URL`.</div>
        ) : null}

        {activePanel === "review" ? <ReviewPanel onAnalyze={handleAnalyze} /> : null}
        {activePanel === "voice" ? <VoicePanel reviewContext={reviewContext} onHistory={(preview) => addHistory("VOICE", preview)} /> : null}
        {activePanel === "research" ? <ResearchPanel onHistory={(preview) => addHistory("RESEARCH", preview)} /> : null}
        {activePanel === "history" ? <WorkflowPanel reviewContext={reviewContext} history={history} /> : null}
      </main>
    </div>
  );
}
