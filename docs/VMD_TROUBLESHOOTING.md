# VMD motion troubleshooting

A VMD file can be structurally valid but still fail to animate in Our Stage if it is not attached to a Motion Track or if the runtime repeatedly reloads it while the timeline advances.

## Checks performed by Our Stage

- File header and section lengths
- Target model name stored in the VMD
- Number of bone and morph tracks
- Number of tracks whose position, rotation or weight changes
- Standard MMD bone compatibility with the loaded PMX
- Missing custom bones and morphs
- Whether the imported motion is actually attached to an actor Motion Track

## Low-variation files

A high keyframe count does not by itself prove that every track changes substantially. Some exporters include repeated values, model-specific correction tracks or data that a simple heuristic does not fully characterise.

Our Stage therefore treats `LOW_VARIATION_MOTION` and `MOSTLY_DUPLICATE_MOTION_KEYS` as advisory warnings, not proof that the VMD is invalid. A successful playback in another MMD application is stronger evidence that the file contains usable motion.

## Doodle Dance investigation

The supplied files target `カズサ_V1.1`. The parser detects large keyframe counts but relatively few materially changing standard tracks. However, the same files were confirmed to show visible movement in another MMD application.

This exposed two Our Stage issues:

1. Importing a VMD added it to the asset library but did not automatically add it to the actor's empty Motion Track.
2. Repeated timeline renders could request the same VMD load concurrently and keep returning the runtime to frame zero.

Both paths are now handled:

- importing a VMD automatically creates the first Motion Clip when the selected actor has an empty Motion Track;
- duplicate in-flight loads for the same VMD are deduplicated;
- low-variation analysis remains a warning that requires preview confirmation.

## Recommended test

1. Import the PMX model.
2. Import the VMD.
3. Confirm a purple Motion Clip appears at time zero.
4. Press Space or the Play button.
5. Confirm the timeline playhead advances and the status shows `Motion ready`.
6. Run Validation and treat low-variation messages as warnings rather than blocking errors.
