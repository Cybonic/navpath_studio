import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import export, files, maps


app = FastAPI(title="NavPath Studio API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(maps.router, prefix="/api/maps", tags=["maps"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(files.router, prefix="/api/files", tags=["files"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _frontend_dist_dir() -> Path:
    configured = os.environ.get("FRONTEND_DIST_DIR")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


frontend_dist = _frontend_dist_dir()
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
