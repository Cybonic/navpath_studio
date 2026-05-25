import type { ControlPoint, SmoothingSettings, ValidationIssue, Waypoint, WorldPoint } from '../types';
import { distance } from './coordinates';
import { normalizeAngle, waypointWithOrientation } from './headingGeneration';

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
  const smoothedPolyline = buildSmoothedPolyline(roughPolyline, settings, spacing, warnings);

  return {
    waypoints: resamplePolyline(smoothedPolyline, spacing, 'computed_path'),
    warnings,
  };
}

function buildSmoothedPolyline(
  points: WorldPoint[],
  settings: SmoothingSettings,
  spacing: number,
  warnings: ValidationIssue[],
): WorldPoint[] {
  if (!settings.enabled || settings.method === 'none' || points.length < 3) {
    return points;
  }

  const interpolationResolution = clampSpacing(settings.interpolation_resolution_m);

  switch (settings.method) {
    case 'corner_rounding':
      return buildCornerRoundedPolyline(points, settings, spacing, warnings);
    case 'chaikin':
      return buildChaikinPolyline(points, settings.smoothing_strength);
    case 'catmull_rom':
      return buildCatmullRomPolyline(points, interpolationResolution, settings.smoothing_strength);
    case 'cubic_spline':
      return buildCubicSplinePolyline(points, interpolationResolution);
    case 'bezier':
      return buildBezierPolyline(points, interpolationResolution, settings.smoothing_strength);
    case 'savitzky_golay':
      return buildSavitzkyGolayPolyline(points, interpolationResolution, settings.smoothing_strength);
    default:
      return points;
  }
}

export function resamplePolyline(points: WorldPoint[], spacing: number, sourcePrimitiveId?: string): Waypoint[] {
  const cleaned = removeDuplicatePoints(points);
  if (cleaned.length === 0) return [];
  if (cleaned.length === 1) {
    return [
      waypointWithOrientation({
        id: createId('wp'),
        point: cleaned[0],
        yaw: 0,
        sourcePrimitiveId,
      }),
    ];
  }

  const safeSpacing = clampSpacing(spacing);
  const segments = cleaned.slice(1).map((point, index) => ({
    start: cleaned[index],
    end: point,
    length: distance(cleaned[index], point),
  }));
  const totalLength = segments.reduce((total, segment) => total + segment.length, 0);
  if (totalLength <= EPSILON) {
    return [
      waypointWithOrientation({
        id: createId('wp'),
        point: cleaned[0],
        yaw: 0,
        sourcePrimitiveId,
      }),
    ];
  }

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
    return waypointWithOrientation({
      id: createId('wp'),
      point: { x, y },
      yaw,
      sourcePrimitiveId,
    });
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

    const incomingDirection = {
      x: (corner.x - previous.x) / incomingLength,
      y: (corner.y - previous.y) / incomingLength,
    };
    const outgoingDirection = {
      x: (next.x - corner.x) / outgoingLength,
      y: (next.y - corner.y) / outgoingLength,
    };
    const headingChange = Math.acos(clamp(dot(incomingDirection, outgoingDirection), -1, 1));

    if (headingChange < 0.03 || Math.PI - headingChange < 0.03) {
      pushIfDistinct(output, corner);
      continue;
    }

    const maxTangentDistance = Math.min(incomingLength, outgoingLength) * 0.45;
    let radius = requestedRadius;
    let tangentDistance = radius * Math.tan(headingChange / 2);

    if (tangentDistance > maxTangentDistance) {
      tangentDistance = maxTangentDistance;
      radius = tangentDistance / Math.tan(headingChange / 2);
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
      x: corner.x - incomingDirection.x * tangentDistance,
      y: corner.y - incomingDirection.y * tangentDistance,
    };
    const tangentEnd = {
      x: corner.x + outgoingDirection.x * tangentDistance,
      y: corner.y + outgoingDirection.y * tangentDistance,
    };
    const turnSign = Math.sign(cross(incomingDirection, outgoingDirection));
    if (turnSign === 0) {
      pushIfDistinct(output, corner);
      continue;
    }
    const normal = turnSign > 0
      ? { x: -incomingDirection.y, y: incomingDirection.x }
      : { x: incomingDirection.y, y: -incomingDirection.x };
    const center = {
      x: tangentStart.x + normal.x * radius,
      y: tangentStart.y + normal.y * radius,
    };
    const startAngle = Math.atan2(tangentStart.y - center.y, tangentStart.x - center.x);
    const endAngle = Math.atan2(tangentEnd.y - center.y, tangentEnd.x - center.x);
    const delta = normalizeArcDelta(startAngle, endAngle, turnSign > 0);
    const arcLength = Math.abs(delta) * radius;
    const samples = Math.max(4, Math.ceil(arcLength / spacing));

    pushIfDistinct(output, tangentStart);
    for (let sample = 1; sample < samples; sample += 1) {
      const t = sample / samples;
      const angle = startAngle + delta * t;
      pushIfDistinct(output, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
    }
    pushIfDistinct(output, tangentEnd);
  }

  pushIfDistinct(output, points[points.length - 1]);
  return output;
}

