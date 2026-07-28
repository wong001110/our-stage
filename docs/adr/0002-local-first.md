# ADR 0002: Local-First Architecture

- **Status:** Accepted
- **Date:** 2026-07-28

## Context

Our Stage is initially a personal project used locally. Its main assets can be large and may have restrictive licences. The application must manage PMX models, VMD motions, textures, audio, project files, render caches, and exported videos.

A cloud-first architecture would introduce hosting, storage, database, authentication, upload bandwidth, privacy, deletion, and render-worker costs before they are required by the product goal.

## Decision

Adopt a **local-first architecture** for v0.1.0.

- Projects and asset libraries are stored on the user's machine.
- Rendering and FFmpeg export run locally.
- No account, server, cloud database, or object storage is required.
- AI is optional and accessed through a provider adapter.
- `MockProvider` supports no-cost and offline development.
- When a cloud AI provider is enabled, only structured metadata and relevant project state are sent; PMX/VMD binaries and textures are not sent by default.

## Consequences

### Positive

- No fixed infrastructure cost.
- Imported assets remain local by default.
- Large model and texture files do not require upload.
- The application remains useful without a network connection except optional AI calls.
- Development can focus on the editor, runtime, validation, and export path.

### Negative

- Projects do not automatically sync between devices.
- Sharing and collaboration are deferred.
- The user is responsible for local backups.
- Local hardware determines preview and export performance.
- Cross-device account-based asset libraries are not available.

## Local data model

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

Projects reference library assets through stable IDs and hashes rather than relying only on absolute paths.

## Future migration path

A later online edition may add:

- account and authentication;
- optional project sync;
- object storage;
- cloud render workers;
- sharing and collaboration;
- creator asset distribution.

Those capabilities must be introduced behind adapters and explicit user choices. They must not require rewriting the project schema or editor core.

## Security and privacy constraints

- API keys use Electron `safeStorage`.
- Imported assets are treated as untrusted files.
- Third-party assets are never committed to the public repository by default.
- Cloud AI requests are data-minimised.
- Cache cleanup must not delete source projects or shared library assets.
