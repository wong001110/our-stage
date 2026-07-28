import {
  touchProject,
  type MotionClip,
  type OurStageProject,
  type ProjectTrack,
  type TimelineClip,
} from '@our-stage/project-schema';

export type ProjectOperation =
  | { type: 'add_clip'; trackId: string; clip: TimelineClip }
  | { type: 'remove_clip'; trackId: string; clipId: string }
  | { type: 'move_clip'; trackId: string; clipId: string; startSeconds: number }
  | { type: 'resize_clip'; trackId: string; clipId: string; durationSeconds: number }
  | { type: 'replace_motion'; trackId: string; clipId: string; motionAssetId: string }
  | { type: 'set_clip_speed'; trackId: string; clipId: string; speed: number };

export interface TimelineEvaluation {
  timeSeconds: number;
  active: Array<{
    track: ProjectTrack;
    clip: TimelineClip;
    localTimeSeconds: number;
    progress: number;
  }>;
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
              ? { ...clip, durationSeconds: Math.max(0.05, operation.durationSeconds) }
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
  }
}

export function operationLabel(operation: ProjectOperation): string {
  switch (operation.type) {
    case 'add_clip':
      return `Add ${operation.clip.type} clip`;
    case 'remove_clip':
      return 'Remove clip';
    case 'move_clip':
      return 'Move clip';
    case 'resize_clip':
      return 'Resize clip';
    case 'replace_motion':
      return 'Replace motion';
    case 'set_clip_speed':
      return 'Change motion speed';
  }
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
  return { timeSeconds: time, active };
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
