from fastapi import APIRouter

from app.models.path import NavPath, PathExportRequest, PathValidationRequest, ValidationReport
from app.services.path_generator import build_nav_path
from app.services.path_validator import validate_waypoints

router = APIRouter()


@router.post("/path", response_model=NavPath)
def export_path(request: PathExportRequest) -> NavPath:
    return build_nav_path(request.waypoints, frame_id=request.frame_id)


@router.post("/validate", response_model=ValidationReport)
def validate_path(request: PathValidationRequest) -> ValidationReport:
    return validate_waypoints(
        request.waypoints,
        robot_profile=request.robot_profile,
        max_spacing=request.max_spacing,
        max_yaw_jump_deg=request.max_yaw_jump_deg,
    )
