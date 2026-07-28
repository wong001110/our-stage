import { describe, expect, it } from 'vitest';
import { createBlankProject, parseProject } from './index';

describe('project schema', () => {
  it('creates and parses a blank project', () => {
    const project = createBlankProject('Test Stage');
    expect(parseProject(project).metadata.name).toBe('Test Stage');
  });

  it('rejects an invalid duration', () => {
    const project = createBlankProject();
    expect(() => parseProject({ ...project, output: { ...project.output, durationSeconds: 0 } })).toThrow();
  });
});
