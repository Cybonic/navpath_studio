import { useStudioStore } from '../store/useStudioStore';
import { distance } from '../utils/coordinates';

export function PropertiesSidebar() {
  const elements = useStudioStore((state) => state.elements);
  const selectedId = useStudioStore((state) => state.selectedId);
  const cursorWorld = useStudioStore((state) => state.cursorWorld);
  const selected = elements.find((element) => element.id === selectedId);

  return (
    <aside className="sidebar">
      <h2>Properties</h2>
      {cursorWorld && (
        <div className="metric">
          <span>Cursor</span>
          <strong>
            {cursorWorld.x.toFixed(3)}, {cursorWorld.y.toFixed(3)} m
          </strong>
        </div>
      )}
      {!selected && <p className="muted">Select or draw an element.</p>}
      {selected?.type === 'line' && (
        <div className="details">
          <h3>Line</h3>
          <p>Length: {distance(selected.start, selected.end).toFixed(3)} m</p>
          <p>Waypoints: {selected.waypoints.length}</p>
          <p>Spacing: {selected.spacing} m</p>
        </div>
      )}
      {selected?.type === 'arc' && (
        <div className="details">
          <h3>Arc</h3>
          <p>Radius: {selected.radius.toFixed(3)} m</p>
          <p>Waypoints: {selected.waypoints.length}</p>
          <p>Spacing: {selected.spacing} m</p>
        </div>
      )}
      {selected?.type === 'action' && (
        <div className="details">
          <h3>{selected.label}</h3>
          <p>
            Position: {selected.position.x.toFixed(3)}, {selected.position.y.toFixed(3)} m
          </p>
        </div>
      )}
      <div className="metric">
        <span>Elements</span>
        <strong>{elements.length}</strong>
      </div>
    </aside>
  );
}
