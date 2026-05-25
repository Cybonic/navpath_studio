import type {
  ActionNode,
  ComputedTrajectory,
  ControlPoint,
  MapMetadata,
  NativeProjectExport,
  OrientationDisplaySettings,
  RobotProfile,
  SmoothingSettings,
  TrajectorySegment,
} from '../types';

export function buildNativeProjectExport(input: {
  map: MapMetadata | null;
  robotProfile: RobotProfile;
  smoothingSettings: SmoothingSettings;
  orientationDisplay: OrientationDisplaySettings;
  controlPoints: ControlPoint[];
  trajectorySegments: TrajectorySegment[];
  actionNodes: ActionNode[];
  computedTrajectory: ComputedTrajectory | null;
}): NativeProjectExport {
  const waypoints = input.computedTrajectory && !input.computedTrajectory.is_stale
    ? input.computedTrajectory.waypoints
    : [];

  return {
    navpath_studio_project: {
      version: '0.1',
      frame_id: input.map?.frame_id ?? 'map',
      map: input.map,
      robot_profile: input.robotProfile,
      smoothing_settings: input.smoothingSettings,
      orientation_display: input.orientationDisplay,
      control_points: input.controlPoints,
      primitives: input.trajectorySegments,
      action_nodes: input.actionNodes,
      generated_waypoints: {
        spacing: input.smoothingSettings.waypoint_spacing,
        poses: waypoints.map((waypoint) => [waypoint.x, waypoint.y, waypoint.yaw]),
      },
      computed_trajectory: input.computedTrajectory,
      validation: input.computedTrajectory?.validation,
      export_note:
        'Native project data preserves design-time metadata. nav_msgs/Path export remains path-only.',
    },
  };
}
