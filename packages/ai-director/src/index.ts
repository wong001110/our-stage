import type { OurStageProject } from '@our-stage/project-schema';

export interface ProjectOperation {
  type: string;
  [key: string]: unknown;
}

export interface ProjectPatch {
  patchId: string;
  baseProjectRevision: number;
  summary: string;
  operations: ProjectOperation[];
  assumptions?: string[];
  warnings?: string[];
}

export interface AiDirectorProvider {
  createComposition(project: OurStageProject, request: string): Promise<ProjectPatch>;
  reviseComposition(project: OurStageProject, request: string): Promise<ProjectPatch>;
}

export class MockAiDirectorProvider implements AiDirectorProvider {
  async createComposition(project: OurStageProject, request: string): Promise<ProjectPatch> {
    return {
      patchId: `patch-${crypto.randomUUID()}`,
      baseProjectRevision: project.revision,
      summary: `Mock composition for: ${request}`,
      operations: [],
      assumptions: ['No compatible motion assets are loaded yet.'],
      warnings: ['Import VMD motions before generating a playable composition.'],
    };
  }

  async reviseComposition(project: OurStageProject, request: string): Promise<ProjectPatch> {
    return this.createComposition(project, request);
  }
}
