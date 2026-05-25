import type { MapMetadata, OccupancyGrid, RobotProfile, ValidationIssue, ValidationReport, Waypoint } from '../types';
import { distance, worldToPixel } from './coordinates';
import { normalizeAngle, waypointQuaternion } from './headingGeneration';

const EPSILON = 1e-6;

export function validateWaypoints(
  waypoints: Waypoint[],
  options: {
    map?: MapMetadata | null;
    occupancyGrid?: OccupancyGrid | null;
    robotProfile?: RobotProfile;
    maxSpacing: number;
    maxYawJumpDeg: number;
  },
): ValidationReport {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const spacings = segmentSpacings(waypoints);
  const duplicateWaypointCount = spacings.filter((spacing) => spacing <= EPSILON).length;
  const zeroLengthSegmentCount = duplicateWaypointCount;
  const maxYawJumpDeg = computeMaxYawJumpDeg(waypoints);
  const maxCurvature = computeMaxCurvature(waypoints);
  const pathLength = spacings.reduce((total, spacing) => total + spacing, 0);
  const maxSpacing = spacings.length > 0 ? Math.max(...spacings) : 0;
  const minSpacing = spacings.length > 0 ? Math.min(...spacings) : 0;
  const meanSpacing = spacings.length > 0 ? pathLength / spacings.length : 0;

  if (waypoints.length < 2) {
    errors.push({
      type: 'too_few_poses',
      severity: 'error',
      message: 'Export requires at least two generated poses.',
    });
  }

  waypoints.forEach((waypoint, index) => {
    if (!Number.isFinite(waypoint.x) || !Number.isFinite(waypoint.y) || !Number.isFinite(waypoint.yaw)) {
      errors.push({
        type: 'non_finite_pose',
        severity: 'error',
        message: `Waypoint ${index + 1} contains a non-finite position or yaw.`,
        waypoint_index: index,
      });
    }
    const quaternion = waypointQuaternion(waypoint);
    if (
      !Number.isFinite(quaternion.x) ||
      !Number.isFinite(quaternion.y) ||
      !Number.isFinite(quaternion.z) ||
      !Number.isFinite(quaternion.w)
    ) {
      errors.push({
        type: 'non_finite_orientation',
        severity: 'error',
        message: `Waypoint ${index + 1} contains a non-finite orientation quaternion.`,
        waypoint_index: index,
      });
    }
  });

  if (duplicateWaypointCount > 0) {
    warnings.push({
      type: 'duplicate_waypoints',
      severity: 'warning',
      message: `${duplicateWaypointCount} adjacent generated waypoint pair(s) are duplicated.`,
    });
  }

  if (maxSpacing > options.maxSpacing) {
    warnings.push({
      type: 'max_spacing_exceeded',
      severity: 'warning',
      message: `Maximum waypoint spacing is ${maxSpacing.toFixed(3)} m, above the ${options.maxSpacing.toFixed(3)} m limit.`,
    });
  }

  if (maxYawJumpDeg > options.maxYawJumpDeg) {
    warnings.push({
      type: 'yaw_jump',
      severity: 'warning',
      message: `Maximum yaw jump is ${maxYawJumpDeg.toFixed(1)} deg, above the ${options.maxYawJumpDeg.toFixed(1)} deg limit.`,
    });
  }

  if (options.robotProfile && Number.isFinite(maxCurvature) && maxCurvature > 0) {
    const minTurningRadius = options.robotProfile.motion_limits.min_turning_radius;
    const curvatureLimit = minTurningRadius > 0 ? 1 / minTurningRadius : Number.POSITIVE_INFINITY;
    if (maxCurvature > curvatureLimit) {
      const severity = curvatureViolationIsBlocking(options.robotProfile) ? 'error' : 'warning';
      const issue: ValidationIssue = {
        type: 'curvature_exceeded',
        severity,
        message: `Maximum curvature is ${maxCurvature.toFixed(3)} 1/m, above the robot limit ${curvatureLimit.toFixed(3)} 1/m.`,
      };
      if (severity === 'error') {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }
  }

  if (pathSelfIntersects(waypoints)) {
    warnings.push({
      type: 'self_intersection',
      severity: 'warning',
      message: 'Generated path appears to cross itself.',
    });
  }

  if (options.map) {
    waypoints.forEach((waypoint, index) => {
      const pixel = worldToPixel(waypoint, options.map as MapMetadata);
      if (pixel.px < 0 || pixel.py < 0 || pixel.px >= options.map!.width || pixel.py >= options.map!.height) {
        warnings.push({
          type: 'outside_map',
          severity: 'warning',
          message: `Waypoint ${index + 1} is outside the uploaded map extent.`,
          waypoint_index: index,
        });
      }
    });
  }

  if (options.map && options.occupancyGrid) {
    const occupancyIssues = validateAgainstOccupancy(waypoints, options.map, options.occupancyGrid);
    errors.push(...occupancyIssues.errors);
    warnings.push(...occupancyIssues.warnings);
  }

  return {
    status: errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'valid_with_warnings' : 'valid',
    metrics: {
      waypoint_count: waypoints.length,
      path_length_m: pathLength,
      mean_spacing_m: meanSpacing,
      min_spacing_m: minSpacing,
      max_spacing_m: maxSpacing,
      max_yaw_jump_deg: maxYawJumpDeg,
      zero_length_segment_count: zeroLengthSegmentCount,
      duplicate_waypoint_count: duplicateWaypointCount,
      max_curvature: maxCurvature,
    },
    warnings,
    errors,
  };
}

function validateAgainstOccupancy(
  waypoints: Waypoint[],
  map: MapMetadata,
  occupancyGrid: OccupancyGrid,
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const occupiedHits = new Set<string>();
  const unknownHits = new Set<string>();

  for (let index = 0; index < waypoints.length; index += 1) {
    sampleWaypointPair(waypoints[index], waypoints[index + 1] ?? null, map).forEach((sample) => {
      const cell = occupancyCellAt(sample.x, sample.y, occupancyGrid);
      if (cell === 100) {
        occupiedHits.add(`${sample.x},${sample.y}`);
      } else if (cell === -1) {
        unknownHits.add(`${sample.x},${sample.y}`);
      }
    });
  }

  if (occupiedHits.size > 0) {
    errors.push({
      type: 'occupied_cell_intersection',
      severity: 'error',
      message: `Generated path intersects ${occupiedHits.size} occupied map cell(s).`,
    });
  }

  if (unknownHits.size > 0) {
    warnings.push({
      type: 'unknown_cell_intersection',
      severity: 'warning',
      message: `Generated path crosses ${unknownHits.size} unknown map cell(s).`,
    });
  }

  return { errors, warnings };
}

function sampleWaypointPair(
  start: Waypoint,
  end: Waypoint | null,
  map: MapMetadata,
): Array<{ x: number; y: number }> {
  const startPixel = worldToPixel(start, map);
  if (!end) return [roundPixel(startPixel)];

  const endPixel = worldToPixel(end, map);
  const dx = endPixel.px - startPixel.px;
  const dy = endPixel.py - startPixel.py;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));

  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    return roundPixel({
      px: startPixel.px + dx * t,
      py: startPixel.py + dy * t,
    });
  });
}

