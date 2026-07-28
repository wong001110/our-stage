import { describe, expect, it } from 'vitest';
import { createActorTracks, createBlankProject, parseProject } from './index';

describe('project schema', () => {
  it('creates and parses a blank project', () => {
    const project = createBlankProject('Test Stage');
    expect(parseProject(project).metadata.name).toBe('Test Stage');
    expect(project.tracks.map((track) => track.type)).toEqual(['camera', 'audio', 'render-effect']);
  });

  it('creates deterministic actor track types', () => {
    expect(createActorTracks('actor-1').map((track) => track.type)).toEqual([
      'motion',
      'expression',
      'transform',
    ]);
  });

  it('rejects an invalid duration', () => {
    const project = createBlankProject();
    expect(() =>
      parseProject({ ...project, output: { ...project.output, durationSeconds: 0 } }),
    ).toThrow();
  });
});
