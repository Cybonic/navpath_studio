import type { MapMetadata, ValidationIssue, ValidationReport, Waypoint } from '../types';
import { distance, worldToPixel } from './coordinates';

const EPSILON = 1e-6;

export function validateWaypoints(
  waypoints: Waypoint[],
  options: {
    map?: MapMetadata | null;
    maxSpacing: number;
    maxYawJumpDeg: number;
  },
): ValidationReport {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const spacings = segmentSpacings(waypoints);
  const duplicateWaypointCount = spacings.filter((spacing) => spacing <= EPSILON).length;
  const maxYawJumpDeg = computeMaxYawJumpDeg(waypoints);
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

  if (options.map) {
    waypoints.forEach((waypoint, index) => {
      const pixel = worldToPixel(waypoint, options.map as MapMetadata);
      if (pixel.px < 0 || pixel.py < 0 || pixel.px > options.map!.width || pixel.py > options.map!.height) {
        warnings.push({
          type: 'outside_map',
          severity: 'warning',
          message: `Waypoint ${index + 1} is outside the uploaded map extent.`,
          waypoint_index: index,
        });
      }
    });
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
      duplicate_waypoint_count: duplicateWaypointCount,
    },
    warnings,
    errors,
  };
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

function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}
