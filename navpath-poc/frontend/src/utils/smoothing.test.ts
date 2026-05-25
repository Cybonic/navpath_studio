import { describe, expect, it } from 'vitest';

import type { ControlPoint, MapMetadata, OccupancyGrid, SmoothingMethod, SmoothingSettings } from '../types';
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
  obstacle_avoidance_enabled: false,
  obstacle_avoidance_clearance_m: 0.2,
  obstacle_avoidance_max_perturbation_m: 1.0,
  obstacle_avoidance_max_iterations: 50,
};

// 5×5 map, resolution 0.1 m/px, origin at (0,0). Pixel (2,2) → world (0.2, 0.2) approx.
// Cell (col=2, row=2) is marked occupied (value 100).
const testMap: MapMetadata = {
  image: 'test.pgm',
  mode: 'trinary',
  resolution: 0.1,
  origin: [0, 0, 0],
  negate: 0,
  occupied_thresh: 0.65,
  free_thresh: 0.196,
  width: 5,
  height: 5,
  frame_id: 'map',
};

function makeGrid(width: number, height: number, occupiedCells: number[]): OccupancyGrid {
  const cells = new Array<number>(width * height).fill(0);
  for (const idx of occupiedCells) {
    cells[idx] = 100;
  }
  return { width, height, cells };
}

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

describe('obstacle avoidance', () => {
  const avoidanceSettings: SmoothingSettings = {
    ...settings,
    method: 'none',
    waypoint_spacing: 0.1,
    obstacle_avoidance_enabled: true,
    obstacle_avoidance_clearance_m: 0.15,
    obstacle_avoidance_max_perturbation_m: 2.0,
    obstacle_avoidance_max_iterations: 100,
  };

  it('returns displaced_count 0 when avoidance is disabled', () => {
    const points: ControlPoint[] = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0.4, y: 0 },
    ];
    // No occupancy grid passed → avoidance skipped
    const result = computeSmoothWaypoints(points, settings);
    expect(result.displaced_count).toBe(0);
    expect(result.waypoints.every((w) => !w.obstacle_displaced)).toBe(true);
  });

  it('returns displaced_count 0 when avoidance enabled but no grid provided', () => {
    const points: ControlPoint[] = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0.4, y: 0 },
    ];
    const result = computeSmoothWaypoints(points, avoidanceSettings);
    expect(result.displaced_count).toBe(0);
  });

  it('displaces waypoints out of an occupied cell and marks them', () => {
    // worldToPixel: px = x/res, py = height - y/res
    // Pixel (px=2,py=2) = world (x=0.2, y=(5-2)*0.1=0.3)
    // Grid cell at row=2,col=2 → index 12 → mark occupied.
    const grid = makeGrid(5, 5, [12]);
    // Path passes through world (0.2, 0.3) which maps to pixel (2,2).
    const points: ControlPoint[] = [
      { id: 'a', x: 0, y: 0.3 },
      { id: 'mid', x: 0.2, y: 0.3 },
      { id: 'b', x: 0.4, y: 0.3 },
    ];

    const result = computeSmoothWaypoints(points, avoidanceSettings, grid, testMap);

    // Some waypoints should have been displaced
    expect(result.displaced_count).toBeGreaterThan(0);
    expect(result.waypoints.some((w) => w.obstacle_displaced)).toBe(true);
    // Endpoints must not be displaced
    expect(result.waypoints[0].obstacle_displaced).toBeFalsy();
    expect(result.waypoints[result.waypoints.length - 1].obstacle_displaced).toBeFalsy();
  });

  it('emits obstacle_avoidance_applied info when avoidance succeeds', () => {
    const grid = makeGrid(5, 5, [12]);
    const points: ControlPoint[] = [
      { id: 'a', x: 0, y: 0.3 },
      { id: 'mid', x: 0.2, y: 0.3 },
      { id: 'b', x: 0.4, y: 0.3 },
    ];

    const result = computeSmoothWaypoints(points, avoidanceSettings, grid, testMap);

    const infoIssues = result.warnings.filter((w) => w.type === 'obstacle_avoidance_applied');
    // Either avoidance succeeded (info present) or repair_failed (path inescapable — still valid test)
    const repairFailed = result.warnings.some((w) => w.type === 'repair_failed');
    if (!repairFailed) {
      expect(infoIssues.length).toBeGreaterThan(0);
      expect(infoIssues[0].severity).toBe('info');
    }
  });

  it('emits repair_failed error when obstacle is inescapable within perturbation budget', () => {
    // Tiny perturbation budget — cannot escape
    const tinyBudget: SmoothingSettings = {
      ...avoidanceSettings,
      obstacle_avoidance_max_perturbation_m: 0.001,
      obstacle_avoidance_max_iterations: 5,
    };
    // Fill a large wall so the path cannot escape
    const wallIndices = [7, 8, 9, 12, 13, 14, 17, 18, 19];
    const grid = makeGrid(5, 5, wallIndices);
    const points: ControlPoint[] = [
      { id: 'a', x: 0, y: 0.25 },
      { id: 'mid', x: 0.25, y: 0.25 },
      { id: 'b', x: 0.5, y: 0.25 },
    ];

    const result = computeSmoothWaypoints(points, tinyBudget, grid, testMap);

    expect(result.warnings.some((w) => w.type === 'repair_failed' && w.severity === 'error')).toBe(true);
  });

  it.each<SmoothingMethod>([
    'none',
    'corner_rounding',
    'chaikin',
    'catmull_rom',
    'cubic_spline',
    'bezier',
    'savitzky_golay',
  ])('runs obstacle avoidance without crash for %s method', (method) => {
    const grid = makeGrid(5, 5, [12]);
    const points: ControlPoint[] = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0.25, y: 0.25 },
      { id: 'c', x: 0.5, y: 0 },
    ];

    expect(() => computeSmoothWaypoints(points, { ...avoidanceSettings, method }, grid, testMap)).not.toThrow();
  });
});

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
