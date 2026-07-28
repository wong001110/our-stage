# Our Stage Project Schema Specification

## 1. Purpose

The project schema is the stable contract shared by:

- the React editor;
- the timeline engine;
- the MMD runtime;
- local persistence;
- validators;
- AI structured output;
- deterministic export;
- future project migrations.

AI must never directly mutate runtime objects. It produces typed operations against this schema.

## 2. Design rules

1. The schema is versioned.
2. IDs are stable and unique within a project.
3. Project JSON stores metadata and asset references, not large binary assets.
4. Times are stored in seconds as finite non-negative numbers.
5. Export evaluation converts time to deterministic frame positions.
6. Runtime-only state is not persisted unless explicitly part of the project.
7. Every external reference can be validated before playback.
8. Schema changes require migration tests.

## 3. Root structure

```ts
interface OurStageProject {
  schemaVersion: 1;
  projectId: ProjectId;
  metadata: ProjectMetadata;
  output: OutputSettings;
  assets: AssetReference[];
  actors: Actor[];
  tracks: Track[];
  render: RenderSettings;
  ai?: AiProjectMetadata;
}
```

## 4. Branded identifiers

Recommended TypeScript pattern:

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };

type ProjectId = Brand<string, "ProjectId">;
type AssetId = Brand<string, "AssetId">;
type ActorId = Brand<string, "ActorId">;
type TrackId = Brand<string, "TrackId">;
type ClipId = Brand<string, "ClipId">;
type MotionId = Brand<string, "MotionId">;
type CameraPresetId = Brand<string, "CameraPresetId">;
type RenderPresetId = Brand<string, "RenderPresetId">;
```

IDs should use UUIDs or another collision-resistant generated form. File names must not serve as IDs.

## 5. Metadata and output

```ts
interface ProjectMetadata {
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  locale: "en" | "zh-CN";
}

interface OutputSettings {
  durationSeconds: number;
  fps: 30 | 60;
  width: number;
  height: number;
  background: BackgroundSettings;
  audioSampleRate?: number;
}
```

v0.1.0 supported presets:

- 720×1280 / 30 FPS;
- 1080×1920 / 30 FPS.

The schema may represent other settings, but the export validator rejects unsupported combinations.

## 6. Asset references

```ts
type AssetType =
  | "pmx-model"
  | "vmd-motion"
  | "vmd-camera"
  | "audio"
  | "stage"
  | "texture"
  | "other";

interface AssetReference {
  assetId: AssetId;
  type: AssetType;
  title: string;
  contentHash: string;
  libraryRelativePath: string;
  source?: AssetSourceMetadata;
  technical?: AssetTechnicalMetadata;
}

interface AssetSourceMetadata {
  creator?: string;
  sourceUrl?: string;
  licence?: string;
  personalUseAllowed?: boolean;
  commercialVideoAllowed?: boolean;
  redistributionAllowed?: boolean;
  derivativeAllowed?: boolean;
  attributionRequired?: boolean;
  attributionText?: string;
  notes?: string;
}
```

Absolute machine paths are resolved by the platform layer and should not be the only persistent locator.

## 7. Actors

```ts
interface Actor {
  actorId: ActorId;
  name: string;
  modelAssetId: AssetId;
  initialTransform: Transform3D;
  modelProfileId?: string;
  enabled: boolean;
}

interface Transform3D {
  position: [number, number, number];
  rotationEuler: [number, number, number];
  scale: [number, number, number];
}
```

v0.1.0 optimises for one actor. The schema may support more than one actor without requiring all multi-actor features in the UI.

## 8. Track union

```ts
type Track =
  | MotionTrack
  | ExpressionTrack
  | TransformTrack
  | CameraTrack
  | AudioTrack
  | RenderEffectTrack;

interface BaseTrack {
  trackId: TrackId;
  name: string;
  enabled: boolean;
  locked: boolean;
}
```

### 8.1 Motion track

```ts
interface MotionTrack extends BaseTrack {
  type: "motion";
  actorId: ActorId;
  clips: MotionClip[];
}

interface MotionClip extends BaseClip {
  type: "motion";
  motionAssetId: AssetId;
  sourceOffsetSeconds: number;
  speed: number;
  loop: boolean;
  blendInSeconds: number;
  blendOutSeconds: number;
  rootMotionMode: "source" | "in-place" | "path";
}
```

### 8.2 Expression track

```ts
interface ExpressionTrack extends BaseTrack {
  type: "expression";
  actorId: ActorId;
  clips: ExpressionClip[];
}

interface ExpressionClip extends BaseClip {
  type: "expression";
  morphName: string;
  weight: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
}
```

### 8.3 Transform track

```ts
interface TransformTrack extends BaseTrack {
  type: "transform";
  actorId: ActorId;
  keyframes: TransformKeyframe[];
}

