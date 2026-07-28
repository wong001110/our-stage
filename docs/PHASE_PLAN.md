# Our Stage Implementation Phase Plan

## 1. Delivery model

Our Stage is delivered through eight independently testable phases.

Each phase must:

1. start from the latest `main`;
2. use one temporary phase branch;
3. include code, tests, and documentation required by that phase;
4. pass the defined acceptance checks;
5. be committed and pushed;
6. be merged into `main`;
7. delete the local and remote phase branch after merge;
8. leave `main` as the only source of truth.

The planning/specification bootstrap may be committed directly to an empty `main`. Implementation phases follow the branch workflow below.

## 2. Branch and merge workflow

Branch names:

```text
phase/00-foundation
phase/01-mmd-runtime
phase/02-local-projects
phase/03-timeline
phase/04-video-export
phase/05-motion-intelligence
phase/06-ai-director
phase/07-mvp-hardening
```

Standard flow:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b phase/XX-name

# implement and validate

git add <intended-files>
git commit -m "<phase commit message>"
git push -u origin phase/XX-name

# after acceptance
git checkout main
git pull --ff-only origin main
git merge --ff-only phase/XX-name
git push origin main

git branch -d phase/XX-name
git push origin --delete phase/XX-name
```

No long-lived `develop`, `test`, or feature branches are required.

---

# Phase 0 — Repository Foundation

**Branch:** `phase/00-foundation`

**Commit:** `chore: establish our stage repository foundation`

## Goal

Create a reliable TypeScript monorepo, Electron shell, independently runnable web editor, shared contracts, tests, and CI baseline.

## Scope

- pnpm workspace
- `apps/editor` React + Vite application
- `apps/desktop` Electron main/preload/packaging structure
- initial shared packages
- TypeScript strict mode
- ESLint and Prettier
- Vitest baseline
- Playwright/Electron test baseline
- GitHub Actions
- `.gitattributes` and `.gitignore`
- typed platform API
- Project Schema v1 baseline
- Mock AI provider
- architecture and developer documentation

## Required repository structure

```text
apps/
  editor/
  desktop/
packages/
  project-schema/
  timeline-engine/
  mmd-runtime/
  motion-registry/
  validator/
  ai-director/
  video-export/
  platform-api/
  shared-ui/
  shared/
