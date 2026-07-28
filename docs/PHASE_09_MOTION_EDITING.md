# Phase 9 — Motion Editing and Pose Overrides

## Status

Implemented as the first user-editable motion layer for Our Stage.

## Goal

Allow users to adjust an imported VMD without modifying the source file. Our Stage stores additive position and rotation offsets as project keyframes and evaluates them after the VMD pose.

```text
Imported VMD pose
+ Bone Override keyframes
= Preview and exported pose
```

## Included

- Bone list populated from the loaded PMX skeleton
- Common-bone-first selector
- Rotation offsets in degrees for X/Y/Z
- Position offsets for X/Y/Z
- Step, linear and smooth interpolation
- Add or update keyframe at the playhead
- Delete keyframe
- Reset one bone or all pose overrides
- Bone Override timeline track and diamond keyframe markers
- Selected-bone axis marker in the 3D viewport
- Project save, autosave and reopen support
- Shared preview and deterministic export evaluation
- Undo and redo through normal project operations
- Migration of existing v0.1 projects by adding the missing actor track

## Data model

A keyframe is stored as a normal timeline clip:

```json
{
  "type": "bone-override",
  "clipId": "clip-...",
  "boneName": "右腕",
  "startSeconds": 4.2,
  "durationSeconds": 0.0333333333,
  "rotationEulerOffset": [0.1, 0, -0.25],
  "positionOffset": [0, 0, 0],
  "interpolation": "smooth",
  "enabled": true
}
```

The short duration is only used by the common clip contract. The timeline engine treats the clip as a keyframe and interpolates to the next keyframe for the same bone.

## Evaluation order

```text
Evaluate VMD at timeline time
→ Apply actor transform and morphs
→ Capture the unmodified VMD bone pose
→ Evaluate Bone Override keyframes
→ Apply offsets relative to the captured VMD pose
→ Render preview or export frame
```

Offsets are not accumulated frame to frame. Every frame begins from the VMD-evaluated pose.

## User workflow

1. Import PMX and VMD.
2. Pause at the desired time.
3. Select a bone in Inspector → Pose Override.
4. Change rotation or position offsets.
5. Choose interpolation.
6. Add Key.
7. Move to another time and add another key.
8. Preview and export normally.

## Deliberate limitations

- Numeric controls are used instead of a full rotation gizmo in this first version.
- No animation graph/curve editor.
- No direct VMD overwrite or VMD export.
- No multi-bone pose library yet.
- IK target dragging and foot lock remain a later phase.
- Rotation uses local XYZ Euler offsets applied after the VMD pose.

## Acceptance checks

- Existing projects open and receive a Bone Override track.
- Two keyframes interpolate deterministically.
- Reset and delete operations are undoable.
- Saved projects preserve overrides.
- Preview and video export use the same evaluated offsets.
