from fastapi import APIRouter

from app.models.path import NavPath, PathExportRequest
from app.services.path_generator import build_nav_path

router = APIRouter()


@router.post("/path", response_model=NavPath)
def export_path(request: PathExportRequest) -> NavPath:
    return build_nav_path(request.waypoints, frame_id=request.frame_id)
