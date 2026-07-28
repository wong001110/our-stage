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

export interface ExportSession {
  jobId: string;
  outputPath: string;
  frameCount: number;
  fps: number;
}

export interface ExportProgress {
  jobId: string;
  frameIndex: number;
  frameCount: number;
  ratio: number;
}

export interface ExportResult {
  outputPath: string;
  durationMs: number;
  frameCount: number;
}

export interface AiGenerateRequest {
  mode: 'create' | 'revise';
  provider: 'deepseek';
  project: OurStageProject;
  request: string;
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
  startVideoExport(request: ExportRequest): Promise<ExportSession | null>;
  writeVideoFrame(jobId: string, frameIndex: number, bytes: Uint8Array): Promise<ExportProgress>;
  finishVideoExport(jobId: string): Promise<ExportResult>;
  cancelVideoExport(jobId: string): Promise<void>;
  generateAiPatch(request: AiGenerateRequest): Promise<unknown>;
}

declare global {
  interface Window {
    ourStage?: PlatformAdapter;
  }
}
