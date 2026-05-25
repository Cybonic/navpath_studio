import { describe, expect, it } from 'vitest';

import type { ControlPoint, SmoothingMethod, SmoothingSettings } from '../types';
import { computeSmoothWaypoints } from './smoothing';

const settings: SmoothingSettings = {
  enabled: true,
  method: 'corner_rounding',
  waypoint_spacing: 0.1,
  corner_radius: 0.3,
  smoothing_strength: 0.5,
  interpolation_resolution_m: 0.05,
  preserve_endpoints: true,
  preserve_action_attachments: true,
  min_turning_radius: 0.1,
  max_yaw_jump_deg: 30,
  max_deviation_from_control_polyline_m: 0.5,
};

describe('computeSmoothWaypoints', () => {
  it('preserves endpoints and resamples a two-point path', () => {
    const points: ControlPoint[] = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 1, y: 0 },
    ];

    const result = computeSmoothWaypoints(points, settings);

    expect(result.waypoints[0].x).toBeCloseTo(0);
    expect(result.waypoints[0].y).toBeCloseTo(0);
    expect(result.waypoints[result.waypoints.length - 1].x).toBeCloseTo(1);
    expect(result.waypoints[result.waypoints.length - 1].y).toBeCloseTo(0);
    expect(result.waypoints.length).toBeGreaterThan(2);
  });

  it('rounds a sharp corner into more than the original rough points', () => {
    const points: ControlPoint[] = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 1, y: 0 },
      { id: 'c', x: 1, y: 1 },
    ];

    const result = computeSmoothWaypoints(points, settings);

    expect(result.waypoints.length).toBeGreaterThan(3);
    expect(result.waypoints[0].x).toBeCloseTo(0);
    expect(result.waypoints[result.waypoints.length - 1].y).toBeCloseTo(1);
  });

  it('resamples the rough polyline when smoothing method is none', () => {
    const points: ControlPoint[] = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 1, y: 0 },
      { id: 'c', x: 1, y: 1 },
    ];

    const result = computeSmoothWaypoints(points, { ...settings, method: 'none' });

    expect(result.waypoints.some((waypoint) => Math.abs(waypoint.x - 1) < 1e-6 && Math.abs(waypoint.y) < 1e-6)).toBe(true);
    expect(result.waypoints[0].x).toBeCloseTo(0);
    expect(result.waypoints[result.waypoints.length - 1].y).toBeCloseTo(1);
  });

  it.each<SmoothingMethod>([
    'none',
    'corner_rounding',
    'chaikin',
    'catmull_rom',
    'cubic_spline',
    'bezier',
    'savitzky_golay',
  ])('computes waypoints with %s smoothing while preserving endpoints', (method) => {
    const points: ControlPoint[] = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 1, y: 0 },
      { id: 'c', x: 1, y: 1 },
      { id: 'd', x: 2, y: 1 },
    ];

    const result = computeSmoothWaypoints(points, { ...settings, method });

    expect(result.waypoints.length).toBeGreaterThan(2);
    expect(result.waypoints[0].x).toBeCloseTo(0);
    expect(result.waypoints[0].y).toBeCloseTo(0);
    expect(result.waypoints[result.waypoints.length - 1].x).toBeCloseTo(2);
    expect(result.waypoints[result.waypoints.length - 1].y).toBeCloseTo(1);
  });
});
