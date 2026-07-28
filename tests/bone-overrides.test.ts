import { describe, expect, it } from 'vitest';
import {
  createActorTracks,
  createBlankProject,
  parseProject,
  type OurStageProject,
} from '@our-stage/project-schema';
import {
  applyProjectOperation,
  createBoneOverrideClip,
  evaluateTimeline,
} from '@our-stage/timeline-engine';

function projectWithActor(): OurStageProject {
  const project = createBlankProject('Bone override test');
  const actorId = 'actor-test';
  return {
    ...project,
    actors: [{
      actorId,
      name: 'Test actor',
      modelAssetId: 'model-test',
      enabled: true,
      initialTransform: {
        position: [0, 0, 0],
        rotationEuler: [0, 0, 0],
        scale: [1, 1, 1],
      },
    }],
    tracks: [...project.tracks, ...createActorTracks(actorId)],
  };
}

describe('bone override timeline', () => {
  it('smoothly interpolates offsets between keyframes', () => {
    let project = projectWithActor();
    const track = project.tracks.find((item) => item.type === 'bone-override');
    expect(track?.type).toBe('bone-override');
    if (!track || track.type !== 'bone-override') return;

    const first = createBoneOverrideClip('右腕', 0, [0, 0, 0], [0, 0, 0], 'linear');
    const second = createBoneOverrideClip('右腕', 2, [0, 0, 1], [0, 2, 0], 'linear');
    project = applyProjectOperation(project, { type: 'add_clip', trackId: track.trackId, clip: first });
    project = applyProjectOperation(project, { type: 'add_clip', trackId: track.trackId, clip: second });

    const evaluated = evaluateTimeline(project, 1).boneOverrides[0];
    expect(evaluated?.boneName).toBe('右腕');
    expect(evaluated?.rotationEulerOffset[2]).toBeCloseTo(0.5);
    expect(evaluated?.positionOffset[1]).toBeCloseTo(1);
  });

  it('keeps the latest keyframe after the final key', () => {
    let project = projectWithActor();
    const track = project.tracks.find((item) => item.type === 'bone-override');
    if (!track || track.type !== 'bone-override') return;
    const clip = createBoneOverrideClip('頭', 1, [0.2, 0, 0], [0, 0, 0], 'smooth');
    project = applyProjectOperation(project, { type: 'add_clip', trackId: track.trackId, clip });
    expect(evaluateTimeline(project, 5).boneOverrides[0]?.rotationEulerOffset[0]).toBeCloseTo(0.2);
  });

  it('adds a Bone Override track when opening an older project', () => {
    const project = projectWithActor();
    const oldProject = {
      ...project,
      tracks: project.tracks.filter((track) => track.type !== 'bone-override'),
    };
    const parsed = parseProject(oldProject);
    expect(parsed.tracks.some(
      (track) => track.type === 'bone-override' && track.actorId === 'actor-test',
    )).toBe(true);
  });
});
