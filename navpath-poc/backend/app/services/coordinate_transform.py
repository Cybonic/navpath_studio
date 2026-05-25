import math
from typing import Any


def pixel_to_world(px: float, py: float, metadata: dict[str, Any]) -> dict[str, float]:
    resolution = float(metadata["resolution"])
    origin_x, origin_y, origin_yaw = [float(v) for v in metadata["origin"]]
    height = float(metadata["height"])

    local_x = px * resolution
    local_y = (height - py) * resolution
    cos_yaw = math.cos(origin_yaw)
    sin_yaw = math.sin(origin_yaw)

    return {
        "x": origin_x + local_x * cos_yaw - local_y * sin_yaw,
        "y": origin_y + local_x * sin_yaw + local_y * cos_yaw,
    }


def world_to_pixel(x: float, y: float, metadata: dict[str, Any]) -> dict[str, float]:
    resolution = float(metadata["resolution"])
    origin_x, origin_y, origin_yaw = [float(v) for v in metadata["origin"]]
    height = float(metadata["height"])

    dx = x - origin_x
    dy = y - origin_y
    cos_yaw = math.cos(origin_yaw)
    sin_yaw = math.sin(origin_yaw)

    local_x = dx * cos_yaw + dy * sin_yaw
    local_y = -dx * sin_yaw + dy * cos_yaw
    return {"px": local_x / resolution, "py": height - local_y / resolution}
