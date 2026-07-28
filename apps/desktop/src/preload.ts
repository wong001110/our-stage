import { contextBridge, ipcRenderer } from 'electron';
import type { OurStageProject } from '@our-stage/project-schema';
import type { ImportedFileReference, PlatformAdapter } from '@our-stage/platform-api';

const api: PlatformAdapter = {
  importModel: () => ipcRenderer.invoke('asset:import-model') as Promise<ImportedFileReference | null>,
  importMotion: () => ipcRenderer.invoke('asset:import-motion') as Promise<ImportedFileReference | null>,
  importAudio: () => ipcRenderer.invoke('asset:import-audio') as Promise<ImportedFileReference | null>,
  loadProject: () => ipcRenderer.invoke('project:load') as Promise<OurStageProject | null>,
  saveProject: (project) => ipcRenderer.invoke('project:save', project) as Promise<string | null>,
  exportVideo: async () => { throw new Error('Video export is implemented in Phase 4.'); },
};
contextBridge.exposeInMainWorld('ourStage', api);
