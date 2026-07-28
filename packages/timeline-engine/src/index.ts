import {
  touchProject,
  type BoneOverrideClip,
  type BoneOverrideTrack,
  type MotionClip,
  type OurStageProject,
  type ProjectTrack,
  type TimelineClip,
  type Vector3Tuple,
} from '@our-stage/project-schema';

export type ProjectOperation =
  | { type: 'add_clip'; trackId: string; clip: TimelineClip }
  | { type: 'remove_clip'; trackId: string; clipId: string }
  | { type: 'move_clip'; trackId: string; clipId: string; startSeconds: number }
  | { type: 'resize_clip'; trackId: string; clipId: string; durationSeconds: number }
  | { type: 'replace_motion'; trackId: string; clipId: string; motionAssetId: string }
  | { type: 'set_clip_speed'; trackId: string; clipId: string; speed: number }
  | {
      type: 'update_bone_override';
      trackId: string;
      clipId: string;
      boneName: string;
      rotationEulerOffset: Vector3Tuple;
      positionOffset: Vector3Tuple;
      interpolation: BoneOverrideClip['interpolation'];
    }
  | { type: 'replace_bone_override_clips'; trackId: string; clips: BoneOverrideClip[] };

export interface EvaluatedBoneOverride {
  trackId: string;
  actorId: string;
  boneName: string;
  rotationEulerOffset: Vector3Tuple;
  positionOffset: Vector3Tuple;
  interpolation: BoneOverrideClip['interpolation'];
  sourceClipId: string;
  nextClipId?: string;
}

export interface TimelineEvaluation {
  timeSeconds: number;
  active: Array<{
    track: ProjectTrack;
    clip: TimelineClip;
    localTimeSeconds: number;
    progress: number;
  }>;
  boneOverrides: EvaluatedBoneOverride[];
}

export interface HistoryEntry {
  undo: ProjectOperation;
  redo: ProjectOperation;
  label: string;
}

function clipEnd(clip: TimelineClip): number {
  return clip.startSeconds + clip.durationSeconds;
}

function cloneTrackWithClips(track: ProjectTrack, clips: TimelineClip[]): ProjectTrack {
  return { ...track, clips } as ProjectTrack;
}

function findTrack(project: OurStageProject, trackId: string): ProjectTrack {
  const track = project.tracks.find((item) => item.trackId === trackId);
  if (!track) throw new Error(`Unknown track: ${trackId}`);
  return track;
}

function findClip(project: OurStageProject, trackId: string, clipId: string): TimelineClip {
  const track = findTrack(project, trackId);
  const clip = track.clips.find((item) => item.clipId === clipId);
  if (!clip) throw new Error(`Unknown clip: ${clipId}`);
  return clip;
}

function assertBoneTrack(track: ProjectTrack): asserts track is BoneOverrideTrack {
  if (track.type !== 'bone-override') throw new Error('Operation requires a Bone Override track.');
}

