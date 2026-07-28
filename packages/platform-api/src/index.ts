import type { OurStageProject } from '@our-stage/project-schema';

export interface ImportedFileReference {
  assetId: string;
  name: string;
  path: string;
  sourcePath?: string;
  size: number;
  type: string;
}

export interface RecentProject {
  name: string;
  path: string;
  updatedAt: string;
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
  resolveAsset(sourcePath: string): Promise<string | null>;
  loadProject(): Promise<OurStageProject | null>;
  saveProject(project: OurStageProject): Promise<string | null>;
  autosaveProject(project: OurStageProject): Promise<void>;
  getRecentProjects(): Promise<RecentProject[]>;
  setCredential(provider: string, value: string): Promise<boolean>;
  hasCredential(provider: string): Promise<boolean>;
  exportVideo(request: ExportRequest): Promise<ExportResult>;
}

declare global {
  interface Window {
    ourStage?: PlatformAdapter;
  }
}
