import { useMemo, useState } from 'react';

import { useStudioStore } from '../store/useStudioStore';
import { buildNavPath, pathToYaml } from '../utils/pathExport';

export function ExportPanel() {
  const [format, setFormat] = useState<'json' | 'yaml'>('json');
  const map = useStudioStore((state) => state.map);
  const allWaypoints = useStudioStore((state) => state.allWaypoints);
  const waypoints = allWaypoints();
  const path = useMemo(() => buildNavPath(waypoints, map?.frame_id ?? 'map'), [map, waypoints]);
  const output = format === 'json' ? JSON.stringify(path, null, 2) : pathToYaml(path);

  return (
    <section className="exportPanel">
      <div className="exportHeader">
        <h2>Path Export</h2>
        <select value={format} onChange={(event) => setFormat(event.target.value as 'json' | 'yaml')}>
          <option value="json">JSON</option>
          <option value="yaml">YAML</option>
        </select>
      </div>
      <p className="muted">
        {waypoints.length} waypoint{waypoints.length === 1 ? '' : 's'} in frame{' '}
        <code>{path.header.frame_id}</code>
      </p>
      <textarea readOnly value={output} />
    </section>
  );
}