function buildChaikinPolyline(points: WorldPoint[], smoothingStrength: number): WorldPoint[] {
  const weight = Math.min(0.45, Math.max(0.05, smoothingStrength * 0.45));
  const output: WorldPoint[] = [points[0]];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    output.push({
      x: start.x * (1 - weight) + end.x * weight,
      y: start.y * (1 - weight) + end.y * weight,
    });
    output.push({
      x: start.x * weight + end.x * (1 - weight),
      y: start.y * weight + end.y * (1 - weight),
    });
  }
  output.push(points[points.length - 1]);
  return output;
}

function buildCatmullRomPolyline(points: WorldPoint[], resolution: number, smoothingStrength: number): WorldPoint[] {
  const tension = 1 - Math.min(1, Math.max(0, smoothingStrength)) * 0.75;
  const output: WorldPoint[] = [points[0]];

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const samples = Math.max(2, Math.ceil(distance(p1, p2) / resolution));

    for (let sample = 1; sample <= samples; sample += 1) {
      const t = sample / samples;
      pushIfDistinct(output, catmullRomPoint(p0, p1, p2, p3, t, tension));
    }
  }

  return output;
}

function buildBezierPolyline(points: WorldPoint[], resolution: number, smoothingStrength: number): WorldPoint[] {
  const handleScale = Math.min(0.45, Math.max(0.05, smoothingStrength * 0.35));
  const output: WorldPoint[] = [points[0]];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 2)];
    const control1 = {
      x: start.x + (end.x - previous.x) * handleScale,
      y: start.y + (end.y - previous.y) * handleScale,
    };
    const control2 = {
      x: end.x - (next.x - start.x) * handleScale,
      y: end.y - (next.y - start.y) * handleScale,
    };
    const samples = Math.max(2, Math.ceil(distance(start, end) / resolution));

    for (let sample = 1; sample <= samples; sample += 1) {
      const t = sample / samples;
      pushIfDistinct(output, cubicBezierPoint(start, control1, control2, end, t));
    }
  }

  return output;
}

function buildSavitzkyGolayPolyline(points: WorldPoint[], resolution: number, smoothingStrength: number): WorldPoint[] {
  const sampled = resamplePolyline(points, resolution).map(({ x, y }) => ({ x, y }));
  if (sampled.length < 5) return sampled;

  const strength = Math.min(1, Math.max(0, smoothingStrength));
  const output: WorldPoint[] = [sampled[0], sampled[1]];

  for (let index = 2; index < sampled.length - 2; index += 1) {
    const filtered = {
      x:
        (-3 * sampled[index - 2].x +
          12 * sampled[index - 1].x +
          17 * sampled[index].x +
          12 * sampled[index + 1].x -
          3 * sampled[index + 2].x) /
        35,
      y:
        (-3 * sampled[index - 2].y +
          12 * sampled[index - 1].y +
          17 * sampled[index].y +
          12 * sampled[index + 1].y -
          3 * sampled[index + 2].y) /
        35,
    };
    output.push({
      x: sampled[index].x * (1 - strength) + filtered.x * strength,
      y: sampled[index].y * (1 - strength) + filtered.y * strength,
    });
  }

  output.push(sampled[sampled.length - 2], sampled[sampled.length - 1]);
  return output;
}

