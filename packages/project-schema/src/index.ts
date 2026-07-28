import { z } from 'zod';

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

export const assetReferenceSchema = z.object({
  assetId: z.string().min(1),
  type: z.enum(['pmx-model', 'vmd-motion', 'vmd-camera', 'audio', 'stage', 'texture', 'other']),
  title: z.string().min(1),
  contentHash: z.string(),
  libraryRelativePath: z.string(),
});

export const actorSchema = z.object({
  actorId: z.string().min(1),
  name: z.string().min(1),
  modelAssetId: z.string().min(1),
  enabled: z.boolean(),
});

export const baseClipSchema = z.object({
  clipId: z.string().min(1),
  startSeconds: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().positive(),
  enabled: z.boolean(),
  label: z.string().optional(),
});

export const trackSchema = z.object({
  trackId: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  locked: z.boolean(),
  type: z.enum(['motion', 'expression', 'transform', 'camera', 'audio', 'render-effect']),
  actorId: z.string().optional(),
  clips: z.array(baseClipSchema).default([]),
});

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
export type ProjectTrack = z.infer<typeof trackSchema>;

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
    tracks: [],
    render: { presetId: 'soft-our-series', quality: 'draft', physicsQuality: 'reduced' },
  };
}

export function parseProject(input: unknown): OurStageProject {
  return ourStageProjectSchema.parse(input);
}
