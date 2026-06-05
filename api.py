"""
FastAPI wrapper for the Hiring Agent pipeline.
Accepts PDF + Gemini API key, returns evaluation JSON.
"""

import os
import sys
import json
import tempfile
import logging
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Hiring Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/evaluate")
async def evaluate_resume(
    pdf: UploadFile = File(...),
    gemini_api_key: str = Form(...),
    model: str = Form("gemini-2.0-flash"),
):
    if not pdf.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Write uploaded PDF to a temp file
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(await pdf.read())
        tmp_path = tmp.name

    try:
        # Set env vars for this request
        os.environ["LLM_PROVIDER"] = "gemini"
        os.environ["DEFAULT_MODEL"] = model
        os.environ["GEMINI_API_KEY"] = gemini_api_key
        os.environ["DEVELOPMENT_MODE"] = "False"

        # Reload modules that cache env vars at import time
        import importlib
        import prompt as prompt_mod
        importlib.reload(prompt_mod)

        from pdf import PDFHandler
        from github import fetch_and_display_github_info
        from evaluator import ResumeEvaluator
        from transform import (
            convert_json_resume_to_text,
            convert_github_data_to_text,
        )

        # 1. Extract resume data from PDF
        pdf_handler = PDFHandler()
        resume_data = pdf_handler.extract_json_from_pdf(tmp_path)
        if resume_data is None:
            raise HTTPException(status_code=422, detail="Could not parse PDF resume.")

        # 2. Fetch GitHub data if profile found
        github_data = {}
        profiles = []
        if resume_data.basics and resume_data.basics.profiles:
            profiles = resume_data.basics.profiles or []
        github_profile = next(
            (p for p in profiles if p.network and p.network.lower() == "github"), None
        )
        if github_profile:
            try:
                github_data = fetch_and_display_github_info(github_profile.url)
            except Exception as e:
                logger.warning(f"GitHub fetch failed: {e}")

        # 3. Evaluate
        from prompt import DEFAULT_MODEL, MODEL_PARAMETERS
        model_params = MODEL_PARAMETERS.get(DEFAULT_MODEL)
        evaluator = ResumeEvaluator(model_name=DEFAULT_MODEL, model_params=model_params)

        resume_text = convert_json_resume_to_text(resume_data)
        if github_data:
            resume_text += convert_github_data_to_text(github_data)

        evaluation = evaluator.evaluate_resume(resume_text)

        if evaluation is None:
            raise HTTPException(status_code=500, detail="Evaluation returned no data.")

        # 4. Build response
        candidate_name = ""
        if resume_data.basics and resume_data.basics.name:
            candidate_name = resume_data.basics.name

        def safe_dict(obj):
            if obj is None:
                return {}
            if hasattr(obj, "model_dump"):
                return obj.model_dump()
            return dict(obj)

        scores_raw = safe_dict(evaluation.scores) if hasattr(evaluation, "scores") else {}

        total = 0
        max_total = 0
        scores_out = {}
        for cat, data in scores_raw.items():
            score = min(data.get("score", 0), data.get("max", 0))
            total += score
            max_total += data.get("max", 0)
            scores_out[cat] = {
                "score": score,
                "max": data.get("max", 0),
                "evidence": data.get("evidence", ""),
            }

        bonus = 0
        bonus_breakdown = ""
        if hasattr(evaluation, "bonus_points") and evaluation.bonus_points:
            bonus = evaluation.bonus_points.total or 0
            bonus_breakdown = evaluation.bonus_points.breakdown or ""
        total += bonus

        deductions = 0
        deduction_reasons = ""
        if hasattr(evaluation, "deductions") and evaluation.deductions:
            deductions = evaluation.deductions.total or 0
            deduction_reasons = evaluation.deductions.reasons or ""
        total -= deductions

        strengths = []
        if hasattr(evaluation, "key_strengths"):
            strengths = evaluation.key_strengths or []

        improvements = []
        if hasattr(evaluation, "areas_for_improvement"):
            improvements = evaluation.areas_for_improvement or []

        hire_rec = getattr(evaluation, "hire_recommendation", "Maybe")
        summary = getattr(evaluation, "summary", "")

        return {
            "candidate_name": candidate_name,
            "total_score": round(total, 1),
            "max_score": max_total,
            "scores": scores_out,
            "bonus_points": {"total": bonus, "breakdown": bonus_breakdown},
            "deductions": {"total": deductions, "reasons": deduction_reasons},
            "key_strengths": strengths,
            "areas_for_improvement": improvements,
            "hire_recommendation": hire_rec,
            "summary": summary,
            "github_found": bool(github_profile),
        }

    finally:
        os.unlink(tmp_path)


# Serve React frontend (built files)
frontend_dir = Path(__file__).parent / "frontend" / "dist"
if frontend_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dir / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        index = frontend_dir / "index.html"
        return FileResponse(str(index))
