import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# The host filesystem is mounted here via docker-compose volume.
# Falls back to /tmp when the mount is absent (e.g. bare-Python dev mode).
_WORKSPACE_ENV = os.environ.get("WORKSPACE_ROOT", "/workspace")
WORKSPACE_ROOT = Path(_WORKSPACE_ENV).resolve()


def _safe_resolve(rel_path: str) -> Path:
    """Resolve *rel_path* inside WORKSPACE_ROOT; reject path-traversal attempts."""
    # Strip any leading slashes so Path() doesn't treat it as absolute
    candidate = (WORKSPACE_ROOT / rel_path.lstrip("/")).resolve()
    if not str(candidate).startswith(str(WORKSPACE_ROOT)):
        raise HTTPException(status_code=400, detail="Path is outside the workspace.")
    return candidate


@router.get("/list")
def list_directory(path: str = "") -> dict:
    """Return immediate sub-directories of *path* (relative to WORKSPACE_ROOT)."""
    target = _safe_resolve(path)
    if not target.exists() or not target.is_dir():
        raise HTTPException(status_code=404, detail=f"Directory not found: {path!r}")

    dirs = sorted(
        d.name
        for d in target.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    )
    # Return path relative to workspace root for display
    rel = str(target.relative_to(WORKSPACE_ROOT)) if target != WORKSPACE_ROOT else ""
    return {"path": rel, "dirs": dirs}


class SaveRequest(BaseModel):
    path: str
    nav_yaml: str
    project_json: str


@router.post("/save")
def save_files(req: SaveRequest) -> dict:
    """Write nav_path.yaml and navpath_project.json to *path*."""
    target = _safe_resolve(req.path)
    try:
        target.mkdir(parents=True, exist_ok=True)
        (target / "nav_path.yaml").write_text(req.nav_yaml, encoding="utf-8")
        (target / "navpath_project.json").write_text(req.project_json, encoding="utf-8")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    rel = str(target.relative_to(WORKSPACE_ROOT)) if target != WORKSPACE_ROOT else "/"
    return {"saved_to": rel}
