import { create } from 'zustand';

import type {
  ActionNode,
  ComputedTrajectory,
  ControlPoint,
  DrawingElement,
  MapMetadata,
  OccupancyGrid,
  OrientationDisplaySettings,
  RobotProfile,
  SmoothingSettings,
  ToolMode,
  TrajectorySegment,
  ValidationReport,
  Waypoint,
  WorldPoint,
} from '../types';
import type { AutosaveSnapshot } from '../utils/autosave';
import { computeSmoothWaypoints } from '../utils/smoothing';
import { validateWaypoints } from '../utils/validation';
import { generateArcThroughEndpointsWaypoints, generateLineWaypoints } from '../utils/waypointGeneration';
import { waypointWithOrientation } from '../utils/headingGeneration';

interface CanvasPan {
  x: number;
  y: number;
}

interface StudioState {
  map: MapMetadata | null;
  occupancyGrid: OccupancyGrid | null;
  imageDataUrl: string | null;
  tool: ToolMode;
  spacing: number;
  zoom: number;
  pan: CanvasPan;
  trajectoryPoints: ControlPoint[];
  trajectorySegments: TrajectorySegment[];
  smoothingSettings: SmoothingSettings;
  robotProfile: RobotProfile;
  computedTrajectory: ComputedTrajectory | null;
  orientationDisplay: OrientationDisplaySettings;
  elements: DrawingElement[];
  selectedId: string | null;
  selectedWaypointIndex: number | null;
  cursorWorld: WorldPoint | null;
  draftPoint: WorldPoint | null;
  statusMessage: string | null;
  autosaveEnabled: boolean;
  lastAutosavedAt: string | null;
  setMap: (map: MapMetadata, imageDataUrl: string, occupancyGrid?: OccupancyGrid | null) => void;
  setAutosaveEnabled: (enabled: boolean) => void;
  markAutosaved: (savedAt: string) => void;
  restoreAutosaveSnapshot: (snapshot: AutosaveSnapshot) => void;
  setTool: (tool: ToolMode) => void;
  setSpacing: (spacing: number) => void;
  setSmoothingSettings: (settings: Partial<SmoothingSettings>) => void;
  setOrientationDisplay: (settings: Partial<OrientationDisplaySettings>) => void;
  setSelectedWaypointIndex: (index: number | null) => void;
  computeSmoothTrajectory: () => void;
  addActionAtPoint: (point: WorldPoint) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setPan: (pan: CanvasPan) => void;
  panBy: (delta: CanvasPan) => void;
  resetPan: () => void;
  addTrajectoryPoint: (point: WorldPoint) => void;
  addArcTrajectoryPoint: (point: WorldPoint) => void;
  updateTrajectoryPoint: (index: number, point: WorldPoint) => void;
  updateTrajectorySegment: (index: number, segment: TrajectorySegment) => void;
  removeTrajectoryPoint: (index: number) => void;
  clearTrajectory: () => void;
  clearAllContent: () => void;
  addElement: (element: DrawingElement) => void;
  setSelectedId: (id: string | null) => void;
  setCursorWorld: (point: WorldPoint | null) => void;
  setDraftPoint: (point: WorldPoint | null) => void;
  allWaypoints: () => Waypoint[];
}

const defaultRobotProfile: RobotProfile = {
  name: 'generic_2d_ground_robot',
  kinematics: {
    type: 'generic',
    holonomic: false,
    can_reverse: false,
    can_rotate_in_place: true,
  },
  footprint: {
    type: 'circle',
    radius: 0.35,
    polygon: [],
  },
  motion_limits: {
    max_linear_velocity: 0.5,
    max_angular_velocity: 1.0,
    min_turning_radius: 0.8,
  },
  path_constraints: {
    default_spacing: 0.1,
    max_spacing: 0.3,
    min_spacing: 0.02,
    max_yaw_jump_deg: 30,
  },
  controller_profile: 'generic',
};

const defaultSmoothingSettings: SmoothingSettings = {
  enabled: true,
  method: 'corner_rounding',
  waypoint_spacing: 0.1,
  corner_radius: 0.5,
  smoothing_strength: 0.5,
  interpolation_resolution_m: 0.05,
  preserve_endpoints: true,
  preserve_action_attachments: true,
  min_turning_radius: defaultRobotProfile.motion_limits.min_turning_radius,
  max_yaw_jump_deg: defaultRobotProfile.path_constraints.max_yaw_jump_deg,
  max_deviation_from_control_polyline_m: 0.5,
};

