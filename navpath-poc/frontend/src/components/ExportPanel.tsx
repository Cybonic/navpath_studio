import { useMemo, useState } from 'react';

import { useStudioStore } from '../store/useStudioStore';
import { buildNavPath, pathToYaml } from '../utils/pathExport';
import { buildNativeProjectExport } from '../utils/projectExport';

export function ExportPanel() {
  const [format, setFormat] = useState<'path_json' | 'path_yaml' | 'project_json'>('path_json');
  const map = useStudioStore((state) => state.map);
  const robotProfile = useStudioStore((state) => state.robotProfile);
  const smoothingSettings = useStudioStore((state) => state.smoothingSettings);
  const orientationDisplay = useStudioStore((state) => state.orientationDisplay);
  const trajectoryPoints = useStudioStore((state) => state.trajectoryPoints);
  const trajectorySegments = useStudioStore((state) => state.trajectorySegments);
  const elements = useStudioStore((state) => state.elements);
  const computedTrajectory = useStudioStore((state) => state.computedTrajectory);
  const allWaypoints = useStudioStore((state) => state.allWaypoints);
  const waypoints = allWaypoints();
  const path = useMemo(() => buildNavPath(waypoints, map?.frame_id ?? 'map'), [map, waypoints]);
  const project = useMemo(
    () =>
      buildNativeProjectExport({
        map,
        robotProfile,
        smoothingSettings,
        orientationDisplay,
        controlPoints: trajectoryPoints,
        trajectorySegments,
        actionNodes: elements.filter((element) => element.type === 'action'),
        computedTrajectory,
      }),
    [
      computedTrajectory,
      elements,
      map,
      orientationDisplay,
      robotProfile,
      smoothingSettings,
      trajectoryPoints,
      trajectorySegments,
    ],
  );
  const output =
    format === 'path_json'
      ? JSON.stringify(path, null, 2)
      : format === 'path_yaml'
        ? pathToYaml(path)
        : JSON.stringify(project, null, 2);
  const exportBlocked =
    !computedTrajectory ||
    computedTrajectory.is_stale ||
    computedTrajectory.validation?.status === 'invalid' ||
    waypoints.length < 2;

  return (
    <section className="exportPanel">
      <div className="exportHeader">
        <h2>Path Export</h2>
        <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
          <option value="path_json">nav_msgs/Path JSON</option>
          <option value="path_yaml">nav_msgs/Path YAML</option>
          <option value="project_json">Project JSON</option>
        </select>
      </div>
      <p className="muted">
        {waypoints.length} waypoint{waypoints.length === 1 ? '' : 's'} in frame{' '}
        <code>{path.header.frame_id}</code>
      </p>
      {exportBlocked && format !== 'project_json' && (
        <p className="validationError">
          Export requires a current computed trajectory with at least two valid poses.
        </p>
      )}
      {format === 'project_json' && (
        <p className="muted">Project export preserves rough points, smoothing settings, actions, and validation.</p>
      )}
      <textarea readOnly value={output} />
    </section>
  );
}
