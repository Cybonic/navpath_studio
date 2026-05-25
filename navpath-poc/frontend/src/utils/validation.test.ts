import { describe, expect, it } from 'vitest';

import { validateWaypoints } from './validation';

describe('validateWaypoints', () => {
  it('marks paths with fewer than two poses invalid', () => {
    const report = validateWaypoints([{ x: 0, y: 0, yaw: 0 }], {
      maxSpacing: 0.3,
      maxYawJumpDeg: 30,
    });

    expect(report.status).toBe('invalid');
    expect(report.errors[0].type).toBe('too_few_poses');
  });

  it('warns on excessive waypoint spacing and yaw jumps', () => {
    const report = validateWaypoints(
      [
        { x: 0, y: 0, yaw: 0 },
        { x: 1, y: 0, yaw: Math.PI },
      ],
      {
        maxSpacing: 0.3,
        maxYawJumpDeg: 30,
      },
    );

    expect(report.status).toBe('valid_with_warnings');
    expect(report.warnings.map((issue) => issue.type)).toContain('max_spacing_exceeded');
    expect(report.warnings.map((issue) => issue.type)).toContain('yaw_jump');
  });
});
