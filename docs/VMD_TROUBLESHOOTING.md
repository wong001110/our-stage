# VMD motion troubleshooting

A VMD file can be structurally valid and still contain almost no visible motion.

## Checks performed by Our Stage

- File header and section lengths
- Target model name stored in the VMD
- Number of bone and morph tracks
- Number of tracks whose position, rotation or weight actually changes
- Standard MMD bone compatibility with the loaded PMX
- Missing custom bones and morphs

## Static or pose-only files

A high keyframe count does not prove that a file contains animation. Exporters sometimes write the same pose to many frames or include model-specific correction tracks.

Our Stage reports `STATIC_OR_POSE_ONLY_MOTION` when fewer than five bone tracks change and no morph track changes. It reports `MOSTLY_DUPLICATE_MOTION_KEYS` when fewer than ten percent of all tracks contain changing values.

## Current Doodle Dance test files

The supplied files target `カズサ_V1.1` and contain many duplicate values:

- `dance v2.vmd`: 6,581 bone keys and 2,604 morph keys, but only four bone tracks change materially and no morph weight changes.
- `dance.vmd`: 1,539 bone keys, also with only a few changing tracks.

They may display a fixed pose with a small centre or arm adjustment. This is a property of the files, not evidence that the Sparkle PMX is broken.

Use another VMD with clear changing rotations on upper body, arms, legs and IK tracks to verify full playback.
