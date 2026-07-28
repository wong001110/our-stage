# Our Stage

**Our Stage — AI Character Director Playground** is a local-first desktop experiment for directing imported MMD characters with a deterministic timeline and AI-assisted composition.

Users bring their own PMX character models, VMD motions, audio, and related assets. Our Stage focuses on arranging those assets into a short performance: motion clips, expressions, actor placement, camera shots, render presets, validation, and MP4 export.

## Product principle

```text
Import PMX character
+ Import VMD motions
+ Describe the intended performance
        ↓
AI proposes a structured composition
        ↓
Deterministic timeline validates and executes it
        ↓
User reviews and edits
        ↓
Fixed-frame render exports MP4
```

AI acts as an assistant director. It does not directly generate arbitrary bone animation in the first release. All AI output must be expressed as validated project operations against assets that actually exist.

## v0.1.0 scope

- Local-first Electron desktop application
- React and Three.js web editor core
- PMX character import
- VMD motion import and playback
- Motion, expression, transform, camera, and audio tracks
- Deterministic preview and fixed-frame export
- Local project and asset management
- Motion compatibility and timeline validation
- AI-generated composition drafts
- Natural-language edits expressed as reviewable project patches
- 720×1280 and 1080×1920 MP4 output

## Explicitly out of scope for v0.1.0

- Model creation or rigging
- Full MME `.fx` compatibility
- Text-to-motion bone generation
- Complex two-character contact animation
- Video-to-motion pipeline
- Cloud rendering, user accounts, payments, or marketplace
- Public hosting requirements
- 4K output

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Implementation phases](docs/PHASE_PLAN.md)
- [Project schema](docs/PROJECT_SCHEMA.md)
- [AI director specification](docs/AI_DIRECTOR_SPEC.md)
- [Motion validation specification](docs/MOTION_VALIDATION_SPEC.md)
- [Security and asset policy](docs/SECURITY_AND_ASSET_POLICY.md)
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [ADR 0001: Web editor core with Electron shell](docs/adr/0001-web-editor-electron-shell.md)
- [ADR 0002: Local-first architecture](docs/adr/0002-local-first.md)

## Repository policy

- `main` is the only source of truth.
- Each implementation phase is developed on one temporary phase branch.
- A phase is merged only after its acceptance checks pass.
- The local and remote phase branches are deleted after merge.
- Third-party PMX, VMD, textures, stages, music, generated videos, API keys, and personal project files must not be committed.

## Status

Planning and specification baseline. Implementation starts with **Phase 0 — Repository Foundation**.
