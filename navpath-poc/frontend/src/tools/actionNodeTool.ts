import type { ActionNode, WorldPoint } from '../types';

export function createActionNode(position: WorldPoint, count: number): ActionNode {
  return {
    id: crypto.randomUUID(),
    type: 'action',
    position,
    label: `Action ${count + 1}`,
  };
}
