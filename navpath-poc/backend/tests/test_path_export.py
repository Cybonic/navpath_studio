import math

import pytest

from app.models.path import Waypoint
from app.services.path_generator import build_nav_path, yaw_to_quaternion


def test_yaw_to_quaternion_planar():
    quat = yaw_to_quaternion(math.pi / 2)

    assert quat.x == 0.0
    assert quat.y == 0.0
    assert quat.z == pytest.approx(math.sqrt(0.5))
    assert quat.w == pytest.approx(math.sqrt(0.5))


def test_build_nav_path_uses_map_frame_and_meters():
    path = build_nav_path([Waypoint(x=1.2, y=-0.5, yaw=0.0)], frame_id="map")

    assert path.header.frame_id == "map"
    assert len(path.poses) == 1
    assert path.poses[0].header.frame_id == "map"
    assert path.poses[0].pose.position.x == 1.2
    assert path.poses[0].pose.position.y == -0.5
    assert path.poses[0].pose.position.z == 0.0
    assert path.poses[0].pose.orientation.w == pytest.approx(1.0)
