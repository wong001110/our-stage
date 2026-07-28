import type { OurStageProject } from '@our-stage/project-schema';
import type { ThreeMmdRuntime } from '@our-stage/mmd-runtime';
import { evaluateTimeline } from '@our-stage/timeline-engine';

const lerp = (a: number, b: number, progress: number) => a + (b - a) * progress;

export async function renderProjectFrame(
  runtime: ThreeMmdRuntime,
  project: OurStageProject,
  actorId: string | null,
  timeSeconds: number,
): Promise<void> {
  const actor = project.actors.find((item) => item.actorId === actorId) ?? project.actors[0];
  if (!actor) {
    runtime.renderNow();
    return;
  }

  const evaluation = evaluateTimeline(project, timeSeconds);
  const motionEntry = evaluation.active.find(
    (item) => item.track.type === 'motion' && item.track.actorId === actor.actorId,
  );

  if (motionEntry?.clip.type === 'motion') {
    const asset = project.assets.find((item) => item.assetId === motionEntry.clip.motionAssetId);
    if (asset?.runtimeUrl) {
      if (runtime.getLoadedMotionId() !== asset.assetId) {
        await runtime.loadMotion(asset.runtimeUrl, asset.assetId);
      }
      const duration = runtime.getState().duration;
      const localTime =
        motionEntry.clip.loop && duration > 0
          ? motionEntry.localTimeSeconds % duration
          : motionEntry.localTimeSeconds;
      runtime.seek(localTime);
    }
  } else if (runtime.getState().motionLoaded) {
    runtime.seek(0);
  }

  const transformEntry = evaluation.active.find(
    (item) => item.track.type === 'transform' && item.track.actorId === actor.actorId,
  );
  if (transformEntry?.clip.type === 'transform') {
    const { from, to } = transformEntry.clip;
    const progress = transformEntry.progress;
    runtime.setActorTransform({
      position: from.position.map((value, index) =>
        lerp(value, to.position[index] ?? value, progress),
      ) as [number, number, number],
      rotationEuler: from.rotationEuler.map((value, index) =>
        lerp(value, to.rotationEuler[index] ?? value, progress),
      ) as [number, number, number],
      scale: from.scale.map((value, index) =>
        lerp(value, to.scale[index] ?? value, progress),
      ) as [number, number, number],
    });
  } else {
    runtime.setActorTransform(actor.initialTransform);
  }

  runtime.resetMorphs();
  for (const item of evaluation.active) {
    if (item.track.type === 'expression' && item.clip.type === 'expression') {
      runtime.setMorph(item.clip.morphName, item.clip.weight);
    }
  }

  const cameraEntry = evaluation.active.find((item) => item.clip.type === 'camera');
  if (cameraEntry?.clip.type === 'camera') runtime.applyCameraPreset(cameraEntry.clip.presetId);
  runtime.renderNow();
}
