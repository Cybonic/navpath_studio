import { create } from 'zustand';

import type { DrawingElement, MapMetadata, ToolMode, Waypoint, WorldPoint } from '../types';

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
  elements: [],
  selectedId: null,
  cursorWorld: null,
  draftPoint: null,
  setMap: (map, imageDataUrl) =>
    set({ map, imageDataUrl, elements: [], selectedId: null, zoom: 1, pan: { x: 0, y: 0 } }),
  setTool: (tool) => set({ tool, draftPoint: null }),
  setSpacing: (spacing) => set({ spacing }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomIn: () => set((state) => ({ zoom: clampZoom(state.zoom * 1.2) })),
  zoomOut: () => set((state) => ({ zoom: clampZoom(state.zoom / 1.2) })),
  resetZoom: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
  setPan: (pan) => set({ pan }),
  panBy: (delta) => set((state) => ({ pan: { x: state.pan.x + delta.x, y: state.pan.y + delta.y } })),
  resetPan: () => set({ pan: { x: 0, y: 0 } }),
  addElement: (element) =>
    set((state) => ({
      elements: [...state.elements, element],
      selectedId: element.id,
      draftPoint: null,
    })),
  setSelectedId: (id) => set({ selectedId: id }),
  setCursorWorld: (point) => set({ cursorWorld: point }),
  setDraftPoint: (point) => set({ draftPoint: point }),
  allWaypoints: () =>
    get().elements.flatMap((element) => {
      if (element.type === 'line' || element.type === 'arc') {
        return element.waypoints;
      }
      return [];
    }),
}));

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(8, Math.max(0.25, zoom));
}
