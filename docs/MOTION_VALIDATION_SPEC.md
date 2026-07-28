# Our Stage Motion Validation Specification

## 1. Purpose

AI cannot reliably guarantee that a selected or generated composition is correct. Our Stage therefore treats motion quality as a layered validation problem.

A composition is considered trustworthy only when it passes the relevant checks for:

1. structural validity;
2. asset and MMD compatibility;
3. timeline and transition consistency;
4. basic kinematic and physical plausibility;
5. camera visibility and framing;
6. user review.

The validator reports confidence and problems. It does not claim absolute correctness.

## 2. Validation levels

### 2.1 Error

Blocks playback or export.

Examples:

- missing referenced asset;
- unknown actor or motion ID;
- invalid clip timing;
- unsupported project version;
- model failed to load;
- export profile is unsupported.

### 2.2 Warning

Playback or export may continue, but quality may be reduced.

Examples:

- missing optional finger bones;
- abrupt transition;
- minor foot sliding;
- hand near the frame edge;
- motion metadata is unverified;
- model has unusually large textures.

### 2.3 Information

Useful diagnostic that does not imply a problem.

Examples:

- physics disabled in Draft mode;
- motion uses root movement;
- camera preset tracks the actor;
- model contains no named smile morph.

## 3. Validation pipeline

```text
Project schema
→ asset existence and integrity
→ model capability profile
→ motion requirement profile
→ timeline semantics
→ transition analysis
→ fixed-step motion simulation
→ camera/framing analysis
→ report
```

## 4. Model compatibility profile

Generated when a PMX model is imported.

```ts
interface ModelCompatibilityProfile {
  modelAssetId: AssetId;
  canonicalBones: Record<string, string | null>;
  morphs: Record<string, string | null>;
  ik: {
    leftLeg: boolean;
    rightLeg: boolean;
    leftToe: boolean;
    rightToe: boolean;
  };
  counts: {
    vertices: number;
    triangles: number;
    materials: number;
    textures: number;
    bones: number;
    morphs: number;
    rigidBodies: number;
    joints: number;
  };
  textureStats: {
    totalBytes: number;
    largestWidth: number;
    largestHeight: number;
  };
  warnings: ValidationDiagnostic[];
}
```

Canonical mappings include at least:

- centre/root;
- upper body;
- neck and head;
- left/right shoulder;
- left/right arm;
- left/right elbow;
- left/right wrist;
- left/right leg;
- left/right knee;
- left/right ankle;
- common leg and toe IK bones.

## 5. Motion requirement profile

Generated or manually curated for each VMD motion.

```ts
interface MotionRequirementProfile {
  motionId: MotionId;
  durationSeconds: number;
  requiredBones: string[];
  optionalBones: string[];
  requiredMorphs: string[];
  movement: "stationary" | "local" | "travelling";
  loopable: boolean;
  startPose?: PoseSignature;
  endPose?: PoseSignature;
  requiresProps: string[];
  verification: "unreviewed" | "auto-analysed" | "user-verified";
}
```

Compatibility result:

```ts
interface MotionCompatibilityResult {
  score: number;
  missingRequiredBones: string[];
  missingOptionalBones: string[];
  missingMorphs: string[];
  playable: boolean;
  diagnostics: ValidationDiagnostic[];
}
```

A missing required major bone is normally an error. A missing optional finger or accessory bone is normally a warning.

## 6. Structural and timeline checks

Required checks:

- every referenced actor, asset, track, clip, preset, and morph exists;
- clip times are finite and non-negative;
- clip duration is positive;
- clip end does not violate project duration rules;
- speed is finite and greater than zero;
- source offset is inside the source motion or audio;
- incompatible overlapping clips are rejected or resolved explicitly;
- camera coverage does not contain invalid gaps when a camera track is required;
- stale project patches do not apply against a changed revision.

## 7. Transition analysis

For adjacent motion clips, compare the outgoing end pose and incoming start pose.

Initial metrics:

- root position delta;
- root orientation delta;
- major joint quaternion angle delta;
- wrist and ankle world-position delta;
- body-height delta.

Example output:

```text
Transition: idle-01 → wave-03
Root position delta: 0.03 m
Right wrist delta: 0.41 m
Upper-body rotation delta: 18°
Recommended crossfade: 0.45 s
Status: warning — visible right-arm pop is possible
```

