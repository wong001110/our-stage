import { create } from 'zustand';
import { analyseVmdUrl } from '@our-stage/motion-registry';
import {
  createActorTracks,
  createBlankProject,
  parseProject,
  touchProject,
  type AssetReference,
  type BoneOverrideClip,
  type OurStageProject,
  type TimelineClip,
  type Vector3Tuple,
} from '@our-stage/project-schema';
import type { ImportedFileReference, RecentProject } from '@our-stage/platform-api';
import {
  applyProjectOperation,
  createBoneOverrideClip,
  createMotionClip,
  evaluateTimeline,
  invertProjectOperation,
  operationLabel,
  type HistoryEntry,
  type ProjectOperation,
} from '@our-stage/timeline-engine';

export interface BoneOverrideDraft {
  actorId: string;
  boneName: string;
  rotationEulerOffset: Vector3Tuple;
  positionOffset: Vector3Tuple;
  interpolation: BoneOverrideClip['interpolation'];
}

interface ProjectState {
  project: OurStageProject;
  projectPath: string | null;
  dirty: boolean;
  selectedActorId: string | null;
  selectedAssetId: string | null;
  selectedClipId: string | null;
  selectedBoneName: string | null;
  availableBoneNames: string[];
  boneOverridePreview: BoneOverrideDraft | null;
  currentTime: number;
  timelinePlaying: boolean;
  zoom: number;
  recentProjects: RecentProject[];
  message: string | null;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
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
  selectClip(clipId: string | null): void;
  selectBone(boneName: string | null): void;
  setAvailableBoneNames(boneNames: string[]): void;
  setBoneOverridePreview(preview: BoneOverrideDraft | null): void;
  setCurrentTime(time: number): void;
  setTimelinePlaying(playing: boolean): void;
  setZoom(zoom: number): void;
  executeOperation(operation: ProjectOperation): void;
  undo(): void;
  redo(): void;
  addSelectedAssetToTimeline(): void;
  addCameraShot(): void;
  addExpression(): void;
  addOrUpdateBoneOverrideKeyframe(): void;
  deleteBoneOverrideKeyframe(): void;
  resetSelectedBoneOverrides(): void;
  resetAllBoneOverrides(): void;
  updateProject(updater: (project: OurStageProject) => OurStageProject): void;
  clearMessage(): void;
}

const ZERO_VECTOR: Vector3Tuple = [0, 0, 0];

function toAsset(file: ImportedFileReference): AssetReference {
  const type = file.type as AssetReference['type'];
  return {
    assetId: file.assetId,
    type,
    title: file.name,
    contentHash: file.assetId,
    ...(file.sourcePath ? { sourcePath: file.sourcePath } : {}),
    runtimeUrl: file.path,
    sizeBytes: file.size,
    source: { licence: 'Unspecified', redistributionAllowed: false },
  };
}

function mergeAsset(project: OurStageProject, asset: AssetReference): OurStageProject {
  const assets = [...project.assets.filter((item) => item.assetId !== asset.assetId), asset];
  return touchProject({ ...project, assets });
}

function selectedActor(project: OurStageProject, actorId: string | null) {
  return project.actors.find((actor) => actor.actorId === actorId) ?? project.actors[0];
}

function selectedTrackForClip(project: OurStageProject, clipId: string | null) {
  if (!clipId) return null;
  return project.tracks.find((track) => track.clips.some((clip) => clip.clipId === clipId)) ?? null;
}

function boneOverrideTrack(project: OurStageProject, actorId: string) {
  return project.tracks.find(
    (track) => track.type === 'bone-override' && track.actorId === actorId,
  );
}

function draftAtTime(
  project: OurStageProject,
  actorId: string,
  boneName: string,
  timeSeconds: number,
): BoneOverrideDraft {
  const evaluated = evaluateTimeline(project, timeSeconds).boneOverrides.find(
    (item) => item.actorId === actorId && item.boneName === boneName,
  );
  return {
    actorId,
    boneName,
    rotationEulerOffset: evaluated?.rotationEulerOffset ?? [...ZERO_VECTOR],
    positionOffset: evaluated?.positionOffset ?? [...ZERO_VECTOR],
    interpolation: evaluated?.interpolation ?? 'smooth',
  };
}

