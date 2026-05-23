from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.map import MapUploadResponse, PixelPoint, WorldPoint
from app.services.map_loader import load_map_upload

router = APIRouter()


@router.post("/upload", response_model=MapUploadResponse)
async def upload_map(
    yaml_file: UploadFile = File(...),
    image_file: UploadFile = File(...),
) -> MapUploadResponse:
    try:
        return await load_map_upload(yaml_file, image_file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/pixel-to-world", response_model=WorldPoint)
def pixel_to_world_endpoint(point: PixelPoint, metadata: dict) -> WorldPoint:
    from app.services.map_loader import pixel_to_world

    world = pixel_to_world(point.px, point.py, metadata)
    return WorldPoint(**world)


@router.post("/world-to-pixel", response_model=PixelPoint)
def world_to_pixel_endpoint(point: WorldPoint, metadata: dict) -> PixelPoint:
    from app.services.map_loader import world_to_pixel

    pixel = world_to_pixel(point.x, point.y, metadata)
    return PixelPoint(**pixel)
