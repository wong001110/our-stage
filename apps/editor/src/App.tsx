import { Clapperboard, FolderOpen, Sparkles } from 'lucide-react';

export function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">OS</div>
        <div>
          <h1>Our Stage</h1>
          <p>AI Character Director Playground</p>
        </div>
        <span className="status-pill">Foundation</span>
      </header>

      <section className="welcome-card">
        <div className="welcome-copy">
          <span className="eyebrow">LOCAL-FIRST CREATIVE TOOL</span>
          <h2>Bring a character. Direct a performance.</h2>
          <p>
            Import PMX characters and VMD motion assets, arrange them on a deterministic
            timeline, then let AI propose edits you can inspect and control.
          </p>
          <div className="actions">
            <button type="button" className="primary-button">
              <FolderOpen size={18} /> New local project
            </button>
            <button type="button" className="secondary-button">
              <Sparkles size={18} /> Try mock director
            </button>
          </div>
        </div>
        <div className="stage-placeholder" aria-label="Stage preview placeholder">
          <Clapperboard size={42} />
          <strong>Stage preview</strong>
          <span>Three.js and MMD runtime arrive in Phase 1.</span>
        </div>
      </section>

      <section className="foundation-grid">
        {[
          ['Web editor core', 'React, TypeScript, Vite'],
          ['Desktop shell', 'Electron with isolated preload'],
          ['Project contract', 'Versioned schema and project patches'],
          ['Validation-first AI', 'Mock provider before paid APIs'],
        ].map(([title, description]) => (
          <article key={title}>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
