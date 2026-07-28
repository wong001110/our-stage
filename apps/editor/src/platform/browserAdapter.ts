import { parseProject, type OurStageProject } from '@our-stage/project-schema';
import type { ImportedFileReference, PlatformAdapter, RecentProject } from '@our-stage/platform-api';

async function pickFile(accept: string, type: string): Promise<ImportedFileReference | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({
        assetId: `browser-${crypto.randomUUID()}`,
        name: file.name,
        path: URL.createObjectURL(file),
        size: file.size,
        type,
      });
    };
    input.click();
  });
}

export function createBrowserPlatformAdapter(): PlatformAdapter {
  return {
    importModel: () => pickFile('.pmx,.pmd', 'pmx-model'),
    importMotion: () => pickFile('.vmd', 'vmd-motion'),
    importAudio: () => pickFile('audio/*', 'audio'),
    resolveAsset: async (sourcePath) => sourcePath,
    loadProject: async () => {
      const raw = localStorage.getItem('our-stage:project');
      return raw ? parseProject(JSON.parse(raw)) : null;
    },
    saveProject: async (project) => {
      localStorage.setItem('our-stage:project', JSON.stringify(project));
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.metadata.name.replace(/[^a-z0-9-_]+/gi, '-')}.ourstage`;
      link.click();
      URL.revokeObjectURL(url);
      return link.download;
    },
    autosaveProject: async (project) => {
      localStorage.setItem('our-stage:project', JSON.stringify(project));
    },
    getRecentProjects: async (): Promise<RecentProject[]> => [],
    setCredential: async () => false,
    hasCredential: async () => false,
    exportVideo: async () => {
      throw new Error('Desktop mode is required for FFmpeg export.');
    },
  };
}
