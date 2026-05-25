import { describe, expect, it } from 'vitest';

import { buildNavPath } from './pathExport';

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
