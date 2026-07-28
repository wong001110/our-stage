import { describe, expect, it } from 'vitest';
import { createActorTracks, createBlankProject } from '@our-stage/project-schema';
import {
  applyProjectOperation,
  createBoneOverrideClip,
  createMotionClip,
  evaluateTimeline,
  invertProjectOperation,
} from './index';

function projectWithActor() {
  const project = createBlankProject();
  return {
    ...project,
    actors: [
      {
        actorId: 'actor-1',
        name: 'Actor',
        modelAssetId: 'model-1',
        enabled: true,
        initialTransform: {
          position: [0, 0, 0] as [number, number, number],
          rotationEuler: [0, 0, 0] as [number, number, number],
          scale: [1, 1, 1] as [number, number, number],
        },
      },
    ],
    tracks: [...project.tracks, ...createActorTracks('actor-1')],
  };
}

describe('timeline operations', () => {
  it('adds, evaluates and removes a clip through inverse operation', () => {
    const project = projectWithActor();
    const clip = createMotionClip('motion-1', 2, 4);
    const add = { type: 'add_clip' as const, trackId: 'motion-actor-1', clip };
    const next = applyProjectOperation(project, add);
    expect(evaluateTimeline(next, 3).active[0]?.clip.clipId).toBe(clip.clipId);
    const reverted = applyProjectOperation(next, invertProjectOperation(project, add));
    expect(evaluateTimeline(reverted, 3).active).toHaveLength(0);
  });

  it('uses deterministic local motion time', () => {
    const project = projectWithActor();
    const clip = { ...createMotionClip('motion-1', 1, 5), speed: 2, sourceOffsetSeconds: 0.5 };
    const next = applyProjectOperation(project, {
      type: 'add_clip',
      trackId: 'motion-actor-1',
      clip,
    });
    expect(evaluateTimeline(next, 2).active[0]?.localTimeSeconds).toBe(2.5);
  });

  it('interpolates additive bone offsets between keyframes', () => {
    let project = projectWithActor();
    const first = createBoneOverrideClip('右腕', 0, [0, 0, 0], [0, 0, 0], 'linear');
    const second = createBoneOverrideClip('右腕', 2, [0, 0, 1], [0, 2, 0], 'linear');
    project = applyProjectOperation(project, {
      type: 'add_clip',
      trackId: 'bone-override-actor-1',
      clip: first,
    });
    project = applyProjectOperation(project, {
      type: 'add_clip',
      trackId: 'bone-override-actor-1',
      clip: second,
    });
    const evaluated = evaluateTimeline(project, 1).boneOverrides[0];
    expect(evaluated?.boneName).toBe('右腕');
    expect(evaluated?.rotationEulerOffset[2]).toBeCloseTo(0.5);
    expect(evaluated?.positionOffset[1]).toBeCloseTo(1);
  });

  it('holds the final bone override after the last keyframe', () => {
    let project = projectWithActor();
    const keyframe = createBoneOverrideClip('頭', 1, [0.2, 0, 0]);
    project = applyProjectOperation(project, {
      type: 'add_clip',
      trackId: 'bone-override-actor-1',
      clip: keyframe,
    });
    expect(evaluateTimeline(project, 5).boneOverrides[0]?.rotationEulerOffset[0])
      .toBeCloseTo(0.2);
  });
});
