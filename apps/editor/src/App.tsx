import './phase9.css';
import { useEffect, useState } from 'react';
import {
  Download,
  FilePlus2,
  Film,
  FolderOpen,
  Library,
  Music2,
  Save,
  Sparkles,
} from 'lucide-react';
import { AiDirectorPanel } from './components/AiDirectorPanel';
import { BoneOverrideEditor } from './components/BoneOverrideEditor';
import { ExportPanel } from './components/ExportPanel';
import { MmdViewport } from './components/MmdViewport';
import { TimelineEditor } from './components/TimelineEditor';
import { ValidationPanel } from './components/ValidationPanel';
import { useProjectStore } from './store/projectStore';

const copy = {
  en: {
    new: 'New', open: 'Open', save: 'Save', export: 'Export', ai: 'AI Director',
    assets: 'Assets', motion: 'Motion', audio: 'Audio', inspector: 'Inspector',
    project: 'Project', selected: 'Selected asset', licence: 'Licence',
    render: 'Render preset', output: 'Output', language: 'Language',
  },
  'zh-CN': {
    new: '新建', open: '打开', save: '保存', export: '导出', ai: 'AI 导演',
    assets: '素材', motion: '动作', audio: '音频', inspector: '属性',
    project: '项目', selected: '选中素材', licence: '授权',
    render: '渲染预设', output: '输出', language: '语言',
  },
} as const;

export function App() {
  const [exportOpen, setExportOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const project = useProjectStore((state) => state.project);
  const dirty = useProjectStore((state) => state.dirty);
  const selectedAssetId = useProjectStore((state) => state.selectedAssetId);
  const newProject = useProjectStore((state) => state.newProject);
  const openProject = useProjectStore((state) => state.openProject);
  const saveProject = useProjectStore((state) => state.saveProject);
  const importMotion = useProjectStore((state) => state.importMotion);
  const importAudio = useProjectStore((state) => state.importAudio);
  const selectAsset = useProjectStore((state) => state.selectAsset);
  const updateProject = useProjectStore((state) => state.updateProject);
  const timelinePlaying = useProjectStore((state) => state.timelinePlaying);
  const setTimelinePlaying = useProjectStore((state) => state.setTimelinePlaying);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const selectedAsset = project.assets.find((asset) => asset.assetId === selectedAssetId);
  const t = copy[project.metadata.locale];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveProject();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (event.code === 'Space') {
        event.preventDefault();
        setTimelinePlaying(!timelinePlaying);
      } else if (event.key === 'Escape') {
        setAiOpen(false);
        setExportOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveProject, undo, redo, timelinePlaying, setTimelinePlaying]);

  const setPreset = (presetId: string) => updateProject((current) => ({
    ...current,
    render: { ...current.render, presetId },
  }));
  const setOutput = (value: string) => updateProject((current) => ({
    ...current,
    output: value === '1080'
      ? { ...current.output, width: 1080, height: 1920 }
      : { ...current.output, width: 720, height: 1280 },
  }));
  const setLocale = (locale: 'en' | 'zh-CN') => updateProject((current) => ({
    ...current,
    metadata: { ...current.metadata, locale },
  }));

  return (
    <main className="editor-shell">
      <header className="topbar">
        <div className="brand-mark">OS</div>
        <div><h1>Our Stage <small>Phase 9</small></h1><p>{project.metadata.name}{dirty ? ' · Unsaved' : ''}</p></div>
        <nav className="top-actions">
          <button type="button" onClick={() => newProject()}><FilePlus2 size={16} />{t.new}</button>
          <button type="button" onClick={() => void openProject()}><FolderOpen size={16} />{t.open}</button>
          <button type="button" onClick={() => void saveProject()}><Save size={16} />{t.save}</button>
          <button type="button" onClick={() => setExportOpen(true)}><Download size={16} />{t.export}</button>
          <button type="button" className="accent" onClick={() => setAiOpen(true)}><Sparkles size={16} />{t.ai}</button>
        </nav>
      </header>

      <div className="editor-grid">
        <aside className="asset-panel panel">
          <div className="panel-heading"><Library size={17} /><strong>{t.assets}</strong></div>
          <div className="asset-import-actions">
            <button type="button" onClick={() => void importMotion()}><Film size={14} />{t.motion}</button>
            <button type="button" onClick={() => void importAudio()}><Music2 size={14} />{t.audio}</button>
          </div>
          <div className="asset-list">
            {project.assets.length === 0 ? (
              <div className="asset-empty"><Film size={24} /><span>Import a PMX model in the viewport, then add VMD motions here.</span></div>
            ) : project.assets.map((asset) => (
              <button
                type="button"
                key={asset.assetId}
                className={asset.assetId === selectedAssetId ? 'asset-row selected' : 'asset-row'}
                onClick={() => selectAsset(asset.assetId)}
              >
                <span>{asset.title}</span><small>{asset.type}</small>
              </button>
            ))}
          </div>
        </aside>

        <MmdViewport />

        <aside className="inspector-panel panel">
          <div className="panel-heading"><strong>{t.inspector}</strong></div>
          <div className="inspector-scroll">
            <div className="property-group"><label>{t.project}</label><span>{project.metadata.name}</span></div>
            <div className="property-group"><label>{t.selected}</label><span>{selectedAsset?.title ?? '—'}</span></div>
            <div className="property-group"><label>{t.licence}</label><span>{selectedAsset?.source?.licence ?? 'Not recorded'}</span></div>
            <div className="property-group">
              <label>{t.render}</label>
              <select value={project.render.presetId} onChange={(event) => setPreset(event.target.value)}>
                <option value="classic-mmd">Classic MMD Toon</option>
                <option value="soft-our-series">Soft Our Series</option>
                <option value="cyan-magenta-outline">Cyan/Magenta Stage</option>
              </select>
            </div>
            <div className="property-group">
              <label>{t.output}</label>
              <select value={project.output.width === 1080 ? '1080' : '720'} onChange={(event) => setOutput(event.target.value)}>
                <option value="720">720 × 1280</option>
                <option value="1080">1080 × 1920</option>
              </select>
            </div>
            <div className="property-group">
              <label>{t.language}</label>
              <select value={project.metadata.locale} onChange={(event) => setLocale(event.target.value as 'en' | 'zh-CN')}>
                <option value="en">English</option><option value="zh-CN">中文</option>
              </select>
            </div>
            <BoneOverrideEditor />
            <ValidationPanel />
          </div>
        </aside>
      </div>

      <TimelineEditor />
      {exportOpen && <ExportPanel onClose={() => setExportOpen(false)} />}
      {aiOpen && <AiDirectorPanel onClose={() => setAiOpen(false)} />}
    </main>
  );
}
