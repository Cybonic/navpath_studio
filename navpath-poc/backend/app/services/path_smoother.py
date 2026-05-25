import math
import uuid

from app.models.path import SmoothingSettings, Waypoint
from app.models.primitives import ControlPoint
from app.services.path_exporter import yaw_to_quaternion


def compute_resampled_path(control_points: list[ControlPoint], settings: SmoothingSettings) -> list[Waypoint]:
    """Backend reference smoother for API/export parity; frontend owns interactive smoothing in the PoC."""
    if not control_points:
        return []
    if len(control_points) == 1:
        return [_waypoint(control_points[0].x, control_points[0].y, 0.0)]

    spacing = settings.waypoint_spacing
    waypoints: list[Waypoint] = []
    for index in range(1, len(control_points)):
        start = control_points[index - 1]
        end = control_points[index]
        segment = _line_waypoints(start.x, start.y, end.x, end.y, spacing, f"segment_{index}")
        waypoints.extend(segment if index == 1 else segment[1:])
    return waypoints


def _line_waypoints(start_x: float, start_y: float, end_x: float, end_y: float, spacing: float, source_id: str) -> list[Waypoint]:
    length = math.hypot(end_x - start_x, end_y - start_y)
    yaw = math.atan2(end_y - start_y, end_x - start_x)
    if length <= 1e-9:
        return [_waypoint(start_x, start_y, yaw, source_id)]
    steps = max(1, math.ceil(length / spacing))
    return [
        _waypoint(
            start_x + (end_x - start_x) * index / steps,
            start_y + (end_y - start_y) * index / steps,
            yaw,
            source_id,
        )
        for index in range(steps + 1)
    ]


def _waypoint(x: float, y: float, yaw: float, source_id: str | None = None) -> Waypoint:
    normalized_yaw = _normalize_angle(yaw)
    return Waypoint(
        id=f"wp_{uuid.uuid4()}",
        x=x,
        y=y,
        yaw=normalized_yaw,
        yaw_deg=normalized_yaw * 180.0 / math.pi,
        orientation_quaternion=yaw_to_quaternion(normalized_yaw),
        source_primitive_id=source_id,
    )


def _normalize_angle(angle: float) -> float:
    while angle > math.pi:
        angle -= math.pi * 2.0
    while angle < -math.pi:
        angle += math.pi * 2.0
    return angle
