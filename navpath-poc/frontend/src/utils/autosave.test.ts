import { describe, expect, it } from 'vitest';

import {
  clearAutosaveSnapshot,
  loadAutosavePreference,
  loadAutosaveSnapshot,
  saveAutosavePreference,
  saveAutosaveSnapshot,
  type AutosaveSnapshot,
} from './autosave';

describe('autosave storage helpers', () => {
  it('round-trips snapshots and preferences', () => {
    const storage = new MemoryStorage();
    const snapshot: AutosaveSnapshot = {
      version: 1,
      saved_at: '2026-05-25T12:00:00.000Z',
      map: null,
      occupancyGrid: null,
      imageDataUrl: null,
      trajectoryPoints: [],
      trajectorySegments: [],
      smoothingSettings: {
        enabled: true,
        method: 'corner_rounding',
        waypoint_spacing: 0.1,
        corner_radius: 0.5,
        smoothing_strength: 0.5,
        interpolation_resolution_m: 0.05,
        preserve_endpoints: true,
        preserve_action_attachments: true,
        min_turning_radius: 0.8,
        max_yaw_jump_deg: 30,
        max_deviation_from_control_polyline_m: 0.5,
        obstacle_avoidance_enabled: false,
        obstacle_avoidance_clearance_m: 0.2,
        obstacle_avoidance_max_perturbation_m: 1.0,
        obstacle_avoidance_max_iterations: 50,
      },
      robotProfile: {
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
          max_angular_velocity: 1,
          min_turning_radius: 0.8,
        },
        path_constraints: {
          default_spacing: 0.1,
          max_spacing: 0.3,
          min_spacing: 0.02,
          max_yaw_jump_deg: 30,
        },
        controller_profile: 'generic',
      },
      computedTrajectory: null,
      orientationDisplay: {
        show_arrows: true,
        show_yaw_labels: false,
        arrow_stride: 1,
        arrow_length_m: 0.25,
        selected_waypoint_show_quaternion: true,
      },
      actionNodes: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
    };

    saveAutosaveSnapshot(snapshot, storage);
    saveAutosavePreference(false, storage);

    expect(loadAutosaveSnapshot(storage)).toEqual(snapshot);
    expect(loadAutosavePreference(storage)).toBe(false);

    clearAutosaveSnapshot(storage);
    expect(loadAutosaveSnapshot(storage)).toBeNull();
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
