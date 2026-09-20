from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from .agent import run_portfolio_agent
from .database import healthcheck, list_portfolio, migrate, save_assessment
from .models import AssessmentInput


@asynccontextmanager
async def lifespan(_: FastAPI):
    await migrate()
    yield


app = FastAPI(title="Application Portfolio Rationalizer", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
async def api_health():
    await healthcheck()
    return {"status": "ok"}


@app.get("/api/portfolio")
async def api_portfolio():
    return {"applications": await list_portfolio()}


@app.post("/api/agent/analyze")
async def api_analyze(assessment: AssessmentInput):
    try:
        return run_portfolio_agent(assessment).model_dump(by_alias=True)
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=error.errors()) from error


@app.post("/api/assessments", status_code=201)
async def api_assessments(assessment: AssessmentInput):
    result = run_portfolio_agent(assessment)
    assessment_id = await save_assessment(assessment, result)
    return {"id": assessment_id, **result.model_dump(by_alias=True)}


static_dir = Path(__file__).resolve().parent.parent / "client-dist"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets") if (static_dir / "assets").exists() else None


@app.get("/{path:path}", include_in_schema=False)
async def angular_app(path: str):
    requested = static_dir / path
    if path and requested.is_file():
        return FileResponse(requested)
    return FileResponse(static_dir / "index.html")
