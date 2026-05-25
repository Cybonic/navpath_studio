import { useEffect, useRef, useState } from 'react';

import { ExportPanel } from './components/ExportPanel';
import { MapCanvas } from './components/MapCanvas';
import { PropertiesSidebar } from './components/PropertiesSidebar';
import { Toolbar } from './components/Toolbar';
import { useStudioStore } from './store/useStudioStore';
import type { ActionNode, DrawingElement, NavPathExport, NativeProjectExport } from './types';
import {
  type AutosaveSnapshot,
  clearAutosaveSnapshot,
  loadAutosavePreference,
  loadAutosaveSnapshot,
  saveAutosavePreference,
  saveAutosaveSnapshot,
} from './utils/autosave';

function getApiBase(): string {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  if (window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return window.location.origin;
}

const API_BASE = getApiBase();

export default function App() {
  const [yamlFile, setYamlFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setMap = useStudioStore((state) => state.setMap);
  const importRef = useRef<HTMLInputElement | null>(null);
  const autosavePayloadRef = useRef<string | null>(null);

  useEffect(() => {
    const autosavePreference = loadAutosavePreference();
    const autosaveEnabled = autosavePreference ?? true;
    useStudioStore.getState().setAutosaveEnabled(autosaveEnabled);
    if (!autosaveEnabled) return;

    const snapshot = loadAutosaveSnapshot();
    if (snapshot) {
      autosavePayloadRef.current = snapshotPayloadKey(snapshot);
      useStudioStore.getState().restoreAutosaveSnapshot(snapshot);
    }
  }, []);

  useEffect(() => {
    let saveTimer: number | undefined;
    const unsubscribe = useStudioStore.subscribe((state) => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveAutosavePreference(state.autosaveEnabled);
        if (!state.autosaveEnabled) {
          autosavePayloadRef.current = null;
          clearAutosaveSnapshot();
          return;
        }

        const snapshot = buildAutosaveSnapshot(state);
        const payloadKey = snapshotPayloadKey(snapshot);
        if (payloadKey === autosavePayloadRef.current) return;

        saveAutosaveSnapshot(snapshot);
        autosavePayloadRef.current = payloadKey;
        useStudioStore.getState().markAutosaved(snapshot.saved_at);
      }, 300);
    });

    return () => {
      window.clearTimeout(saveTimer);
      unsubscribe();
    };
  }, []);

  async function uploadMap() {
    if (!yamlFile || !imageFile) {
      setError('Select both a map YAML file and matching image.');
      return;
    }
    const formData = new FormData();
    formData.append('yaml_file', yamlFile);
    formData.append('image_file', imageFile);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/maps/upload`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? 'Map upload failed');
      }
      setMap(payload.metadata, payload.image_data_url, payload.occupancy_grid ?? null);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Map upload failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadFromFolder() {
    if (!window.showDirectoryPicker) return;
    setError(null);
    setLoading(true);
    try {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });

      // Find the first YAML file in the folder
      let yamlHandle: FileSystemFileHandle | null = null;
      let yamlName = '';
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind === 'file' && (name.endsWith('.yaml') || name.endsWith('.yml'))) {
          yamlHandle = handle as FileSystemFileHandle;
          yamlName = name;
          break;
        }
      }
      if (!yamlHandle) throw new Error('No YAML file found in the selected folder.');

      const yamlFile = await yamlHandle.getFile();
      const yamlText = await yamlFile.text();

      // Extract the image filename from the YAML (image: <filename>)
      const imageMatch = yamlText.match(/^\s*image\s*:\s*(.+)$/m);
      const imageName = imageMatch?.[1]?.trim();
      if (!imageName) throw new Error(`Could not find "image:" field in ${yamlName}.`);

      const imageHandle = await dir.getFileHandle(imageName);
      const imageFile = await imageHandle.getFile();

      const formData = new FormData();
      formData.append('yaml_file', yamlFile, yamlName);
      formData.append('image_file', imageFile, imageName);

      const response = await fetch(`${API_BASE}/api/maps/upload`, { method: 'POST', body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? 'Map upload failed');

      setMap(payload.metadata, payload.image_data_url, payload.occupancy_grid ?? null);
      // Store the handle so Save files writes back to this same folder
      useStudioStore.getState().setMapDirHandle(dir);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load from folder.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so the same file can be re-imported
    event.target.value = '';
    if (!file) return;
    setError(null);
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setError('Could not parse file — expected a JSON export from NavPath Studio.');
      return;
    }
    if (data && typeof data === 'object' && 'navpath_studio_project' in data) {
      useStudioStore.getState().loadProject(data as NativeProjectExport);
    } else if (
      data &&
      typeof data === 'object' &&
      'poses' in data &&
      'header' in data
    ) {
      useStudioStore.getState().loadNavPath(data as NavPathExport);
    } else {
      setError(
        'Unrecognised format. Expected a nav_msgs/Path JSON or a NavPath Studio project JSON.',
      );
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>NavPath Studio</h1>
          <p>Draw design-time Nav2 paths on occupancy maps.</p>
        </div>
        <div className="uploadBar">
          <label>
            YAML
            <input accept=".yaml,.yml" type="file" onChange={(event) => setYamlFile(event.target.files?.[0] ?? null)} />
          </label>
          <label>
            Map image
            <input accept=".pgm,.png,.jpg,.jpeg" type="file" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
          </label>
          <button disabled={loading} onClick={uploadMap} type="button">
            {loading ? 'Loading...' : 'Load map'}
          </button>
          {window.showDirectoryPicker && (
            <button disabled={loading} onClick={handleLoadFromFolder} type="button" title="Pick a folder — loads the map and remembers the location for Save files">
              Load from folder…
            </button>
          )}
          <input
            accept=".json"
            ref={importRef}
            style={{ display: 'none' }}
            type="file"
            onChange={handleImport}
          />
          <button onClick={() => importRef.current?.click()} type="button">
            Import path…
          </button>
        </div>
      </header>
      {error && <div className="error">{error}</div>}
      <Toolbar />
      <section className="workspace">
        <MapCanvas />
        <aside className="sidePanel">
          <PropertiesSidebar />
          <ExportPanel />
        </aside>
      </section>
    </main>
  );
}

function buildAutosaveSnapshot(state: ReturnType<typeof useStudioStore.getState>): AutosaveSnapshot {
  return {
    version: 1,
    saved_at: new Date().toISOString(),
    map: state.map,
    occupancyGrid: state.occupancyGrid,
    imageDataUrl: state.imageDataUrl,
    trajectoryPoints: state.trajectoryPoints,
    trajectorySegments: state.trajectorySegments,
    smoothingSettings: state.smoothingSettings,
    robotProfile: state.robotProfile,
    computedTrajectory: state.computedTrajectory,
    orientationDisplay: state.orientationDisplay,
    actionNodes: state.elements.filter(isActionNode),
    zoom: state.zoom,
    pan: state.pan,
  };
}

function snapshotPayloadKey(snapshot: AutosaveSnapshot): string {
  const { saved_at: _savedAt, ...payload } = snapshot;
  return JSON.stringify(payload);
}

function isActionNode(element: DrawingElement): element is ActionNode {
  return element.type === 'action';
}
