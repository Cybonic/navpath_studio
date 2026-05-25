from typing import Literal

from pydantic import BaseModel, Field

from app.models.robot_profile import RobotProfile


class Quaternion(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float
    w: float


class Waypoint(BaseModel):
    id: str | None = None
    x: float
    y: float
    yaw: float = 0.0
    yaw_deg: float | None = None
    orientation_quaternion: Quaternion | None = None
    source_primitive_id: str | None = None


SmoothingMethod = Literal[
    "none",
    "corner_rounding",
    "chaikin",
    "catmull_rom",
    "cubic_spline",
    "bezier",
    "savitzky_golay",
]


class SmoothingSettings(BaseModel):
    enabled: bool = True
    method: SmoothingMethod = "corner_rounding"
    waypoint_spacing: float = Field(default=0.1, gt=0)
    corner_radius: float = Field(default=0.5, gt=0)
    smoothing_strength: float = Field(default=0.5, ge=0, le=1)
    interpolation_resolution_m: float = Field(default=0.05, gt=0)
    preserve_endpoints: bool = True
    preserve_action_attachments: bool = True
    min_turning_radius: float | None = Field(default=0.8, gt=0)
    max_yaw_jump_deg: float = Field(default=30.0, gt=0)
    max_deviation_from_control_polyline_m: float | None = Field(default=0.5, gt=0)


class ValidationIssue(BaseModel):
    type: str
    severity: Literal["info", "warning", "error"]
    message: str
    primitive_id: str | None = None
    waypoint_index: int | None = None


class ValidationMetrics(BaseModel):
    waypoint_count: int
    path_length_m: float
    mean_spacing_m: float
    min_spacing_m: float
    max_spacing_m: float
    max_yaw_jump_deg: float
    zero_length_segment_count: int
    duplicate_waypoint_count: int
    max_curvature: float


class ValidationReport(BaseModel):
    status: Literal["valid", "valid_with_warnings", "invalid"]
    metrics: ValidationMetrics
    warnings: list[ValidationIssue] = Field(default_factory=list)
    errors: list[ValidationIssue] = Field(default_factory=list)


class ComputedTrajectory(BaseModel):
    id: str
    source_control_point_ids: list[str]
    smoothing_settings: SmoothingSettings
    waypoints: list[Waypoint]
    is_stale: bool = False
    validation: ValidationReport | None = None


class PathValidationRequest(BaseModel):
    waypoints: list[Waypoint]
    robot_profile: RobotProfile = Field(default_factory=RobotProfile)
    max_spacing: float = Field(default=0.3, gt=0)
    max_yaw_jump_deg: float = Field(default=30.0, gt=0)


class PathExportRequest(BaseModel):
    frame_id: str = "map"
    waypoints: list[Waypoint] = Field(min_length=2)


class Header(BaseModel):
    frame_id: str


class Position(BaseModel):
    x: float
    y: float
    z: float = 0.0


class Pose(BaseModel):
    position: Position
    orientation: Quaternion


class PoseStamped(BaseModel):
    header: Header
    pose: Pose


class NavPath(BaseModel):
    header: Header
    poses: list[PoseStamped]
