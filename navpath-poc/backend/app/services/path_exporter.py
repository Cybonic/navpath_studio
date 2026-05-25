import math

from app.models.path import Header, NavPath, Pose, PoseStamped, Position, Quaternion, Waypoint


def yaw_to_quaternion(yaw: float) -> Quaternion:
    half = yaw / 2.0
    quaternion = Quaternion(x=0.0, y=0.0, z=math.sin(half), w=math.cos(half))
    norm = math.hypot(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
    if not math.isfinite(norm) or norm == 0:
        return Quaternion(x=0.0, y=0.0, z=0.0, w=1.0)
    return Quaternion(
        x=quaternion.x / norm,
        y=quaternion.y / norm,
        z=quaternion.z / norm,
        w=quaternion.w / norm,
    )


def waypoint_quaternion(point: Waypoint) -> Quaternion:
    return point.orientation_quaternion or yaw_to_quaternion(point.yaw)


def build_nav_path(waypoints: list[Waypoint], frame_id: str = "map") -> NavPath:
    poses = [
        PoseStamped(
            header=Header(frame_id=frame_id),
            pose=Pose(
                position=Position(x=point.x, y=point.y, z=0.0),
                orientation=waypoint_quaternion(point),
            ),
        )
        for point in waypoints
    ]
    return NavPath(header=Header(frame_id=frame_id), poses=poses)