Possible responses:

- increase crossfade;
- insert a neutral transition;
- select another motion;
- permit the user to accept the warning.

## 8. Fixed-step simulation

Motion quality checks should evaluate a controlled time sequence, not depend on the user's preview frame rate.

```ts
for (let frame = 0; frame <= sampleFrameCount; frame += 1) {
  const time = frame / sampleFps;
  timeline.evaluate(time);
  runtime.setTime(time);
  physics.step(1 / sampleFps);
  collectMetrics();
}
```

Draft validation may sample at a lower rate. Final validation may use the actual export frame rate.

## 9. Ground and foot checks

### 9.1 Ground penetration

Compare foot, ankle, and selected body points with the ground plane.

- small negative tolerance may be allowed for model variation;
- sustained or severe penetration is a warning or error;
- isolated physics spikes should be reported separately.

### 9.2 Floating

When both feet remain significantly above the expected ground without a jumping/flying motion tag, report a warning.

### 9.3 Foot sliding

A basic heuristic:

1. estimate foot-contact intervals from ankle/foot height and vertical velocity;
2. during contact, measure horizontal world movement;
3. compare movement with configured thresholds;
4. report total slide distance and worst interval.

Example:

```text
Left foot contact: 2.10–2.82 s
Horizontal movement while planted: 0.032 m
Warning threshold: 0.050 m
Status: pass
```

The first release may report foot sliding without automatically repairing it.

## 10. Joint-range and motion smoothness checks

Initial checks:

- implausible elbow or knee reversal;
- extreme neck rotation;
- non-finite transforms;
- sudden position or rotation discontinuity;
- excessive velocity, acceleration, or jerk;
- physics body explosion or extreme displacement.

Thresholds must be configurable and tuned against test fixtures. They should not be presented as universal anatomical truth.

## 11. Camera and framing checks

At selected sample times:

- actor bounding box intersects the camera frustum;
- head is not unintentionally cropped;
- important hand motion remains visible when the motion metadata marks it as important;
- actor is not completely obscured;
- camera is not inside model geometry where detectable;
- camera speed and rotation do not exceed preset limits;
- vertical-video safe margins are respected.

Example diagnostics:

```text
✓ Actor visible for 100% of sampled frames
△ Right wrist outside safe frame in 8% of sampled frames
✓ Head remains inside vertical safe margin
△ Camera angular velocity exceeds comfortable preset at 6.2 s
```

## 12. Semantic correctness

The first MVP does not attempt to prove semantics from raw animation alone.

Primary semantic source:

- user-verified motion metadata;
- curated tags;
- emotion, energy, movement, and prop requirements;
- start/end pose notes.

AI selects from this metadata. The validator confirms that the selected motion satisfies requested tags and constraints as recorded.

Future optional layers:

- automatic motion-feature extraction;
- low-resolution preview frames reviewed by a multimodal model;
- user feedback used to improve motion metadata.

A vision-model review is advisory and must not replace deterministic checks or user confirmation.

## 13. Validation report

```ts
interface ValidationReport {
  status: "pass" | "pass-with-warnings" | "blocked";
  errors: ValidationDiagnostic[];
  warnings: ValidationDiagnostic[];
  information: ValidationDiagnostic[];
  metrics: Record<string, number | string | boolean>;
}

interface ValidationDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  actorId?: ActorId;
  motionId?: MotionId;
  clipId?: ClipId;
  timeRange?: [number, number];
  suggestedActions?: SuggestedAction[];
}
```

The UI should show concise status first, with expandable technical detail.

## 14. Suggested actions

Diagnostics may offer controlled actions:

- increase crossfade;
- replace motion;
- disable physics;
- reset actor to ground;
- switch camera preset;
- reduce motion speed;
- import a missing morph/motion alternative;
- continue with warning;
- block export until fixed.

No automatic action should silently modify the project without recording a normal project operation.

## 15. MVP acceptance examples

A valid report can read:

```text
✓ Project schema valid
✓ All referenced files available
✓ Required major bones compatible
✓ Expression morph available
✓ No blocking timeline conflict
△ Transition into wave may be abrupt
△ Right hand approaches frame edge
✓ Export profile supported

Status: pass with warnings — review preview before export
```

The application must not display “AI confirmed the motion is correct.”

Preferred wording:

> Automated checks passed. Review the preview before final export.
