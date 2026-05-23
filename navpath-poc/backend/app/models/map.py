from typing import Literal

from pydantic import BaseModel, Field


MapMode = Literal["trinary", "scale", "raw"]


class MapMetadata(BaseModel):
    image: str
    mode: MapMode = "trinary"
    resolution: float = Field(gt=0)
    origin: list[float] = Field(min_length=3, max_length=3)
    negate: int = Field(ge=0, le=1)
    occupied_thresh: float = Field(gt=0, lt=1)
    free_thresh: float = Field(gt=0, lt=1)
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    frame_id: str = "map"


class PixelPoint(BaseModel):
    px: float
    py: float


class WorldPoint(BaseModel):
    x: float
    y: float


class MapUploadResponse(BaseModel):
    metadata: MapMetadata
    image_data_url: str
