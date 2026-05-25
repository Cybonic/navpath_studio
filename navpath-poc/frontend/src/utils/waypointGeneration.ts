import type { Waypoint, WorldPoint } from '../types';
import { distance } from './coordinates';

const EPSILON = 1e-9;

export function generateLineWaypoints(
  start: WorldPoint,
  end: WorldPoint,
  spacing: number,
): Waypoint[] {
  const length = distance(start, end);
  const yaw = Math.atan2(end.y - start.y, end.x - start.x);
  if (length < EPSILON) {
    return [{ ...start, yaw }];
  }

  const segments = Math.max(1, Math.ceil(length / spacing));
  return Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments;
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      yaw,
    };
  });
}

export function generateArcWaypoints(
  center: WorldPoint,
  radius: number,
  startAngle: number,
  endAngle: number,
  clockwise: boolean,
  spacing: number,
): Waypoint[] {
  if (radius < EPSILON) {
    return [{ ...center, yaw: 0 }];
  }

  const delta = normalizeArcDelta(startAngle, endAngle, clockwise);
  const arcLength = Math.abs(delta) * radius;
  const segments = Math.max(1, Math.ceil(arcLength / spacing));

  return Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments;
    const angle = startAngle + delta * t;
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
      yaw: angle + (clockwise ? -Math.PI / 2 : Math.PI / 2),
    };
  });
}

export function generateArcThroughEndpointsWaypoints(
  start: WorldPoint,
  end: WorldPoint,
  radius: number,
  clockwise: boolean,
  spacing: number,
): Waypoint[] {
  const chord = distance(start, end);
  if (chord < EPSILON) {
    return [{ ...start, yaw: 0 }];
  }

  if (radius + EPSILON < chord / 2) {
    throw new RangeError('Arc radius is too small to connect the selected endpoints.');
  }

  const safeRadius = radius;
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const halfChord = chord / 2;
  const centerDistance = Math.sqrt(Math.max(safeRadius * safeRadius - halfChord * halfChord, 0));
  const unit = {
    x: (end.x - start.x) / chord,
    y: (end.y - start.y) / chord,
  };
  const normal = { x: -unit.y, y: unit.x };
  const sign = clockwise ? -1 : 1;
  const center = {
    x: midpoint.x + normal.x * centerDistance * sign,
    y: midpoint.y + normal.y * centerDistance * sign,
  };
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

  return generateArcWaypoints(center, safeRadius, startAngle, endAngle, clockwise, spacing);
}

function normalizeArcDelta(startAngle: number, endAngle: number, clockwise: boolean): number {
  const twoPi = Math.PI * 2;
  if (clockwise) {
    let delta = endAngle - startAngle;
    while (delta >= 0) delta -= twoPi;
    return delta;
  }

  let delta = endAngle - startAngle;
  while (delta <= 0) delta += twoPi;
  return delta;
}
