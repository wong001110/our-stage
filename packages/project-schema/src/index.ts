import { z } from 'zod';

export const assetTypeSchema = z.enum([
  'pmx-model',
  'vmd-motion',
  'vmd-camera',
  'audio',
  'stage',
  'texture',
  'other',
]);

export const outputSettingsSchema = z.object({
  durationSeconds: z.number().finite().positive().max(600),
  fps: z.union([z.literal(30), z.literal(60)]),
  width: z.number().int().positive().max(3840),
  height: z.number().int().positive().max(3840),
});

export const projectMetadataSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  locale: z.union([z.literal('en'), z.literal('zh-CN')]),
});

export const assetSourceSchema = z.object({
  creator: z.string().optional(),
  sourceUrl: z.string().optional(),
  licence: z.string().optional(),
  personalUseAllowed: z.boolean().optional(),
  commercialVideoAllowed: z.boolean().optional(),
  redistributionAllowed: z.boolean().optional(),
  attributionRequired: z.boolean().optional(),
  attributionText: z.string().optional(),
  notes: z.string().optional(),
});

export const assetReferenceSchema = z.object({
  assetId: z.string().min(1),
  type: assetTypeSchema,
  title: z.string().min(1),
  contentHash: z.string(),
  sourcePath: z.string().optional(),
  runtimeUrl: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().default(0),
  source: assetSourceSchema.optional(),
});

export const transformSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotationEuler: z.tuple([z.number(), z.number(), z.number()]),
  scale: z.tuple([z.number(), z.number(), z.number()]),
});

export const actorSchema = z.object({
  actorId: z.string().min(1),
  name: z.string().min(1),
  modelAssetId: z.string().min(1),
  enabled: z.boolean(),
  initialTransform: transformSchema,
});

export const baseClipSchema = z.object({
  clipId: z.string().min(1),
  startSeconds: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().positive(),
  enabled: z.boolean(),
  label: z.string().optional(),
});

export const motionClipSchema = baseClipSchema.extend({
  type: z.literal('motion'),
  motionAssetId: z.string().min(1),
  sourceOffsetSeconds: z.number().finite().nonnegative().default(0),
  speed: z.number().finite().positive().max(4).default(1),
  loop: z.boolean().default(false),
  blendInSeconds: z.number().finite().nonnegative().default(0.25),
  blendOutSeconds: z.number().finite().nonnegative().default(0.25),
});

export const expressionClipSchema = baseClipSchema.extend({
  type: z.literal('expression'),
  morphName: z.string().min(1),
  weight: z.number().min(0).max(1),
  fadeInSeconds: z.number().nonnegative().default(0.15),
  fadeOutSeconds: z.number().nonnegative().default(0.15),
});

export const cameraClipSchema = baseClipSchema.extend({
  type: z.literal('camera'),
  presetId: z.string().min(1),
  targetActorId: z.string().optional(),
  interpolation: z.enum(['cut', 'linear', 'smooth']).default('smooth'),
});

export const audioClipSchema = baseClipSchema.extend({
  type: z.literal('audio'),
  audioAssetId: z.string().min(1),
  sourceOffsetSeconds: z.number().nonnegative().default(0),
  volume: z.number().min(0).max(2).default(1),
});

export const renderEffectClipSchema = baseClipSchema.extend({
  type: z.literal('render-effect'),
  presetId: z.string().min(1),
});

export const transformClipSchema = baseClipSchema.extend({
  type: z.literal('transform'),
  from: transformSchema,
  to: transformSchema,
  interpolation: z.enum(['step', 'linear', 'smooth']).default('smooth'),
});

export const timelineClipSchema = z.discriminatedUnion('type', [
  motionClipSchema,
  expressionClipSchema,
  transformClipSchema,
  cameraClipSchema,
  audioClipSchema,
  renderEffectClipSchema,
]);

const baseTrackShape = {
  trackId: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  locked: z.boolean(),
};

