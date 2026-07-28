import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Gauge, Pause, Play, RotateCcw, Upload } from 'lucide-react';
import { ThreeMmdRuntime, type MmdRuntimeState } from '@our-stage/mmd-runtime';
import { useProjectStore } from '../store/projectStore';

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
  const loadedModelRef = useRef<string | null>(null);
  const loadedMotionRef = useRef<string | null>(null);
  const [runtimeState, setRuntimeState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const project = useProjectStore((state) => state.project);
  const selectedActorId = useProjectStore((state) => state.selectedActorId);
  const selectedAssetId = useProjectStore((state) => state.selectedAssetId);
  const importModel = useProjectStore((state) => state.importModel);
  const importMotion = useProjectStore((state) => state.importMotion);
  const setCurrentTime = useProjectStore((state) => state.setCurrentTime);

  const actor = useMemo(
    () => project.actors.find((item) => item.actorId === selectedActorId) ?? project.actors[0],
    [project.actors, selectedActorId],
  );
  const modelAsset = project.assets.find((asset) => asset.assetId === actor?.modelAssetId);
  const selectedMotion = project.assets.find(
    (asset) => asset.assetId === selectedAssetId && asset.type === 'vmd-motion',
  );
  const motionAsset = selectedMotion ?? project.assets.find((asset) => asset.type === 'vmd-motion');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runtime = new ThreeMmdRuntime(canvas);
    runtimeRef.current = runtime;
    const unsubscribe = runtime.subscribe((state) => {
      setRuntimeState(state);
      setCurrentTime(state.currentTime);
    });
    return () => {
      unsubscribe();
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [setCurrentTime]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !modelAsset?.runtimeUrl || loadedModelRef.current === modelAsset.assetId) return;
    loadedModelRef.current = modelAsset.assetId;
    loadedMotionRef.current = null;
    setBusy(true);
    void runtime
      .loadModel(modelAsset.runtimeUrl, modelAsset.title)
      .catch(() => {
        loadedModelRef.current = null;
      })
      .finally(() => setBusy(false));
  }, [modelAsset?.assetId, modelAsset?.runtimeUrl, modelAsset?.title]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (
      !runtime ||
      !runtimeState.modelLoaded ||
      !motionAsset?.runtimeUrl ||
      loadedMotionRef.current === motionAsset.assetId
    ) {
      return;
    }
    loadedMotionRef.current = motionAsset.assetId;
    setBusy(true);
    void runtime
      .loadMotion(motionAsset.runtimeUrl)
      .catch(() => {
        loadedMotionRef.current = null;
      })
      .finally(() => setBusy(false));
  }, [motionAsset?.assetId, motionAsset?.runtimeUrl, runtimeState.modelLoaded]);

  return (
    <section className="viewport-panel">
      <div className="viewport-toolbar">
        <button type="button" onClick={() => void importModel()} disabled={busy}>
          <Upload size={16} /> PMX
        </button>
        <button
          type="button"
          onClick={() => void importMotion()}
          disabled={busy || !runtimeState.modelLoaded}
        >
          <Upload size={16} /> VMD
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          onClick={() =>
            runtimeState.playing ? runtimeRef.current?.pause() : runtimeRef.current?.play()
          }
          disabled={!runtimeState.motionLoaded}
        >
          {runtimeState.playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          onClick={() => runtimeRef.current?.reset()}
          disabled={!runtimeState.modelLoaded}
        >
          <RotateCcw size={16} />
        </button>
        <span className="time-readout">
          {runtimeState.currentTime.toFixed(2)} / {runtimeState.duration.toFixed(2)}s
        </span>
        <label className="quality-select">
          <Gauge size={15} />
          <select
            defaultValue="preview"
            onChange={(event) =>
              runtimeRef.current?.setQuality(
                event.target.value as 'draft' | 'preview' | 'final',
              )
            }
          >
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
          <span title={runtimeState.diagnostics.renderer}>
            {runtimeState.diagnostics.renderer}
          </span>
        </div>
      )}
    </section>
  );
}
