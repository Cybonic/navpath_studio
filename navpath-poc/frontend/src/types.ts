export type MapMode = 'trinary' | 'scale' | 'raw';

export interface MapMetadata {
  image: string;
  mode: MapMode;
  resolution: number;
  origin: [number, number, number];
  negate: 0 | 1;
  occupied_thresh: number;
  free_thresh: number;
  width: number;
  height: number;
  frame_id: string;
}

export interface PixelPoint {
  px: number;
  py: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface ControlPoint extends WorldPoint {
  id: string;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Waypoint extends WorldPoint {
  id?: string;
  yaw: number;
  source_primitive_id?: string;
}

export type ToolMode = 'select' | 'pan' | 'line' | 'arc' | 'action';

export interface LineTrajectorySegment {
  id: string;
  type: 'line';
}

export interface ArcTrajectorySegment {
  id: string;
  type: 'arc';
  radius: number;
  clockwise: boolean;
}

export type TrajectorySegment = LineTrajectorySegment | ArcTrajectorySegment;

export interface LinePrimitive {
  id: string;
  type: 'line';
  start: WorldPoint;
  end: WorldPoint;
  spacing: number;
  waypoints: Waypoint[];
}

export interface ArcPrimitive {
  id: string;
  type: 'arc';
  center: WorldPoint;
  radius: number;
  startAngle: number;
  endAngle: number;
  clockwise: boolean;
  spacing: number;
  waypoints: Waypoint[];
}

export interface ActionNode {
  id: string;
  type: 'action';
  action_type: string;
  position: WorldPoint;
  yaw?: number;
  label: string;
  trajectory_id: string;
  arc_length_s_m: number;
  waypoint_index?: number;
  source_waypoint_id?: string;
  placement_mode: 'snap_to_trajectory';
  attachment_status: 'attached' | 'stale' | 'invalid';
  metadata?: Record<string, unknown>;
}

export type DrawingElement = LinePrimitive | ArcPrimitive | ActionNode;

export interface SmoothingSettings {
  enabled: boolean;
  method: 'corner_rounding' | 'chaikin' | 'none';
  waypoint_spacing: number;
  corner_radius: number;
  preserve_endpoints: boolean;
  preserve_action_attachments: boolean;
  min_turning_radius?: number;
  max_yaw_jump_deg: number;
}

export interface ComputedTrajectory {
  id: string;
  source_control_point_ids: string[];
  smoothing_settings: SmoothingSettings;
  waypoints: Waypoint[];
  is_stale: boolean;
  validation?: ValidationReport;
}

export interface ValidationIssue {
  type: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  primitive_id?: string;
  waypoint_index?: number;
}

export interface ValidationReport {
  status: 'valid' | 'valid_with_warnings' | 'invalid';
  metrics: {
    waypoint_count: number;
    path_length_m: number;
    mean_spacing_m: number;
    min_spacing_m: number;
    max_spacing_m: number;
    max_yaw_jump_deg: number;
    duplicate_waypoint_count: number;
  };
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
}

export interface RobotProfile {
  name: string;
  kinematics: {
    type: 'differential' | 'skid_steer' | 'ackermann' | 'omni' | 'generic';
    holonomic: boolean;
    can_reverse: boolean;
    can_rotate_in_place: boolean;
  };
  footprint: {
    type: 'circle' | 'rectangle' | 'polygon';
    radius: number;
    polygon: WorldPoint[];
  };
  motion_limits: {
    max_linear_velocity: number;
    max_angular_velocity: number;
    min_turning_radius: number;
  };
  path_constraints: {
    default_spacing: number;
    max_spacing: number;
    min_spacing: number;
    max_yaw_jump_deg: number;
  };
  controller_profile: 'generic' | 'regulated_pure_pursuit' | 'mppi' | 'dwb';
}

export interface NavPathExport {
  header: {
    frame_id: string;
  };
  poses: Array<{
    header: {
      frame_id: string;
    };
    pose: {
      position: {
        x: number;
        y: number;
        z: number;
      };
      orientation: Quaternion;
    };
  }>;
}
