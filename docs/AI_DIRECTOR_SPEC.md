# Our Stage AI Director Specification

## 1. Role of the AI Director

The AI Director assists with composition. It does not replace the deterministic editor or animation runtime.

Its responsibilities are:

- understand the user's requested performance;
- select from motions, expressions, camera presets, and render presets that actually exist;
- propose a structured project patch;
- revise an existing composition through targeted operations;
- explain missing capabilities and offer controlled fallbacks.

It is not responsible for:

- creating arbitrary PMX models;
- directly editing Three.js objects;
- emitting executable JavaScript;
- inventing asset IDs;
- declaring motion quality without validation;
- directly generating full VMD bone data in v0.1.0.

## 2. Provider abstraction

```ts
interface AiDirectorProvider {
  createComposition(input: CreateCompositionInput): Promise<ProjectPatch>;
  reviseComposition(input: ReviseCompositionInput): Promise<ProjectPatch>;
}
```

Initial implementations:

- `MockProvider` — deterministic fixtures for development and tests;
- `DeepSeekProvider` — optional cloud structured-output provider.

Future providers may include OpenAI, Gemini, or Ollama without changing editor behaviour.

## 3. Input contract

The AI receives a minimal structured context.

```ts
interface CreateCompositionInput {
  request: string;
  output: OutputSettings;
  actors: ActorCapabilitySummary[];
  candidateMotions: MotionCandidate[];
  cameraPresets: CameraPresetSummary[];
  renderPresets: RenderPresetSummary[];
  constraints: DirectorConstraints;
}
```

The AI does not require:

- PMX binary content;
- VMD binary content;
- texture files;
- absolute local paths;
- API keys;
- unrelated project files.

## 4. Motion retrieval before generation

The provider should not receive every motion when the library becomes large.

v0.1.0 retrieval order:

1. parse intent and required concepts;
2. filter by actor compatibility;
3. filter by duration, movement, loop, props, and required bones;
4. rank tags and descriptions with deterministic weighted search;
5. pass a limited candidate set to the language model;
6. require the final result to reference only candidate or explicitly supplied IDs.

Vector retrieval is deferred until metadata search becomes insufficient.

## 5. Output contract

```ts
interface ProjectPatch {
  patchId: string;
  baseProjectRevision: number;
  summary: string;
  operations: ProjectOperation[];
  assumptions?: string[];
  warnings?: string[];
}
```

Example:

```json
{
  "patchId": "patch-001",
  "baseProjectRevision": 4,
  "summary": "Create a ten-second walk-in and shy-wave composition.",
  "operations": [
    {
      "type": "add_motion_clip",
      "actorId": "actor-1",
      "trackId": "motion-track-1",
      "motionId": "walk-in-01",
      "startSeconds": 0,
      "durationSeconds": 4,
      "speed": 1
    },
    {
      "type": "add_motion_clip",
      "actorId": "actor-1",
      "trackId": "motion-track-1",
      "motionId": "shy-wave-02",
      "startSeconds": 4,
      "durationSeconds": 4,
      "speed": 0.9
    },
    {
      "type": "set_expression",
      "actorId": "actor-1",
      "morphName": "smile",
      "startSeconds": 4,
      "durationSeconds": 4,
      "weight": 0.8
    },
    {
      "type": "add_camera_shot",
      "trackId": "camera-track-1",
      "presetId": "medium-close-up",
      "startSeconds": 6,
      "durationSeconds": 4,
      "targetActorId": "actor-1"
    }
  ],
  "assumptions": [
    "The selected walk motion contains forward root movement."
  ],
  "warnings": []
}
```

## 6. Generation workflow

```text
User request
→ normalise request and constraints
→ retrieve compatible motion candidates
→ call provider with structured schema
→ parse output
→ validate all IDs and values
→ simulate operations on a project copy
→ run timeline and compatibility validators
→ show diff and diagnostics
→ user accepts or rejects
→ apply normal project operations
```

## 7. Revision workflow

The user may request:

- “Move the wave one second earlier.”
- “Keep the camera at a medium shot.”
- “Make the motion slower.”
- “Remove the rotating camera.”
- “Use a more energetic ending.”

Revision input includes:

- current project revision;
- selected or relevant clips;
- nearby timeline context;
- available replacement assets;
- the natural-language request.

The AI must produce targeted operations. It should not regenerate the entire project unless explicitly requested.

Example:

```json
{
  "operations": [
    {
      "type": "move_clip",
      "clipId": "wave-clip-1",
      "newStartSeconds": 3
    },
    {
      "type": "update_camera_shot",
      "clipId": "camera-clip-2",
      "presetId": "medium"
    }
  ]
}
```

## 8. Validation and repair

AI output is accepted only after:

1. JSON/schema validation;
2. base revision check;
3. referenced-ID validation;
4. operation-level validation;
5. application to an isolated project copy;
6. timeline validation;
7. compatibility validation;
8. camera/export validation where relevant.

One controlled repair attempt may be made when the output is structurally invalid. The repair request includes only the validation errors and original structured output.

Do not create an unbounded retry loop.

## 9. Missing capability behaviour

When the user requests an unavailable action, the system must not invent a motion.

Example request:

> Make the character sit down and drink coffee.

Available library lacks sitting and drinking motions.

Expected response data:

```json
{
  "status": "missing-capability",
  "missing": ["sit-down", "hold-cup", "drink"],
  "fallbacks": [
    "Use a standing hand-to-mouth gesture as an approximation.",
    "Import an appropriate VMD motion.",
    "Generate only the camera and expression portion."
  ]
}
```

The UI should let the user select a fallback rather than silently applying a poor approximation.

## 10. Cost and privacy controls

- `MockProvider` is the default in development.
- All non-AI editor features work without an API key.
- API keys are encrypted through Electron `safeStorage`.
- Keys are not written to project files or logs.
- Requests send metadata, not PMX/VMD binaries.
- Log token usage and estimated cost when the provider exposes it.
- Configure maximum request size, timeout, and retry count.
- Provide a per-provider enable/disable control.

## 11. Prompt design

The provider system prompt should state:

- use only supplied IDs;
- return only the requested structured schema;
- respect total duration and track constraints;
- prefer verified and compatible motions;
- do not claim unavailable capabilities;
- preserve existing project content unless the user asks to replace it;
- express uncertainty in `assumptions` or `warnings`;
- keep operations minimal for revision requests.

## 12. Human-in-the-loop requirements

Before a non-trivial AI patch is applied, the user should see:

- summary;
- added, removed, moved, and replaced clips;
- warnings and assumptions;
- validation status;
- Accept and Reject actions.

After application, normal undo must reverse the whole patch as one logical action.

## 13. AI evaluation

Maintain deterministic test fixtures for:

- simple one-actor composition;
- missing motion;
- invalid ID attempt;
- duration overflow;
- targeted revision;
- conflicting user request;
- provider timeout;
- malformed structured output;
- stale base revision.

Useful metrics:

- schema-valid response rate;
- unknown-ID rate;
- first-pass validation rate;
- number of operations changed by user;
- accepted versus rejected patches;
- missing-capability honesty;
- latency and cost.

## 14. Deferred AI capabilities

- text-to-motion model;
- video understanding of final animation;
- multi-agent director/critic workflow;
- LangGraph orchestration;
- embedding/vector motion retrieval;
- autonomous repeated repair;
- automatic dialogue/TTS/lip sync;
- multi-character spatial and contact planning.