function buildCubicSplinePolyline(points: WorldPoint[], resolution: number): WorldPoint[] {
  const distances = cumulativeDistances(points);
  const totalLength = distances[distances.length - 1];
  if (totalLength <= EPSILON) return points;

  const splineX = buildNaturalCubicSpline(distances, points.map((point) => point.x));
  const splineY = buildNaturalCubicSpline(distances, points.map((point) => point.y));
  const samples = Math.max(2, Math.ceil(totalLength / resolution));
  const output: WorldPoint[] = [];

  for (let sample = 0; sample <= samples; sample += 1) {
    const s = (totalLength * sample) / samples;
    output.push({ x: evaluateSpline(splineX, s), y: evaluateSpline(splineY, s) });
  }

  output[0] = points[0];
  output[output.length - 1] = points[points.length - 1];
  return output;
}

function catmullRomPoint(
  p0: WorldPoint,
  p1: WorldPoint,
  p2: WorldPoint,
  p3: WorldPoint,
  t: number,
  tension: number,
): WorldPoint {
  const t2 = t * t;
  const t3 = t2 * t;
  const m1 = { x: (p2.x - p0.x) * tension, y: (p2.y - p0.y) * tension };
  const m2 = { x: (p3.x - p1.x) * tension, y: (p3.y - p1.y) * tension };
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return {
    x: h00 * p1.x + h10 * m1.x + h01 * p2.x + h11 * m2.x,
    y: h00 * p1.y + h10 * m1.y + h01 * p2.y + h11 * m2.y,
  };
}

function cubicBezierPoint(
  start: WorldPoint,
  control1: WorldPoint,
  control2: WorldPoint,
  end: WorldPoint,
  t: number,
): WorldPoint {
  const inverse = 1 - t;
  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse * inverse * t * control1.x +
      3 * inverse * t * t * control2.x +
      t ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse * inverse * t * control1.y +
      3 * inverse * t * t * control2.y +
      t ** 3 * end.y,
  };
}

function cumulativeDistances(points: WorldPoint[]): number[] {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distances.push(distances[index - 1] + distance(points[index - 1], points[index]));
  }
  return distances;
}

interface CubicSpline {
  x: number[];
  a: number[];
  b: number[];
  c: number[];
  d: number[];
}

function buildNaturalCubicSpline(x: number[], y: number[]): CubicSpline {
  const n = x.length - 1;
  const a = y.slice();
  const b = new Array<number>(n).fill(0);
  const d = new Array<number>(n).fill(0);
  const h = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) h[i] = x[i + 1] - x[i];

  const alpha = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i += 1) {
    alpha[i] = (3 / h[i]) * (a[i + 1] - a[i]) - (3 / h[i - 1]) * (a[i] - a[i - 1]);
  }

  const c = new Array<number>(n + 1).fill(0);
  const l = new Array<number>(n + 1).fill(1);
  const mu = new Array<number>(n + 1).fill(0);
  const z = new Array<number>(n + 1).fill(0);

  for (let i = 1; i < n; i += 1) {
    l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  for (let j = n - 1; j >= 0; j -= 1) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (a[j + 1] - a[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  return { x, a, b, c, d };
}

function evaluateSpline(spline: CubicSpline, value: number): number {
  const segment = Math.min(
    spline.x.length - 2,
    Math.max(0, spline.x.findIndex((x, index) => index < spline.x.length - 1 && value <= spline.x[index + 1])),
  );
  const dx = value - spline.x[segment];
  return spline.a[segment] + spline.b[segment] * dx + spline.c[segment] * dx * dx + spline.d[segment] * dx * dx * dx;
}

function removeDuplicatePoints<T extends WorldPoint>(points: T[]): T[] {
  return points.filter((point, index) => index === 0 || distance(points[index - 1], point) > EPSILON);
}

function pushIfDistinct(points: WorldPoint[], point: WorldPoint): void {
  if (points.length === 0 || distance(points[points.length - 1], point) > EPSILON) {
    points.push(point);
  }
}

function dot(a: WorldPoint, b: WorldPoint): number {
  return a.x * b.x + a.y * b.y;
}

function cross(a: WorldPoint, b: WorldPoint): number {
  return a.x * b.y - a.y * b.x;
}

function normalizeArcDelta(startAngle: number, endAngle: number, counterClockwise: boolean): number {
  let delta = normalizeAngle(endAngle - startAngle);
  if (counterClockwise && delta <= 0) delta += Math.PI * 2;
  if (!counterClockwise && delta >= 0) delta -= Math.PI * 2;
  return delta;
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
