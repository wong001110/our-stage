import {
  FilePlus2,
  Film,
  FolderOpen,
  Library,
  Music2,
  Save,
  Sparkles,
} from 'lucide-react';
import { MmdViewport } from './components/MmdViewport';
import { useProjectStore } from './store/projectStore';

export function App() {
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const message = useProjectStore((state) => state.message);
  const selectedAssetId = useProjectStore((state) => state.selectedAssetId);
  const newProject = useProjectStore((state) => state.newProject);
  const openProject = useProjectStore((state) => state.openProject);
  const saveProject = useProjectStore((state) => state.saveProject);
  const importMotion = useProjectStore((state) => state.importMotion);
  const importAudio = useProjectStore((state) => state.importAudio);
  const selectAsset = useProjectStore((state) => state.selectAsset);

  const selectedAsset = project.assets.find((asset) => asset.assetId === selectedAssetId);

  return (
    <main className="editor-shell">
      <header className="topbar">
        <div className="brand-mark">OS</div>
        <div>
          <h1>Our Stage</h1>
          <p>
            {project.metadata.name}
            {dirty ? ' · Unsaved' : ''}
          </p>
        </div>
        <nav className="top-actions">
          <button type="button" onClick={() => newProject()}>
            <FilePlus2 size={16} /> New
          </button>
          <button type="button" onClick={() => void openProject()}>
            <FolderOpen size={16} /> Open
          </button>
          <button type="button" onClick={() => void saveProject()}>
            <Save size={16} /> Save
          </button>
          <button type="button" className="accent">
            <Sparkles size={16} /> AI Director
          </button>
        </nav>
      </header>

      <div className="editor-grid">
        <aside className="asset-panel panel">
          <div className="panel-heading">
            <Library size={17} />
            <strong>Assets</strong>
          </div>
          <div className="asset-import-actions">
            <button type="button" onClick={() => void importMotion()}>
              <Film size={14} /> Motion
            </button>
            <button type="button" onClick={() => void importAudio()}>
              <Music2 size={14} /> Audio
            </button>
          </div>
          <div className="asset-list">
            {project.assets.length === 0 ? (
              <div className="asset-empty">
                <Film size={24} />
                <span>Imported models, motions, stages and audio appear here.</span>
              </div>
            ) : (
              project.assets.map((asset) => (
                <button
                  type="button"
                  key={asset.assetId}
                  className={asset.assetId === selectedAssetId ? 'asset-row selected' : 'asset-row'}
                  onClick={() => selectAsset(asset.assetId)}
                >
                  <span>{asset.title}</span>
                  <small>{asset.type}</small>
                </button>
              ))
            )}
          </div>
        </aside>
        <MmdViewport />
        <aside className="inspector-panel panel">
          <div className="panel-heading">
            <strong>Inspector</strong>
          </div>
          <div className="property-group">
            <label>Project</label>
            <span>{project.metadata.name}</span>
          </div>
          <div className="property-group">
            <label>Selected asset</label>
            <span>{selectedAsset?.title ?? 'No asset selected'}</span>
          </div>
          <div className="property-group">
            <label>Licence</label>
            <span>{selectedAsset?.source?.licence ?? 'Not recorded'}</span>
          </div>
          <div className="property-group">
            <label>Render preset</label>
            <span>Soft Our Series Stage</span>
          </div>
          <div className="property-group">
            <label>Output</label>
            <span>
              {project.output.width} × {project.output.height} · {project.output.fps} FPS
            </span>
          </div>
        </aside>
      </div>

      <section className="timeline-shell panel">
        <div className="timeline-heading">
          <strong>Timeline</strong>
          <span>{message ?? 'Project data is autosaved locally.'}</span>
        </div>
        <div className="timeline-ruler">
          0s <span>3s</span><span>6s</span><span>9s</span><span>12s</span>
        </div>
        <div className="timeline-placeholder">Motion, expression, camera and audio tracks</div>
      </section>
    </main>
  );
}