function exactBoneKeyframe(
  project: OurStageProject,
  actorId: string,
  boneName: string,
  timeSeconds: number,
): { trackId: string; clip: BoneOverrideClip } | null {
  const track = boneOverrideTrack(project, actorId);
  if (!track || track.type !== 'bone-override') return null;
  const tolerance = 0.5 / project.output.fps;
  const clip = track.clips.find(
    (item) => item.boneName === boneName
      && Math.abs(item.startSeconds - timeSeconds) <= tolerance,
  );
  return clip ? { trackId: track.trackId, clip } : null;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createBlankProject(),
  projectPath: null,
  dirty: false,
  selectedActorId: null,
  selectedAssetId: null,
  selectedClipId: null,
  selectedBoneName: null,
  availableBoneNames: [],
  boneOverridePreview: null,
  currentTime: 0,
  timelinePlaying: false,
  zoom: 72,
  recentProjects: [],
  message: null,
  undoStack: [],
  redoStack: [],

  newProject(name) {
    set({
      project: createBlankProject(name),
      projectPath: null,
      dirty: false,
      selectedActorId: null,
      selectedAssetId: null,
      selectedClipId: null,
      selectedBoneName: null,
      availableBoneNames: [],
      boneOverridePreview: null,
      currentTime: 0,
      timelinePlaying: false,
      undoStack: [],
      redoStack: [],
      message: 'Created a new local project.',
    });
  },

  async openProject() {
    const platform = window.ourStage;
    if (!platform) return;
    const loaded = await platform.loadProject();
    if (!loaded) return;
    const project = parseProject(loaded);
    const resolvedAssets = await Promise.all(project.assets.map(async (asset) => {
      if (!asset.sourcePath) return asset;
      const runtimeUrl = await platform.resolveAsset(asset.sourcePath);
      return runtimeUrl ? { ...asset, runtimeUrl } : asset;
    }));
    const hydrated = { ...project, assets: resolvedAssets };
    set({
      project: hydrated,
      projectPath: null,
      dirty: false,
      selectedActorId: hydrated.actors[0]?.actorId ?? null,
      selectedAssetId: null,
      selectedClipId: null,
      selectedBoneName: null,
      availableBoneNames: [],
      boneOverridePreview: null,
      currentTime: 0,
      timelinePlaying: false,
      undoStack: [],
      redoStack: [],
      message: `Opened ${hydrated.metadata.name}.`,
    });
    await get().refreshRecent();
  },

  async saveProject() {
    const platform = window.ourStage;
    if (!platform) return;
    const savedPath = await platform.saveProject(parseProject(get().project));
    if (savedPath) {
      set({ projectPath: savedPath, dirty: false, message: 'Project saved.' });
      await get().refreshRecent();
    }
  },

  async autosave() {
    const platform = window.ourStage;
    if (!platform || !get().dirty) return;
    await platform.autosaveProject(parseProject(get().project));
  },

  async refreshRecent() {
    set({ recentProjects: (await window.ourStage?.getRecentProjects()) ?? [] });
  },

  async importModel() {
    const file = await window.ourStage?.importModel();
    if (!file) return null;
    const asset = toAsset(file);
    const actorId = `actor-${crypto.randomUUID()}`;
    const project = mergeAsset(get().project, asset);
    const next = touchProject({
      ...project,
      actors: [...project.actors, {
        actorId,
        name: asset.title.replace(/\.(pmx|pmd)$/i, ''),
        modelAssetId: asset.assetId,
        enabled: true,
        initialTransform: {
          position: [0, 0, 0],
          rotationEuler: [0, 0, 0],
          scale: [1, 1, 1],
        },
      }],
      tracks: [...project.tracks, ...createActorTracks(actorId)],
    });
    set({
      project: next,
      selectedActorId: actorId,
      selectedAssetId: asset.assetId,
      selectedBoneName: null,
      availableBoneNames: [],
      boneOverridePreview: null,
      dirty: true,
      message: `Imported ${asset.title}.`,
    });
    await get().autosave();
    return asset;
  },

  async importMotion() {
    const file = await window.ourStage?.importMotion();
    if (!file) return null;
    const asset = toAsset(file);
    const state = get();
    const actor = selectedActor(state.project, state.selectedActorId);
    const project = mergeAsset(state.project, asset);
    let next = project;
    let clip: TimelineClip | null = null;
    let analysisMessage = '';
    try {
      const analysis = await analyseVmdUrl(file.path);
      analysisMessage = `${analysis.animatedBoneNames.length} animated bone track(s), target model ${analysis.modelName || 'unknown'}.`;
      if (actor) {
        const track = project.tracks.find(
          (item) => item.type === 'motion' && item.actorId === actor.actorId,
        );
        if (track && track.type === 'motion' && !track.clips.length) {
          const duration = Math.min(
            project.output.durationSeconds,
            Math.max(0.1, analysis.durationSeconds || 4),
          );
          clip = createMotionClip(asset.assetId, 0, duration);
          next = applyProjectOperation(project, {
            type: 'add_clip',
            trackId: track.trackId,
            clip,
          });
        }
      }
    } catch (error) {
      analysisMessage = error instanceof Error ? error.message : String(error);
    }
    set({
      project: next,
      selectedAssetId: asset.assetId,
      selectedClipId: clip?.clipId ?? state.selectedClipId,
      currentTime: clip ? 0 : state.currentTime,
      dirty: true,
      message: clip
        ? `Imported and added ${asset.title} to the timeline. ${analysisMessage}`
        : `Imported ${asset.title}. ${analysisMessage}`,
    });
    await get().autosave();
    return asset;
  },

  async importAudio() {
    const file = await window.ourStage?.importAudio();
    if (!file) return null;
    const asset = toAsset(file);
    set({
      project: mergeAsset(get().project, asset),
      selectedAssetId: asset.assetId,
      dirty: true,
      message: `Imported ${asset.title}. Select “Add selected” to place it on the timeline.`,
    });
    await get().autosave();
    return asset;
  },

  selectActor(selectedActorId) {
    set({
      selectedActorId,
      selectedBoneName: null,
      availableBoneNames: [],
      boneOverridePreview: null,
    });
  },

  selectAsset: (selectedAssetId) => set({ selectedAssetId }),

  selectClip(selectedClipId) {
    const state = get();
    const track = selectedTrackForClip(state.project, selectedClipId);
    const clip = track?.clips.find((item) => item.clipId === selectedClipId);
    if (track?.type === 'bone-override' && clip?.type === 'bone-override') {
      set({
        selectedClipId,
        selectedBoneName: clip.boneName,
        currentTime: clip.startSeconds,
        boneOverridePreview: {
          actorId: track.actorId,
          boneName: clip.boneName,
          rotationEulerOffset: clip.rotationEulerOffset,
          positionOffset: clip.positionOffset,
          interpolation: clip.interpolation,
        },
      });
      return;
    }
    set({ selectedClipId });
  },

  selectBone(selectedBoneName) {
    const state = get();
    const actor = selectedActor(state.project, state.selectedActorId);
    set({
      selectedBoneName,
      selectedClipId: null,
      boneOverridePreview: actor && selectedBoneName
        ? draftAtTime(state.project, actor.actorId, selectedBoneName, state.currentTime)
        : null,
    });
  },

  setAvailableBoneNames(availableBoneNames) {
    const state = get();
    const selectedBoneName = state.selectedBoneName
      && availableBoneNames.includes(state.selectedBoneName)
      ? state.selectedBoneName
      : null;
    set({
      availableBoneNames,
      selectedBoneName,
      boneOverridePreview: selectedBoneName ? state.boneOverridePreview : null,
    });
  },

  setBoneOverridePreview: (boneOverridePreview) => set({ boneOverridePreview }),

  setCurrentTime(time) {
    const state = get();
    const currentTime = Math.min(state.project.output.durationSeconds, Math.max(0, time));
    const actor = selectedActor(state.project, state.selectedActorId);
    set({
      currentTime,
      boneOverridePreview: actor && state.selectedBoneName
        ? draftAtTime(state.project, actor.actorId, state.selectedBoneName, currentTime)
        : state.boneOverridePreview,
    });
  },

  setTimelinePlaying(timelinePlaying) {
    set({ timelinePlaying, boneOverridePreview: timelinePlaying ? null : get().boneOverridePreview });
  },

  setZoom: (zoom) => set({ zoom: Math.min(160, Math.max(36, zoom)) }),

  executeOperation(operation) {
    const project = get().project;
    const inverse = invertProjectOperation(project, operation);
    const next = applyProjectOperation(project, operation);
    const entry: HistoryEntry = {
      undo: inverse,
      redo: operation,
      label: operationLabel(operation),
    };
    set((state) => ({
      project: next,
      dirty: true,
      undoStack: [...state.undoStack, entry].slice(-100),
      redoStack: [],
      message: entry.label,
    }));
    void get().autosave();
  },

  undo() {
    const entry = get().undoStack.at(-1);
    if (!entry) return;
    const project = applyProjectOperation(get().project, entry.undo);
    set((state) => ({
      project,
      dirty: true,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
      message: `Undo: ${entry.label}`,
    }));
    const state = get();
    const actor = selectedActor(state.project, state.selectedActorId);
    if (actor && state.selectedBoneName) {
      set({
        boneOverridePreview: draftAtTime(
          state.project,
          actor.actorId,
          state.selectedBoneName,
          state.currentTime,
        ),
      });
    }
  },

  redo() {
    const entry = get().redoStack.at(-1);
    if (!entry) return;
    const project = applyProjectOperation(get().project, entry.redo);
    set((state) => ({
      project,
      dirty: true,
      undoStack: [...state.undoStack, entry],
      redoStack: state.redoStack.slice(0, -1),
      message: `Redo: ${entry.label}`,
    }));
    const state = get();
    const actor = selectedActor(state.project, state.selectedActorId);
    if (actor && state.selectedBoneName) {
      set({
        boneOverridePreview: draftAtTime(
          state.project,
          actor.actorId,
          state.selectedBoneName,
          state.currentTime,
        ),
      });
    }
  },

  addSelectedAssetToTimeline() {
    const state = get();
    const asset = state.project.assets.find((item) => item.assetId === state.selectedAssetId);
    if (!asset) {
      set({ message: 'Select a motion or audio asset first.' });
      return;
    }
    if (asset.type === 'vmd-motion') {
      const actor = selectedActor(state.project, state.selectedActorId);
      if (!actor) {
        set({ message: 'Import and select a PMX actor first.' });
        return;
      }
      const track = state.project.tracks.find(
        (item) => item.type === 'motion' && item.actorId === actor.actorId,
      );
      if (!track || track.type !== 'motion') return;
      const maxDuration = Math.max(0.1, state.project.output.durationSeconds - state.currentTime);
      const clip = createMotionClip(asset.assetId, state.currentTime, Math.min(4, maxDuration));
      state.executeOperation({ type: 'add_clip', trackId: track.trackId, clip });
      set({ selectedClipId: clip.clipId });
      return;
    }
    if (asset.type === 'audio') {
      const track = state.project.tracks.find((item) => item.type === 'audio');
      if (!track || track.type !== 'audio') return;
      const clip: TimelineClip = {
        type: 'audio',
        clipId: `clip-${crypto.randomUUID()}`,
        audioAssetId: asset.assetId,
        startSeconds: state.currentTime,
        durationSeconds: Math.max(0.1, state.project.output.durationSeconds - state.currentTime),
        sourceOffsetSeconds: 0,
        volume: 1,
        enabled: true,
      };
      state.executeOperation({ type: 'add_clip', trackId: track.trackId, clip });
      set({ selectedClipId: clip.clipId });
      return;
    }
    set({ message: 'Only motion and audio assets can be placed directly.' });
  },

  addCameraShot() {
    const state = get();
    const track = state.project.tracks.find((item) => item.type === 'camera');
    if (!track || track.type !== 'camera') return;
    const actor = selectedActor(state.project, state.selectedActorId);
    const clip: TimelineClip = {
      type: 'camera',
      clipId: `clip-${crypto.randomUUID()}`,
      presetId: 'medium',
      ...(actor ? { targetActorId: actor.actorId } : {}),
      interpolation: 'smooth',
      startSeconds: state.currentTime,
      durationSeconds: Math.max(
        0.1,
        Math.min(3, state.project.output.durationSeconds - state.currentTime),
      ),
      enabled: true,
    };
    state.executeOperation({ type: 'add_clip', trackId: track.trackId, clip });
    set({ selectedClipId: clip.clipId });
  },

  addExpression() {
    const state = get();
    const actor = selectedActor(state.project, state.selectedActorId);
    if (!actor) return;
    const track = state.project.tracks.find(
      (item) => item.type === 'expression' && item.actorId === actor.actorId,
    );
    if (!track || track.type !== 'expression') return;
    const clip: TimelineClip = {
      type: 'expression',
      clipId: `clip-${crypto.randomUUID()}`,
      morphName: '笑い',
      weight: 0.8,
      fadeInSeconds: 0.15,
      fadeOutSeconds: 0.2,
      startSeconds: state.currentTime,
      durationSeconds: Math.max(
        0.1,
        Math.min(2, state.project.output.durationSeconds - state.currentTime),
      ),
      enabled: true,
    };
    state.executeOperation({ type: 'add_clip', trackId: track.trackId, clip });
    set({ selectedClipId: clip.clipId });
  },

  addOrUpdateBoneOverrideKeyframe() {
    const state = get();
    const actor = selectedActor(state.project, state.selectedActorId);
    const preview = state.boneOverridePreview;
    if (!actor || !state.selectedBoneName || !preview) {
      set({ message: 'Select a loaded PMX bone before adding a pose keyframe.' });
      return;
    }
    const track = boneOverrideTrack(state.project, actor.actorId);
    if (!track || track.type !== 'bone-override') {
      set({ message: 'The selected actor has no Bone Override track.' });
      return;
    }
    const exact = exactBoneKeyframe(
      state.project,
      actor.actorId,
      state.selectedBoneName,
      state.currentTime,
    );
    if (exact) {
      state.executeOperation({
        type: 'update_bone_override',
        trackId: exact.trackId,
        clipId: exact.clip.clipId,
        boneName: state.selectedBoneName,
        rotationEulerOffset: preview.rotationEulerOffset,
        positionOffset: preview.positionOffset,
        interpolation: preview.interpolation,
      });
      set({ selectedClipId: exact.clip.clipId, message: `Updated ${state.selectedBoneName} keyframe.` });
      return;
    }
    const clip = createBoneOverrideClip(
      state.selectedBoneName,
      state.currentTime,
      preview.rotationEulerOffset,
      preview.positionOffset,
      preview.interpolation,
      1 / state.project.output.fps,
    );
    state.executeOperation({ type: 'add_clip', trackId: track.trackId, clip });
    set({ selectedClipId: clip.clipId, message: `Added ${state.selectedBoneName} keyframe.` });
  },

  deleteBoneOverrideKeyframe() {
    const state = get();
    const actor = selectedActor(state.project, state.selectedActorId);
    if (!actor || !state.selectedBoneName) return;
    const exact = exactBoneKeyframe(
      state.project,
      actor.actorId,
      state.selectedBoneName,
      state.currentTime,
    );
    if (!exact) {
      set({ message: 'There is no selected-bone keyframe at the playhead.' });
      return;
    }
    state.executeOperation({
      type: 'remove_clip',
      trackId: exact.trackId,
      clipId: exact.clip.clipId,
    });
    const next = get();
    set({
      selectedClipId: null,
      boneOverridePreview: draftAtTime(
        next.project,
        actor.actorId,
        state.selectedBoneName,
        state.currentTime,
      ),
      message: `Deleted ${state.selectedBoneName} keyframe.`,
    });
  },

  resetSelectedBoneOverrides() {
    const state = get();
    const actor = selectedActor(state.project, state.selectedActorId);
    if (!actor || !state.selectedBoneName) return;
    const track = boneOverrideTrack(state.project, actor.actorId);
    if (!track || track.type !== 'bone-override') return;
    const clips = track.clips.filter((clip) => clip.boneName !== state.selectedBoneName);
    state.executeOperation({
      type: 'replace_bone_override_clips',
      trackId: track.trackId,
      clips,
    });
    set({
      selectedClipId: null,
      boneOverridePreview: {
        actorId: actor.actorId,
        boneName: state.selectedBoneName,
        rotationEulerOffset: [...ZERO_VECTOR],
        positionOffset: [...ZERO_VECTOR],
        interpolation: 'smooth',
      },
      message: `Reset all ${state.selectedBoneName} overrides.`,
    });
  },

  resetAllBoneOverrides() {
    const state = get();
    const actor = selectedActor(state.project, state.selectedActorId);
    if (!actor) return;
    const track = boneOverrideTrack(state.project, actor.actorId);
    if (!track || track.type !== 'bone-override') return;
    state.executeOperation({
      type: 'replace_bone_override_clips',
      trackId: track.trackId,
      clips: [],
    });
    set({
      selectedClipId: null,
      boneOverridePreview: state.selectedBoneName ? {
        actorId: actor.actorId,
        boneName: state.selectedBoneName,
        rotationEulerOffset: [...ZERO_VECTOR],
        positionOffset: [...ZERO_VECTOR],
        interpolation: 'smooth',
      } : null,
      message: 'Reset all pose overrides for the selected actor.',
    });
  },

  updateProject(updater) {
    set((state) => ({ project: touchProject(updater(state.project)), dirty: true }));
    void get().autosave();
  },

  clearMessage: () => set({ message: null }),
}));

export function getSelectedClip(state: ProjectState): TimelineClip | null {
  const track = selectedTrackForClip(state.project, state.selectedClipId);
  return track?.clips.find((clip) => clip.clipId === state.selectedClipId) ?? null;
}
