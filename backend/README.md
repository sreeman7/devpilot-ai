# DevPilot AI

Hackathon MVP for an Amazon Nova-powered developer copilot.

## Frontend

The React frontend is already scaffolded in this repo:
- [src/App.jsx](/Users/sreeman/Documents/devpilot-ai/src/App.jsx)
- [src/styles.css](/Users/sreeman/Documents/devpilot-ai/src/styles.css)

Run it with:

```bash
cp .env.example .env
npm install
npm run dev
```

If your backend is not on `http://localhost:8000`, set `VITE_API_URL` in the root `.env`.

## Backend

The FastAPI backend is in:
- [backend/main.py](/Users/sreeman/Documents/devpilot-ai/backend/main.py)
- [backend/requirements.txt](/Users/sreeman/Documents/devpilot-ai/backend/requirements.txt)
- [backend/.env.example](/Users/sreeman/Documents/devpilot-ai/backend/.env.example)

Run it with:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## API

- `GET /api/health`
- `POST /api/review`
- `POST /api/voice`
- `POST /api/research`
- `POST /api/route`
- `POST /api/review/screenshot`

## Notes

- The backend automatically falls back to mock mode when AWS credentials are unavailable.
- The current voice endpoint uses a text-response layer for the hackathon MVP. It is shaped for Nova 2 Sonic integration, but not wired to streaming audio yet.
