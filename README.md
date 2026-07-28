# Our Stage

**Our Stage — AI Character Director Playground** is a local-first Electron tool for arranging imported PMX characters and VMD motions into short videos.

It combines a normal editable timeline with an AI assistant that proposes structured changes. AI does not directly control Three.js objects or invent unavailable motion files.

## MVP workflow

```text
Import PMX character and textures
→ Import VMD motion and optional audio
→ Add clips manually or ask AI Director for a draft
→ Review the structured patch
→ Edit motion, expression, camera and timing
→ Run compatibility validation
→ Export fixed-frame H.264/AAC MP4 with FFmpeg
```

## Included in v0.1.0

- Electron desktop shell with isolated preload API
- React + Vite creative editor
- Three.js PMX/VMD preview
- Motion, expression, transform, camera and audio timeline tracks
- Local project save, autosave, recent projects and encrypted API credentials
- VMD parser and PMX/VMD bone compatibility report
- Mock AI Director that works offline and without fees
- Optional DeepSeek structured patch provider
- Natural-language draft and targeted revision modes
- Draft, Preview and Final quality modes
- Classic MMD, Soft Our Series and Cyan/Magenta stage presets
- 720×1280 and 1080×1920 fixed-frame MP4 output
- English default with core Chinese controls

## Requirements

- Windows 10/11 x64 for the first packaged target
- Node.js 22.12 or newer
- pnpm 11.17
- FFmpeg and FFprobe available on `PATH`, or `FFMPEG_PATH` set to the executable
- A GPU and driver capable of Chromium WebGL2

Tested target hardware is an Intel Core i5-12500H, 16 GB RAM and NVIDIA RTX 3060 Laptop GPU.

## Development

```bash
pnpm install
pnpm dev
```

Run the editor only:

```bash
pnpm dev:editor
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

## Known v0.1.0 limitations

- One actor is the primary supported workflow.
- Bullet/Ammo hair and skirt physics are not enabled in the current runtime build.
- Motion blending is represented in project data, but full pose-aware crossfade tuning remains limited.
- The Cyan/Magenta preset uses coloured stage lighting rather than full MME-compatible dual-outline rendering.
- Complex two-character contact animation is not supported.
- DeepSeek output still depends on provider compliance and is always schema-validated before application.
- Browser-only export and cloud rendering are not included.
- The project requires manual Windows/Electron/WebGL validation with user-supplied assets because those files cannot be committed.

See [MVP status](docs/MVP_STATUS.md), [technical architecture](docs/TECHNICAL_ARCHITECTURE.md) and [phase plan](docs/PHASE_PLAN.md).
