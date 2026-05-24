import { create } from 'zustand';

import type { DrawingElement, MapMetadata, ToolMode, TrajectorySegment, Waypoint, WorldPoint } from '../types';
import { generateArcThroughEndpointsWaypoints, generateLineWaypoints } from '../utils/waypointGeneration';

interface CanvasPan {
  x: number;
  y: number;
}

interface StudioState {
  map: MapMetadata | null;
  imageDataUrl: string | null;
  tool: ToolMode;
  spacing: number;
  zoom: number;
  pan: CanvasPan;
  trajectoryPoints: WorldPoint[];
  trajectorySegments: TrajectorySegment[];
  elements: DrawingElement[];
  selectedId: string | null;
  cursorWorld: WorldPoint | null;
  draftPoint: WorldPoint | null;
  setMap: (map: MapMetadata, imageDataUrl: string) => void;
  setTool: (tool: ToolMode) => void;
  setSpacing: (spacing: number) => void;
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
  addElement: (element: DrawingElement) => void;
  setSelectedId: (id: string | null) => void;
  setCursorWorld: (point: WorldPoint | null) => void;
  setDraftPoint: (point: WorldPoint | null) => void;
  allWaypoints: () => Waypoint[];
}

export const useStudioStore = create<StudioState>((set, get) => ({
  map: null,
  imageDataUrl: null,
  tool: 'line',
  spacing: 0.1,
  zoom: 1,
  pan: { x: 0, y: 0 },
  trajectoryPoints: [],
  trajectorySegments: [],
  elements: [],
  selectedId: null,
  cursorWorld: null,
  draftPoint: null,
  setMap: (map, imageDataUrl) =>
    set({
      map,
      imageDataUrl,
      elements: [],
      trajectoryPoints: [],
      trajectorySegments: [],
      selectedId: null,
      zoom: 1,
      pan: { x: 0, y: 0 },
    }),
  setTool: (tool) => set({ tool, draftPoint: null }),
  setSpacing: (spacing) => set({ spacing }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomIn: () => set((state) => ({ zoom: clampZoom(state.zoom * 1.2) })),
  zoomOut: () => set((state) => ({ zoom: clampZoom(state.zoom / 1.2) })),
  resetZoom: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
  setPan: (pan) => set({ pan }),
  panBy: (delta) => set((state) => ({ pan: { x: state.pan.x + delta.x, y: state.pan.y + delta.y } })),
  resetPan: () => set({ pan: { x: 0, y: 0 } }),
  addTrajectoryPoint: (point) =>
    set((state) => ({
      trajectoryPoints: [...state.trajectoryPoints, point],
      trajectorySegments:
        state.trajectoryPoints.length === 0
          ? []
          : [...state.trajectorySegments, { id: crypto.randomUUID(), type: 'line' }],
      selectedId: null,
      draftPoint: null,
    })),
  addArcTrajectoryPoint: (point) =>
    set((state) => ({
      trajectoryPoints: [...state.trajectoryPoints, point],
      trajectorySegments:
        state.trajectoryPoints.length === 0
          ? []
          : [
              ...state.trajectorySegments,
              {
                id: crypto.randomUUID(),
                type: 'arc',
                radius: defaultArcRadius(state.trajectoryPoints[state.trajectoryPoints.length - 1], point),
                clockwise: false,
              },
            ],
      selectedId: null,
      draftPoint: null,
    })),
  updateTrajectoryPoint: (index, point) =>
    set((state) => ({
      trajectoryPoints: state.trajectoryPoints.map((existing, existingIndex) =>
        existingIndex === index ? point : existing,
      ),
    })),
  updateTrajectorySegment: (index, segment) =>
    set((state) => ({
      trajectorySegments: state.trajectorySegments.map((existing, existingIndex) =>
        existingIndex === index ? normalizeSegment(segment, state.trajectoryPoints[index], state.trajectoryPoints[index + 1]) : existing,
      ),
    })),
  removeTrajectoryPoint: (index) =>
    set((state) => ({
      trajectoryPoints: state.trajectoryPoints.filter((_, existingIndex) => existingIndex !== index),
      trajectorySegments: removePointSegments(state.trajectorySegments, index),
    })),
  clearTrajectory: () => set({ trajectoryPoints: [], trajectorySegments: [], draftPoint: null }),
  addElement: (element) =>
    set((state) => ({
      elements: [...state.elements, element],
      selectedId: element.id,
      draftPoint: null,
    })),
  setSelectedId: (id) => set({ selectedId: id }),
  setCursorWorld: (point) => set({ cursorWorld: point }),
  setDraftPoint: (point) => set({ draftPoint: point }),
  allWaypoints: () => {
    const state = get();
    return [
      ...buildTrajectoryWaypoints(state.trajectoryPoints, state.trajectorySegments, state.spacing),
      ...state.elements.flatMap((element) => {
      if (element.type === 'line' || element.type === 'arc') {
        return element.waypoints;
      }
      return [];
      }),
    ];
  },
}));

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(8, Math.max(0.25, zoom));
}

export function buildTrajectoryWaypoints(
  points: WorldPoint[],
  segments: TrajectorySegment[],
  spacing: number,
): Waypoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0], yaw: 0 }];

  return points.flatMap((point, index) => {
    const next = points[index + 1];
    if (!next) return [];

    const segment = segments[index];
    const waypoints =
      segment?.type === 'arc'
        ? generateArcThroughEndpointsWaypoints(point, next, segment.radius, segment.clockwise, spacing)
        : generateLineWaypoints(point, next, spacing);
    return index === 0 ? waypoints : waypoints.slice(1);
  });
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
