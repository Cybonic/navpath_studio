import { describe, expect, it } from 'vitest';

import type { Waypoint } from '../types';
import { buildGoalsYaml, buildNavPath, subsampleByDistance } from './pathExport';

describe('path export', () => {
  it('exports map-frame positions with planar quaternions', () => {
    const path = buildNavPath([{ x: 1.2, y: -0.5, yaw: Math.PI / 2 }], 'map');

    expect(path.header.frame_id).toBe('map');
    expect(path.poses).toHaveLength(1);
    expect(path.poses[0].header.frame_id).toBe('map');
    expect(path.poses[0].pose.position).toEqual({ x: 1.2, y: -0.5, z: 0 });
    expect(path.poses[0].pose.orientation.z).toBeCloseTo(Math.sqrt(0.5));
    expect(path.poses[0].pose.orientation.w).toBeCloseTo(Math.sqrt(0.5));
  });

  it('uses stored waypoint quaternions when available', () => {
    const path = buildNavPath(
      [
        {
          x: 0,
          y: 0,
          yaw: Math.PI,
          orientation_quaternion: { x: 0, y: 0, z: 0.25, w: 0.75 },
        },
      ],
      'map',
    );

    expect(path.poses[0].pose.orientation).toEqual({ x: 0, y: 0, z: 0.25, w: 0.75 });
  });
});

describe('subsampleByDistance', () => {
  function wp(x: number, y: number): Waypoint {
    return { x, y, yaw: 0 };
  }

  it('returns empty array for empty input', () => {
    expect(subsampleByDistance([], 1.0)).toEqual([]);
  });

  it('returns single waypoint unchanged', () => {
    expect(subsampleByDistance([wp(1, 2)], 1.0)).toHaveLength(1);
  });

  it('always includes first and last waypoints', () => {
    // 10 points spaced 0.1 m apart, stride 5 m → only first and last pass
    const points = Array.from({ length: 10 }, (_, i) => wp(i * 0.1, 0));
    const result = subsampleByDistance(points, 5.0);
    expect(result[0]).toBe(points[0]);
    expect(result[result.length - 1]).toBe(points[points.length - 1]);
  });

  it('samples roughly every strideM metres along a straight line', () => {
    // 11 points at 0.5 m intervals → total 5 m; stride 1 m → ~5 samples + start = ~6
    const points = Array.from({ length: 11 }, (_, i) => wp(i * 0.5, 0));
    const result = subsampleByDistance(points, 1.0);
    // first (0m), ~1m, ~2m, ~3m, ~4m, last (5m) → 6 points
    expect(result.length).toBeGreaterThanOrEqual(5);
    expect(result.length).toBeLessThanOrEqual(7);
  });
});

describe('buildGoalsYaml', () => {
  const dense: Waypoint[] = Array.from({ length: 21 }, (_, i) => ({
    x: i * 0.5,
    y: 0,
    yaw: 0,
  }));

  it('produces a YAML string containing the goals: key', () => {
    const yaml = buildGoalsYaml(dense, 'map', 1.0);
    expect(yaml).toMatch(/^goals:/m);
  });

  it('includes the correct frame_id in each goal', () => {
    const yaml = buildGoalsYaml(dense, 'robot_map', 1.0);
    const matches = yaml.match(/frame_id: robot_map/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(0);
  });

  it('produces fewer goals than the dense waypoint count for large strides', () => {
    const yaml = buildGoalsYaml(dense, 'map', 2.0);
    const goalCount = (yaml.match(/- header:/g) ?? []).length;
    expect(goalCount).toBeLessThan(dense.length);
    expect(goalCount).toBeGreaterThanOrEqual(2); // at least first + last
  });

  it('handles two-waypoint degenerate path', () => {
    const two: Waypoint[] = [
      { x: 0, y: 0, yaw: 0 },
      { x: 1, y: 0, yaw: 0 },
    ];
    const yaml = buildGoalsYaml(two, 'map', 5.0);
    const goalCount = (yaml.match(/- header:/g) ?? []).length;
    expect(goalCount).toBe(2); // first + last always included
  });
});
