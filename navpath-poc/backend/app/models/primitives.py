from typing import Literal

from pydantic import BaseModel, Field


class ControlPoint(BaseModel):
    id: str
    x: float
    y: float


class LinePrimitive(BaseModel):
    id: str
    type: Literal["line"] = "line"
    start: ControlPoint
    end: ControlPoint


class ArcPrimitive(BaseModel):
    id: str
    type: Literal["arc"] = "arc"
    start: ControlPoint
    end: ControlPoint
    radius: float = Field(gt=0)
    clockwise: bool = False
    center: dict[str, float] | None = None


PathPrimitive = LinePrimitive | ArcPrimitive
