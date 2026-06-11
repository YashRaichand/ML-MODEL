import os
import re
import json
import tempfile
import logging
from pathlib import Path

import fitz  # PyMuPDF
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import google.generativeai as genai

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Hiring Agent API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

PROMPT = """You are an expert technical recruiter. Evaluate this resume and return ONLY valid JSON, no markdown, no explanation.

SCORING:
- open_source: max 35 pts (GitHub contributions, PRs, open source work)
- self_projects: max 30 pts (personal projects, complexity, impact)
- production: max 25 pts (internships, jobs, deployed products)
- technical_skills: max 10 pts (breadth and depth of tech stack)
- bonus_points: 0-20 (exceptional work, patents, top competitions)
- deductions: 0-20 (red flags: job hopping, gaps, inflated claims)

RESUME:
{resume_text}

Return ONLY this JSON:
{{
  "candidate_name": "string",
  "scores": {{
    "open_source": {{"score": 0, "max": 35, "evidence": "string"}},
    "self_projects": {{"score": 0, "max": 30, "evidence": "string"}},
    "production": {{"score": 0, "max": 25, "evidence": "string"}},
    "technical_skills": {{"score": 0, "max": 10, "evidence": "string"}}
  }},
  "bonus_points": {{"total": 0, "breakdown": "string"}},
  "deductions": {{"total": 0, "reasons": "string"}},
  "key_strengths": ["string", "string", "string"],
  "areas_for_improvement": ["string", "string"],
  "hire_recommendation": "Strong Hire",
  "summary": "2-3 sentence honest summary"
}}"""


def extract_text_from_pdf(path: str) -> str:
    doc = fitz.open(path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text[:8000]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/evaluate")
async def evaluate_resume(
    pdf: UploadFile = File(...),
    gemini_api_key: str = Form(...),
    model: str = Form("gemini-1.5-flash"),
):
    if not pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files supported.")

    # Save PDF to temp file
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(await pdf.read())
        tmp_path = tmp.name

    try:
        # Extract text
        resume_text = extract_text_from_pdf(tmp_path)
        if len(resume_text.strip()) < 50:
            raise HTTPException(status_code=422, detail="Could not extract text from PDF.")

        # Call Gemini
        genai.configure(api_key=gemini_api_key)
        gemini_model = genai.GenerativeModel(model)
        response = gemini_model.generate_content(PROMPT.format(resume_text=resume_text))
        raw = response.text.strip()

        # Strip markdown fences if present
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        raw = raw.strip()

        result = json.loads(raw)

        # Calculate total
        scores = result.get("scores", {})
        total = sum(min(v.get("score", 0), v.get("max", 0)) for v in scores.values())
        max_total = sum(v.get("max", 0) for v in scores.values())
        total += result.get("bonus_points", {}).get("total", 0)
        total -= result.get("deductions", {}).get("total", 0)

        result["total_score"] = round(max(0, total), 1)
        result["max_score"] = max_total
        result["github_found"] = False
        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e} | raw: {raw[:300]}")
        raise HTTPException(status_code=500, detail=f"AI returned invalid JSON: {str(e)}")
    except Exception as e:
        logger.error(f"Evaluation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


# Serve React frontend
frontend_dir = Path(__file__).parent / "frontend" / "dist"
if frontend_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dir / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(str(frontend_dir / "index.html"))