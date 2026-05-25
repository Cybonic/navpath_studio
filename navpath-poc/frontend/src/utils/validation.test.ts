import { describe, expect, it } from 'vitest';

import type { RobotProfile } from '../types';
import { validateWaypoints } from './validation';

const genericRobot: RobotProfile = {
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
};

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

  it('treats tight curvature as blocking for Ackermann profiles', () => {
    const report = validateWaypoints(
      [
        { x: 0, y: 0, yaw: 0 },
        { x: 0.1, y: 0, yaw: Math.PI / 2 },
        { x: 0.1, y: 0.1, yaw: Math.PI / 2 },
      ],
      {
        robotProfile: {
          ...genericRobot,
          kinematics: {
            ...genericRobot.kinematics,
            type: 'ackermann',
            can_rotate_in_place: false,
          },
        },
        maxSpacing: 0.3,
        maxYawJumpDeg: 180,
      },
    );

    expect(report.status).toBe('invalid');
    expect(report.errors.map((issue) => issue.type)).toContain('curvature_exceeded');
  });

  it('reports curvature as a warning for rotate-in-place profiles', () => {
    const report = validateWaypoints(
      [
        { x: 0, y: 0, yaw: 0 },
        { x: 0.1, y: 0, yaw: Math.PI / 2 },
        { x: 0.1, y: 0.1, yaw: Math.PI / 2 },
      ],
      {
        robotProfile: genericRobot,
        maxSpacing: 0.3,
        maxYawJumpDeg: 180,
      },
    );

    expect(report.status).toBe('valid_with_warnings');
    expect(report.warnings.map((issue) => issue.type)).toContain('curvature_exceeded');
  });

  it('rejects paths that cross occupied occupancy-grid cells', () => {
    const cells = new Array(16).fill(0);
    cells[2 * 4 + 1] = 100;

    const report = validateWaypoints(
      [
        { x: 1, y: 2, yaw: 0 },
        { x: 2, y: 2, yaw: 0 },
      ],
      {
        map: {
          image: 'test.pgm',
          mode: 'trinary',
          resolution: 1,
          origin: [0, 0, 0],
          negate: 0,
          occupied_thresh: 0.65,
          free_thresh: 0.25,
          width: 4,
          height: 4,
          frame_id: 'map',
        },
        occupancyGrid: {
          width: 4,
          height: 4,
          cells,
        },
        maxSpacing: 2,
        maxYawJumpDeg: 30,
      },
    );

    expect(report.status).toBe('invalid');
    expect(report.errors.map((issue) => issue.type)).toContain('occupied_cell_intersection');
  });

  it('warns when paths cross unknown occupancy-grid cells', () => {
    const cells = new Array(16).fill(0);
    cells[2 * 4 + 1] = -1;

    const report = validateWaypoints(
      [
        { x: 1, y: 2, yaw: 0 },
        { x: 2, y: 2, yaw: 0 },
      ],
      {
        map: {
          image: 'test.pgm',
          mode: 'trinary',
          resolution: 1,
          origin: [0, 0, 0],
          negate: 0,
          occupied_thresh: 0.65,
          free_thresh: 0.25,
          width: 4,
          height: 4,
          frame_id: 'map',
        },
        occupancyGrid: {
          width: 4,
          height: 4,
          cells,
        },
        maxSpacing: 2,
        maxYawJumpDeg: 30,
      },
    );

    expect(report.status).toBe('valid_with_warnings');
    expect(report.warnings.map((issue) => issue.type)).toContain('unknown_cell_intersection');
  });
});