export const motionTrackSchema = z.object({
  ...baseTrackShape,
  type: z.literal('motion'),
  actorId: z.string().min(1),
  clips: z.array(motionClipSchema),
});
export const expressionTrackSchema = z.object({
  ...baseTrackShape,
  type: z.literal('expression'),
  actorId: z.string().min(1),
  clips: z.array(expressionClipSchema),
});
export const transformTrackSchema = z.object({
  ...baseTrackShape,
  type: z.literal('transform'),
  actorId: z.string().min(1),
  clips: z.array(transformClipSchema),
});
export const cameraTrackSchema = z.object({
  ...baseTrackShape,
  type: z.literal('camera'),
  clips: z.array(cameraClipSchema),
});
export const audioTrackSchema = z.object({
  ...baseTrackShape,
  type: z.literal('audio'),
  clips: z.array(audioClipSchema),
});
export const renderEffectTrackSchema = z.object({
  ...baseTrackShape,
  type: z.literal('render-effect'),
  clips: z.array(renderEffectClipSchema),
});

export const trackSchema = z.discriminatedUnion('type', [
  motionTrackSchema,
  expressionTrackSchema,
  transformTrackSchema,
  cameraTrackSchema,
  audioTrackSchema,
  renderEffectTrackSchema,
]);

export const ourStageProjectSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  metadata: projectMetadataSchema,
  output: outputSettingsSchema,
  assets: z.array(assetReferenceSchema),
  actors: z.array(actorSchema),
  tracks: z.array(trackSchema),
  render: z.object({
    presetId: z.string(),
    quality: z.enum(['draft', 'preview', 'final']),
    physicsQuality: z.enum(['off', 'reduced', 'full']),
  }),
});

export type OurStageProject = z.infer<typeof ourStageProjectSchema>;
export type OutputSettings = z.infer<typeof outputSettingsSchema>;
export type AssetReference = z.infer<typeof assetReferenceSchema>;
export type Actor = z.infer<typeof actorSchema>;
export type TimelineClip = z.infer<typeof timelineClipSchema>;
export type MotionClip = z.infer<typeof motionClipSchema>;
export type ProjectTrack = z.infer<typeof trackSchema>;
export type TrackType = ProjectTrack['type'];

export function createBlankProject(name = 'Untitled Stage'): OurStageProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    projectId: `project-${crypto.randomUUID()}`,
    revision: 0,
    metadata: { name, createdAt: now, updatedAt: now, locale: 'en' },
    output: { durationSeconds: 12, fps: 30, width: 720, height: 1280 },
    assets: [],
    actors: [],
    tracks: [
      { trackId: 'camera-main', name: 'Camera', type: 'camera', enabled: true, locked: false, clips: [] },
      { trackId: 'audio-main', name: 'Audio', type: 'audio', enabled: true, locked: false, clips: [] },
      { trackId: 'render-main', name: 'Render', type: 'render-effect', enabled: true, locked: false, clips: [] },
    ],
    render: { presetId: 'soft-our-series', quality: 'draft', physicsQuality: 'reduced' },
  };
}

export function createActorTracks(actorId: string): ProjectTrack[] {
  return [
    { trackId: `motion-${actorId}`, name: 'Motion', type: 'motion', actorId, enabled: true, locked: false, clips: [] },
    { trackId: `expression-${actorId}`, name: 'Expression', type: 'expression', actorId, enabled: true, locked: false, clips: [] },
    { trackId: `transform-${actorId}`, name: 'Transform', type: 'transform', actorId, enabled: true, locked: false, clips: [] },
  ];
}

export function parseProject(input: unknown): OurStageProject {
  return ourStageProjectSchema.parse(input);
}

export function touchProject(project: OurStageProject): OurStageProject {
  return {
    ...project,
    revision: project.revision + 1,
    metadata: { ...project.metadata, updatedAt: new Date().toISOString() },
  };
}
