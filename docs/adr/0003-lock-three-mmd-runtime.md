# ADR 0003: Lock Three.js to the MMD-compatible runtime line

- **Status:** Accepted
- **Date:** 2026-07-28

## Context

Our Stage v0.1.0 uses the established Three.js `MMDLoader`, `MMDAnimationHelper`, `OutlineEffect`, IK and VMD animation path. Three.js deprecated its bundled MMD modules in r170 and directed projects to migrate before their removal.

The initial dependency draft used a newer Three.js release whose package no longer guarantees the bundled MMD modules used by the current runtime adapter.

## Decision

Pin both `three` and `@types/three` to `0.169.0` for the v0.1.0 runtime.

This is the last pre-deprecation Three.js line and preserves the loader/helper API already implemented and tested structurally in Our Stage.

## Consequences

### Positive

- The existing PMX/VMD runtime imports remain available.
- Phase 1 code does not need an unverified loader rewrite immediately before MVP validation.
- Dependency behaviour is reproducible and can be tested against the supplied local model and motion.

### Negative

- The renderer does not use the latest Three.js release.
- Newer WebGPU and rendering improvements are deferred.
- Security and compatibility updates must be assessed carefully rather than automatically upgrading Three.js.

## Follow-up

After v0.1.0 is manually validated, evaluate `@yohawing/three-mmd-loader` behind the existing `MmdRuntimeAdapter`. Migration is accepted only after PMX textures, VMD animation, IK, morphs, seeking, physics and deterministic export pass regression tests.
