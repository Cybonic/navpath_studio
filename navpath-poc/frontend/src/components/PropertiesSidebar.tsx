import { useStudioStore } from '../store/useStudioStore';
import { distance } from '../utils/coordinates';

export function PropertiesSidebar() {
  const elements = useStudioStore((state) => state.elements);
  const trajectoryPoints = useStudioStore((state) => state.trajectoryPoints);
  const trajectorySegments = useStudioStore((state) => state.trajectorySegments);
  const selectedId = useStudioStore((state) => state.selectedId);
  const cursorWorld = useStudioStore((state) => state.cursorWorld);
  const updateTrajectoryPoint = useStudioStore((state) => state.updateTrajectoryPoint);
  const updateTrajectorySegment = useStudioStore((state) => state.updateTrajectorySegment);
  const removeTrajectoryPoint = useStudioStore((state) => state.removeTrajectoryPoint);
  const clearTrajectory = useStudioStore((state) => state.clearTrajectory);
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
      <div className="trajectoryEditor">
        <div className="sectionHeader">
          <h3>Trajectory Points</h3>
          <button disabled={trajectoryPoints.length === 0} onClick={clearTrajectory} type="button">
            Clear
          </button>
        </div>
        {trajectoryPoints.length === 0 && <p className="muted">Use Line tool and click points in order.</p>}
        {trajectoryPoints.length > 0 && (
          <div className="pointTable">
            <div className="pointRow pointHeader">
              <span>#</span>
              <span>X m</span>
              <span>Y m</span>
              <span />
            </div>
            {trajectoryPoints.map((point, index) => (
              <div className="pointRow" key={index}>
                <span>{index + 1}</span>
                <input
                  step="0.01"
                  type="number"
                  value={roundForInput(point.x)}
                  onChange={(event) =>
                    updateTrajectoryPoint(index, { ...point, x: Number(event.target.value) })
                  }
                />
                <input
                  step="0.01"
                  type="number"
                  value={roundForInput(point.y)}
                  onChange={(event) =>
                    updateTrajectoryPoint(index, { ...point, y: Number(event.target.value) })
                  }
                />
                <button onClick={() => removeTrajectoryPoint(index)} title="Remove point" type="button">
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="trajectoryEditor">
        <div className="sectionHeader">
          <h3>Segments</h3>
        </div>
        {trajectorySegments.length === 0 && <p className="muted">Add at least two points to create segments.</p>}
        {trajectorySegments.length > 0 && (
          <div className="segmentList">
            {trajectorySegments.map((segment, index) => (
              <div className="segmentEditor" key={segment.id}>
                <strong>
                  {index + 1} to {index + 2}: {segment.type}
                </strong>
                {segment.type === 'arc' && (
                  <>
                    <label>
                      Radius m
                      <input
                        min={minimumArcRadius(trajectoryPoints[index], trajectoryPoints[index + 1])}
                        step="0.01"
                        type="number"
                        value={roundForInput(segment.radius)}
                        onChange={(event) =>
                          updateTrajectorySegment(index, {
                            ...segment,
                            radius: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="checkboxLabel">
                      <input
                        checked={segment.clockwise}
                        type="checkbox"
                        onChange={(event) =>
                          updateTrajectorySegment(index, {
                            ...segment,
                            clockwise: event.target.checked,
                          })
                        }
                      />
                      Clockwise
                    </label>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function roundForInput(value: number): number {
  return Number(value.toFixed(3));
}

function minimumArcRadius(start?: { x: number; y: number }, end?: { x: number; y: number }): number {
  if (!start || !end) return 0.01;
  return Number((Math.hypot(end.x - start.x, end.y - start.y) / 2).toFixed(3));
}
