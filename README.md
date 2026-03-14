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

### Core workflow

1. Code Review
   Paste code and get a structured review with score, findings, positives, and a refactored version.

2. Voice Debug
   Ask follow-up questions about the reviewed code by text or browser mic input.

3. Doc Research
   Enter a bug or problem statement and get a researched solution with warnings and sources.

4. Screenshot Analysis
   Upload or drag-drop a screenshot and get visual issue detection plus suggestions.

### Review productivity features

5. Apply Fix
   Apply an issue's fix directly into the editor.

6. Copy Fix
   Copy any suggested fix with one click.

7. Confidence Score
   Each review issue shows a confidence bar based on severity.

8. Auto Language Detection
   Detects common languages from pasted code.

9. Issue Filter
   Filter review findings by `ALL`, `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`.

10. Diff View
    Compare original code and refactored output side by side.

11. Export Report
    Export a review as a Markdown report.

12. Share Review
    Create a share link for a review and reopen it in the frontend with `?share=<id>`.

### Session and history features

13. Save Session
    Reviews are stored in localStorage and can be reopened later.

14. Fix History
    Accepted and rejected fixes are tracked with timestamps and severity.

15. Session History
    Voice, research, translation, repo, screenshot, and review actions are tracked in the UI.

### Advanced panels

16. Language Translation
    Translate code between languages with translated output, differences, and notes.

17. Repo Review
    Review a public GitHub repo, fetch up to 10 source files, and show aggregate findings.

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
