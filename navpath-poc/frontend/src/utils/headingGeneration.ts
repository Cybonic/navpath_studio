import type { Quaternion, Waypoint, WorldPoint } from '../types';
import { yawToQuaternion } from './quaternions';

export function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

export function radiansToDegrees(radians: number): number {
  return (normalizeAngle(radians) * 180) / Math.PI;
}

export function waypointWithOrientation(input: {
  id?: string;
  point: WorldPoint;
  yaw: number;
  sourcePrimitiveId?: string;
}): Waypoint {
  const yaw = normalizeAngle(input.yaw);
  const waypoint: Waypoint = {
    id: input.id,
    x: input.point.x,
    y: input.point.y,
    yaw,
    yaw_deg: radiansToDegrees(yaw),
    orientation_quaternion: yawToQuaternion(yaw),
  };
  if (input.sourcePrimitiveId) {
    waypoint.source_primitive_id = input.sourcePrimitiveId;
  }
  return waypoint;
}

export function waypointQuaternion(waypoint: Waypoint): Quaternion {
  return waypoint.orientation_quaternion ?? yawToQuaternion(waypoint.yaw);
}
