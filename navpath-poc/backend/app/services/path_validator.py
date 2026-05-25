import math

from app.models.path import ValidationIssue, ValidationMetrics, ValidationReport, Waypoint
from app.models.robot_profile import RobotProfile
from app.services.path_exporter import waypoint_quaternion

EPSILON = 1e-6


def validate_waypoints(
    waypoints: list[Waypoint],
    robot_profile: RobotProfile | None = None,
    max_spacing: float = 0.3,
    max_yaw_jump_deg: float = 30.0,
) -> ValidationReport:
    robot_profile = robot_profile or RobotProfile()
    warnings: list[ValidationIssue] = []
    errors: list[ValidationIssue] = []
    spacings = _segment_spacings(waypoints)
    path_length = sum(spacings)
    duplicate_count = sum(1 for spacing in spacings if spacing <= EPSILON)
    max_spacing_seen = max(spacings) if spacings else 0.0
    min_spacing_seen = min(spacings) if spacings else 0.0
    mean_spacing = path_length / len(spacings) if spacings else 0.0
    max_yaw_jump_seen = _max_yaw_jump_deg(waypoints)
    max_curvature = _max_curvature(waypoints)

    if len(waypoints) < 2:
        errors.append(
            ValidationIssue(
                type="too_few_poses",
                severity="error",
                message="Export requires at least two generated poses.",
            )
        )

    for index, waypoint in enumerate(waypoints):
        if not all(math.isfinite(value) for value in (waypoint.x, waypoint.y, waypoint.yaw)):
            errors.append(
                ValidationIssue(
                    type="non_finite_pose",
                    severity="error",
                    message=f"Waypoint {index + 1} contains a non-finite position or yaw.",
                    waypoint_index=index,
                )
            )
        quaternion = waypoint_quaternion(waypoint)
        if not all(math.isfinite(value) for value in (quaternion.x, quaternion.y, quaternion.z, quaternion.w)):
            errors.append(
                ValidationIssue(
                    type="non_finite_orientation",
                    severity="error",
                    message=f"Waypoint {index + 1} contains a non-finite orientation quaternion.",
                    waypoint_index=index,
                )
            )

    if duplicate_count:
        warnings.append(
            ValidationIssue(
                type="duplicate_waypoints",
                severity="warning",
                message=f"{duplicate_count} adjacent generated waypoint pair(s) are duplicated.",
            )
        )

    if max_spacing_seen > max_spacing:
        warnings.append(
            ValidationIssue(
                type="max_spacing_exceeded",
                severity="warning",
                message=f"Maximum waypoint spacing is {max_spacing_seen:.3f} m, above the {max_spacing:.3f} m limit.",
            )
        )

    if max_yaw_jump_seen > max_yaw_jump_deg:
        warnings.append(
            ValidationIssue(
                type="yaw_jump",
                severity="warning",
                message=f"Maximum yaw jump is {max_yaw_jump_seen:.1f} deg, above the {max_yaw_jump_deg:.1f} deg limit.",
            )
        )

    curvature_limit = 1.0 / robot_profile.motion_limits.min_turning_radius
    if max_curvature > curvature_limit:
        severity = "error" if _curvature_violation_is_blocking(robot_profile) else "warning"
        issue = ValidationIssue(
            type="curvature_exceeded",
            severity=severity,
            message=f"Maximum curvature is {max_curvature:.3f} 1/m, above the robot limit {curvature_limit:.3f} 1/m.",
        )
        if severity == "error":
            errors.append(issue)
        else:
            warnings.append(issue)

    status = "invalid" if errors else "valid_with_warnings" if warnings else "valid"
    return ValidationReport(
        status=status,
        metrics=ValidationMetrics(
            waypoint_count=len(waypoints),
            path_length_m=path_length,
            mean_spacing_m=mean_spacing,
            min_spacing_m=min_spacing_seen,
            max_spacing_m=max_spacing_seen,
            max_yaw_jump_deg=max_yaw_jump_seen,
            zero_length_segment_count=duplicate_count,
            duplicate_waypoint_count=duplicate_count,
            max_curvature=max_curvature,
        ),
        warnings=warnings,
        errors=errors,
    )


def _segment_spacings(waypoints: list[Waypoint]) -> list[float]:
    return [
        math.hypot(waypoints[index].x - waypoints[index - 1].x, waypoints[index].y - waypoints[index - 1].y)
        for index in range(1, len(waypoints))
    ]


def _max_yaw_jump_deg(waypoints: list[Waypoint]) -> float:
    if len(waypoints) < 2:
        return 0.0
    return max(
        abs(_normalize_angle(waypoints[index].yaw - waypoints[index - 1].yaw)) * 180.0 / math.pi
        for index in range(1, len(waypoints))
    )


def _max_curvature(waypoints: list[Waypoint]) -> float:
    max_curvature = 0.0
    for index in range(1, len(waypoints)):
        spacing = math.hypot(waypoints[index].x - waypoints[index - 1].x, waypoints[index].y - waypoints[index - 1].y)
        if spacing <= EPSILON:
            continue
        yaw_change = abs(_normalize_angle(waypoints[index].yaw - waypoints[index - 1].yaw))
        max_curvature = max(max_curvature, yaw_change / spacing)
    return max_curvature


def _normalize_angle(angle: float) -> float:
    while angle > math.pi:
        angle -= math.pi * 2.0
    while angle < -math.pi:
        angle += math.pi * 2.0
    return angle


def _curvature_violation_is_blocking(robot_profile: RobotProfile) -> bool:
    return robot_profile.kinematics.type == "ackermann" or not robot_profile.kinematics.can_rotate_in_place
