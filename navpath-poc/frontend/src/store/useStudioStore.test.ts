import { describe, expect, it } from 'vitest';

import { buildTrajectoryWaypoints, useStudioStore } from './useStudioStore';

describe('buildTrajectoryWaypoints', () => {
  it('connects points sequentially and avoids duplicate segment joins', () => {
    const waypoints = buildTrajectoryWaypoints(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      [
        { id: 'a', type: 'line' },
        { id: 'b', type: 'line' },
      ],
      0.5,
    );

    expect(waypoints.map((point) => [point.x, point.y])).toEqual([
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 0.5],
      [1, 1],
    ]);
    expect(waypoints[0].yaw).toBeCloseTo(0);
    expect(waypoints[3].yaw).toBeCloseTo(Math.PI / 2);
  });

  it('generates editable arc segments between ordered points', () => {
    const waypoints = buildTrajectoryWaypoints(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [{ id: 'arc', type: 'arc', radius: 0.75, clockwise: false }],
      0.25,
    );

    expect(waypoints[0].x).toBeCloseTo(0);
    expect(waypoints[0].y).toBeCloseTo(0);
    expect(waypoints[waypoints.length - 1].x).toBeCloseTo(1);
    expect(waypoints[waypoints.length - 1].y).toBeCloseTo(0);
    expect(waypoints.length).toBeGreaterThan(2);
  });

  it('rejects impossible arc radii instead of silently clamping them', () => {
    expect(() =>
      buildTrajectoryWaypoints(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        [{ id: 'arc', type: 'arc', radius: 0.25, clockwise: false }],
        0.25,
      ),
    ).toThrow(/radius is too small/);
  });
});

describe('computed trajectory workflow', () => {
  it('exports no waypoints until the rough path is computed', () => {
    resetStoreForTest();
    const store = useStudioStore.getState();

    store.addTrajectoryPoint({ x: 0, y: 0 });
    store.addTrajectoryPoint({ x: 1, y: 0 });

    expect(useStudioStore.getState().allWaypoints()).toEqual([]);

    useStudioStore.getState().computeSmoothTrajectory();

    expect(useStudioStore.getState().computedTrajectory?.is_stale).toBe(false);
    expect(useStudioStore.getState().allWaypoints().length).toBeGreaterThan(2);
  });

  it('marks computed trajectories and attached actions stale after control point edits', () => {
    resetStoreForTest();
    const store = useStudioStore.getState();

    store.addTrajectoryPoint({ x: 0, y: 0 });
    store.addTrajectoryPoint({ x: 1, y: 0 });
    useStudioStore.getState().computeSmoothTrajectory();
    useStudioStore.getState().addActionAtPoint({ x: 0.5, y: 0.02 });

    const attachedAction = useStudioStore.getState().elements[0];
    expect(attachedAction?.type).toBe('action');
    expect(attachedAction?.type === 'action' ? attachedAction.attachment_status : null).toBe('attached');

    useStudioStore.getState().updateTrajectoryPoint(1, { x: 1, y: 1 });

    expect(useStudioStore.getState().computedTrajectory?.is_stale).toBe(true);
    const staleAction = useStudioStore.getState().elements[0];
    expect(staleAction?.type).toBe('action');
    expect(staleAction?.type === 'action' ? staleAction.attachment_status : null).toBe('stale');
    expect(useStudioStore.getState().allWaypoints()).toEqual([]);
  });

  it('clears all user-created content while preserving map-independent defaults', () => {
    resetStoreForTest();
    const store = useStudioStore.getState();

    store.addTrajectoryPoint({ x: 0, y: 0 });
    store.addTrajectoryPoint({ x: 1, y: 0 });
    useStudioStore.getState().computeSmoothTrajectory();
    useStudioStore.getState().addActionAtPoint({ x: 0.5, y: 0 });

    useStudioStore.getState().clearAllContent();

    expect(useStudioStore.getState().trajectoryPoints).toEqual([]);
    expect(useStudioStore.getState().trajectorySegments).toEqual([]);
    expect(useStudioStore.getState().computedTrajectory).toBeNull();
    expect(useStudioStore.getState().elements).toEqual([]);
    expect(useStudioStore.getState().allWaypoints()).toEqual([]);
    expect(useStudioStore.getState().smoothingSettings.waypoint_spacing).toBe(0.1);
  });
});

function resetStoreForTest(): void {
  useStudioStore.setState({
    map: null,
    occupancyGrid: null,
    imageDataUrl: null,
    tool: 'line',
    spacing: 0.1,
    zoom: 1,
    pan: { x: 0, y: 0 },
    trajectoryPoints: [],
    trajectorySegments: [],
    computedTrajectory: null,
    orientationDisplay: {
      show_arrows: true,
      show_yaw_labels: false,
      arrow_stride: 1,
      arrow_length_m: 0.25,
      selected_waypoint_show_quaternion: true,
    },
    elements: [],
    selectedId: null,
    selectedWaypointIndex: null,
    cursorWorld: null,
    draftPoint: null,
    statusMessage: null,
  });
}
