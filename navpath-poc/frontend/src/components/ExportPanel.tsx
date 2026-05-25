import { useMemo, useState } from 'react';

import { useStudioStore } from '../store/useStudioStore';
import { buildGoalsYaml, buildNavPath, pathToYaml } from '../utils/pathExport';
import { buildNativeProjectExport } from '../utils/projectExport';

function getApiBase(): string {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE as string;
  if (window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return window.location.origin;
}
const API_BASE = getApiBase();

type ExportFormat = 'path_json' | 'path_yaml' | 'goals_yaml' | 'project_json';

const FORMAT_META: Record<ExportFormat, { label: string; filename: string; mime: string }> = {
  path_json: { label: 'nav_msgs/Path JSON', filename: 'nav_path.json', mime: 'application/json' },
  path_yaml: { label: 'nav_msgs/Path YAML', filename: 'nav_path.yaml', mime: 'application/yaml' },
  goals_yaml: {
    label: 'NavigateThroughPoses YAML',
    filename: 'navigate_through_poses.yaml',
    mime: 'application/yaml',
  },
  project_json: { label: 'Project JSON', filename: 'navpath_project.json', mime: 'application/json' },
};

export function ExportPanel() {
  const [format, setFormat] = useState<ExportFormat>('path_json');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveLinks, setSaveLinks] = useState<{ yaml: string; json: string } | null>(null);
  // Folder browser state (used when File System Access API is unavailable)
  const [browserPath, setBrowserPath] = useState('');
  const [browserDirs, setBrowserDirs] = useState<string[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [backendSaved, setBackendSaved] = useState(false);
  const map = useStudioStore((state) => state.map);
  const robotProfile = useStudioStore((state) => state.robotProfile);
  const smoothingSettings = useStudioStore((state) => state.smoothingSettings);
  const orientationDisplay = useStudioStore((state) => state.orientationDisplay);
  const trajectoryPoints = useStudioStore((state) => state.trajectoryPoints);
  const trajectorySegments = useStudioStore((state) => state.trajectorySegments);
  const elements = useStudioStore((state) => state.elements);
  const computedTrajectory = useStudioStore((state) => state.computedTrajectory);
  const allWaypoints = useStudioStore((state) => state.allWaypoints);
  const mapDirHandle = useStudioStore((state) => state.mapDirHandle);
  const waypoints = allWaypoints();
  const frameId = map?.frame_id ?? 'map';

  const path = useMemo(() => buildNavPath(waypoints, frameId), [frameId, waypoints]);
  const goals = useMemo(() => buildGoalsYaml(waypoints, frameId, 1.0), [frameId, waypoints]);
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
        : format === 'goals_yaml'
          ? goals
          : JSON.stringify(project, null, 2);

  const exportBlocked =
    !computedTrajectory ||
    computedTrajectory.is_stale ||
    computedTrajectory.validation?.status === 'invalid' ||
    waypoints.length < 2;

  /** Write a string to a FileSystemFileHandle obtained from a directory handle. */
  async function writeToDir(dir: FileSystemDirectoryHandle, filename: string, content: string) {
    const handle = await dir.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /** Trigger a browser fallback download (no directory picker support). */
  function triggerDownload(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasFileSystemAPI = !!(window.showDirectoryPicker || window.showSaveFilePicker);

  async function loadBrowserDir(relPath: string) {
    setBrowserLoading(true);
    setBrowserError(null);
    setBackendSaved(false);
    try {
      const params = new URLSearchParams({ path: relPath });
      const res = await fetch(`${API_BASE}/api/files/list?${params}`);
      const data = await res.json() as { path?: string; dirs?: string[]; detail?: string };
      if (!res.ok) throw new Error(data.detail ?? 'Failed to list directory');
      setBrowserPath((data.path as string) ?? '');
      setBrowserDirs((data.dirs as string[]) ?? []);
    } catch (err) {
      setBrowserError(err instanceof Error ? err.message : 'Failed to browse directory');
    } finally {
      setBrowserLoading(false);
    }
  }

  async function handleServerSave() {
    setSaveError(null);
    setBackendSaved(false);
    const navYaml = pathToYaml(path);
    const projectJson = JSON.stringify(project, null, 2);
    try {
      const res = await fetch(`${API_BASE}/api/files/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: browserPath, nav_yaml: navYaml, project_json: projectJson }),
      });
      const data = await res.json() as { saved_to?: string; detail?: string };
      if (!res.ok) throw new Error(data.detail ?? 'Failed to save files');
      setBackendSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save files');
    }
  }

  function openSaveDialog() {
    setSaveError(null);
    setBackendSaved(false);
    if (!hasFileSystemAPI) {
      // Launch backend folder browser; blob links are no longer needed
      if (saveLinks) {
        URL.revokeObjectURL(saveLinks.yaml);
        URL.revokeObjectURL(saveLinks.json);
        setSaveLinks(null);
      }
      void loadBrowserDir('');
    }
    setShowSaveDialog(true);
  }

  function closeSaveDialog() {
    if (saveLinks) {
      URL.revokeObjectURL(saveLinks.yaml);
      URL.revokeObjectURL(saveLinks.json);
      setSaveLinks(null);
    }
    setShowSaveDialog(false);
  }

  /** Write directly to a known directory handle — no OS picker. */
  async function handleSaveToKnownDir(dir: FileSystemDirectoryHandle) {
    setSaveError(null);
    const navYaml = pathToYaml(path);
    const projectJson = JSON.stringify(project, null, 2);
    try {
      await writeToDir(dir, 'nav_path.yaml', navYaml);
      await writeToDir(dir, 'navpath_project.json', projectJson);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to write files.');
    }
  }

  /** Open the OS folder/file picker to choose a save location. */
  async function handleSaveChooseFolder() {
    setSaveError(null);
    const navYaml = pathToYaml(path);
    const projectJson = JSON.stringify(project, null, 2);

    // Tier 1: showDirectoryPicker — Chromium (Chrome/Edge). User picks one folder for both files.
    if (window.showDirectoryPicker) {
      const opts: DirectoryPickerOptions = { mode: 'readwrite' };
      if (mapDirHandle) opts.startIn = mapDirHandle;
      let dir: FileSystemDirectoryHandle;
      try {
        dir = await window.showDirectoryPicker(opts);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSaveError(err instanceof Error ? err.message : 'Failed to open folder picker.');
        return;
      }
      try {
        await writeToDir(dir, 'nav_path.yaml', navYaml);
        await writeToDir(dir, 'navpath_project.json', projectJson);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to write files.');
      }
      return;
    }

    // Tier 2: showSaveFilePicker — Firefox 111+. One dialog per file.
    if (window.showSaveFilePicker) {
      try {
        const startIn = mapDirHandle ?? undefined;
        const yamlHandle = await window.showSaveFilePicker({
          suggestedName: 'nav_path.yaml',
          startIn,
          types: [{ description: 'YAML', accept: { 'application/yaml': ['.yaml'] } }],
        });
        const yamlWritable = await yamlHandle.createWritable();
        await yamlWritable.write(navYaml);
        await yamlWritable.close();

        const jsonHandle = await window.showSaveFilePicker({
          suggestedName: 'navpath_project.json',
          startIn,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const jsonWritable = await jsonHandle.createWritable();
        await jsonWritable.write(projectJson);
        await jsonWritable.close();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSaveError(err instanceof Error ? err.message : 'Failed to save files.');
      }
      return;
    }

    // Tier 3: blob downloads — last resort when no File System Access API is available.
    triggerDownload('nav_path.yaml', navYaml, 'application/yaml');
    triggerDownload('navpath_project.json', projectJson, 'application/json');
  }

  return (
    <section className="exportPanel">
      <div className="exportHeader">
        <h2>Path Export</h2>
        <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
          {(Object.entries(FORMAT_META) as [ExportFormat, (typeof FORMAT_META)[ExportFormat]][]).map(
            ([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
        <button
          onClick={openSaveDialog}
          disabled={exportBlocked}
          title="Save nav_path.yaml and navpath_project.json"
        >
          Save files
        </button>
        {saveError && <p className="validationError">{saveError}</p>}
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
      {format === 'goals_yaml' && !exportBlocked && (
        <p className="muted">
          Sparse goals for Nav2 WaypointFollower / NavigateThroughPoses action (~1 m stride).
        </p>
      )}
      {format === 'project_json' && (
        <p className="muted">Project export preserves rough points, smoothing settings, actions, and validation.</p>
      )}
      <textarea readOnly value={output} />

      {showSaveDialog && (
        <div className="saveDialogOverlay" role="dialog" aria-modal="true" aria-label="Save files">
          <div className="saveDialogBox">
            <h3>Save files</h3>
            {mapDirHandle ? (
              // Known folder from "Load from folder" — suggest it
              <>
                <p>Save <code>nav_path.yaml</code> and <code>navpath_project.json</code> to:</p>
                <p className="saveDialogFolder">{mapDirHandle.name}/</p>
                <div className="saveDialogActions">
                  <button
                    className="saveDialogPrimary"
                    onClick={() => { closeSaveDialog(); void handleSaveToKnownDir(mapDirHandle); }}
                  >
                    Save here
                  </button>
                  {hasFileSystemAPI && (
                    <button onClick={() => { closeSaveDialog(); void handleSaveChooseFolder(); }}>
                      Choose folder…
                    </button>
                  )}
                  <button onClick={closeSaveDialog}>Cancel</button>
                </div>
              </>
            ) : hasFileSystemAPI ? (
              // No suggestion but browser supports location picking
              <>
                <p>Choose where to save <code>nav_path.yaml</code> and <code>navpath_project.json</code>.</p>
                <div className="saveDialogActions">
                  <button
                    className="saveDialogPrimary"
                    onClick={() => { closeSaveDialog(); void handleSaveChooseFolder(); }}
                  >
                    Choose folder…
                  </button>
                  <button onClick={closeSaveDialog}>Cancel</button>
                </div>
              </>
            ) : (
              // No File System Access API — show backend-powered folder browser
              (() => {
                const parts = browserPath ? browserPath.split('/') : [];
                return (
                  <>
                    <p>Navigate to the folder where you want to save the files.</p>
                    <div className="folderBrowser">
                      <div className="folderBreadcrumb">
                        <button onClick={() => void loadBrowserDir('')}>~</button>
                        {parts.map((part, i) => {
                          const upTo = parts.slice(0, i + 1).join('/');
                          return (
                            <span key={upTo}>
                              <span className="folderSep">/</span>
                              <button onClick={() => void loadBrowserDir(upTo)}>{part}</button>
                            </span>
                          );
                        })}
                      </div>
                      {browserLoading && <p className="muted">Loading…</p>}
                      {browserError && <p className="validationError">{browserError}</p>}
                      {!browserLoading && !browserError && (
                        <div className="folderDirList">
                          {browserDirs.length === 0 && (
                            <p className="muted">No sub-folders here.</p>
                          )}
                          {browserDirs.map((dir) => (
                            <button
                              key={dir}
                              className="folderDirItem"
                              onClick={() =>
                                void loadBrowserDir(browserPath ? `${browserPath}/${dir}` : dir)
                              }
                            >
                              📁 {dir}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {backendSaved && (
                      <p className="saveDialogSuccess">
                        ✓ Saved to ~/{browserPath}
                      </p>
                    )}
                    {saveError && <p className="validationError">{saveError}</p>}
                    <div className="saveDialogActions">
                      <button
                        className="saveDialogPrimary"
                        disabled={browserLoading}
                        onClick={() => void handleServerSave()}
                      >
                        Save here
                      </button>
                      <button onClick={closeSaveDialog}>Close</button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}
    </section>
  );
}

