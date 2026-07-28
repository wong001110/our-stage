# Our Stage Security and Asset Policy

## 1. Scope

Our Stage imports local 3D models, motion files, textures, archives, audio, and optional AI credentials. Even in a personal local application, these inputs must be treated as untrusted.

This policy defines the minimum controls for v0.1.0.

## 2. Electron security baseline

Required window configuration:

```ts
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  preload: preloadPath,
}
```

Rules:

- The React renderer must not access Node.js directly.
- Preload exposes a narrow typed `window.ourStage` API.
- Do not expose unrestricted `ipcRenderer`, `fs`, `shell`, or `child_process`.
- Validate every IPC payload with a runtime schema.
- Validate the sender for privileged IPC calls where practical.
- Do not load arbitrary remote pages in privileged application windows.
- Keep navigation and new-window creation restricted.
- Use a restrictive Content Security Policy.
- Open external links through an explicit safe allow-list flow.

## 3. File import policy

Accepted v0.1.0 categories:

- PMX model package;
- VMD motion;
- supported audio files;
- controlled stage assets where implemented;
- archives used only for supported asset packages.

Rules:

- Detect content and validate extension where practical.
- Reject executable files and script files in imported packages.
- Do not execute code from an asset package.
- Resolve imported paths inside an application-controlled library directory.
- Use SHA-256 to identify content.
- Preserve the original import name only as metadata.
- Never overwrite an unrelated existing asset because a file name matches.

## 4. Archive extraction

Archive import must prevent:

- `../` path traversal;
- absolute paths;
- Windows drive paths;
- symbolic-link escape;
- excessive file counts;
- decompression bombs;
- file-type smuggling;
- overwrite of existing application files.

Initial limits should be configurable. Suggested development defaults:

- maximum model package: 500 MB compressed;
- maximum extracted total: 2 GB;
- maximum individual texture dimension: 4096×4096 without explicit override;
- maximum file count per package: 10,000;
- maximum actor count in an active MVP project: 2.

Limits are product safeguards, not guarantees that every accepted asset will perform well.

## 5. Local directory boundaries

Use application-controlled directories:

```text
OurStageData/
├── library/
├── projects/
├── exports/
├── cache/
└── logs/
```

Rules:

- Imported files may be copied into the library after validation.
- Cache may be deleted without losing project truth.
- Project deletion must not silently delete shared library assets.
- Export cleanup must only remove files created by the current export job.
- Canonicalise and verify every path before reading, writing, moving, or deleting.

## 6. Third-party asset policy

The repository must not contain third-party PMX, VMD, textures, stages, music, or proprietary shaders unless their licence explicitly allows repository redistribution.

Every imported asset should support metadata for:

- creator;
- source URL;
- licence name or original terms;
- personal-use permission;
- permission to publish rendered videos;
- commercial-video permission;
- modification permission;
- redistribution permission;
- attribution requirement and text;
- notes.

Important distinctions:

- free download is not redistribution permission;
- permission to render a video is not permission to bundle the source asset;
- personal use is not commercial use;
- model, motion, stage, music, and shader terms are independent.

Our Stage records the user's metadata but does not guarantee legal rights to an imported asset.

## 7. Git repository policy

Never commit:

- imported models or motions;
- personal project directories;
- generated videos;
- render frames and caches;
- `.env` or API keys;
- local application data;
- diagnostic logs containing local paths or request content;
- paid/proprietary FFmpeg builds;
- unlicensed test fixtures.

Use a minimal legal fixture specifically cleared for automated tests, or generate synthetic fixture data where possible.

## 8. API credentials

- Store cloud AI keys through Electron `safeStorage`.
- Do not place credentials in project JSON.
- Do not expose decrypted keys to the renderer longer than required.
- Prefer provider calls from a privileged process or a narrowly controlled service layer.
- Redact keys from logs and error messages.
- Provide a remove/replace credential action.
- Non-AI features must function without a key.

## 9. AI data minimisation

Cloud AI requests should contain:

- user composition request;
- motion titles, IDs, tags, duration, and compatibility metadata;
- actor capability summary;
- relevant timeline JSON;
- camera/render preset definitions.

Do not upload by default:

- PMX binaries;
- VMD binaries;
- textures;
- full local paths;
- unrelated files;
- secrets.

The provider adapter must make request payloads inspectable in a development diagnostic view with secrets removed.

## 10. FFmpeg process security

- Use `spawn` with an argument array, not shell-concatenated commands.
- Never interpolate untrusted file names into a shell command string.
- Resolve the FFmpeg executable from a controlled application setting.
- Validate all export paths.
- Capture and limit diagnostic output.
- Support cancellation and child-process cleanup.
- Prevent an export job from deleting arbitrary paths.
- Record the FFmpeg version for reproducibility.

## 11. Local logs

Logs may include:

- event type;
- timestamp;
- anonymised/project-local IDs;
- validation codes;
- export process status;
- component versions.

Avoid logging:

- API keys;
- complete AI prompts containing private text unless explicit debug mode is enabled;
- asset binary data;
- unnecessary absolute user paths.

Provide log rotation or a maximum log size.

## 12. Packaging and dependency policy

- Lock dependency versions.
- Review Electron and Three.js security/release notes before upgrades.
- Generate a dependency licence inventory before public binary distribution.
- Record whether the bundled FFmpeg configuration is LGPL or GPL and fulfil the applicable obligations.
- Do not auto-update executables in v0.1.0 unless the update mechanism is explicitly designed and verified.

## 13. Failure behaviour

When an import or privileged operation fails:

- do not partially trust the asset;
- clean only the temporary files created for that operation;
- provide a stable diagnostic code;
- preserve the original project;
- avoid retry loops that repeatedly process a malicious or corrupt file;
- allow the user to remove the failed import record.

## 14. Minimum security acceptance for v0.1.0

- Electron isolation settings are active.
- IPC payloads are schema-validated.
- archive path traversal tests pass.
- executable files are rejected from asset packages.
- API keys are encrypted at rest and absent from project files/logs.
- FFmpeg is invoked without a shell command string.
- project/export cleanup cannot leave the configured application directories.
- `.gitignore` protects local assets, projects, exports, caches, logs, and environment files.
