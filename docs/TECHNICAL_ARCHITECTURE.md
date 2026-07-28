# Our Stage Technical Architecture

## 1. Architecture summary

Our Stage uses a **web editor core inside an Electron desktop shell**.

- React and Three.js implement the editor and MMD preview.
- Electron provides local file access, native dialogs, secure credential storage, FFmpeg process control, and Windows packaging.
- Shared TypeScript packages define the project schema, timeline engine, validation, AI operations, and export contracts.
- No application server is required for v0.1.0.

```text
React Editor
├── Timeline UI
├── Asset Browser
├── Properties
├── AI Director
└── Three.js Viewport
        │
        ▼
Core TypeScript Packages
├── Project Schema
├── Timeline Engine
├── MMD Runtime Adapter
├── Motion Registry
├── Validators
├── AI Director
└── Video Export Contracts
        │
        ▼
Electron Platform Layer
├── File System
├── Native Dialogs
├── safeStorage
├── FFmpeg / FFprobe
├── Worker Processes
└── Desktop Packaging
```

## 2. Recommended repository structure

```text
our-stage/
├── apps/
│   ├── editor/                 # React + Vite web editor
│   └── desktop/                # Electron main, preload, packaging
├── packages/
│   ├── project-schema/
│   ├── timeline-engine/
│   ├── mmd-runtime/
│   ├── motion-registry/
│   ├── validator/
│   ├── ai-director/
│   ├── video-export/
│   ├── platform-api/
│   ├── shared-ui/
│   └── shared/
├── docs/
├── scripts/
├── tests/
└── .github/workflows/
```

## 3. Core technology stack

### 3.1 Language and workspace

- TypeScript with strict compiler settings
- pnpm workspace
- Node.js current supported LTS selected during Phase 0
- ESLint and Prettier

Recommended TypeScript flags:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

### 3.2 Desktop layer

- Electron
- Electron Forge for packaging
- Electron `safeStorage` for local AI credentials
- Preload script and `contextBridge`
- Main or utility processes for file and export work

Required security defaults:

```ts
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  preload: preloadPath,
}
```

The renderer must never receive direct access to `fs`, `child_process`, `shell`, or unrestricted `ipcRenderer`.

### 3.3 Editor UI

- React
- Vite
- Zustand for editor and project state
- Immer for safe immutable updates
- Radix UI primitives
- CSS Modules and CSS variables
- Lucide React icons
- i18next for English and Chinese

The editor should remain independently runnable in a normal Chromium browser during development. Platform-dependent operations are accessed through an adapter.

### 3.4 3D and MMD runtime

- Three.js
- WebGL2 for v0.1.0
- Three.js `AnimationMixer`, `AnimationClip`, and `AnimationAction`
- PMX/VMD loader selected after Phase 1 compatibility testing
- MMD IK and Bullet-compatible physics through the selected runtime
- GLSL shaders and post-processing

The product code must depend on an internal adapter rather than directly exposing a loader implementation:

```ts
interface MmdRuntimeAdapter {
  loadModel(source: ModelSource): Promise<MmdModel>;
  loadMotion(source: MotionSource): Promise<MmdMotion>;
  bindMotion(modelId: ModelId, motionId: MotionId): Promise<void>;
  setTime(seconds: number): void;
  setMorph(name: string, weight: number): void;
  resetPhysics(): void;
  stepPhysics(deltaSeconds: number): void;
  inspectModel(): ModelCompatibilityProfile;
  dispose(): void;
}
```

Phase 1 must compare at least:

1. a maintained TypeScript-first Three.js MMD loader; and
2. a locked Three.js version using the established MMDLoader/MMDAnimationHelper path.

The selected implementation is accepted only after real PMX/VMD playback, morph, IK, physics, seek, and deterministic export tests.

### 3.5 Timeline engine

The timeline is a custom deterministic engine shared by manual edits and AI edits.

Required track types:

- actor transform;
- motion;
- expression;
- camera;
- audio;
- render effect.

The timeline must use two clocks:

- **Preview clock:** based on `requestAnimationFrame`, may drop frames.
- **Export clock:** based on `frameIndex / fps`, never depends on wall-clock render speed.

All edits are represented as typed project operations. Undo/redo stores reversible commands or operation history.

### 3.6 Schema and validation

- Zod as the TypeScript runtime schema source
- JSON Schema generated or maintained for AI structured output
- Versioned project format
- Branded identifier types where practical

Validation modules:

- schema validator;
- asset validator;
- model/motion compatibility validator;
- timeline validator;
- motion-quality validator;
- camera validator;
- export validator.

### 3.7 Local data

v0.1.0 uses files rather than a database.

```text
OurStageData/
├── library/
│   ├── models/
│   ├── motions/
│   ├── audio/
│   └── stages/
├── projects/
├── exports/
├── cache/
└── logs/
```

Each project is a directory or project package containing versioned JSON and references to library assets.

Node.js capabilities used through Electron:

- `fs/promises`;
- `path`;
- `crypto` for SHA-256;
- streams;
- worker threads or utility processes;
- `child_process.spawn` for FFmpeg.

### 3.8 AI layer

MVP providers:

- `MockProvider` for deterministic tests and no-key usage;
- `DeepSeekProvider` as the first optional cloud implementation.

Provider contract:

