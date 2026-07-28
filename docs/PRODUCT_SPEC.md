# Our Stage Product Specification

## 1. Product summary

**Our Stage — AI Character Director Playground** is a local-first desktop creation tool for arranging imported MMD character assets into short videos.

The user supplies PMX models, VMD motions, audio, stages, and related files. Our Stage provides the editor, deterministic timeline, camera and expression controls, AI-assisted composition, validation, and MP4 export.

The project is primarily a personal learning and product-design experiment. It is not required to compete with professional MMD, Blender, or commercial AI animation platforms.

## 2. Problem statement

Creating a short MMD performance requires users to understand model compatibility, motion files, camera setup, expressions, timing, physics, rendering, and video export. Existing workflows often expose all technical details at once.

Our Stage explores a different interaction model:

- the system understands the assets that are actually available;
- AI proposes a usable first composition;
- the composition remains editable through a conventional timeline;
- natural-language changes become reviewable timeline operations;
- deterministic code, not the language model, remains responsible for execution and validation.

## 3. Target user

The first target user is the project owner using the application locally on Windows.

The user:

- already has or can obtain MMD assets;
- wants to experiment with character performances and short-form videos;
- may not be an experienced animator;
- wants AI assistance without losing manual control;
- accepts that imported assets may have compatibility limitations.

## 4. Product goals

### 4.1 Primary goals

1. Load an external PMX character and its textures.
2. Load and preview external VMD motions.
3. Arrange motion, expression, transform, camera, and audio clips on a timeline.
4. Save and reopen local projects reliably.
5. Generate a composition draft from a natural-language request using only available assets.
6. Modify an existing composition through natural-language instructions.
7. Validate structural, compatibility, motion, and camera issues before export.
8. Export a deterministic MP4 video at a fixed frame rate.

### 4.2 Learning goals

The project should provide practical exposure to:

- Electron desktop architecture;
- React-based creative tooling;
- Three.js, WebGL2, shaders, skeleton animation, IK, and physics;
- deterministic timeline systems and undo/redo;
- structured AI output and tool-style project operations;
- retrieval over motion metadata;
- multimedia processing and FFmpeg;
- human-in-the-loop AI product design.

## 5. Non-goals for v0.1.0

- Creating, rigging, or repairing arbitrary character models.
- Generating production-quality bone animation from text.
- Full MME `.fx` compatibility.
- Professional animation curve editing.
- Complex two-character physical interactions.
- Video-to-motion or text-to-motion generation.
- A public SaaS, account system, marketplace, payment system, or cloud render farm.
- Real-time collaboration.
- Supporting every 3D character format.
- Guaranteed compatibility with every PMX or VMD file.
- 4K output.

## 6. Core product principles

### 6.1 Local first

Projects, imported assets, API credentials, caches, and exported videos stay on the user's computer by default. The application must remain useful without a server account.

### 6.2 User-supplied assets

Our Stage does not bundle third-party models, motions, music, or stages. The user imports assets and records their source and licence information.

### 6.3 AI proposes; deterministic code executes

AI may select assets and propose project operations. It may not directly mutate the live Three.js scene or emit arbitrary executable code.

All AI output must pass:

1. schema validation;
2. asset-reference validation;
3. timeline validation;
4. model and motion compatibility checks;
5. user review before application when practical.

### 6.4 Manual control remains available

Every AI-created composition must remain editable through the same timeline and property controls used for manual creation.

### 6.5 Preview quality and final quality are separate

The editor may reduce resolution, physics, shadows, and post-processing for responsiveness. Final export uses a fixed frame clock and may render more slowly than real time.

## 7. Primary workflow

```text
Create or open a local project
        ↓
Import a PMX character and textures
        ↓
Import VMD motions and optional audio/stage assets
        ↓
Inspect compatibility and asset metadata
        ↓
Compose manually or ask AI for a draft
        ↓
Review and edit timeline, expressions, actor placement, and camera
        ↓
Run validation
        ↓
Preview at Draft or Preview quality
        ↓
Export deterministic MP4 at Final quality
```

## 8. Functional requirements

### 8.1 Project management

- Create, open, save, save as, and autosave projects.
- Maintain recent-project history.
- Detect missing and changed assets.
- Recover from an interrupted session when possible.
- Use a versioned project schema.

### 8.2 Asset management

- Import PMX model packages and related textures.
- Import VMD motions.
- Import common audio files supported by the local FFmpeg build.
- Calculate SHA-256 hashes for deduplication and integrity checks.
- Record asset title, creator, source URL, licence, attribution, and redistribution policy.
- Reject unsafe archive paths and unreasonable asset sizes.

### 8.3 MMD preview

- Display the imported character with its materials.
- Play bone and morph animation.
- Support IK and MMD-compatible rigid-body physics where available.
- Control playback, pause, seek, reset, and quality level.
- Display model diagnostics and renderer information.

### 8.4 Timeline

Required track types:

- actor transform;
- motion;
- expression/morph;
- camera;
- audio;
- render effect or preset.

Required editing actions:

- add, remove, move, trim, duplicate, and replace clips;
- adjust motion speed and loop behaviour;
- crossfade compatible motion clips;
- undo and redo;
- save all edits as project operations.

### 8.5 AI Director

The AI Director must:

- receive a user request, output settings, model capability profile, and candidate motion metadata;
- reference only known IDs;
- produce a structured `ProjectPatch`;
- support composition creation and revision;
- expose a diff before applying non-trivial changes;
- fail safely when required assets are missing;
- work through a provider interface with a default mock provider.

### 8.6 Validation

The application must distinguish:

- errors that prevent playback or export;
- warnings that may reduce quality;
- informational diagnostics.

Checks include:

- schema validity;
- missing assets and unknown IDs;
- unsupported bones or morphs;
- invalid clip timing;
- abrupt transitions;
- obvious ground penetration or floating;
- camera visibility and severe framing issues;
- unsupported export configuration.

### 8.7 Export

- Use a deterministic fixed-frame clock.
- Support 720×1280 at 30 FPS.
- Support 1080×1920 at 30 FPS for final output.
- Combine video and audio through FFmpeg.
- Report progress and allow cancellation.
- Clean temporary data after success or handled failure.
- Verify output properties with FFprobe.

## 9. Experience requirements

- The interface follows the Our Series visual direction: soft purple and pink accents, restrained notebook-like details, and a clean professional timeline.
- The 3D viewport and timeline remain visually dominant.
- Advanced diagnostics are available without blocking a beginner workflow.
- AI controls must show what will change rather than hiding edits.
- Error messages must offer a next action: replace an asset, use a fallback, disable a feature, or continue with a warning.
- English is the default interface language; Chinese is supported through i18n.

## 10. Initial performance targets

Target development hardware:

- Intel Core i5-12500H;
- 16 GB RAM;
- NVIDIA RTX 3060 Laptop GPU with 6 GB VRAM;
- Windows 64-bit.

Initial content target:

- one character as the primary path;
- two characters as a later controlled extension;
- 10–20 imported motions for AI composition testing;
- 10–20 second vertical videos;
- Draft preview at reduced resolution;
- deterministic final output at 1080×1920 / 30 FPS.

## 11. Product success criteria for v0.1.0

The local MVP is complete when a user can:

1. install and open the Windows application;
2. create a project;
3. import one PMX model and at least ten VMD motions;
4. manually build a short composition;
5. ask AI to create a composition using those motions;
6. revise the composition in natural language;
7. review validation results;
8. save and reopen the project;
9. export a stable 10–20 second vertical MP4;
10. complete the workflow without any cloud infrastructure other than an optional AI API.
