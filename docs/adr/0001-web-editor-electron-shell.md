# ADR 0001: Web Editor Core with Electron Shell

- **Status:** Accepted
- **Date:** 2026-07-28

## Context

Our Stage needs:

- React-based creative-tool UI;
- Three.js/WebGL MMD preview;
- local PMX/VMD directory access;
- reliable local project storage;
- direct FFmpeg/FFprobe execution;
- encrypted local AI credentials;
- deterministic Windows packaging;
- the option to expose a limited web edition later.

A pure web application simplifies distribution but makes local asset directories, long-running FFmpeg work, stable codec support, and permission persistence more complex. A desktop-only architecture tightly coupled to Electron would reduce future portability and make browser testing harder.

## Decision

Use a **web editor core with an Electron desktop shell**.

- `apps/editor` is a normal React + Vite application.
- `apps/desktop` hosts Electron main, preload, utility processes, and packaging.
- Shared packages contain schema, timeline, MMD runtime adapter, validation, AI, and export contracts.
- The editor accesses platform capabilities through a typed `PlatformAdapter`.
- Electron is the v0.1.0 production platform.

## Consequences

### Positive

- React and Three.js remain standard web technologies.
- The editor can run in a browser during development.
- Electron provides local files, native dialogs, `safeStorage`, and FFmpeg.
- A future browser edition can implement a different platform adapter.
- Chromium version and WebGL behaviour are controlled in the desktop build.

### Negative

- Electron increases installation size and baseline memory usage.
- IPC and preload boundaries require security discipline.
- The project must maintain editor and desktop build configurations.
- The future web adapter will have reduced capabilities unless backed by server services or newer browser APIs.

## Rejected alternatives

### Pure browser application

Rejected for v0.1.0 because local asset management and reliable FFmpeg export are central, while public deployment is not.

### Native Windows UI

Rejected because it would reduce reuse of React/Three.js skills and future web portability.

### Unity, Godot, or Blender as the primary application runtime

Rejected because the learning objective centres on Web 3D, AI-assisted creative tooling, and a web-compatible editor architecture.

## Implementation constraints

- Renderer uses `nodeIntegration: false`.
- Context isolation and sandbox are enabled.
- Preload exposes a narrow typed API.
- Editor code does not import Electron modules.
- Platform-specific behaviour is accessed through adapters.
- FFmpeg runs outside the renderer process.
