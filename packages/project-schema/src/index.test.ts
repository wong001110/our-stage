import { describe, expect, it } from 'vitest';
import { createActorTracks, createBlankProject, parseProject } from './index';

describe('project schema', () => {
  it('creates and parses a blank project', () => {
    const project = createBlankProject('Test Stage');
    expect(parseProject(project).metadata.name).toBe('Test Stage');
    expect(project.tracks.map((track) => track.type)).toEqual([
      'camera',
      'audio',
      'render-effect',
    ]);
  });

  it('creates deterministic actor track types', () => {
    expect(createActorTracks('actor-1').map((track) => track.type)).toEqual([
      'motion',
      'expression',
      'transform',
      'bone-override',
    ]);
  });

  it('adds a missing Bone Override track when opening an older project', () => {
    const project = createBlankProject('Legacy');
    const actorId = 'actor-legacy';
    const legacy = {
      ...project,
      actors: [{
        actorId,
        name: 'Legacy actor',
        modelAssetId: 'model-legacy',
        enabled: true,
        initialTransform: {
          position: [0, 0, 0] as [number, number, number],
          rotationEuler: [0, 0, 0] as [number, number, number],
          scale: [1, 1, 1] as [number, number, number],
        },
      }],
      tracks: [
        ...project.tracks,
        ...createActorTracks(actorId).filter((track) => track.type !== 'bone-override'),
      ],
    };
    const parsed = parseProject(legacy);
    expect(parsed.tracks.some(
      (track) => track.type === 'bone-override' && track.actorId === actorId,
    )).toBe(true);
  });

  it('rejects an invalid duration', () => {
    const project = createBlankProject();
    expect(() =>
      parseProject({ ...project, output: { ...project.output, durationSeconds: 0 } }),
    ).toThrow();
  });
});
