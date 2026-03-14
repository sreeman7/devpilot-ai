# DevPilot AI 🚀

> AI developer copilot powered by Amazon Nova — code review, voice debugging, and autonomous doc research in one unified workflow.

**Amazon Nova AI Hackathon 2026**

## What It Does

DevPilot AI combines three Amazon Nova models into a single debugging workflow:

| Feature | Model | What it does |
|---|---|---|
| Code Review | Nova 2 Lite | Bug detection, security analysis, severity-ranked fixes |
| Voice Debugger | Nova 2 Sonic | Spoken Q&A about your code, conversational explanations |
| Doc Research | Nova Act | Autonomous search of official docs, GitHub, Stack Overflow |

## Project Structure
```
devpilot-ai/
├── backend/        # FastAPI + Amazon Bedrock
│   ├── main.py
│   └── requirements.txt
├── frontend/       # React UI
│   └── src/App.js
└── README.md
```

## How to Run

**Terminal 1 — Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm start
```

## Built With
- Amazon Nova 2 Lite — code reasoning and analysis
- Amazon Nova 2 Sonic — speech-to-speech voice interface
- Amazon Nova Act — autonomous doc browsing
- Amazon Bedrock — model hosting
- FastAPI — Python backend
- React — frontend