function roundPixel(pixel: { px: number; py: number }): { x: number; y: number } {
  return {
    x: Math.round(pixel.px),
    y: Math.round(pixel.py),
  };
}

function occupancyCellAt(x: number, y: number, occupancyGrid: OccupancyGrid): number | null {
  if (x < 0 || y < 0 || x >= occupancyGrid.width || y >= occupancyGrid.height) return null;
  return occupancyGrid.cells[y * occupancyGrid.width + x] ?? null;
}

function segmentSpacings(waypoints: Waypoint[]): number[] {
  return waypoints.slice(1).map((waypoint, index) => distance(waypoints[index], waypoint));
}

function computeMaxYawJumpDeg(waypoints: Waypoint[]): number {
  if (waypoints.length < 2) return 0;
  return waypoints.slice(1).reduce((maxJump, waypoint, index) => {
    const jump = Math.abs(normalizeAngle(waypoint.yaw - waypoints[index].yaw)) * (180 / Math.PI);
    return Math.max(maxJump, jump);
  }, 0);
}

function computeMaxCurvature(waypoints: Waypoint[]): number {
  if (waypoints.length < 3) return 0;
  let maxCurvature = 0;
  for (let index = 1; index < waypoints.length; index += 1) {
    const spacing = distance(waypoints[index - 1], waypoints[index]);
    if (spacing <= EPSILON) continue;
    const yawChange = Math.abs(normalizeAngle(waypoints[index].yaw - waypoints[index - 1].yaw));
    maxCurvature = Math.max(maxCurvature, yawChange / spacing);
  }
  return maxCurvature;
}

function curvatureViolationIsBlocking(robotProfile: RobotProfile): boolean {
  if (robotProfile.kinematics.type === 'ackermann') return true;
  return !robotProfile.kinematics.can_rotate_in_place;
}

function pathSelfIntersects(waypoints: Waypoint[]): boolean {
  if (waypoints.length < 4) return false;
  for (let a = 0; a < waypoints.length - 1; a += 1) {
    for (let b = a + 2; b < waypoints.length - 1; b += 1) {
      if (a === 0 && b === waypoints.length - 2) continue;
      if (segmentsIntersect(waypoints[a], waypoints[a + 1], waypoints[b], waypoints[b + 1])) {
        return true;
      }
    }
  }
  return false;
}

function segmentsIntersect(a: Waypoint, b: Waypoint, c: Waypoint, d: Waypoint): boolean {
  const ab1 = orientation(a, b, c);
  const ab2 = orientation(a, b, d);
  const cd1 = orientation(c, d, a);
  const cd2 = orientation(c, d, b);
  return ab1 * ab2 < 0 && cd1 * cd2 < 0;
}

function orientation(a: Waypoint, b: Waypoint, c: Waypoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
