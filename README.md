# Hiring Agent — Web Deployment

AI-powered resume scorer by HackerRank, wrapped with FastAPI + React for web deployment.

## Stack
- **Backend**: FastAPI (Python) — wraps the original HackerRank pipeline
- **Frontend**: React + Vite
- **LLM**: Google Gemini (user provides API key per-request)

## Deploy to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — just click **Deploy**
5. No env vars needed (Gemini key is passed per-request by the user)

## Local Development

```bash
# Backend
pip install -r requirements.txt
uvicorn api:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # runs on :5173, proxies /evaluate to :8000
```

## API

`POST /evaluate`
- `pdf`: PDF file (multipart)
- `gemini_api_key`: string
- `model`: gemini-2.0-flash | gemini-2.5-flash | gemini-2.5-pro
