import type { ToolMode } from '../types';
import { useStudioStore } from '../store/useStudioStore';

const tools: Array<{ id: ToolMode; label: string }> = [
  { id: 'line', label: 'Control Points' },
  { id: 'arc', label: 'Arc Segment' },
  { id: 'action', label: 'Snap Action' },
  { id: 'pan', label: 'Pan' },
  { id: 'select', label: 'Select' },
];

export function Toolbar() {
  const tool = useStudioStore((state) => state.tool);
  const spacing = useStudioStore((state) => state.spacing);
  const zoom = useStudioStore((state) => state.zoom);
  const trajectoryPoints = useStudioStore((state) => state.trajectoryPoints);
  const computedTrajectory = useStudioStore((state) => state.computedTrajectory);
  const elements = useStudioStore((state) => state.elements);
  const statusMessage = useStudioStore((state) => state.statusMessage);
  const autosaveEnabled = useStudioStore((state) => state.autosaveEnabled);
  const lastAutosavedAt = useStudioStore((state) => state.lastAutosavedAt);
  const setTool = useStudioStore((state) => state.setTool);
  const setAutosaveEnabled = useStudioStore((state) => state.setAutosaveEnabled);
  const setSpacing = useStudioStore((state) => state.setSpacing);
  const computeSmoothTrajectory = useStudioStore((state) => state.computeSmoothTrajectory);
  const clearAllContent = useStudioStore((state) => state.clearAllContent);
  const zoomIn = useStudioStore((state) => state.zoomIn);
  const zoomOut = useStudioStore((state) => state.zoomOut);
  const resetZoom = useStudioStore((state) => state.resetZoom);
  const panBy = useStudioStore((state) => state.panBy);
  const resetPan = useStudioStore((state) => state.resetPan);
  const trajectoryState = !computedTrajectory
    ? 'No computed trajectory'
    : computedTrajectory.is_stale
      ? 'Trajectory stale'
      : `${computedTrajectory.validation?.status ?? 'computed'} · ${computedTrajectory.waypoints.length} waypoints`;
  const hasUserContent = trajectoryPoints.length > 0 || Boolean(computedTrajectory) || elements.length > 0;

  const confirmClearAllContent = () => {
    if (!hasUserContent) return;
    const confirmed = window.confirm(
      'Clear rough points, computed paths, generated waypoints, and action nodes? The loaded map and robot profile will stay available.',
    );
    if (confirmed) {
      clearAllContent();
    }
  };

  return (
    <div className="toolbar">
      <div className="toolGroup">
        {tools.map((item) => (
          <button
            key={item.id}
            className={tool === item.id ? 'active' : ''}
            onClick={() => setTool(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <label>
        Waypoint spacing
        <input
          min="0.02"
          step="0.01"
          type="number"
          value={spacing}
          onChange={(event) => setSpacing(Number(event.target.value))}
        />
        m
      </label>
      <div className="computeControls">
        <button
          className="computeButton"
          disabled={trajectoryPoints.length < 2}
          onClick={computeSmoothTrajectory}
          type="button"
        >
          Compute Smooth Trajectory
        </button>
        <span className={computedTrajectory?.is_stale ? 'trajectoryBadge stale' : 'trajectoryBadge'}>
          {trajectoryState}
        </span>
      </div>
      {statusMessage && <span className="toolbarStatus">{statusMessage}</span>}
      <label className="autosaveToggle">
        <input
          checked={autosaveEnabled}
          type="checkbox"
          onChange={(event) => setAutosaveEnabled(event.target.checked)}
        />
        Autosave
        {autosaveEnabled && lastAutosavedAt && (
          <span title={lastAutosavedAt}>{formatSaveTime(lastAutosavedAt)}</span>
        )}
      </label>
      <button disabled={!hasUserContent} onClick={confirmClearAllContent} type="button">
        Clear All Content
      </button>
      <div className="zoomControls" aria-label="Map zoom controls">
        <button onClick={zoomOut} title="Zoom out" type="button">
          -
        </button>
        <button onClick={resetZoom} title="Reset zoom" type="button">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={zoomIn} title="Zoom in" type="button">
          +
        </button>
      </div>
      <div className="panControls" aria-label="Map pan controls">
        <button onClick={() => panBy({ x: 0, y: -48 })} title="Move map up" type="button">
          ↑
        </button>
        <button onClick={() => panBy({ x: -48, y: 0 })} title="Move map left" type="button">
          ←
        </button>
        <button onClick={resetPan} title="Reset pan" type="button">
          Center
        </button>
        <button onClick={() => panBy({ x: 48, y: 0 })} title="Move map right" type="button">
          →
        </button>
        <button onClick={() => panBy({ x: 0, y: 48 })} title="Move map down" type="button">
          ↓
        </button>
      </div>
    </div>
  );
}

function formatSaveTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'saved';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