const defaultOrientationDisplay: OrientationDisplaySettings = {
  show_arrows: true,
  show_yaw_labels: false,
  arrow_stride: 1,
  arrow_length_m: 0.25,
  selected_waypoint_show_quaternion: true,
};

export const useStudioStore = create<StudioState>((set, get) => ({
  map: null,
  occupancyGrid: null,
  imageDataUrl: null,
  tool: 'line',
  spacing: defaultSmoothingSettings.waypoint_spacing,
  zoom: 1,
  pan: { x: 0, y: 0 },
  trajectoryPoints: [],
  trajectorySegments: [],
  smoothingSettings: defaultSmoothingSettings,
  robotProfile: defaultRobotProfile,
  computedTrajectory: null,
  orientationDisplay: defaultOrientationDisplay,
  elements: [],
  selectedId: null,
  selectedWaypointIndex: null,
  cursorWorld: null,
  draftPoint: null,
  statusMessage: null,
  autosaveEnabled: true,
  lastAutosavedAt: null,
  setMap: (map, imageDataUrl, occupancyGrid = null) =>
    set({
      map,
      occupancyGrid,
      imageDataUrl,
      elements: [],
      trajectoryPoints: [],
      trajectorySegments: [],
      computedTrajectory: null,
      selectedWaypointIndex: null,
      selectedId: null,
      statusMessage: null,
      zoom: 1,
      pan: { x: 0, y: 0 },
    }),
  setAutosaveEnabled: (enabled) =>
    set({
      autosaveEnabled: enabled,
      lastAutosavedAt: enabled ? get().lastAutosavedAt : null,
      statusMessage: enabled ? 'Autosave enabled.' : 'Autosave disabled for this browser.',
    }),
  markAutosaved: (savedAt) => set({ lastAutosavedAt: savedAt }),
  restoreAutosaveSnapshot: (snapshot) =>
    set({
      map: snapshot.map,
      occupancyGrid: snapshot.occupancyGrid,
      imageDataUrl: snapshot.imageDataUrl,
      trajectoryPoints: snapshot.trajectoryPoints,
      trajectorySegments: snapshot.trajectorySegments,
      smoothingSettings: snapshot.smoothingSettings,
      spacing: snapshot.smoothingSettings.waypoint_spacing,
      robotProfile: snapshot.robotProfile,
      computedTrajectory: snapshot.computedTrajectory,
      orientationDisplay: snapshot.orientationDisplay,
      elements: snapshot.actionNodes,
      zoom: snapshot.zoom,
      pan: snapshot.pan,
      selectedId: null,
      selectedWaypointIndex: null,
      cursorWorld: null,
      draftPoint: null,
      statusMessage: snapshot.map ? 'Restored autosaved workspace.' : null,
      lastAutosavedAt: snapshot.saved_at,
    }),
  setTool: (tool) => set({ tool, draftPoint: null, statusMessage: null }),
  setSpacing: (spacing) =>
    set((state) => ({
      spacing: clampSpacing(spacing, state.robotProfile),
      smoothingSettings: {
        ...state.smoothingSettings,
        waypoint_spacing: clampSpacing(spacing, state.robotProfile),
      },
      ...staleComputedState(state),
    })),
  setSmoothingSettings: (settings) =>
    set((state) => {
      const nextSettings = {
        ...state.smoothingSettings,
        ...settings,
      };
      nextSettings.waypoint_spacing = clampSpacing(nextSettings.waypoint_spacing, state.robotProfile);
      nextSettings.corner_radius = Math.max(0.01, nextSettings.corner_radius);
      nextSettings.smoothing_strength = clampUnit(nextSettings.smoothing_strength);
      nextSettings.interpolation_resolution_m = Math.max(0.01, nextSettings.interpolation_resolution_m);
      return {
        smoothingSettings: nextSettings,
        spacing: nextSettings.waypoint_spacing,
        ...staleComputedState(state),
      };
    }),
  setOrientationDisplay: (settings) =>
    set((state) => ({
      orientationDisplay: {
        ...state.orientationDisplay,
        ...settings,
        arrow_stride: Math.max(1, Math.round(settings.arrow_stride ?? state.orientationDisplay.arrow_stride)),
        arrow_length_m: Math.max(0.05, settings.arrow_length_m ?? state.orientationDisplay.arrow_length_m),
      },
    })),
  setSelectedWaypointIndex: (index) => set({ selectedWaypointIndex: index, selectedId: null }),
  computeSmoothTrajectory: () =>
    set((state) => {
      const smoothResult = computeTrajectoryFromCurrentIntent(state);
      const validation = withAdditionalWarnings(
        validateWaypoints(smoothResult.waypoints, {
          map: state.map,
          occupancyGrid: state.occupancyGrid,
          robotProfile: state.robotProfile,
          maxSpacing: state.robotProfile.path_constraints.max_spacing,
          maxYawJumpDeg: state.smoothingSettings.max_yaw_jump_deg,
        }),
        smoothResult.warnings,
      );
      const trajectory: ComputedTrajectory = {
        id: createId('computed_traj'),
        source_control_point_ids: state.trajectoryPoints.map((point) => point.id),
        smoothing_settings: state.smoothingSettings,
        waypoints: smoothResult.waypoints,
        is_stale: false,
        validation,
      };

      return {
        computedTrajectory: trajectory,
        elements: reattachActionNodes(state.elements, trajectory),
        selectedId: null,
        selectedWaypointIndex: null,
        statusMessage:
          validation.status === 'invalid'
            ? 'Computed trajectory has blocking validation errors.'
            : 'Computed smooth trajectory updated.',
      };
    }),
  addActionAtPoint: (point) =>
    set((state) => {
      const trajectory = state.computedTrajectory;
      if (!trajectory || trajectory.is_stale || trajectory.waypoints.length < 2) {
        return { statusMessage: 'Compute a current smooth trajectory before placing action nodes.' };
      }

      const snap = snapPointToTrajectory(point, trajectory.waypoints, 0.25);
      if (!snap) {
        return { statusMessage: 'Action node rejected: click closer to the computed trajectory.' };
      }

      const actionCount = state.elements.filter((element) => element.type === 'action').length;
      const action: ActionNode = {
        id: createId('action'),
        type: 'action',
        action_type: 'inspect',
        position: snap.position,
        yaw: snap.yaw,
        label: `Action ${actionCount + 1}`,
        trajectory_id: trajectory.id,
        arc_length_s_m: snap.arcLength,
        waypoint_index: snap.waypointIndex,
        source_waypoint_id: trajectory.waypoints[snap.waypointIndex]?.id,
        placement_mode: 'snap_to_trajectory',
        attachment_status: 'attached',
        metadata: {},
      };

      return {
        elements: [...state.elements, action],
        selectedId: action.id,
        selectedWaypointIndex: null,
        statusMessage: 'Action node snapped to computed trajectory.',
      };
    }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomIn: () => set((state) => ({ zoom: clampZoom(state.zoom * 1.2) })),
  zoomOut: () => set((state) => ({ zoom: clampZoom(state.zoom / 1.2) })),
  resetZoom: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
  setPan: (pan) => set({ pan }),
  panBy: (delta) => set((state) => ({ pan: { x: state.pan.x + delta.x, y: state.pan.y + delta.y } })),
  resetPan: () => set({ pan: { x: 0, y: 0 } }),
  addTrajectoryPoint: (point) =>
    set((state) => ({
      trajectoryPoints: [...state.trajectoryPoints, { id: createId('cp'), ...point }],
      trajectorySegments:
        state.trajectoryPoints.length === 0
          ? []
          : [...state.trajectorySegments, { id: createId('segment'), type: 'line' }],
      selectedId: null,
      selectedWaypointIndex: null,
      draftPoint: null,
      statusMessage: null,
      ...staleComputedState(state),
    })),
  addArcTrajectoryPoint: (point) =>
    set((state) => ({
      trajectoryPoints: [...state.trajectoryPoints, { id: createId('cp'), ...point }],
      trajectorySegments:
        state.trajectoryPoints.length === 0
          ? []
          : [
              ...state.trajectorySegments,
              {
                id: createId('segment'),
                type: 'arc',
                radius: defaultArcRadius(state.trajectoryPoints[state.trajectoryPoints.length - 1], point),
                clockwise: false,
              },
            ],
      selectedId: null,
      selectedWaypointIndex: null,
      draftPoint: null,
      statusMessage: null,
      ...staleComputedState(state),
    })),
  updateTrajectoryPoint: (index, point) =>
    set((state) => ({
      trajectoryPoints: state.trajectoryPoints.map((existing, existingIndex) =>
        existingIndex === index ? { ...existing, ...point } : existing,
      ),
      ...staleComputedState(state),
    })),
  updateTrajectorySegment: (index, segment) =>
    set((state) => ({
      trajectorySegments: state.trajectorySegments.map((existing, existingIndex) =>
        existingIndex === index
          ? normalizeSegment(segment, state.trajectoryPoints[index], state.trajectoryPoints[index + 1])
          : existing,
      ),
      ...staleComputedState(state),
    })),
  removeTrajectoryPoint: (index) =>
    set((state) => ({
      trajectoryPoints: state.trajectoryPoints.filter((_, existingIndex) => existingIndex !== index),
      trajectorySegments: removePointSegments(state.trajectorySegments, index),
      ...staleComputedState(state),
    })),
  clearTrajectory: () =>
    set((state) => ({
      trajectoryPoints: [],
      trajectorySegments: [],
      computedTrajectory: null,
      elements: markActionNodes(state.elements, 'invalid'),
      selectedWaypointIndex: null,
      draftPoint: null,
      statusMessage: null,
    })),
  clearAllContent: () =>
    set({
      trajectoryPoints: [],
      trajectorySegments: [],
      computedTrajectory: null,
      elements: [],
      selectedId: null,
      selectedWaypointIndex: null,
      draftPoint: null,
      statusMessage: 'Cleared all trajectory content. Loaded map and robot profile were preserved.',
    }),
  addElement: (element) =>
    set((state) => ({
      elements: [...state.elements, element],
      selectedId: element.id,
      draftPoint: null,
    })),
  setSelectedId: (id) => set({ selectedId: id, selectedWaypointIndex: null }),
  setCursorWorld: (point) => set({ cursorWorld: point }),
  setDraftPoint: (point) => set({ draftPoint: point }),
  allWaypoints: () => {
    const trajectory = get().computedTrajectory;
    return trajectory && !trajectory.is_stale ? trajectory.waypoints : [];
  },
}));

function staleComputedState(state: StudioState): Partial<StudioState> {
  if (!state.computedTrajectory) return {};
  return {
    computedTrajectory: {
      ...state.computedTrajectory,
      is_stale: true,
    },
    elements: markActionNodes(state.elements, 'stale'),
    statusMessage: 'Trajectory out of date. Click Compute Smooth Trajectory to update.',
  };
}

function markActionNodes(elements: DrawingElement[], status: ActionNode['attachment_status']): DrawingElement[] {
  return elements.map((element) =>
    element.type === 'action'
      ? {
          ...element,
          attachment_status: status,
        }
      : element,
  );
}

function reattachActionNodes(elements: DrawingElement[], trajectory: ComputedTrajectory): DrawingElement[] {
  return elements.map((element) => {
    if (element.type !== 'action') return element;
    const attachment = pointAtArcLength(trajectory.waypoints, element.arc_length_s_m);
    if (!attachment) {
      return { ...element, trajectory_id: trajectory.id, attachment_status: 'invalid' };
    }
    return {
      ...element,
      position: attachment.position,
      yaw: attachment.yaw,
      trajectory_id: trajectory.id,
      waypoint_index: attachment.waypointIndex,
      source_waypoint_id: trajectory.waypoints[attachment.waypointIndex]?.id,
      attachment_status: 'attached',
    };
  });
}

function withAdditionalWarnings(report: ValidationReport, issues: ValidationReport['warnings']): ValidationReport {
  const extraErrors = issues.filter((issue) => issue.severity === 'error');
  const extraWarnings = issues.filter((issue) => issue.severity !== 'error');
  const mergedErrors = [...extraErrors, ...report.errors];
  const mergedWarnings = [...extraWarnings, ...report.warnings];
  return {
    ...report,
    status: mergedErrors.length > 0 ? 'invalid' : mergedWarnings.length > 0 ? 'valid_with_warnings' : 'valid',
    errors: mergedErrors,
    warnings: mergedWarnings,
  };
}

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(8, Math.max(0.25, zoom));
}

