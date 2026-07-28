import { contextBridge, ipcRenderer } from 'electron';
import type { OurStageProject } from '@our-stage/project-schema';
import type {
  ImportedFileReference,
  PlatformAdapter,
  RecentProject,
} from '@our-stage/platform-api';

const api: PlatformAdapter = {
  importModel: () =>
    ipcRenderer.invoke('asset:import-model') as Promise<ImportedFileReference | null>,
  importMotion: () =>
    ipcRenderer.invoke('asset:import-motion') as Promise<ImportedFileReference | null>,
  importAudio: () =>
    ipcRenderer.invoke('asset:import-audio') as Promise<ImportedFileReference | null>,
  resolveAsset: (sourcePath) =>
    ipcRenderer.invoke('asset:resolve', sourcePath) as Promise<string | null>,
  loadProject: () => ipcRenderer.invoke('project:load') as Promise<OurStageProject | null>,
  saveProject: (project) =>
    ipcRenderer.invoke('project:save', project) as Promise<string | null>,
  autosaveProject: (project) =>
    ipcRenderer.invoke('project:autosave', project) as Promise<void>,
  getRecentProjects: () =>
    ipcRenderer.invoke('project:recent') as Promise<RecentProject[]>,
  setCredential: (provider, value) =>
    ipcRenderer.invoke('credential:set', provider, value) as Promise<boolean>,
  hasCredential: (provider) =>
    ipcRenderer.invoke('credential:has', provider) as Promise<boolean>,
  exportVideo: async () => {
    throw new Error('Video export is implemented in Phase 4.');
  },
};
contextBridge.exposeInMainWorld('ourStage', api);
