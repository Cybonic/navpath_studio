import { describe, expect, it } from 'vitest';

import type { NativeProjectExport } from '../types';
import { useStudioStore } from '../store/useStudioStore';
import { buildNativeProjectExport } from './projectExport';

describe('buildNativeProjectExport', () => {
  it('preserves design-time metadata separately from nav_msgs/Path', () => {
    const state = useStudioStore.getState();
    const project: NativeProjectExport = buildNativeProjectExport({
      map: null,
      robotProfile: state.robotProfile,
      smoothingSettings: state.smoothingSettings,
      orientationDisplay: state.orientationDisplay,
      controlPoints: [{ id: 'cp_1', x: 0, y: 0 }],
      trajectorySegments: [],
      actionNodes: [],
      computedTrajectory: null,
    });

    expect(project.navpath_studio_project.version).toBe('0.1');
    expect(project.navpath_studio_project.control_points).toHaveLength(1);
    expect(project.navpath_studio_project.robot_profile.name).toBe('generic_2d_ground_robot');
    expect(project.navpath_studio_project.export_note).toContain('nav_msgs/Path');
  });
});
