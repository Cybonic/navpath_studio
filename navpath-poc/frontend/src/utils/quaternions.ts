import type { Quaternion } from '../types';

export function yawToQuaternion(yaw: number): Quaternion {
  const half = yaw / 2;
  return {
    x: 0,
    y: 0,
    z: Math.sin(half),
    w: Math.cos(half),
  };
}
