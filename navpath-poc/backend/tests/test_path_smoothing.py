from app.models.path import SmoothingSettings
from app.models.primitives import ControlPoint
from app.services.path_smoother import compute_resampled_path


def test_backend_reference_smoother_preserves_endpoints_and_metadata():
    waypoints = compute_resampled_path(
        [
            ControlPoint(id="a", x=0.0, y=0.0),
            ControlPoint(id="b", x=1.0, y=0.0),
        ],
        SmoothingSettings(method="none", waypoint_spacing=0.1),
    )

    assert len(waypoints) > 2
    assert waypoints[0].x == 0.0
    assert waypoints[0].y == 0.0
    assert waypoints[-1].x == 1.0
    assert waypoints[-1].y == 0.0
    assert waypoints[0].orientation_quaternion is not None
    assert waypoints[0].source_primitive_id == "segment_1"
