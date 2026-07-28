import { Film, FolderOpen, Library, Save, Sparkles } from 'lucide-react';
import { MmdViewport } from './components/MmdViewport';

export function App() {
  return (
    <main className="editor-shell">
      <header className="topbar">
        <div className="brand-mark">OS</div>
        <div>
          <h1>Our Stage</h1>
          <p>AI Character Director Playground</p>
        </div>
        <nav className="top-actions">
          <button type="button"><FolderOpen size={16} /> Open</button>
          <button type="button"><Save size={16} /> Save</button>
          <button type="button" className="accent"><Sparkles size={16} /> AI Director</button>
        </nav>
      </header>

      <div className="editor-grid">
        <aside className="asset-panel panel">
          <div className="panel-heading"><Library size={17} /><strong>Assets</strong></div>
          <div className="asset-empty">
            <Film size={24} />
            <span>Imported models, motions, stages and audio appear here.</span>
          </div>
        </aside>
        <MmdViewport />
        <aside className="inspector-panel panel">
          <div className="panel-heading"><strong>Inspector</strong></div>
          <div className="property-group"><label>Actor</label><span>No actor selected</span></div>
          <div className="property-group"><label>Render preset</label><span>Soft Our Series Stage</span></div>
          <div className="property-group"><label>Output</label><span>720 × 1280 · 30 FPS</span></div>
        </aside>
      </div>

      <section className="timeline-shell panel">
        <div className="timeline-heading"><strong>Timeline</strong><span>Timeline editing arrives in Phase 3.</span></div>
        <div className="timeline-ruler">0s <span>3s</span><span>6s</span><span>9s</span><span>12s</span></div>
        <div className="timeline-placeholder">Motion, expression, camera and audio tracks</div>
      </section>
    </main>
  );
}
