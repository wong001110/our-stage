import '../export.css';
import { useRef, useState } from 'react';
import { Film, LoaderCircle, Square, X } from 'lucide-react';
import { createFramePlan, canvasToPngBytes } from '@our-stage/video-export';
import { useProjectStore } from '../store/projectStore';
import { getActiveRuntime } from '../runtime/runtimeRegistry';
import { renderProjectFrame } from '../runtime/renderProjectFrame';

interface ExportPanelProps { onClose(): void; }

export function ExportPanel({ onClose }: ExportPanelProps) {
  const project = useProjectStore((state) => state.project);
  const selectedActorId = useProjectStore((state) => state.selectedActorId);
  const currentTime = useProjectStore((state) => state.currentTime);
  const setCurrentTime = useProjectStore((state) => state.setCurrentTime);
  const setTimelinePlaying = useProjectStore((state) => state.setTimelinePlaying);
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Choose Export to render the current project with a fixed frame clock.');
  const activeJob = useRef<string | null>(null);
  const cancelled = useRef(false);

  const startExport = async () => {
    const platform = window.ourStage;
    const runtime = getActiveRuntime();
    if (!platform || !runtime || !runtime.getState().modelLoaded) {
      setStatus('error');
      setMessage('Load a PMX model before exporting.');
      return;
    }
    const framePlan = createFramePlan(project.output);
    setTimelinePlaying(false);
    setStatus('rendering');
    setProgress(0);
    setMessage('Preparing FFmpeg…');
    cancelled.current = false;
    const session = await platform.startVideoExport({ project });
    if (!session) {
      setStatus('idle');
      setMessage('Export cancelled before rendering.');
      return;
    }
    activeJob.current = session.jobId;
    runtime.setQuality('final');
    runtime.setOutputSize(project.output.width, project.output.height);
    try {
      for (let frameIndex = 0; frameIndex < framePlan.frameCount; frameIndex += 1) {
        if (cancelled.current) throw new Error('Export cancelled.');
        const time = framePlan.timeAt(frameIndex);
        await renderProjectFrame(runtime, project, selectedActorId, time);
        const bytes = await canvasToPngBytes(runtime.getCanvas());
        const state = await platform.writeVideoFrame(session.jobId, frameIndex, bytes);
        setProgress(state.ratio);
        setMessage(`Rendering frame ${frameIndex + 1} of ${framePlan.frameCount}`);
      }
      const result = await platform.finishVideoExport(session.jobId);
      activeJob.current = null;
      setProgress(1);
      setStatus('done');
      setMessage(`Exported ${result.frameCount} frames to ${result.outputPath}`);
    } catch (error) {
      if (activeJob.current) await platform.cancelVideoExport(activeJob.current).catch(() => undefined);
      activeJob.current = null;
      setStatus('error');
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      runtime.clearOutputSize();
      setCurrentTime(currentTime);
      await renderProjectFrame(runtime, project, selectedActorId, currentTime).catch(() => undefined);
    }
  };

  const cancelExport = async () => {
    cancelled.current = true;
    const jobId = activeJob.current;
    if (jobId) await window.ourStage?.cancelVideoExport(jobId);
  };

  return <div className="modal-backdrop" role="presentation"><section className="export-panel" role="dialog" aria-modal="true" aria-label="Export video"><header><div><strong>Deterministic video export</strong><span>{project.output.width} × {project.output.height} · {project.output.fps} FPS · {project.output.durationSeconds}s</span></div><button type="button" onClick={onClose} disabled={status === 'rendering'}><X size={16} /></button></header><div className="export-body"><Film size={36} /><p>{message}</p><div className="progress-track"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div><small>{Math.round(progress * 100)}%</small></div><footer>{status === 'rendering' ? <button type="button" className="danger" onClick={() => void cancelExport()}><Square size={14} /> Cancel</button> : <button type="button" className="accent" onClick={() => void startExport()}>{status === 'idle' ? <Film size={14} /> : <LoaderCircle size={14} />} Export MP4</button>}</footer></section></div>;
}