```

## Acceptance

- editor runs in a browser development mode;
- Electron loads the same editor;
- Electron renderer has no Node integration;
- a blank project validates, saves, and reloads through a stub/local adapter;
- lint, typecheck, test, and build commands pass;
- CI passes on the baseline repository;
- README contains reproducible setup instructions.

---

# Phase 1 — MMD Runtime Proof

**Branch:** `phase/01-mmd-runtime`

**Commit:** `feat: complete phase 1 mmd runtime proof`

## Goal

Prove that a PMX model and VMD motion can be loaded, controlled, inspected, and prepared for deterministic rendering in Electron.

## Scope

- compare candidate MMD loader implementations;
- select and lock the Three.js/runtime versions;
- load PMX model package and textures;
- load VMD bone and morph animation;
- IK support;
- rigid-body physics;
- play, pause, seek, reset;
- external deterministic time control;
- basic camera, light, shadow, and toon rendering;
- Draft/Preview quality toggle;
- model diagnostics;
- renderer/GPU diagnostics;
- explicit resource disposal.

## Acceptance

- controlled test PMX loads correctly;
- controlled VMD plays bone and morph animation;
- IK and physics operate or report supported limitations;
- seeking to a timestamp is repeatable;
- runtime can evaluate a fixed sequence of timestamps without relying on wall-clock time;
- 20-minute playback does not show unbounded memory growth;
- selected loader decision is recorded in an ADR or architecture update.

---

# Phase 2 — Local Assets and Project System

**Branch:** `phase/02-local-projects`

**Commit:** `feat: complete phase 2 local asset and project system`

## Goal

Create a safe local asset library and versioned project lifecycle.

## Scope

- PMX package import;
- VMD import;
- audio import;
- native dialogs;
- project create/open/save/save-as;
- autosave and crash-recovery snapshot;
- recent projects;
- SHA-256 asset hashing and deduplication;
- manifest and licence metadata;
- missing/changed asset diagnostics;
- safe archive extraction;
- file-size, texture-size, and file-type limits;
- cache and log directories;
- local API credential storage.

## Acceptance

- project survives application restart;
- assets are not duplicated unnecessarily;
- moved, changed, or missing assets are diagnosed;
- archive extraction cannot escape the intended directory;
- no third-party assets or credentials appear in Git;
- user can inspect source/licence information for imported assets.

---

# Phase 3 — Deterministic Timeline Editor

**Branch:** `phase/03-timeline`

**Commit:** `feat: complete phase 3 deterministic timeline editor`

## Goal

Provide a usable non-linear timeline that drives the MMD runtime through project data rather than ad-hoc scene changes.

## Scope

Track types:

- motion;
- expression;
- actor transform;
- camera;
- audio;
- render effect.

Editing:

- playhead and ruler;
- playback controls;
- timeline zoom and scroll;
- clip add/remove/move/trim/duplicate;
- speed, loop, and source offset;
- motion crossfade;
- expression clips;
- actor position and rotation;
- camera presets and keyframes;
- undo/redo;
- copy/paste;
- project operation history.

## Acceptance

- user can construct `Idle → Walk → Wave → Idle`;
- seeking to any time reconstructs a consistent scene;
- save/reopen preserves the timeline;
- undo/redo passes operation tests;
- overlapping clip behaviour is explicit and tested;
- manual and future AI edits use the same operation model.

---

# Phase 4 — Deterministic Video Export

**Branch:** `phase/04-video-export`

**Commit:** `feat: complete phase 4 deterministic video export`

## Goal

Export stable MP4 video independently of real-time preview frame rate.

## Scope

- export clock based on `frameIndex / fps`;
- fixed physics stepping;
- 720×1280 / 30 FPS profile;
- 1080×1920 / 30 FPS profile;
- FFmpeg detection and process management;
- frame streaming or controlled temporary-frame strategy;
- audio mix;
- progress reporting;
- cancellation;
- failure diagnostics;
- temporary data cleanup;
- FFprobe output verification.

## Acceptance

- a 10-second 30 FPS project produces approximately 300 intended frames;
- preview frame drops do not alter output timing;
- repeated export of the same project preserves animation and camera timing;
- audio duration and video duration are aligned within the specified tolerance;
- cancellation terminates the worker and cleans temporary files;
- FFprobe confirms expected resolution, FPS, codecs, and audio stream.

**Gate:** Do not prioritise advanced AI or rendering polish until this phase is proven.

---

# Phase 5 — Motion Intelligence and Validation

**Branch:** `phase/05-motion-intelligence`

**Commit:** `feat: complete phase 5 motion intelligence and validation`

## Goal

Represent what motions mean, determine whether they are compatible with a model, and detect common composition problems.

## Scope

- Motion Registry;
- manual and assisted metadata entry;
- model compatibility profile;
- required/optional bone mapping;
- morph mapping;
- IK/physics capability reporting;
- timeline validation;
- transition-pose comparison;
- basic foot contact/sliding heuristic;
- floor penetration/floating heuristic;
- joint-rotation anomaly checks;
- camera visibility and framing checks;
- error/warning/info diagnostics;
- validation report UI.

## Acceptance

- every referenced motion and asset ID is verified;
- model/motion compatibility score and missing capabilities are visible;
- invalid timing blocks export;
- warnings identify abrupt transitions and obvious framing problems;
- validator output is deterministic and covered by tests;
- the user can continue with non-blocking warnings.

---

# Phase 6 — AI Director V1

**Branch:** `phase/06-ai-director`

**Commit:** `feat: complete phase 6 ai director v1`

## Goal

Generate a valid first composition from natural language using only the project's available assets.

## Scope

- Mock AI provider;
- DeepSeek provider;
- structured output;
- candidate motion filtering and retrieval;
- `ProjectPatch` operations;
- composition request UI;
- patch diff preview;
- accept/reject flow;
- schema and deterministic validation;
- safe retries and repair;
- local API key storage;
- request token/cost logging where available;
- missing-motion fallback response.

## Acceptance

Given a request such as:

> Create a ten-second vertical clip. The character walks in, gives a shy wave, then finish with a close shot.

The system:

- references only existing actor, motion, camera, and preset IDs;
- creates a valid patch;
- produces a usable timeline draft;
- reports missing capabilities rather than inventing files;
- allows preview before application;
- works in Mock mode without an API key.

---

# Phase 7 — Natural-Language Editing and MVP Hardening

**Branch:** `phase/07-mvp-hardening`

**Commit:** `feat: complete our stage local mvp`

**Release tag after acceptance:** `v0.1.0`

## Goal

Turn the technical prototype into a complete local MVP with reliable editing, recovery, diagnostics, packaging, and onboarding.

## Scope

- revise existing timeline with natural language;
- targeted patch operations rather than full regeneration;
- AI change history;
- patch diff and rollback;
- one controlled automatic repair attempt;
- user override after AI output;
- Draft/Preview/Final quality profiles;
- three render presets;
- performance monitor;
- crash recovery and project backups;
- keyboard shortcuts;
- onboarding;
- English default and Chinese translation;
- Windows packaging;
- full README and limitation documentation;
- complete E2E workflow.

Initial render presets:

1. Classic MMD Toon
2. Soft Our Series Stage
3. Cyan-Magenta Outline

## Acceptance

- installable Windows build opens successfully;
- import one external PMX and at least ten VMD motions;
- manual composition works;
- AI composition works;
- targeted natural-language revision works;
- compatibility and timeline diagnostics are visible;
- project survives restart;
- 10–20 second vertical MP4 exports successfully;
- CI and E2E checks pass;
- all implementation phase branches have been removed;
- `main` contains the accepted v0.1.0 state.

---

# Deferred experiments after v0.1.0

- multi-character narrative composition;
- complex contact animation;
- TTS, phoneme timing, and MMD lip morphs;
- music beat analysis and automatic cuts;
- video-to-motion integration;
- text-to-motion research;
- embedding/vector motion retrieval;
- LangGraph validation and repair workflow;
- vision-model preview critique;
- FBX, BVH, VRM, and GLB support;
- WebGPU renderer;
- browser-only edition;
- cloud rendering and sharing;
- motion creator ecosystem or marketplace.
