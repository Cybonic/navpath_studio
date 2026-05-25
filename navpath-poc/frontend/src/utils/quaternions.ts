import type { Quaternion } from '../types';

export function yawToQuaternion(yaw: number): Quaternion {
  const half = yaw / 2;
  const quaternion = {
    x: 0,
    y: 0,
    z: Math.sin(half),
    w: Math.cos(half),
  };
  const norm = Math.hypot(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  if (!Number.isFinite(norm) || norm === 0) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  return {
    x: quaternion.x / norm,
    y: quaternion.y / norm,
    z: quaternion.z / norm,
    w: quaternion.w / norm,
  };
}
