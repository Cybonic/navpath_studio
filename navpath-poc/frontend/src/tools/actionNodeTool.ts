import type { ActionNode, WorldPoint } from '../types';

export function createActionNode(position: WorldPoint, count: number): ActionNode {
  return {
    id: crypto.randomUUID(),
    type: 'action',
    action_type: 'inspect',
    position,
    yaw: 0,
    label: `Action ${count + 1}`,
    trajectory_id: '',
    arc_length_s_m: 0,
    placement_mode: 'snap_to_trajectory',
    attachment_status: 'invalid',
    metadata: {},
  };
}
