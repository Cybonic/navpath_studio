import type { ControlPoint, SmoothingSettings, ValidationIssue, Waypoint, WorldPoint } from '../types';
import { distance } from './coordinates';

const EPSILON = 1e-6;

export interface SmoothResult {
  waypoints: Waypoint[];
  warnings: ValidationIssue[];
}

export function computeSmoothWaypoints(controlPoints: ControlPoint[], settings: SmoothingSettings): SmoothResult {
  const warnings: ValidationIssue[] = [];
  const spacing = clampSpacing(settings.waypoint_spacing);

  if (controlPoints.length === 0) {
    return { waypoints: [], warnings };
  }

  if (controlPoints.length === 1) {
    return {
      waypoints: [{ id: createId('wp'), x: controlPoints[0].x, y: controlPoints[0].y, yaw: 0 }],
      warnings,
    };
  }

  const roughPolyline = removeDuplicatePoints(controlPoints);
  const smoothedPolyline =
    settings.enabled && settings.method === 'corner_rounding' && roughPolyline.length > 2
      ? buildCornerRoundedPolyline(roughPolyline, settings, spacing, warnings)
      : settings.enabled && settings.method === 'chaikin' && roughPolyline.length > 2
        ? buildChaikinPolyline(roughPolyline)
        : roughPolyline;

  return {
    waypoints: resamplePolyline(smoothedPolyline, spacing),
    warnings,
  };
}

export function resamplePolyline(points: WorldPoint[], spacing: number): Waypoint[] {
  const cleaned = removeDuplicatePoints(points);
  if (cleaned.length === 0) return [];
  if (cleaned.length === 1) return [{ id: createId('wp'), ...cleaned[0], yaw: 0 }];

  const safeSpacing = clampSpacing(spacing);
  const segments = cleaned.slice(1).map((point, index) => ({
    start: cleaned[index],
    end: point,
    length: distance(cleaned[index], point),
  }));
  const totalLength = segments.reduce((total, segment) => total + segment.length, 0);
  if (totalLength <= EPSILON) return [{ id: createId('wp'), ...cleaned[0], yaw: 0 }];

  const targets: number[] = [];
  for (let target = 0; target < totalLength; target += safeSpacing) {
    targets.push(target);
  }
  if (targets.length === 0 || Math.abs(targets[targets.length - 1] - totalLength) > EPSILON) {
    targets.push(totalLength);
  }

  let segmentIndex = 0;
  let segmentStartDistance = 0;
  return targets.map((target) => {
    while (
      segmentIndex < segments.length - 1 &&
      segmentStartDistance + segments[segmentIndex].length < target - EPSILON
    ) {
      segmentStartDistance += segments[segmentIndex].length;
      segmentIndex += 1;
    }

    const segment = segments[segmentIndex];
    const segmentT = segment.length <= EPSILON ? 0 : (target - segmentStartDistance) / segment.length;
    const x = segment.start.x + (segment.end.x - segment.start.x) * segmentT;
    const y = segment.start.y + (segment.end.y - segment.start.y) * segmentT;
    const yaw = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x);
    return { id: createId('wp'), x, y, yaw };
  });
}

function buildCornerRoundedPolyline(
  points: WorldPoint[],
  settings: SmoothingSettings,
  spacing: number,
  warnings: ValidationIssue[],
): WorldPoint[] {
  const output: WorldPoint[] = [points[0]];
  const requestedRadius = Math.max(settings.corner_radius, settings.min_turning_radius ?? 0, EPSILON);

  if (settings.min_turning_radius && settings.corner_radius < settings.min_turning_radius) {
    warnings.push({
      type: 'corner_radius_clamped',
      severity: 'warning',
      message: `Corner radius was clamped to the robot minimum turning radius (${settings.min_turning_radius.toFixed(3)} m).`,
    });
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const incomingLength = distance(previous, corner);
    const outgoingLength = distance(corner, next);

    if (incomingLength <= EPSILON || outgoingLength <= EPSILON) {
      pushIfDistinct(output, corner);
      continue;
    }

    const towardPrevious = {
      x: (previous.x - corner.x) / incomingLength,
      y: (previous.y - corner.y) / incomingLength,
    };
    const towardNext = {
      x: (next.x - corner.x) / outgoingLength,
      y: (next.y - corner.y) / outgoingLength,
    };
    const interiorAngle = Math.acos(clamp(dot(towardPrevious, towardNext), -1, 1));
    const turnAngle = Math.PI - interiorAngle;

    if (turnAngle < 0.03 || interiorAngle < 0.03) {
      pushIfDistinct(output, corner);
      continue;
    }

    const maxTangentDistance = Math.min(incomingLength, outgoingLength) * 0.45;
    let radius = requestedRadius;
    let tangentDistance = radius / Math.tan(interiorAngle / 2);

    if (tangentDistance > maxTangentDistance) {
      tangentDistance = maxTangentDistance;
      radius = tangentDistance * Math.tan(interiorAngle / 2);
      warnings.push({
        type: 'corner_radius_reduced',
        severity: 'warning',
        message: `Corner ${index + 1} radius was reduced to ${radius.toFixed(3)} m to fit adjacent segment lengths.`,
        waypoint_index: index,
      });
    }

    if (tangentDistance <= EPSILON) {
      pushIfDistinct(output, corner);
      continue;
    }

    const tangentStart = {
      x: corner.x + towardPrevious.x * tangentDistance,
      y: corner.y + towardPrevious.y * tangentDistance,
    };
    const tangentEnd = {
      x: corner.x + towardNext.x * tangentDistance,
      y: corner.y + towardNext.y * tangentDistance,
    };
    const samples = Math.max(4, Math.ceil((Math.max(radius, spacing) * Math.max(turnAngle, 0.1)) / spacing));

    pushIfDistinct(output, tangentStart);
    for (let sample = 1; sample < samples; sample += 1) {
      const t = sample / samples;
      pushIfDistinct(output, quadraticPoint(tangentStart, corner, tangentEnd, t));
    }
    pushIfDistinct(output, tangentEnd);
  }

  pushIfDistinct(output, points[points.length - 1]);
  return output;
}

function buildChaikinPolyline(points: WorldPoint[]): WorldPoint[] {
  const output: WorldPoint[] = [points[0]];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    output.push({
      x: start.x * 0.75 + end.x * 0.25,
      y: start.y * 0.75 + end.y * 0.25,
    });
    output.push({
      x: start.x * 0.25 + end.x * 0.75,
      y: start.y * 0.25 + end.y * 0.75,
    });
  }
  output.push(points[points.length - 1]);
  return output;
}

function removeDuplicatePoints<T extends WorldPoint>(points: T[]): T[] {
  return points.filter((point, index) => index === 0 || distance(points[index - 1], point) > EPSILON);
}

function pushIfDistinct(points: WorldPoint[], point: WorldPoint): void {
  if (points.length === 0 || distance(points[points.length - 1], point) > EPSILON) {
    points.push(point);
  }
}

function quadraticPoint(start: WorldPoint, control: WorldPoint, end: WorldPoint, t: number): WorldPoint {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  };
}

function dot(a: WorldPoint, b: WorldPoint): number {
  return a.x * b.x + a.y * b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampSpacing(spacing: number): number {
  return Number.isFinite(spacing) && spacing > EPSILON ? spacing : 0.1;
}

function createId(prefix: string): string {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}