interface TransformKeyframe {
  keyframeId: string;
  timeSeconds: number;
  transform: Transform3D;
  interpolation: "step" | "linear" | "bezier";
}
```

### 8.4 Camera track

```ts
interface CameraTrack extends BaseTrack {
  type: "camera";
  clips: CameraClip[];
}

interface CameraClip extends BaseClip {
  type: "camera";
  presetId?: CameraPresetId;
  targetActorId?: ActorId;
  startState: CameraState;
  endState?: CameraState;
  interpolation: "cut" | "linear" | "smooth";
}

interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  roll?: number;
}
```

### 8.5 Audio track

```ts
interface AudioTrack extends BaseTrack {
  type: "audio";
  clips: AudioClip[];
}

interface AudioClip extends BaseClip {
  type: "audio";
  audioAssetId: AssetId;
  sourceOffsetSeconds: number;
  volume: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
}
```

### 8.6 Render-effect track

```ts
interface RenderEffectTrack extends BaseTrack {
  type: "render-effect";
  clips: RenderEffectClip[];
}

interface RenderEffectClip extends BaseClip {
  type: "render-effect";
  presetId: RenderPresetId;
  parameters?: Record<string, number | boolean | string>;
}
```

## 9. Base clip

```ts
interface BaseClip {
  clipId: ClipId;
  startSeconds: number;
  durationSeconds: number;
  enabled: boolean;
  label?: string;
}
```

Validation rules:

- `startSeconds >= 0`;
- `durationSeconds > 0`;
- clip end must not exceed project duration unless the track explicitly allows trimming;
- speed must be finite and greater than zero;
- referenced asset/actor/preset IDs must exist;
- overlapping rules depend on track type.

## 10. Render settings

```ts
interface RenderSettings {
  presetId: RenderPresetId;
  quality: "draft" | "preview" | "final";
  physicsQuality: "off" | "reduced" | "full";
  shadowQuality: "off" | "low" | "medium" | "high";
  postProcessing: {
    outline: boolean;
    bloom: boolean;
    depthBlur: boolean;
    colourGrade: boolean;
  };
  parameters?: Record<string, number | boolean | string>;
}
```

## 11. Motion metadata outside the project

The shared library stores a motion registry record:

```ts
interface MotionMetadata {
  motionId: MotionId;
  assetId: AssetId;
  title: string;
  description?: string;
  tags: string[];
  durationSeconds: number;
  loopable: boolean;
  movement: "stationary" | "local" | "travelling";
  energy: number;
  emotions: string[];
  requiredBones: string[];
  optionalBones: string[];
  requiredMorphs: string[];
  startPose?: PoseSignature;
  endPose?: PoseSignature;
  requiresProps: string[];
  verifiedStatus: "unreviewed" | "auto-analysed" | "user-verified";
}
```

## 12. Project operations

Manual edits and AI edits use the same operation union:

```ts
type ProjectOperation =
  | AddTrackOperation
  | RemoveTrackOperation
  | AddClipOperation
  | RemoveClipOperation
  | MoveClipOperation
  | ResizeClipOperation
  | ReplaceMotionOperation
  | SetClipSpeedOperation
  | SetExpressionOperation
  | SetActorTransformOperation
  | AddCameraShotOperation
  | UpdateCameraShotOperation
  | ChangeRenderPresetOperation;

interface ProjectPatch {
  patchId: string;
  baseProjectRevision: number;
  summary: string;
  operations: ProjectOperation[];
  assumptions?: string[];
  warnings?: string[];
}
```

Each operation must define:

- exact target IDs;
- required fields;
- validation rules;
- inverse operation or sufficient previous state for undo;
- a human-readable diff description.

## 13. Revision and concurrency

Local v0.1.0 is single-user, but patches still include `baseProjectRevision`.

The editor rejects or rebases a patch if the project changed after the AI request was started. This prevents an old AI response from overwriting newer manual edits.

## 14. Runtime-only state

Do not persist as project truth:

- live Three.js object references;
- WebGL resources;
- current decoder/process handles;
- transient hover/selection state;
- uncommitted drag positions;
- raw AI provider responses unless stored in a separate diagnostic log;
- decrypted API keys.

## 15. Migration policy

A future schema version must include:

- explicit source and target versions;
- deterministic migration function;
- fixture tests;
- no silent loss of project data;
- backup before writing the migrated project;
- readable error if migration cannot complete.

Example:

```ts
interface ProjectMigrator {
  fromVersion: number;
  toVersion: number;
  migrate(input: unknown): unknown;
}
```

## 16. Initial validation order

```text
Parse JSON
→ validate schema version
→ migrate if required
→ validate root schema
→ resolve asset references
→ validate actors and tracks
→ validate timeline semantics
→ validate model/motion compatibility
→ report errors, warnings, and information
```
