import type { OurStageProject } from '@our-stage/project-schema';

export interface ImportedFileReference {
  assetId: string;
  name: string;
  path: string;
  size: number;
  type: string;
}

export interface ExportRequest {
  project: OurStageProject;
  outputPath?: string;
}

export interface ExportResult {
  outputPath: string;
  durationMs: number;
}

export interface PlatformAdapter {
  importModel(): Promise<ImportedFileReference | null>;
  importMotion(): Promise<ImportedFileReference | null>;
  importAudio(): Promise<ImportedFileReference | null>;
  loadProject(): Promise<OurStageProject | null>;
  saveProject(project: OurStageProject): Promise<string | null>;
  exportVideo(request: ExportRequest): Promise<ExportResult>;
}

declare global {
  interface Window {
    ourStage?: PlatformAdapter;
  }
}
