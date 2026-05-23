import type { ArcPrimitive, WorldPoint } from '../types';
import { distance } from '../utils/coordinates';
import { generateArcWaypoints } from '../utils/waypointGeneration';

export function createArc(center: WorldPoint, edge: WorldPoint, spacing: number): ArcPrimitive {
  const radius = distance(center, edge);
  const startAngle = Math.atan2(edge.y - center.y, edge.x - center.x);
  const endAngle = startAngle + Math.PI;

  return {
    id: crypto.randomUUID(),
    type: 'arc',
    center,
    radius,
    startAngle,
    endAngle,
    clockwise: false,
    spacing,
    waypoints: generateArcWaypoints(center, radius, startAngle, endAngle, false, spacing),
  };
}
