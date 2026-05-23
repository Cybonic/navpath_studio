import type { MapMetadata, PixelPoint, WorldPoint } from '../types';

export function pixelToWorld(point: PixelPoint, metadata: MapMetadata): WorldPoint {
  const [originX, originY, yaw] = metadata.origin;
  const localX = point.px * metadata.resolution;
  const localY = (metadata.height - point.py) * metadata.resolution;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);

  return {
    x: originX + localX * cosYaw - localY * sinYaw,
    y: originY + localX * sinYaw + localY * cosYaw,
  };
}

export function worldToPixel(point: WorldPoint, metadata: MapMetadata): PixelPoint {
  const [originX, originY, yaw] = metadata.origin;
  const dx = point.x - originX;
  const dy = point.y - originY;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const localX = dx * cosYaw + dy * sinYaw;
  const localY = -dx * sinYaw + dy * cosYaw;

  return {
    px: localX / metadata.resolution,
    py: metadata.height - localY / metadata.resolution,
  };
}

export function distance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
