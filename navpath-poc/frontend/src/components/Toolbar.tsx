import type { ToolMode } from '../types';
import { useStudioStore } from '../store/useStudioStore';

const tools: Array<{ id: ToolMode; label: string }> = [
  { id: 'line', label: 'Path' },
  { id: 'arc', label: 'Arc' },
  { id: 'action', label: 'Action' },
  { id: 'pan', label: 'Pan' },
  { id: 'select', label: 'Select' },
];

export function Toolbar() {
  const tool = useStudioStore((state) => state.tool);
  const spacing = useStudioStore((state) => state.spacing);
  const zoom = useStudioStore((state) => state.zoom);
  const setTool = useStudioStore((state) => state.setTool);
  const setSpacing = useStudioStore((state) => state.setSpacing);
  const zoomIn = useStudioStore((state) => state.zoomIn);
  const zoomOut = useStudioStore((state) => state.zoomOut);
  const resetZoom = useStudioStore((state) => state.resetZoom);
  const panBy = useStudioStore((state) => state.panBy);
  const resetPan = useStudioStore((state) => state.resetPan);

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
        Spacing
        <input
          min="0.02"
          step="0.01"
          type="number"
          value={spacing}
          onChange={(event) => setSpacing(Number(event.target.value))}
        />
        m
      </label>
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