export function applyProjectOperation(
  project: OurStageProject,
  operation: ProjectOperation,
): OurStageProject {
  const tracks = project.tracks.map((track) => {
    if (track.trackId !== operation.trackId) return track;
    switch (operation.type) {
      case 'add_clip':
        if (track.type !== operation.clip.type) {
          throw new Error(`Cannot add ${operation.clip.type} clip to ${track.type} track.`);
        }
        return cloneTrackWithClips(
          track,
          [...track.clips, operation.clip].sort((a, b) => a.startSeconds - b.startSeconds),
        );
      case 'remove_clip':
        return cloneTrackWithClips(
          track,
          track.clips.filter((clip) => clip.clipId !== operation.clipId),
        );
      case 'move_clip':
        return cloneTrackWithClips(
          track,
          track.clips
            .map((clip) =>
              clip.clipId === operation.clipId
                ? { ...clip, startSeconds: Math.max(0, operation.startSeconds) }
                : clip,
            )
            .sort((a, b) => a.startSeconds - b.startSeconds),
        );
      case 'resize_clip':
        return cloneTrackWithClips(
          track,
          track.clips.map((clip) =>
            clip.clipId === operation.clipId
              ? { ...clip, durationSeconds: Math.max(0.01, operation.durationSeconds) }
              : clip,
          ),
        );
      case 'replace_motion':
        if (track.type !== 'motion') throw new Error('Only motion tracks can replace motions.');
        return {
          ...track,
          clips: track.clips.map((clip) =>
            clip.clipId === operation.clipId
              ? { ...clip, motionAssetId: operation.motionAssetId }
              : clip,
          ),
        };
      case 'set_clip_speed':
        if (track.type !== 'motion') throw new Error('Only motion clips support speed changes.');
        return {
          ...track,
          clips: track.clips.map((clip) =>
            clip.clipId === operation.clipId
              ? { ...clip, speed: Math.min(4, Math.max(0.1, operation.speed)) }
              : clip,
          ),
        };
      case 'update_bone_override':
        assertBoneTrack(track);
        return {
          ...track,
          clips: track.clips.map((clip) =>
            clip.clipId === operation.clipId
              ? {
                  ...clip,
                  boneName: operation.boneName,
                  rotationEulerOffset: operation.rotationEulerOffset,
                  positionOffset: operation.positionOffset,
                  interpolation: operation.interpolation,
                }
              : clip,
          ),
        };
      case 'replace_bone_override_clips':
        assertBoneTrack(track);
        return {
          ...track,
          clips: [...operation.clips].sort((a, b) => a.startSeconds - b.startSeconds),
        };
    }
  });
  return touchProject({ ...project, tracks });
}

export function invertProjectOperation(
  project: OurStageProject,
  operation: ProjectOperation,
): ProjectOperation {
  switch (operation.type) {
    case 'add_clip':
      return { type: 'remove_clip', trackId: operation.trackId, clipId: operation.clip.clipId };
    case 'remove_clip':
      return {
        type: 'add_clip',
        trackId: operation.trackId,
        clip: findClip(project, operation.trackId, operation.clipId),
      };
    case 'move_clip':
      return {
        ...operation,
        startSeconds: findClip(project, operation.trackId, operation.clipId).startSeconds,
      };
    case 'resize_clip':
      return {
        ...operation,
        durationSeconds: findClip(project, operation.trackId, operation.clipId).durationSeconds,
      };
    case 'replace_motion': {
      const clip = findClip(project, operation.trackId, operation.clipId);
      if (clip.type !== 'motion') throw new Error('Target clip is not a motion.');
      return { ...operation, motionAssetId: clip.motionAssetId };
    }
    case 'set_clip_speed': {
      const clip = findClip(project, operation.trackId, operation.clipId);
      if (clip.type !== 'motion') throw new Error('Target clip is not a motion.');
      return { ...operation, speed: clip.speed };
    }
    case 'update_bone_override': {
      const clip = findClip(project, operation.trackId, operation.clipId);
      if (clip.type !== 'bone-override') throw new Error('Target clip is not a bone override.');
      return {
        ...operation,
        boneName: clip.boneName,
        rotationEulerOffset: clip.rotationEulerOffset,
        positionOffset: clip.positionOffset,
        interpolation: clip.interpolation,
      };
    }
    case 'replace_bone_override_clips': {
      const track = findTrack(project, operation.trackId);
      assertBoneTrack(track);
      return { ...operation, clips: track.clips };
    }
  }
}

export function operationLabel(operation: ProjectOperation): string {
  switch (operation.type) {
    case 'add_clip':
      return operation.clip.type === 'bone-override' ? 'Add bone override keyframe' : `Add ${operation.clip.type} clip`;
    case 'remove_clip': return 'Remove clip';
    case 'move_clip': return 'Move clip';
    case 'resize_clip': return 'Resize clip';
    case 'replace_motion': return 'Replace motion';
    case 'set_clip_speed': return 'Change motion speed';
    case 'update_bone_override': return 'Update bone override keyframe';
    case 'replace_bone_override_clips': return 'Reset bone overrides';
  }
}

const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);

function interpolateVector(from: Vector3Tuple, to: Vector3Tuple, progress: number): Vector3Tuple {
  return [
    lerp(from[0], to[0], progress),
    lerp(from[1], to[1], progress),
    lerp(from[2], to[2], progress),
  ];
}

