import base64
import io
import math
from pathlib import PurePosixPath
from typing import Any

import yaml
from fastapi import UploadFile
from PIL import Image, ImageOps

from app.models.map import MapMetadata, MapUploadResponse

REQUIRED_MAP_FIELDS = {
    "image",
    "resolution",
    "origin",
    "negate",
    "occupied_thresh",
    "free_thresh",
}


def _validate_yaml(raw: dict[str, Any]) -> dict[str, Any]:
    missing = sorted(REQUIRED_MAP_FIELDS - set(raw))
    if missing:
        raise ValueError(f"Map YAML missing required field(s): {', '.join(missing)}")

    mode = raw.get("mode", "trinary")
    if mode not in {"trinary", "scale", "raw"}:
        raise ValueError("Unsupported map mode. Expected one of: trinary, scale, raw")

    origin = raw["origin"]
    if not isinstance(origin, list) or len(origin) != 3:
        raise ValueError("Map origin must be a 3-item list: [x, y, yaw]")

    try:
        resolution = float(raw["resolution"])
        origin = [float(origin[0]), float(origin[1]), float(origin[2])]
        negate = int(raw["negate"])
        occupied_thresh = float(raw["occupied_thresh"])
        free_thresh = float(raw["free_thresh"])
    except (TypeError, ValueError) as exc:
        raise ValueError("Map YAML has invalid numeric values") from exc

    if resolution <= 0:
        raise ValueError("Map resolution must be greater than zero")
    if negate not in {0, 1}:
        raise ValueError("Map negate must be 0 or 1")
    if not 0 < free_thresh < occupied_thresh < 1:
        raise ValueError("Expected 0 < free_thresh < occupied_thresh < 1")

    normalized = dict(raw)
    normalized.update(
        {
            "mode": mode,
            "resolution": resolution,
            "origin": origin,
            "negate": negate,
            "occupied_thresh": occupied_thresh,
            "free_thresh": free_thresh,
        }
    )
    return normalized


async def load_map_upload(
    yaml_file: UploadFile,
    image_file: UploadFile,
    frame_id: str = "map",
) -> MapUploadResponse:
    yaml_bytes = await yaml_file.read()
    image_bytes = await image_file.read()

    try:
        raw_yaml = yaml.safe_load(yaml_bytes) or {}
    except yaml.YAMLError as exc:
        raise ValueError(f"Invalid map YAML: {exc}") from exc

    if not isinstance(raw_yaml, dict):
        raise ValueError("Map YAML must contain a mapping/object")

    normalized = _validate_yaml(raw_yaml)

    yaml_image_name = PurePosixPath(str(normalized["image"])).name
    upload_image_name = PurePosixPath(image_file.filename or "").name
    if yaml_image_name and upload_image_name and yaml_image_name != upload_image_name:
        raise ValueError(
            "Image/YAML mismatch: YAML references "
            f"'{yaml_image_name}', uploaded image is '{upload_image_name}'"
        )

    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
    except Exception as exc:  # PIL raises several concrete parser exceptions.
        raise ValueError("Unsupported or invalid map image file") from exc

    gray = ImageOps.grayscale(image)
    display = _occupancy_display_image(gray, normalized)
    buffer = io.BytesIO()
    display.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

    metadata = MapMetadata(
        image=normalized["image"],
        mode=normalized["mode"],
        resolution=normalized["resolution"],
        origin=normalized["origin"],
        negate=normalized["negate"],
        occupied_thresh=normalized["occupied_thresh"],
        free_thresh=normalized["free_thresh"],
        width=gray.width,
        height=gray.height,
        frame_id=frame_id,
    )
    return MapUploadResponse(
        metadata=metadata,
        image_data_url=f"data:image/png;base64,{encoded}",
    )


def _occupancy_display_image(image: Image.Image, metadata: dict[str, Any]) -> Image.Image:
    """Create a browser-friendly visual map with free/occupied/unknown contrast."""
    if metadata["mode"] != "trinary":
        return image.convert("RGBA")

    negate = metadata["negate"]
    occupied_thresh = metadata["occupied_thresh"]
    free_thresh = metadata["free_thresh"]
    out = Image.new("RGBA", image.size)
    pixels_in = image.load()
    pixels_out = out.load()

    for y in range(image.height):
        for x in range(image.width):
            pixel = pixels_in[x, y] / 255.0
            occ = pixel if negate else 1.0 - pixel
            if occ >= occupied_thresh:
                color = (24, 31, 42, 255)
            elif occ <= free_thresh:
                color = (245, 247, 250, 255)
            else:
                color = (174, 181, 191, 255)
            pixels_out[x, y] = color
    return out


def pixel_to_world(px: float, py: float, metadata: dict[str, Any]) -> dict[str, float]:
    resolution = float(metadata["resolution"])
    origin_x, origin_y, origin_yaw = [float(v) for v in metadata["origin"]]
    height = float(metadata["height"])

    local_x = px * resolution
    local_y = (height - py) * resolution
    cos_yaw = math.cos(origin_yaw)
    sin_yaw = math.sin(origin_yaw)

    world_x = origin_x + local_x * cos_yaw - local_y * sin_yaw
    world_y = origin_y + local_x * sin_yaw + local_y * cos_yaw
    return {"x": world_x, "y": world_y}


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
