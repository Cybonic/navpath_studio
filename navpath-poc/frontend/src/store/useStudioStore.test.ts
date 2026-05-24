import { describe, expect, it } from 'vitest';

import { buildTrajectoryWaypoints } from './useStudioStore';

describe('buildTrajectoryWaypoints', () => {
  it('connects points sequentially and avoids duplicate segment joins', () => {
    const waypoints = buildTrajectoryWaypoints(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      [
        { id: 'a', type: 'line' },
        { id: 'b', type: 'line' },
      ],
      0.5,
    );

    expect(waypoints.map((point) => [point.x, point.y])).toEqual([
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 0.5],
      [1, 1],
    ]);
    expect(waypoints[0].yaw).toBeCloseTo(0);
    expect(waypoints[3].yaw).toBeCloseTo(Math.PI / 2);
  });

  it('generates editable arc segments between ordered points', () => {
    const waypoints = buildTrajectoryWaypoints(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [{ id: 'arc', type: 'arc', radius: 0.75, clockwise: false }],
      0.25,
    );

    expect(waypoints[0].x).toBeCloseTo(0);
    expect(waypoints[0].y).toBeCloseTo(0);
    expect(waypoints[waypoints.length - 1].x).toBeCloseTo(1);
    expect(waypoints[waypoints.length - 1].y).toBeCloseTo(0);
    expect(waypoints.length).toBeGreaterThan(2);
  });
});