function evaluateBoneOverrideTrack(
  track: BoneOverrideTrack,
  timeSeconds: number,
): EvaluatedBoneOverride[] {
  const grouped = new Map<string, BoneOverrideClip[]>();
  for (const clip of track.clips) {
    if (!clip.enabled) continue;
    const clips = grouped.get(clip.boneName) ?? [];
    clips.push(clip);
    grouped.set(clip.boneName, clips);
  }

  const evaluated: EvaluatedBoneOverride[] = [];
  for (const [boneName, unsorted] of grouped) {
    const clips = [...unsorted].sort((a, b) => a.startSeconds - b.startSeconds);
    const previous = [...clips].reverse().find((clip) => clip.startSeconds <= timeSeconds);
    if (!previous) continue;
    const next = clips.find((clip) => clip.startSeconds > timeSeconds);

    if (!next || previous.interpolation === 'step') {
      evaluated.push({
        trackId: track.trackId,
        actorId: track.actorId,
        boneName,
        rotationEulerOffset: previous.rotationEulerOffset,
        positionOffset: previous.positionOffset,
        interpolation: previous.interpolation,
        sourceClipId: previous.clipId,
        ...(next ? { nextClipId: next.clipId } : {}),
      });
      continue;
    }

    const span = Math.max(1e-6, next.startSeconds - previous.startSeconds);
    const rawProgress = Math.min(1, Math.max(0, (timeSeconds - previous.startSeconds) / span));
    const progress = previous.interpolation === 'smooth' ? smoothstep(rawProgress) : rawProgress;
    evaluated.push({
      trackId: track.trackId,
      actorId: track.actorId,
      boneName,
      rotationEulerOffset: interpolateVector(previous.rotationEulerOffset, next.rotationEulerOffset, progress),
      positionOffset: interpolateVector(previous.positionOffset, next.positionOffset, progress),
      interpolation: previous.interpolation,
      sourceClipId: previous.clipId,
      nextClipId: next.clipId,
    });
  }
  return evaluated;
}

export function evaluateTimeline(
  project: OurStageProject,
  timeSeconds: number,
): TimelineEvaluation {
  const time = Math.min(project.output.durationSeconds, Math.max(0, timeSeconds));
  const active = project.tracks.flatMap((track) => {
    if (!track.enabled) return [];
    return track.clips
      .filter((clip) => clip.enabled && time >= clip.startSeconds && time < clipEnd(clip))
      .map((clip) => {
        const rawLocal = time - clip.startSeconds;
        const speed = clip.type === 'motion' ? clip.speed : 1;
        const sourceOffset =
          clip.type === 'motion' || clip.type === 'audio' ? clip.sourceOffsetSeconds : 0;
        return {
          track,
          clip,
          localTimeSeconds: sourceOffset + rawLocal * speed,
          progress: Math.min(1, Math.max(0, rawLocal / clip.durationSeconds)),
        };
      });
  });

  const boneOverrides = project.tracks.flatMap((track) =>
    track.enabled && track.type === 'bone-override'
      ? evaluateBoneOverrideTrack(track, time)
      : [],
  );

  return { timeSeconds: time, active, boneOverrides };
}

export function createMotionClip(
  motionAssetId: string,
  startSeconds: number,
  durationSeconds = 4,
): MotionClip {
  return {
    type: 'motion',
    clipId: `clip-${crypto.randomUUID()}`,
    motionAssetId,
    startSeconds,
    durationSeconds,
    sourceOffsetSeconds: 0,
    speed: 1,
    loop: false,
    blendInSeconds: 0.25,
    blendOutSeconds: 0.25,
    enabled: true,
  };
}

export function createBoneOverrideClip(
  boneName: string,
  startSeconds: number,
  rotationEulerOffset: Vector3Tuple = [0, 0, 0],
  positionOffset: Vector3Tuple = [0, 0, 0],
  interpolation: BoneOverrideClip['interpolation'] = 'smooth',
  frameDuration = 1 / 30,
): BoneOverrideClip {
  return {
    type: 'bone-override',
    clipId: `clip-${crypto.randomUUID()}`,
    boneName,
    rotationEulerOffset,
    positionOffset,
    interpolation,
    startSeconds,
    durationSeconds: Math.max(0.01, frameDuration),
    enabled: true,
    label: boneName,
  };
}
