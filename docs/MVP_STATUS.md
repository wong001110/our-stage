# Our Stage v0.1.0 MVP Status

## Completed in code

- Repository and Electron security foundation
- PMX/VMD Three.js runtime adapter
- Local file protocol and relative texture loading
- Project save, autosave, recent projects and credential encryption
- Deterministic timeline and undo/redo
- Fixed-frame FFmpeg H.264/AAC export with progress and cancellation
- VMD metadata parser and model compatibility scoring
- Structural validation panel
- Offline Mock AI Director
- Optional DeepSeek structured patch integration
- Natural-language create and revise modes
- Render and output presets
- Core bilingual controls and shortcuts
- Windows packaging workflow

## Automated or environment-independent evidence

- TypeScript syntax transpile checks were run for newly generated Phase 4–7 sources.
- The supplied `dance v2.vmd` parsed as VMD 0002 with 6,581 bone keys, 2,604 morph keys, 42 IK frames and an 8.067-second duration.
- The supplied motion used all 28 standard core body/leg/IK bones present in the tested PMX model.
- A local FFmpeg smoke test produced a one-second MP4 containing exactly 30 H.264 video frames and an AAC audio stream.

## Manual Windows validation still required

The execution sandbox cannot create a WebGL2 context or install npm dependencies from the internet. On the target Windows machine, run:

1. `pnpm install`
2. `pnpm check`
3. `pnpm test:e2e`
4. `pnpm dev`
5. Import the local PMX model and `dance v2.vmd`
6. Add the WAV file to the audio track
7. Run Validation
8. Generate a Mock AI draft
9. Export a 720×1280 test MP4
10. Repeat at 1080×1920
11. Run `pnpm package:windows`

Record screenshots and the exported video after this manual pass.

## Known limitations

- MMD rigid-body physics is currently disabled.
- No full MME `.fx` compatibility.
- No text-to-motion or video-to-motion generation.
- One actor is the recommended path.
- The test assets are local-only and absent from the public repository.
