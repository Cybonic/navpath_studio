import math

from app.models.path import Waypoint
from app.models.robot_profile import Kinematics, RobotProfile
from app.services.path_validator import validate_waypoints


def test_ackermann_curvature_violation_is_error():
    profile = RobotProfile(kinematics=Kinematics(type="ackermann", can_rotate_in_place=False))
    report = validate_waypoints(
        [
            Waypoint(x=0.0, y=0.0, yaw=0.0),
            Waypoint(x=0.1, y=0.0, yaw=math.pi / 2),
            Waypoint(x=0.1, y=0.1, yaw=math.pi / 2),
        ],
        robot_profile=profile,
        max_yaw_jump_deg=180.0,
    )

    assert report.status == "invalid"
    assert "curvature_exceeded" in [issue.type for issue in report.errors]


def test_rotate_in_place_curvature_violation_is_warning():
    report = validate_waypoints(
        [
            Waypoint(x=0.0, y=0.0, yaw=0.0),
            Waypoint(x=0.1, y=0.0, yaw=math.pi / 2),
            Waypoint(x=0.1, y=0.1, yaw=math.pi / 2),
        ],
        robot_profile=RobotProfile(),
        max_yaw_jump_deg=180.0,
    )

    assert report.status == "valid_with_warnings"
    assert "curvature_exceeded" in [issue.type for issue in report.warnings]
