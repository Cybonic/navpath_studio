import type { LinePrimitive, WorldPoint } from '../types';
import { generateLineWaypoints } from '../utils/waypointGeneration';

export function createLine(start: WorldPoint, end: WorldPoint, spacing: number): LinePrimitive {
  return {
    id: crypto.randomUUID(),
    type: 'line',
    start,
    end,
    spacing,
    waypoints: generateLineWaypoints(start, end, spacing),
  };
}
