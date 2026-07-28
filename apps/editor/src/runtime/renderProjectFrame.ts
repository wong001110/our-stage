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
  runtime.clearPoseOverrides();
  runtime.applyRenderPreset(project.render.presetId);

  const actor = project.actors.find((item) => item.actorId === actorId) ?? project.actors[0];
  if (!actor) {
    runtime.renderNow();
    return;
  }

  const evaluation = evaluateTimeline(project, timeSeconds);
  const motionEntry = evaluation.active.find(
    (item) => item.track.type === 'motion' && item.track.actorId === actor.actorId,
  );
  const motionClip = motionEntry?.clip.type === 'motion' ? motionEntry.clip : null;

  if (motionEntry && motionClip) {
    const asset = project.assets.find((item) => item.assetId === motionClip.motionAssetId);
    if (asset?.runtimeUrl) {
      if (runtime.getLoadedMotionId() !== asset.assetId) {
        await runtime.loadMotion(asset.runtimeUrl, asset.assetId);
      }
      const duration = runtime.getState().duration;
      const localTime = motionClip.loop && duration > 0
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

  runtime.beginPoseOverrides();
  for (const override of evaluation.boneOverrides) {
    if (override.actorId !== actor.actorId) continue;
    runtime.applyBoneOverride(
      override.boneName,
      override.rotationEulerOffset,
      override.positionOffset,
    );
  }

  const cameraEntry = evaluation.active.find((item) => item.clip.type === 'camera');
  if (cameraEntry?.clip.type === 'camera') runtime.applyCameraPreset(cameraEntry.clip.presetId);
  runtime.renderNow();
}
