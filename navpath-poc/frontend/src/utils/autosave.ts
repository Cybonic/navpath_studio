import type {
  ActionNode,
  ComputedTrajectory,
  ControlPoint,
  MapMetadata,
  OccupancyGrid,
  OrientationDisplaySettings,
  RobotProfile,
  SmoothingSettings,
  TrajectorySegment,
} from '../types';

export const AUTOSAVE_KEY = 'navpath-studio.autosave.v1';
export const AUTOSAVE_PREF_KEY = 'navpath-studio.autosave.enabled';

export interface AutosaveSnapshot {
  version: 1;
  saved_at: string;
  map: MapMetadata | null;
  occupancyGrid: OccupancyGrid | null;
  imageDataUrl: string | null;
  trajectoryPoints: ControlPoint[];
  trajectorySegments: TrajectorySegment[];
  smoothingSettings: SmoothingSettings;
  robotProfile: RobotProfile;
  computedTrajectory: ComputedTrajectory | null;
  orientationDisplay: OrientationDisplaySettings;
  actionNodes: ActionNode[];
  zoom: number;
  pan: { x: number; y: number };
}

export function loadAutosaveSnapshot(storage: Storage | undefined = safeStorage()): AutosaveSnapshot | null {
  if (!storage) return null;
  const raw = storage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AutosaveSnapshot;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAutosaveSnapshot(snapshot: AutosaveSnapshot, storage: Storage | undefined = safeStorage()): void {
  if (!storage) return;
  storage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
}

export function clearAutosaveSnapshot(storage: Storage | undefined = safeStorage()): void {
  storage?.removeItem(AUTOSAVE_KEY);
}

export function loadAutosavePreference(storage: Storage | undefined = safeStorage()): boolean | null {
  if (!storage) return null;
  const raw = storage.getItem(AUTOSAVE_PREF_KEY);
  if (raw === null) return null;
  return raw === 'true';
}

export function saveAutosavePreference(enabled: boolean, storage: Storage | undefined = safeStorage()): void {
  storage?.setItem(AUTOSAVE_PREF_KEY, enabled ? 'true' : 'false');
}

export function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
