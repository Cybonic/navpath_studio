import { useStudioStore } from '../store/useStudioStore';
import { distance } from '../utils/coordinates';
import { waypointQuaternion } from '../utils/headingGeneration';

export function PropertiesSidebar() {
  const elements = useStudioStore((state) => state.elements);
  const trajectoryPoints = useStudioStore((state) => state.trajectoryPoints);
  const trajectorySegments = useStudioStore((state) => state.trajectorySegments);
  const smoothingSettings = useStudioStore((state) => state.smoothingSettings);
  const orientationDisplay = useStudioStore((state) => state.orientationDisplay);
  const computedTrajectory = useStudioStore((state) => state.computedTrajectory);
  const robotProfile = useStudioStore((state) => state.robotProfile);
  const statusMessage = useStudioStore((state) => state.statusMessage);
  const selectedId = useStudioStore((state) => state.selectedId);
  const selectedWaypointIndex = useStudioStore((state) => state.selectedWaypointIndex);
  const cursorWorld = useStudioStore((state) => state.cursorWorld);
  const updateTrajectoryPoint = useStudioStore((state) => state.updateTrajectoryPoint);
  const updateTrajectorySegment = useStudioStore((state) => state.updateTrajectorySegment);
  const removeTrajectoryPoint = useStudioStore((state) => state.removeTrajectoryPoint);
  const clearTrajectory = useStudioStore((state) => state.clearTrajectory);
  const computeSmoothTrajectory = useStudioStore((state) => state.computeSmoothTrajectory);
  const setSmoothingSettings = useStudioStore((state) => state.setSmoothingSettings);
  const setOrientationDisplay = useStudioStore((state) => state.setOrientationDisplay);
  const setSelectedWaypointIndex = useStudioStore((state) => state.setSelectedWaypointIndex);
  const selected = elements.find((element) => element.id === selectedId);
  const selectedWaypoint =
    selectedWaypointIndex === null ? null : computedTrajectory?.waypoints[selectedWaypointIndex] ?? null;
  const selectedQuaternion = selectedWaypoint ? waypointQuaternion(selectedWaypoint) : null;

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
          {selected.yaw !== undefined && <p>Yaw: {selected.yaw.toFixed(3)} rad</p>}
          <p>Action: {selected.action_type}</p>
          <p>Attachment: {selected.attachment_status}</p>
          <p>Arc length: {selected.arc_length_s_m.toFixed(3)} m</p>
        </div>
      )}
      {selectedWaypoint && selectedQuaternion && (
        <div className="details">
          <h3>Waypoint {selectedWaypointIndex! + 1}</h3>
          <p>
            Position: {selectedWaypoint.x.toFixed(3)}, {selectedWaypoint.y.toFixed(3)} m
          </p>
          <p>
            Yaw: {selectedWaypoint.yaw.toFixed(3)} rad /{' '}
            {(selectedWaypoint.yaw_deg ?? radiansToDegrees(selectedWaypoint.yaw)).toFixed(1)} deg
          </p>
          <p>
            Quaternion: {selectedQuaternion.x.toFixed(3)}, {selectedQuaternion.y.toFixed(3)},{' '}
            {selectedQuaternion.z.toFixed(3)}, {selectedQuaternion.w.toFixed(3)}
          </p>
          {selectedWaypoint.source_primitive_id && <p>Source: {selectedWaypoint.source_primitive_id}</p>}
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
      <div className="trajectoryEditor">
        <div className="sectionHeader">
          <h3>Smoothing</h3>
        </div>
        <label className="checkboxLabel">
          <input
            checked={smoothingSettings.enabled}
            type="checkbox"
            onChange={(event) => setSmoothingSettings({ enabled: event.target.checked })}
          />
          Enabled
        </label>
        <label>
          Method
          <select
            value={smoothingSettings.method}
            onChange={(event) =>
              setSmoothingSettings({
                method: event.target.value as typeof smoothingSettings.method,
              })
            }
          >
            <option value="corner_rounding">Corner rounding</option>
            <option value="chaikin">Chaikin</option>
            <option value="none">None</option>
            <option value="catmull_rom">Catmull-Rom</option>
            <option value="cubic_spline">Cubic spline</option>
            <option value="bezier">Bezier</option>
            <option value="savitzky_golay">Savitzky-Golay</option>
          </select>
        </label>
        <label>
          Waypoint spacing m
          <input
            min={robotProfile.path_constraints.min_spacing}
            max={robotProfile.path_constraints.max_spacing}
            step="0.01"
            type="number"
            value={roundForInput(smoothingSettings.waypoint_spacing)}
            onChange={(event) => setSmoothingSettings({ waypoint_spacing: Number(event.target.value) })}
          />
        </label>
        <label>
          Corner radius m
          <input
            min="0.01"
            step="0.01"
            type="number"
            value={roundForInput(smoothingSettings.corner_radius)}
            onChange={(event) => setSmoothingSettings({ corner_radius: Number(event.target.value) })}
          />
        </label>
        <label>
          Smoothing strength
          <input
            min="0"
            max="1"
            step="0.05"
            type="number"
            value={roundForInput(smoothingSettings.smoothing_strength)}
            onChange={(event) => setSmoothingSettings({ smoothing_strength: Number(event.target.value) })}
          />
        </label>
        <label>
          Interpolation resolution m
          <input
            min="0.01"
            step="0.01"
            type="number"
            value={roundForInput(smoothingSettings.interpolation_resolution_m)}
            onChange={(event) => setSmoothingSettings({ interpolation_resolution_m: Number(event.target.value) })}
          />
        </label>
        <button
          disabled={trajectoryPoints.length < 2}
          onClick={computeSmoothTrajectory}
          type="button"
        >
          Compute Smooth Trajectory
        </button>
        {statusMessage && <p className="statusMessage">{statusMessage}</p>}
      </div>
      <div className="trajectoryEditor">
        <div className="sectionHeader">
          <h3>Computed Trajectory</h3>
        </div>
        {!computedTrajectory && <p className="muted">No computed trajectory yet.</p>}
        {computedTrajectory && (
          <>
            <div className="metric">
              <span>Status</span>
              <strong>{computedTrajectory.is_stale ? 'stale' : computedTrajectory.validation?.status}</strong>
            </div>
            <div className="metric">
              <span>Waypoints</span>
              <strong>{computedTrajectory.waypoints.length}</strong>
            </div>
            {computedTrajectory.validation && (
              <div className="validationReport">
                <p>Length: {computedTrajectory.validation.metrics.path_length_m.toFixed(3)} m</p>
                <p>
                  Spacing min/mean/max:{' '}
                  {computedTrajectory.validation.metrics.min_spacing_m.toFixed(3)} /{' '}
                  {computedTrajectory.validation.metrics.mean_spacing_m.toFixed(3)} /{' '}
                  {computedTrajectory.validation.metrics.max_spacing_m.toFixed(3)} m
                </p>
                <p>Max yaw jump: {computedTrajectory.validation.metrics.max_yaw_jump_deg.toFixed(1)} deg</p>
                <p>Max curvature: {computedTrajectory.validation.metrics.max_curvature.toFixed(3)} 1/m</p>
                <p>Zero-length segments: {computedTrajectory.validation.metrics.zero_length_segment_count}</p>
                {computedTrajectory.validation.errors.map((issue) => (
                  <p className="validationError" key={`${issue.type}-${issue.message}`}>
                    {issue.message}
                  </p>
                ))}
                {computedTrajectory.validation.warnings.map((issue) => (
                  <p className="validationWarning" key={`${issue.type}-${issue.message}`}>
                    {issue.message}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="trajectoryEditor">
        <div className="sectionHeader">
          <h3>Waypoint Orientations</h3>
        </div>
        <label className="checkboxLabel">
          <input
            checked={orientationDisplay.show_arrows}
            type="checkbox"
            onChange={(event) => setOrientationDisplay({ show_arrows: event.target.checked })}
          />
          Show Waypoint Orientations
        </label>
        <label className="checkboxLabel">
          <input
            checked={orientationDisplay.show_yaw_labels}
            type="checkbox"
            onChange={(event) => setOrientationDisplay({ show_yaw_labels: event.target.checked })}
          />
          Show yaw labels
        </label>
        <label>
          Arrow stride
          <input
            min="1"
            step="1"
            type="number"
            value={orientationDisplay.arrow_stride}
            onChange={(event) => setOrientationDisplay({ arrow_stride: Number(event.target.value) })}
          />
        </label>
        <label>
          Arrow length m
          <input
            min="0.05"
            step="0.05"
            type="number"
            value={roundForInput(orientationDisplay.arrow_length_m)}
            onChange={(event) => setOrientationDisplay({ arrow_length_m: Number(event.target.value) })}
          />
        </label>
        {computedTrajectory?.is_stale && <p className="validationWarning">Orientation overlay is stale until recompute.</p>}
        {!computedTrajectory && <p className="muted">Compute a trajectory to inspect waypoint orientations.</p>}
        {computedTrajectory && computedTrajectory.waypoints.length > 0 && (
          <div className="waypointTable">
            <div className="waypointRow waypointHeader">
              <span>#</span>
              <span>X</span>
              <span>Y</span>
              <span>Yaw deg</span>
            </div>
            {computedTrajectory.waypoints.map((waypoint, index) => (
              <button
                className={selectedWaypointIndex === index ? 'waypointRow selectedWaypoint' : 'waypointRow'}
                key={waypoint.id ?? index}
                onClick={() => setSelectedWaypointIndex(index)}
                type="button"
              >
                <span>{index + 1}</span>
                <span>{waypoint.x.toFixed(2)}</span>
                <span>{waypoint.y.toFixed(2)}</span>
                <span>{(waypoint.yaw_deg ?? radiansToDegrees(waypoint.yaw)).toFixed(1)}</span>
              </button>
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

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