function clampSpacing(spacing: number, robotProfile: RobotProfile): number {
  if (!Number.isFinite(spacing)) return robotProfile.path_constraints.default_spacing;
  return Math.min(robotProfile.path_constraints.max_spacing, Math.max(robotProfile.path_constraints.min_spacing, spacing));
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

export function buildTrajectoryWaypoints(
  points: WorldPoint[],
  segments: TrajectorySegment[],
  spacing: number,
): Waypoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [waypointWithOrientation({ point: points[0], yaw: 0, sourcePrimitiveId: 'single_point' })];
  }

  return points.flatMap((point, index) => {
    const next = points[index + 1];
    if (!next) return [];

    const segment = segments[index];
    const waypoints =
      segment?.type === 'arc'
        ? generateArcThroughEndpointsWaypoints(point, next, segment.radius, segment.clockwise, spacing, segment.id)
        : generateLineWaypoints(point, next, spacing, segment?.id ?? `segment_${index + 1}`);
    return index === 0 ? waypoints : waypoints.slice(1);
  });
}

function computeTrajectoryFromCurrentIntent(state: StudioState): {
  waypoints: Waypoint[];
  warnings: ValidationReport['warnings'];
} {
  const hasExplicitArc = state.trajectorySegments.some((segment) => segment.type === 'arc');
  if (!hasExplicitArc) {
    return computeSmoothWaypoints(state.trajectoryPoints, state.smoothingSettings);
  }

  const warnings: ValidationReport['warnings'] = [];
  if (state.smoothingSettings.method !== 'none') {
    warnings.push({
      type: 'explicit_arc_smoothing_bypassed',
      severity: 'info',
      message: 'Explicit arc segments are preserved and resampled directly for this PoC.',
    });
  }

  try {
    return {
      waypoints: buildTrajectoryWaypoints(
        state.trajectoryPoints,
        state.trajectorySegments,
        state.smoothingSettings.waypoint_spacing,
      ),
      warnings,
    };
  } catch (error) {
    warnings.push({
      type: 'invalid_arc',
      severity: 'error',
      message: error instanceof Error ? error.message : 'Arc segment could not be generated.',
    });
    return { waypoints: [], warnings };
  }
}

