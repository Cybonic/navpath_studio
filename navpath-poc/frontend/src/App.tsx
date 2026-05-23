import { useState } from 'react';

import { ExportPanel } from './components/ExportPanel';
import { MapCanvas } from './components/MapCanvas';
import { PropertiesSidebar } from './components/PropertiesSidebar';
import { Toolbar } from './components/Toolbar';
import { useStudioStore } from './store/useStudioStore';

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
      setMap(payload.metadata, payload.image_data_url);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Map upload failed');
    } finally {
      setLoading(false);
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
