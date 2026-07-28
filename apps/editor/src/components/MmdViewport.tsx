import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Gauge, Pause, Play, RotateCcw, Upload } from 'lucide-react';
import { ThreeMmdRuntime, type MmdRuntimeState } from '@our-stage/mmd-runtime';
import { evaluateTimeline } from '@our-stage/timeline-engine';
import { useProjectStore } from '../store/projectStore';
import { registerActiveRuntime } from '../runtime/runtimeRegistry';
import { renderProjectFrame } from '../runtime/renderProjectFrame';

const initialState: MmdRuntimeState = {
  modelLoaded: false,
  motionLoaded: false,
  playing: false,
  currentTime: 0,
  duration: 0,
  diagnostics: null,
  motionProbe: null,
  error: null,
};

export function MmdViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<ThreeMmdRuntime | null>(null);
  const loadedModelRef = useRef<string | null>(null);
  const [runtimeState, setRuntimeState] = useState(initialState);
  const [busy, setBusy] = useState(false);

  const project = useProjectStore((state) => state.project);
  const selectedActorId = useProjectStore((state) => state.selectedActorId);
  const selectedBoneName = useProjectStore((state) => state.selectedBoneName);
  const boneOverridePreview = useProjectStore((state) => state.boneOverridePreview);
  const currentTime = useProjectStore((state) => state.currentTime);
  const timelinePlaying = useProjectStore((state) => state.timelinePlaying);
  const importModel = useProjectStore((state) => state.importModel);
  const importMotion = useProjectStore((state) => state.importMotion);
  const setTimelinePlaying = useProjectStore((state) => state.setTimelinePlaying);
  const setCurrentTime = useProjectStore((state) => state.setCurrentTime);
  const setAvailableBoneNames = useProjectStore((state) => state.setAvailableBoneNames);

  const actor = useMemo(
    () => project.actors.find((item) => item.actorId === selectedActorId) ?? project.actors[0],
    [project.actors, selectedActorId],
  );
  const modelAsset = project.assets.find((asset) => asset.assetId === actor?.modelAssetId);
  const evaluation = useMemo(
    () => evaluateTimeline(project, currentTime),
    [project, currentTime],
  );
  const activeMotion = evaluation.active.find(
    (item) => item.track.type === 'motion' && item.track.actorId === actor?.actorId,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runtime = new ThreeMmdRuntime(canvas);
    runtimeRef.current = runtime;
    registerActiveRuntime(runtime);
    const unsubscribe = runtime.subscribe(setRuntimeState);
    return () => {
      unsubscribe();
      registerActiveRuntime(null);
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    setAvailableBoneNames(runtimeState.diagnostics?.boneNames ?? []);
  }, [runtimeState.diagnostics, setAvailableBoneNames]);

  useEffect(() => {
    runtimeRef.current?.setSelectedBone(selectedBoneName);
  }, [selectedBoneName, runtimeState.modelLoaded]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !modelAsset?.runtimeUrl || loadedModelRef.current === modelAsset.assetId) return;
    loadedModelRef.current = modelAsset.assetId;
    setBusy(true);
    void runtime
      .loadModel(modelAsset.runtimeUrl, modelAsset.title)
      .catch(() => { loadedModelRef.current = null; })
      .finally(() => setBusy(false));
  }, [modelAsset?.assetId, modelAsset?.runtimeUrl, modelAsset?.title]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !runtimeState.modelLoaded) return;
    let cancelled = false;
    void renderProjectFrame(runtime, project, selectedActorId, currentTime)
      .then(() => {
        if (cancelled || !boneOverridePreview || boneOverridePreview.actorId !== actor?.actorId) return;
        runtime.applyBoneOverride(
          boneOverridePreview.boneName,
          boneOverridePreview.rotationEulerOffset,
          boneOverridePreview.positionOffset,
        );
        runtime.renderNow();
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [
    project,
    selectedActorId,
    currentTime,
    runtimeState.modelLoaded,
    boneOverridePreview,
    actor?.actorId,
  ]);

  const probeText = !runtimeState.motionProbe
    ? 'Probe: waiting'
    : runtimeState.motionProbe.changedBones > 0
      ? `Probe: ${runtimeState.motionProbe.changedBones} bones changed`
      : 'Probe: 0 bones changed';

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
          onClick={() => setTimelinePlaying(!timelinePlaying)}
          disabled={!runtimeState.motionLoaded && !activeMotion}
        >
          {timelinePlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          onClick={() => { setTimelinePlaying(false); setCurrentTime(0); }}
          disabled={!runtimeState.modelLoaded}
        >
          <RotateCcw size={16} />
        </button>
        <span className="time-readout">
          {currentTime.toFixed(2)} / {project.output.durationSeconds.toFixed(2)}s
        </span>
        <label className="quality-select">
          <Gauge size={15} />
          <select
            defaultValue="preview"
            onChange={(event) => runtimeRef.current?.setQuality(
              event.target.value as 'draft' | 'preview' | 'final',
            )}
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
        <span>{activeMotion ? `Timeline: ${activeMotion.clip.label ?? 'motion'}` : 'Timeline idle'}</span>
        <span>{probeText}</span>
        <span>{selectedBoneName ? `Bone: ${selectedBoneName}` : 'No bone selected'}</span>
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
