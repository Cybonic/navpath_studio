from pydantic import BaseModel, Field


class Quaternion(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float
    w: float


class Waypoint(BaseModel):
    x: float
    y: float
    yaw: float = 0.0


class PathExportRequest(BaseModel):
    frame_id: str = "map"
    waypoints: list[Waypoint] = Field(min_length=1)


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
