# Our Stage

**Our Stage — AI Character Director Playground** is a local-first Electron tool for arranging imported PMX characters and VMD motions into short videos.

It combines an editable timeline, additive pose overrides, deterministic export, and an AI assistant that proposes structured changes. AI does not directly control Three.js objects or invent unavailable motion files.

## Workflow

```text
Import PMX character and textures
→ Import VMD motion and optional audio
→ Add clips manually or ask AI Director for a draft
→ Pause at any time and adjust individual bones with Pose Override keyframes
→ Edit expressions, camera and timing
→ Run compatibility validation
→ Export fixed-frame H.264/AAC MP4 with FFmpeg
```

## Current capabilities

- Electron desktop shell with isolated preload API
- React + Vite creative editor
- Three.js PMX/VMD preview
- Motion, expression, transform, Bone Override, camera and audio timeline tracks
- User-editable local bone rotation and position offsets
- Step, linear and smooth pose-key interpolation
- Selected-bone axis marker and common-bone-first selector
- Preview and deterministic export using the same pose evaluation path
- Local project save, autosave, recent projects and encrypted API credentials
- VMD parser and PMX/VMD bone compatibility report
- Mock AI Director that works offline and without fees
- Optional DeepSeek structured patch provider
- Natural-language draft and targeted revision modes
- Draft, Preview and Final quality modes
- Classic MMD, Soft Our Series and Cyan/Magenta stage presets
- 720×1280 and 1080×1920 fixed-frame MP4 output
- English default with core Chinese controls

## Pose Override workflow

1. Import a PMX and VMD.
2. Pause at the time you want to adjust.
3. Open **Inspector → Pose Override**.
4. Select a bone such as `頭`, `右腕`, `左ひじ`, or `センター`.
5. Adjust local X/Y/Z rotation or position offsets.
6. Choose Step, Linear, or Smooth interpolation.
7. Add or update a keyframe.
8. Move to another time and create the next keyframe.

The original VMD is never modified. Overrides are stored in the `.ourstage` project and remain undoable.

## Requirements

- Windows 10/11 x64 for the first packaged target
- Node.js 22.12 or newer
- pnpm 11.17
- FFmpeg and FFprobe available on `PATH`, or `FFMPEG_PATH` set to the executable
- A GPU and driver capable of Chromium WebGL2

Tested target hardware is an Intel Core i5-12500H, 16 GB RAM and NVIDIA RTX 3060 Laptop GPU.

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Run checks:

```bash
pnpm check
pnpm test:e2e
```

Build a Windows installer:

```bash
pnpm package:windows
```

## Local assets

Third-party PMX, VMD, textures, music, stages and generated videos are ignored by Git and must not be committed. Users are responsible for checking whether each asset permits personal use, published video output, modification, attribution and commercial use.

## AI cost

The Mock provider is free and offline. DeepSeek is optional and uses the user's own API key, encrypted through Electron `safeStorage`. Only project structure and motion metadata are sent; PMX/VMD binaries and textures are not uploaded by default.

## Current limitations

- One actor is the primary supported workflow.
- Pose editing currently uses numeric local offsets rather than a full rotation gizmo.
- No animation graph or curve editor.
- No VMD overwrite or VMD export.
- IK target dragging, foot lock and pose libraries remain later phases.
- Bullet/Ammo hair and skirt physics are not enabled in the current runtime build.
- Motion blending is represented in project data, but full pose-aware crossfade tuning remains limited.
- Complex two-character contact animation is not supported.
- Browser-only export and cloud rendering are not included.

See [Phase 9 motion editing](docs/PHASE_09_MOTION_EDITING.md), [technical architecture](docs/TECHNICAL_ARCHITECTURE.md), and [phase plan](docs/PHASE_PLAN.md).