```ts
interface AiDirectorProvider {
  createComposition(input: CreateCompositionInput): Promise<ProjectPatch>;
  reviseComposition(input: ReviseCompositionInput): Promise<ProjectPatch>;
}
```

The AI receives only:

- user request;
- project/output constraints;
- actor capability profiles;
- motion metadata and IDs;
- camera and render presets;
- the relevant existing timeline state.

It does not need PMX binaries, texture files, or VMD binaries.

AI output flow:

```text
User request
→ retrieve/filter available motions
→ generate structured ProjectPatch
→ Zod validation
→ deterministic validation
→ diff preview
→ user accepts or rejects
→ apply normal project operations
```

LangChain, LangGraph, vector databases, and local large language models are deferred until a concrete need appears.

### 3.9 Video and audio export

- FFmpeg for H.264/AAC MP4 output
- FFprobe for output verification
- fixed-frame Three.js rendering
- progress and cancellation through Electron IPC
- temporary frame or raw-frame pipeline

Preferred export path:

```text
Project + Assets
→ evaluate frame N at time N/FPS
→ update animation, morphs, camera, and physics
→ render frame
→ stream frame to FFmpeg
→ mix audio
→ write MP4
→ verify with FFprobe
```

Initial profiles:

- Draft preview: reduced internal resolution and effects
- Preview: 720×1280 / 30 FPS
- Final: 1080×1920 / 30 FPS

WebCodecs may be explored later for a browser-only demo, but it is not the primary v0.1.0 export path.

## 4. Process boundaries

### 4.1 Renderer process

Responsible for:

- React UI;
- Three.js viewport;
- timeline interaction;
- transient editor state;
- diff and validation presentation.

It must not perform unrestricted file-system or process execution.

### 4.2 Preload

Exposes a narrow typed API:

```ts
interface OurStagePlatformApi {
  openModel(): Promise<ImportedModelReference>;
  openMotion(): Promise<ImportedMotionReference>;
  openAudio(): Promise<ImportedAudioReference>;
  loadProject(): Promise<OurStageProject>;
  saveProject(project: OurStageProject): Promise<void>;
  exportVideo(request: ExportRequest): Promise<ExportJobId>;
  cancelExport(jobId: ExportJobId): Promise<void>;
  getExportProgress(jobId: ExportJobId): Promise<ExportProgress>;
}
```

### 4.3 Main and utility processes

Responsible for:

- native dialogs;
- asset copying and hashing;
- archive extraction and security checks;
- project persistence;
- safe credential storage;
- FFmpeg/FFprobe execution;
- long-running background work.

## 5. Platform adapter

The editor must depend on a platform interface:

```ts
interface PlatformAdapter {
  importModel(): Promise<ImportedModelReference>;
  importMotion(): Promise<ImportedMotionReference>;
  saveProject(project: OurStageProject): Promise<void>;
  loadProject(): Promise<OurStageProject>;
  exportVideo(request: ExportRequest): Promise<ExportResult>;
}
```

Implementations:

- `ElectronPlatformAdapter` for v0.1.0;
- `WebPlatformAdapter` may later use File System Access API, IndexedDB, and WebCodecs.

This preserves the option to publish a limited web demo without rewriting the editor.

## 6. Rendering architecture

Initial render pipeline:

```text
Main scene pass
→ character mask
→ cyan/magenta outline or classic outline
→ bloom
→ optional depth/background blur
→ colour grade
→ final composite
```

Initial render presets:

1. Classic MMD Toon
2. Soft Our Series Stage
3. Cyan-Magenta Outline

The renderer must support effect-quality reduction for editing and full-quality deterministic export.

## 7. Performance strategy

- Keep preview and final output resolutions separate.
- Pause or reduce physics while scrubbing.
- Allow physics levels: off, reduced, full.
- Use workers for hashing, waveform extraction, and heavy validation.
- Release GPU resources and textures explicitly when assets are unloaded.
- Record model complexity: triangles, materials, texture sizes, bones, morphs, rigid bodies, and joints.
- Warn before loading assets likely to exceed reasonable memory limits.

## 8. Testing architecture

### Unit and schema

- Vitest
- project schema and migration tests
- timeline evaluation tests
- operation and undo/redo tests
- motion registry and compatibility scoring tests
- AI patch parsing tests

### UI

- React Testing Library
- timeline and editor component tests

### End to end

- Playwright with Electron
- create/open/save/reopen workflow
- controlled PMX/VMD playback fixture
- short deterministic export

### Regression

- fixed test model and motion with legal repository distribution rights;
- golden screenshots at fixed timestamps;
- FFprobe checks for duration, frame rate, resolution, codecs, and audio.

## 9. CI and packaging

Linux CI:

- install;
- lint;
- typecheck;
- unit tests;
- schema tests;
- web editor build.

Windows CI:

- Electron build;
- Electron smoke test;
- FFmpeg integration test where practical;
- packaging validation.

Required local phase checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## 10. Technologies intentionally excluded from v0.1.0

- Next.js
- NestJS
- FastAPI
- PostgreSQL
- Redis
- Docker and Kubernetes
- cloud object storage
- account/authentication services
- WebSocket collaboration
- cloud render workers
- LangGraph
- vector database infrastructure
- WebGPU-only rendering
- Unity or Godot
- a trained text-to-motion model

These may be introduced only when a later requirement justifies their cost and complexity.
