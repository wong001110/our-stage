import { contextBridge, ipcRenderer } from 'electron';
import type { OurStageProject } from '@our-stage/project-schema';
import type { PlatformAdapter } from '@our-stage/platform-api';

const notImplemented = async () => null;

const api: PlatformAdapter = {
  importModel: notImplemented,
  importMotion: notImplemented,
  importAudio: notImplemented,
  loadProject: () => ipcRenderer.invoke('project:load') as Promise<OurStageProject | null>,
  saveProject: (project) => ipcRenderer.invoke('project:save', project) as Promise<string | null>,
  exportVideo: async () => {
    throw new Error('Video export is implemented in Phase 4.');
  },
};

contextBridge.exposeInMainWorld('ourStage', api);
