from typing import Literal

from pydantic import BaseModel, Field


KinematicsType = Literal["differential", "skid_steer", "ackermann", "omni", "generic"]
FootprintType = Literal["circle", "rectangle", "polygon"]
ControllerProfile = Literal["generic", "regulated_pure_pursuit", "mppi", "dwb"]


class Kinematics(BaseModel):
    type: KinematicsType = "generic"
    holonomic: bool = False
    can_reverse: bool = False
    can_rotate_in_place: bool = True


class Footprint(BaseModel):
    type: FootprintType = "circle"
    radius: float = Field(default=0.35, gt=0)
    polygon: list[dict[str, float]] = Field(default_factory=list)


class MotionLimits(BaseModel):
    max_linear_velocity: float = Field(default=0.5, gt=0)
    max_angular_velocity: float = Field(default=1.0, gt=0)
    min_turning_radius: float = Field(default=0.8, gt=0)


class PathConstraints(BaseModel):
    default_spacing: float = Field(default=0.1, gt=0)
    max_spacing: float = Field(default=0.3, gt=0)
    min_spacing: float = Field(default=0.02, gt=0)
    max_yaw_jump_deg: float = Field(default=30.0, gt=0)


class RobotProfile(BaseModel):
    name: str = "generic_2d_ground_robot"
    kinematics: Kinematics = Field(default_factory=Kinematics)
    footprint: Footprint = Field(default_factory=Footprint)
    motion_limits: MotionLimits = Field(default_factory=MotionLimits)
    path_constraints: PathConstraints = Field(default_factory=PathConstraints)
    controller_profile: ControllerProfile = "generic"
