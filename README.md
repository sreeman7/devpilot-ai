# DevPilot AI

AI developer copilot built for the Amazon Nova AI Hackathon 2026.

DevPilot AI combines Amazon Nova models with a FastAPI backend and a React frontend to review code, explain issues, research docs, translate code, inspect repositories, and analyze screenshots in one UI.

## What It Does

DevPilot AI uses Amazon Nova models for a multi-step debugging workflow:

| Area | Model | Purpose |
|---|---|---|
| Code Review | Nova 2 Lite | Severity-ranked code review, fixes, refactors |
| Voice Debug | Nova 2 Sonic | Conversational Q&A about the current code |
| Doc Research | Nova Act style workflow | Source-backed research and solution summaries |
| Translation | Nova 2 Lite | Cross-language code rewrites |
| Repo Review | Nova 2 Lite | File-by-file repo review with aggregate scoring |
| Screenshot Review | Nova 2 Lite Vision | IDE / UI / browser screenshot analysis |

## Features

### 1. Code Review Panel

The Code Review panel is the main workflow entry point. You paste code into the editor, select or auto-detect the language, and run a Nova-backed review.

Included review features:

- Severity-ranked findings with `CRITICAL`, `HIGH`, `MEDIUM`, and `LOW`
- Overall code quality score
- One-line summary of the code state
- Per-issue title, description, line number, and fix
- Positive observations section
- Full refactored version section
- Focus selector for security, performance, or bug-oriented reviews
- Auto language detection while typing or pasting
- Review history entry creation after each run

### 2. Apply Fix

Each issue card includes an `Apply Fix` button. Clicking it replaces the editor content with that issue's suggested fix and marks the issue as applied.

Related behavior:

- Green applied badge on the issue card
- Fix application toast message
- Fix acceptance is recorded in Fix History

### 3. Reject Fix

Each issue can also be rejected. Rejecting a fix does not change the editor code, but the decision is stored in Fix History for later review.

### 4. Copy Fix

Every fix block includes a `Copy` button with copied-state feedback so the suggested code can be copied without applying it.

### 5. Confidence Score

Every issue includes a confidence label and progress bar to show how strongly the system believes the issue is valid.

### 6. Issue Filters

The results pane includes filter buttons for:

- `ALL`
- `CRITICAL`
- `HIGH`
- `MEDIUM`
- `LOW`

This lets the user narrow the visible issues without rerunning the review.

### 7. Diff View

The review panel includes a `Diff` button that compares:

- original analyzed code
- updated editor code after applying a fix, or
- the model's full refactored version when no direct fix has been applied

This makes it possible to inspect what changed before keeping or exporting the result.

### 8. Apply All

The `Apply All` button applies the model's full refactored version to the editor and marks all issues as applied.

### 9. Export Report

The `Export` button downloads the current review as a Markdown report containing:

- language
- score
- summary
- issue list
- fixes
- positives
- refactored output

### 10. Share Review

The `Share` button sends the current review to the backend and creates a shareable link.

Share flow includes:

- backend persistence in `backend/shares/`
- unique 8-character share ID
- frontend share URL using `?share=<id>`
- raw API JSON share endpoint
- shared review loading directly into the UI

### 11. Save Session

Completed reviews are stored in browser localStorage so they can be reopened later.

Saved session behavior:

- stores code, language, result, and timestamp
- shows recent saved reviews in the review panel
- shows saved sessions in the History panel

### 12. Fix History

Fix History tracks every accepted and rejected fix across sessions.

Each entry stores:

- action
- issue title
- severity
- timestamp

### 13. Session History

The History panel tracks what happened during the current session, including review, voice, research, translation, repo, and screenshot actions.

### 14. Voice Debug Panel

The Voice Debug panel lets the user ask follow-up questions about the current code review.

Voice features include:

- text input
- browser speech-recognition mic input
- multi-turn history
- code-aware follow-up responses
- optional code snippets in answers

### 15. Doc Research Panel

The Research panel helps investigate bugs, errors, or implementation questions.

Research output includes:

- explanation
- code example
- steps to apply
- warnings / gotchas
- linked sources

### 16. Screenshot Analysis Panel

The Screenshot panel accepts image uploads or drag-and-drop screenshots from an IDE, browser, app UI, or terminal.

Screenshot output includes:

- detected screen type
- what the model sees
- context summary
- issue list
- suggestions

### 17. Language Translation Panel

The Translate panel rewrites code from one language to another.

Translation output includes:

- translated code
- key differences between languages
- migration notes
- copy support for translated code

### 18. Repo Review Panel

The Repo Review panel accepts a public GitHub repository URL and reviews up to 10 source files through the backend.

Repo review output includes:

- average score
- critical count
- high count
- files reviewed count
- per-file summaries
- top issues per file

### 19. Shared UI and UX Features

The app also includes a set of smaller but important workflow features:

- toast notifications for user actions
- copy-to-clipboard helpers
- share URL copy action
- loading indicators for all async flows
- mock mode support when AWS credentials are missing
- browser-tab and manifest branding
- responsive scroll handling for long result blocks and diffs

## Project Structure

```text
devpilot-ai/
├── backend/
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── public/
│   └── src/App.js
└── README.md
```

## Backend API

Implemented routes in [backend/main.py](/Users/sreeman/Documents/devpilot-ai/backend/main.py):

- `GET /api/health`
- `POST /api/review`
- `POST /api/voice`
- `POST /api/research`
- `POST /api/route`
- `POST /api/share`
- `GET /api/share/{share_id}`
- `POST /api/fix-history`
- `POST /api/translate`
- `POST /api/repo`
- `POST /api/review/screenshot`

## Frontend Panels

Implemented panels in [frontend/src/App.js](/Users/sreeman/Documents/devpilot-ai/frontend/src/App.js):

- Code Review
- Voice Debug
- Doc Research
- Translate
- Repo Review
- Screenshot
- Fix History
- History

## Setup

### Backend

```bash
cd backend
python3 -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Optional environment variables:

- `AWS_DEFAULT_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`
- `FRONTEND_BASE_URL`

If AWS credentials are missing, the backend falls back to mock mode for supported routes.

### Frontend

```bash
cd frontend
npm install
npm start
```

Optional frontend environment variable:

- `REACT_APP_API_URL`
- `REACT_APP_APP_URL`

## Tech Stack

- React
- FastAPI
- Amazon Bedrock
- Amazon Nova 2 Lite
- Amazon Nova 2 Sonic
- `httpx`
- `boto3`

## Notes

- Shared reviews are stored in `backend/shares/`.
- Repo review uses the GitHub API and supports an optional GitHub token.
- The backend includes extra JSON recovery and retry logic because model JSON output can be inconsistent.
- The app supports a frontend share URL and a raw backend JSON share endpoint.