function defaultArcRadius(start: WorldPoint, end: WorldPoint): number {
  return Math.max(distance(start, end), 0.1);
}

function distance(start: WorldPoint, end: WorldPoint): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function normalizeSegment(segment: TrajectorySegment, start?: WorldPoint, end?: WorldPoint): TrajectorySegment {
  if (segment.type !== 'arc' || !start || !end) return segment;
  return {
    ...segment,
    radius: Math.max(segment.radius, distance(start, end) / 2),
  };
}

function removePointSegments(segments: TrajectorySegment[], pointIndex: number): TrajectorySegment[] {
  if (segments.length === 0) return [];
  if (pointIndex <= 0) return segments.slice(1);
  if (pointIndex >= segments.length) return segments.slice(0, -1);
  return segments.filter((_, segmentIndex) => segmentIndex !== pointIndex);
}

function snapPointToTrajectory(
  point: WorldPoint,
  waypoints: Waypoint[],
  maxSnapDistance: number,
): { position: WorldPoint; yaw: number; arcLength: number; waypointIndex: number } | null {
  let best:
    | { position: WorldPoint; yaw: number; arcLength: number; waypointIndex: number; distance: number }
    | null = null;
  let accumulated = 0;

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const start = waypoints[index];
    const end = waypoints[index + 1];
    const segmentLength = distance(start, end);
    if (segmentLength <= 1e-9) continue;
    const t = projectPointToSegment(point, start, end);
    const position = {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    };
    const snapDistance = distance(point, position);
    if (!best || snapDistance < best.distance) {
      best = {
        position,
        yaw: Math.atan2(end.y - start.y, end.x - start.x),
        arcLength: accumulated + segmentLength * t,
        waypointIndex: t > 0.5 ? index + 1 : index,
        distance: snapDistance,
      };
    }
    accumulated += segmentLength;
  }

  if (!best || best.distance > maxSnapDistance) return null;
  return best;
}

function pointAtArcLength(
  waypoints: Waypoint[],
  arcLength: number,
): { position: WorldPoint; yaw: number; waypointIndex: number } | null {
  if (waypoints.length < 2 || arcLength < 0) return null;
  let accumulated = 0;
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const start = waypoints[index];
    const end = waypoints[index + 1];
    const segmentLength = distance(start, end);
    if (segmentLength <= 1e-9) continue;
    if (accumulated + segmentLength >= arcLength) {
      const t = (arcLength - accumulated) / segmentLength;
      return {
        position: {
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
        },
        yaw: Math.atan2(end.y - start.y, end.x - start.x),
        waypointIndex: t > 0.5 ? index + 1 : index,
      };
    }
    accumulated += segmentLength;
  }
  const last = waypoints[waypoints.length - 1];
  if (Math.abs(arcLength - accumulated) < 1e-6) {
    return { position: last, yaw: last.yaw, waypointIndex: waypoints.length - 1 };
  }
  return null;
}

function projectPointToSegment(point: WorldPoint, start: WorldPoint, end: WorldPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-12) return 0;
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  return Math.min(1, Math.max(0, t));
}

function createId(prefix: string): string {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}
