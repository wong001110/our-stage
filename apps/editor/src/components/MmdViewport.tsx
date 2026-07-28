import { useEffect, useRef, useState } from 'react';
import { Camera, Gauge, Pause, Play, RotateCcw, Upload } from 'lucide-react';
import { ThreeMmdRuntime, type MmdRuntimeState } from '@our-stage/mmd-runtime';

const initialState: MmdRuntimeState = {
  modelLoaded: false,
  motionLoaded: false,
  playing: false,
  currentTime: 0,
  duration: 0,
  diagnostics: null,
  error: null,
};

export function MmdViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<ThreeMmdRuntime | null>(null);
  const [runtimeState, setRuntimeState] = useState(initialState);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runtime = new ThreeMmdRuntime(canvas);
    runtimeRef.current = runtime;
    const unsubscribe = runtime.subscribe(setRuntimeState);
    return () => {
      unsubscribe();
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  const importModel = async () => {
    const platform = window.ourStage;
    if (!platform) return;
    setBusy(true);
    try {
      const file = await platform.importModel();
      if (file) await runtimeRef.current?.loadModel(file.path, file.name);
    } finally {
      setBusy(false);
    }
  };

  const importMotion = async () => {
    const platform = window.ourStage;
    if (!platform) return;
    setBusy(true);
    try {
      const file = await platform.importMotion();
      if (file) await runtimeRef.current?.loadMotion(file.path);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="viewport-panel">
      <div className="viewport-toolbar">
        <button type="button" onClick={importModel} disabled={busy || !window.ourStage}>
          <Upload size={16} /> PMX
        </button>
        <button type="button" onClick={importMotion} disabled={busy || !runtimeState.modelLoaded || !window.ourStage}>
          <Upload size={16} /> VMD
        </button>
        <span className="toolbar-divider" />
        <button type="button" onClick={() => (runtimeState.playing ? runtimeRef.current?.pause() : runtimeRef.current?.play())} disabled={!runtimeState.motionLoaded}>
          {runtimeState.playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button type="button" onClick={() => runtimeRef.current?.reset()} disabled={!runtimeState.modelLoaded}>
          <RotateCcw size={16} />
        </button>
        <span className="time-readout">{runtimeState.currentTime.toFixed(2)} / {runtimeState.duration.toFixed(2)}s</span>
        <label className="quality-select">
          <Gauge size={15} />
          <select defaultValue="preview" onChange={(event) => runtimeRef.current?.setQuality(event.target.value as 'draft' | 'preview' | 'final')}>
            <option value="draft">Draft</option>
            <option value="preview">Preview</option>
            <option value="final">Final</option>
          </select>
        </label>
      </div>
      <div className="viewport-canvas-wrap">
        <canvas ref={canvasRef} />
        {!runtimeState.modelLoaded && (
          <div className="viewport-empty">
            <Camera size={38} />
            <strong>Import a PMX model</strong>
            <span>Desktop mode resolves the model and relative texture files locally.</span>
          </div>
        )}
        {runtimeState.error && <div className="viewport-error">{runtimeState.error}</div>}
      </div>
      <div className="viewport-status">
        <span>{runtimeState.modelLoaded ? 'Model ready' : 'No model'}</span>
        <span>{runtimeState.motionLoaded ? 'Motion ready' : 'No motion'}</span>
        <span>Physics: compatibility mode (off)</span>
      </div>
      {runtimeState.diagnostics && (
        <div className="diagnostic-strip">
          <strong>{runtimeState.diagnostics.name}</strong>
          <span>{runtimeState.diagnostics.bones} bones</span>
          <span>{runtimeState.diagnostics.morphTargets} morphs</span>
          <span>{runtimeState.diagnostics.materials} materials</span>
          <span title={runtimeState.diagnostics.renderer}>{runtimeState.diagnostics.renderer}</span>
        </div>
      )}
    </section>
  );
}
