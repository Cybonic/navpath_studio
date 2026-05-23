import math

from app.models.path import Header, NavPath, Pose, PoseStamped, Position, Quaternion, Waypoint


def yaw_to_quaternion(yaw: float) -> Quaternion:
    half = yaw / 2.0
    return Quaternion(x=0.0, y=0.0, z=math.sin(half), w=math.cos(half))


def build_nav_path(waypoints: list[Waypoint], frame_id: str = "map") -> NavPath:
    poses = [
        PoseStamped(
            header=Header(frame_id=frame_id),
            pose=Pose(
                position=Position(x=point.x, y=point.y, z=0.0),
                orientation=yaw_to_quaternion(point.yaw),
            ),
        )
        for point in waypoints
    ]
    return NavPath(header=Header(frame_id=frame_id), poses=poses)
