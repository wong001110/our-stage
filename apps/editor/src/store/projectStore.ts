import { create } from 'zustand';
import {
  createActorTracks,
  createBlankProject,
  parseProject,
  touchProject,
  type AssetReference,
  type OurStageProject,
} from '@our-stage/project-schema';
import type { ImportedFileReference, RecentProject } from '@our-stage/platform-api';

interface ProjectState {
  project: OurStageProject;
  projectPath: string | null;
  dirty: boolean;
  selectedActorId: string | null;
  selectedAssetId: string | null;
  currentTime: number;
  recentProjects: RecentProject[];
  message: string | null;
  newProject(name?: string): void;
  openProject(): Promise<void>;
  saveProject(): Promise<void>;
  autosave(): Promise<void>;
  refreshRecent(): Promise<void>;
  importModel(): Promise<AssetReference | null>;
  importMotion(): Promise<AssetReference | null>;
  importAudio(): Promise<AssetReference | null>;
  selectActor(actorId: string | null): void;
  selectAsset(assetId: string | null): void;
  setCurrentTime(time: number): void;
  updateProject(updater: (project: OurStageProject) => OurStageProject): void;
  clearMessage(): void;
}

function toAsset(file: ImportedFileReference): AssetReference {
  const type = file.type as AssetReference['type'];
  return {
    assetId: file.assetId,
    type,
    title: file.name,
    contentHash: file.assetId,
    sourcePath: file.sourcePath,
    runtimeUrl: file.path,
    sizeBytes: file.size,
    source: { licence: 'Unspecified', redistributionAllowed: false },
  };
}

function mergeAsset(project: OurStageProject, asset: AssetReference): OurStageProject {
  const assets = [...project.assets.filter((item) => item.assetId !== asset.assetId), asset];
  return touchProject({ ...project, assets });
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createBlankProject(),
  projectPath: null,
  dirty: false,
  selectedActorId: null,
  selectedAssetId: null,
  currentTime: 0,
  recentProjects: [],
  message: null,

  newProject(name) {
    set({
      project: createBlankProject(name),
      projectPath: null,
      dirty: false,
      selectedActorId: null,
      selectedAssetId: null,
      currentTime: 0,
      message: 'Created a new local project.',
    });
  },

  async openProject() {
    const platform = window.ourStage;
    if (!platform) return;
    const loaded = await platform.loadProject();
    if (!loaded) return;
    const project = parseProject(loaded);
    const resolvedAssets = await Promise.all(
      project.assets.map(async (asset) => {
        if (!asset.sourcePath) return asset;
        const runtimeUrl = await platform.resolveAsset(asset.sourcePath);
        return runtimeUrl ? { ...asset, runtimeUrl } : asset;
      }),
    );
    const hydrated = { ...project, assets: resolvedAssets };
    set({
      project: hydrated,
      projectPath: null,
      dirty: false,
      selectedActorId: hydrated.actors[0]?.actorId ?? null,
      selectedAssetId: null,
      currentTime: 0,
      message: `Opened ${hydrated.metadata.name}.`,
    });
    await get().refreshRecent();
  },

  async saveProject() {
    const platform = window.ourStage;
    if (!platform) return;
    const path = await platform.saveProject(parseProject(get().project));
    if (path) {
      set({ projectPath: path, dirty: false, message: 'Project saved.' });
      await get().refreshRecent();
    }
  },

  async autosave() {
    const platform = window.ourStage;
    if (!platform || !get().dirty) return;
    await platform.autosaveProject(parseProject(get().project));
  },

  async refreshRecent() {
    const recentProjects = (await window.ourStage?.getRecentProjects()) ?? [];
    set({ recentProjects });
  },

  async importModel() {
    const file = await window.ourStage?.importModel();
    if (!file) return null;
    const asset = toAsset(file);
    const actorId = `actor-${crypto.randomUUID()}`;
    const project = mergeAsset(get().project, asset);
    const next = touchProject({
      ...project,
      actors: [
        ...project.actors,
        {
          actorId,
          name: asset.title.replace(/\.(pmx|pmd)$/i, ''),
          modelAssetId: asset.assetId,
          enabled: true,
          initialTransform: {
            position: [0, 0, 0],
            rotationEuler: [0, 0, 0],
            scale: [1, 1, 1],
          },
        },
      ],
      tracks: [...project.tracks, ...createActorTracks(actorId)],
    });
    set({ project: next, selectedActorId: actorId, selectedAssetId: asset.assetId, dirty: true, message: `Imported ${asset.title}.` });
    await get().autosave();
    return asset;
  },

  async importMotion() {
    const file = await window.ourStage?.importMotion();
    if (!file) return null;
    const asset = toAsset(file);
    set({ project: mergeAsset(get().project, asset), selectedAssetId: asset.assetId, dirty: true, message: `Imported ${asset.title}.` });
    await get().autosave();
    return asset;
  },

  async importAudio() {
    const file = await window.ourStage?.importAudio();
    if (!file) return null;
    const asset = toAsset(file);
    set({ project: mergeAsset(get().project, asset), selectedAssetId: asset.assetId, dirty: true, message: `Imported ${asset.title}.` });
    await get().autosave();
    return asset;
  },

  selectActor: (selectedActorId) => set({ selectedActorId }),
  selectAsset: (selectedAssetId) => set({ selectedAssetId }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  updateProject(updater) {
    set((state) => ({ project: touchProject(updater(state.project)), dirty: true }));
    void get().autosave();
  },
  clearMessage: () => set({ message: null }),
}));
