import { contextBridge, ipcRenderer } from 'electron';
import type { OurStageProject } from '@our-stage/project-schema';
import type { AiGenerateRequest, ExportProgress, ExportRequest, ExportResult, ExportSession, ImportedFileReference, PlatformAdapter, RecentProject } from '@our-stage/platform-api';

const api: PlatformAdapter = {
  importModel: () => ipcRenderer.invoke('asset:import-model') as Promise<ImportedFileReference | null>,
  importMotion: () => ipcRenderer.invoke('asset:import-motion') as Promise<ImportedFileReference | null>,
  importAudio: () => ipcRenderer.invoke('asset:import-audio') as Promise<ImportedFileReference | null>,
  resolveAsset: (sourcePath) => ipcRenderer.invoke('asset:resolve', sourcePath) as Promise<string | null>,
  loadProject: () => ipcRenderer.invoke('project:load') as Promise<OurStageProject | null>,
  saveProject: (project) => ipcRenderer.invoke('project:save', project) as Promise<string | null>,
  autosaveProject: (project) => ipcRenderer.invoke('project:autosave', project) as Promise<void>,
  getRecentProjects: () => ipcRenderer.invoke('project:recent') as Promise<RecentProject[]>,
  setCredential: (provider, value) => ipcRenderer.invoke('credential:set', provider, value) as Promise<boolean>,
  hasCredential: (provider) => ipcRenderer.invoke('credential:has', provider) as Promise<boolean>,
  startVideoExport: (request: ExportRequest) => ipcRenderer.invoke('export:start', request) as Promise<ExportSession | null>,
  writeVideoFrame: (jobId, frameIndex, bytes) => ipcRenderer.invoke('export:write-frame', jobId, frameIndex, bytes) as Promise<ExportProgress>,
  finishVideoExport: (jobId) => ipcRenderer.invoke('export:finish', jobId) as Promise<ExportResult>,
  cancelVideoExport: (jobId) => ipcRenderer.invoke('export:cancel', jobId) as Promise<void>,
  generateAiPatch: (request: AiGenerateRequest) => ipcRenderer.invoke('ai:generate', request) as Promise<unknown>,
};
contextBridge.exposeInMainWorld('ourStage', api);
