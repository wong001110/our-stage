import { describe, expect, it } from 'vitest';
import { createActorTracks, createBlankProject } from '@our-stage/project-schema';
import {
  applyProjectOperation,
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
});
