# Our Stage Development Workflow

## 1. Source-of-truth rule

`main` is the only authoritative branch.

Temporary phase branches exist only while a phase is under implementation. After acceptance and merge, both local and remote copies of that phase branch are deleted.

The repository does not use a permanent `develop` branch.

## 2. Phase workflow

Before starting a phase:

```bash
git checkout main
git pull --ff-only origin main
git status --short
```

The working tree must be understood and clean before creating the phase branch.

Create the branch:

```bash
git checkout -b phase/XX-name
```

During implementation:

- keep work limited to the active phase;
- update tests and documentation with the code;
- do not commit imported third-party assets;
- do not begin the next phase before the current acceptance checks pass;
- record any environment limitation that prevents a test from running.

Before commit:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Not every command exists in the empty repository. Phase 0 must establish them. Later phases must run all applicable checks.

Commit and push:

```bash
git add <explicit intended paths>
git commit -m "<phase commit message>"
git push -u origin phase/XX-name
```

Merge after acceptance:

```bash
git checkout main
git pull --ff-only origin main
git merge --ff-only phase/XX-name
git push origin main
```

Delete the completed branch:

```bash
git branch -d phase/XX-name
git push origin --delete phase/XX-name
```

Verify:

```bash
git branch --all
git status --short
git log --oneline --decorate -10
```

## 3. Phase commit messages

```text
Phase 0: chore: establish our stage repository foundation
Phase 1: feat: complete phase 1 mmd runtime proof
Phase 2: feat: complete phase 2 local asset and project system
Phase 3: feat: complete phase 3 deterministic timeline editor
Phase 4: feat: complete phase 4 deterministic video export
Phase 5: feat: complete phase 5 motion intelligence and validation
Phase 6: feat: complete phase 6 ai director v1
Phase 7: feat: complete our stage local mvp
```

A phase may contain intermediate local commits while being developed. The accepted history on `main` should remain understandable and may be squashed when appropriate.

## 4. Change ownership

Each phase should define:

- goal;
- in-scope requirements;
- explicit exclusions;
- files/modules expected to change;
- test plan;
- acceptance checklist;
- final commit message.

Unrelated refactors must not be silently included in a phase. Either defer them or record why they are required.

## 5. Implementation priority

Work follows dependency order:

```text
Engineering foundation
→ MMD runtime proof
→ local project/assets
→ deterministic timeline
→ deterministic export
→ validation
→ AI composition
→ AI revision and MVP hardening
```

Phase 4 is the main feasibility gate. Advanced AI and rendering polish should not overtake proof of deterministic export.

## 6. Definition of done for a phase

A phase is done only when:

- scope is implemented;
- acceptance criteria are demonstrated;
- automated tests pass where available;
- manual checks are recorded where automation is impractical;
- documentation matches the actual implementation;
- no secrets or third-party assets are included;
- the phase is committed and pushed;
- the accepted code is on `main`;
- the temporary branch is deleted;
- remaining known limitations are written down.

## 7. Validation evidence

The phase completion report should state:

```text
Phase:
Branch:
Commit:
Main commit after merge:
Checks run:
Manual validation:
Known limitations:
Environment limitations:
Branch deletion status:
```

Do not claim a check passed if it could not be executed.

## 8. Testing policy

### Unit tests

Required for deterministic logic:

- project schema;
- migrations;
- timeline evaluation;
- project operations;
- undo/redo;
- motion metadata;
- compatibility scoring;
- validation rules;
- AI patch parsing.

### Integration tests

Required for:

- Electron IPC;
- project persistence;
- controlled model/motion loading;
- FFmpeg execution;
- AI provider adapter with mock responses.

### End-to-end tests

Required for the final user path:

```text
open app
→ create project
→ import controlled assets
→ add or generate timeline
→ save and reopen
→ export video
→ verify output
```

### Manual checks

May be required for:

- visual quality;
- physics behaviour;
- GPU-specific rendering;
- real third-party model compatibility;
- subjective motion semantics.

Manual checks must use assets that are not committed unless redistribution rights are explicit.

## 9. Dependency policy

- Pin important rendering and MMD runtime versions.
- Avoid floating dependency ranges for compatibility-sensitive packages.
- Record why a package is introduced.
- Prefer small, replaceable adapters around unstable or specialised dependencies.
- Do not add cloud infrastructure dependencies to the local MVP without a documented requirement.
- Run regression fixtures before upgrading Electron, Three.js, the MMD loader, physics runtime, or FFmpeg.

## 10. Environment and secrets

- Keep `.env*` untracked except an optional `.env.example` without real values.
- Store runtime API keys through Electron `safeStorage`.
- Never hard-code provider keys.
- Test no-key behaviour with `MockProvider`.
- Do not commit local user-data paths.

## 11. Asset policy during development

Repository-safe test assets must satisfy one of:

- created specifically for the project;
- public-domain or equivalently unrestricted;
- explicit licence permits repository redistribution;
- synthetic fixture containing only the minimum format data required by tests.

Personal models, motions, textures, stages, music, and exported videos remain outside Git.

## 12. Issue and decision recording

Use documentation or issues for decisions that affect architecture or phase scope.

Create an ADR when a decision:

- affects multiple modules;
- is difficult to reverse;
- changes platform/runtime selection;
- introduces a new persistent data format;
- changes security boundaries;
- changes the AI responsibility boundary.

## 13. Release workflow for v0.1.0

After Phase 7:

1. verify all phase branches are deleted;
2. run complete local and CI checks;
3. build the Windows package;
4. run the installation and first-launch smoke test;
5. confirm README limitations and setup are accurate;
6. tag the accepted `main` commit:

```bash
git checkout main
git pull --ff-only origin main
git tag -a v0.1.0 -m "Our Stage local MVP"
git push origin v0.1.0
```

A public release should not include third-party creative assets or user credentials.

## 14. Agent execution requirements

When an AI coding agent implements a phase, its task brief must require it to:

- restate the phase scope before coding;
- inspect the existing repository rather than assume structure;
- preserve existing accepted behaviour;
- use sub-agents only when they improve execution quality;
- implement, test, commit, and push;
- report exact commit hash and checks;
- avoid claiming tests that did not run;
- merge into `main` only under the agreed workflow;
- delete the completed phase branch after merge;
- leave no old phase branch behind.
