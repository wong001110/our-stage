import { KeyRound, RotateCcw, Save, Trash2, XCircle } from 'lucide-react';
import type { BoneOverrideClip, Vector3Tuple } from '@our-stage/project-schema';
import { useProjectStore, type BoneOverrideDraft } from '../store/projectStore';

const radiansToDegrees = (value: number) => Math.round((value * 180 / Math.PI) * 10) / 10;
const degreesToRadians = (value: number) => value * Math.PI / 180;

const COMMON_BONES: readonly string[] = [
  '頭', '首', '上半身2', '上半身', '下半身', '右肩', '右腕', '右ひじ', '右手首',
  '左肩', '左腕', '左ひじ', '左手首', '右足', '右ひざ', '右足首', '左足', '左ひざ',
  '左足首', 'センター', 'グルーブ', '全ての親',
];

type Axis = 0 | 1 | 2;

function updateVector(vector: Vector3Tuple, axis: Axis, value: number): Vector3Tuple {
  const next: Vector3Tuple = [...vector];
  next[axis] = Number.isFinite(value) ? value : 0;
  return next;
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
}) {
  return (
    <label className="bone-number-field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function BoneOverrideEditor() {
  const project = useProjectStore((state) => state.project);
  const selectedActorId = useProjectStore((state) => state.selectedActorId);
  const selectedBoneName = useProjectStore((state) => state.selectedBoneName);
  const availableBoneNames = useProjectStore((state) => state.availableBoneNames);
  const preview = useProjectStore((state) => state.boneOverridePreview);
  const currentTime = useProjectStore((state) => state.currentTime);
  const timelinePlaying = useProjectStore((state) => state.timelinePlaying);
  const selectBone = useProjectStore((state) => state.selectBone);
  const setPreview = useProjectStore((state) => state.setBoneOverridePreview);
  const addKeyframe = useProjectStore((state) => state.addOrUpdateBoneOverrideKeyframe);
  const deleteKeyframe = useProjectStore((state) => state.deleteBoneOverrideKeyframe);
  const resetBone = useProjectStore((state) => state.resetSelectedBoneOverrides);
  const resetAll = useProjectStore((state) => state.resetAllBoneOverrides);

  const actor = project.actors.find((item) => item.actorId === selectedActorId) ?? project.actors[0];
  const track = project.tracks.find(
    (item) => item.type === 'bone-override' && item.actorId === actor?.actorId,
  );
  const keyframes = track?.clips.filter(
    (clip) => clip.type === 'bone-override' && clip.boneName === selectedBoneName,
  ) as BoneOverrideClip[] | undefined;
  const exactKeyframe = keyframes?.find(
    (clip) => Math.abs(clip.startSeconds - currentTime) <= 0.5 / project.output.fps,
  );

  const orderedBones = [
    ...COMMON_BONES.filter((name) => availableBoneNames.includes(name)),
    ...availableBoneNames.filter((name) => !COMMON_BONES.includes(name)),
  ];

  const draft: BoneOverrideDraft | null = actor && selectedBoneName
    ? preview ?? {
        actorId: actor.actorId,
        boneName: selectedBoneName,
        rotationEulerOffset: [0, 0, 0],
        positionOffset: [0, 0, 0],
        interpolation: 'smooth',
      }
    : null;

  const patchDraft = (patch: Partial<BoneOverrideDraft>) => {
    if (!draft) return;
    setPreview({ ...draft, ...patch });
  };

  const updateRotation = (axis: Axis, degrees: number) => {
    if (!draft) return;
    patchDraft({
      rotationEulerOffset: updateVector(
        draft.rotationEulerOffset,
        axis,
        degreesToRadians(Math.max(-180, Math.min(180, degrees))),
      ),
    });
  };

  const updatePosition = (axis: Axis, value: number) => {
    if (!draft) return;
    patchDraft({
      positionOffset: updateVector(
        draft.positionOffset,
        axis,
        Math.max(-10, Math.min(10, value)),
      ),
    });
  };

  return (
    <section className="bone-editor">
      <div className="bone-editor-heading">
        <span><KeyRound size={14} /><strong>Pose Override</strong></span>
        <small>{currentTime.toFixed(2)}s</small>
      </div>

      {!actor ? (
        <p>Import a PMX actor before editing its pose.</p>
      ) : availableBoneNames.length === 0 ? (
        <p>Wait for the PMX skeleton to finish loading.</p>
      ) : (
        <>
          <label className="bone-select-label">
            <span>Bone</span>
            <select
              value={selectedBoneName ?? ''}
              onChange={(event) => selectBone(event.target.value || null)}
            >
              <option value="">Select bone…</option>
              {orderedBones.map((name) => <option value={name} key={name}>{name}</option>)}
            </select>
          </label>

          {draft && (
            <>
              <div className="bone-field-section">
                <div className="bone-field-title"><span>Rotation offset</span><small>degrees</small></div>
                <div className="bone-field-grid">
                  {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                    <NumberField
                      key={axis}
                      label={axis}
                      value={radiansToDegrees(draft.rotationEulerOffset[index] ?? 0)}
                      min={-180}
                      max={180}
                      step={1}
                      onChange={(value) => updateRotation(index as Axis, value)}
                    />
                  ))}
                </div>
              </div>

              <div className="bone-field-section">
                <div className="bone-field-title"><span>Position offset</span><small>model units</small></div>
                <div className="bone-field-grid">
                  {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                    <NumberField
                      key={axis}
                      label={axis}
                      value={draft.positionOffset[index] ?? 0}
                      min={-10}
                      max={10}
                      step={0.05}
                      onChange={(value) => updatePosition(index as Axis, value)}
                    />
                  ))}
                </div>
              </div>

              <label className="bone-select-label">
                <span>Interpolation</span>
                <select
                  value={draft.interpolation}
                  onChange={(event) => patchDraft({
                    interpolation: event.target.value as BoneOverrideClip['interpolation'],
                  })}
                >
                  <option value="smooth">Smooth</option>
                  <option value="linear">Linear</option>
                  <option value="step">Step</option>
                </select>
              </label>

              <div className="bone-editor-status">
                <span>{keyframes?.length ?? 0} keyframe(s) for {selectedBoneName}</span>
                <small>{exactKeyframe ? 'Keyframe at playhead' : 'Interpolated preview'}</small>
              </div>

              <div className="bone-editor-actions">
                <button type="button" className="accent" onClick={addKeyframe} disabled={timelinePlaying}>
                  <Save size={13} /> {exactKeyframe ? 'Update key' : 'Add key'}
                </button>
                <button type="button" onClick={deleteKeyframe} disabled={!exactKeyframe || timelinePlaying}>
                  <Trash2 size={13} /> Delete key
                </button>
                <button type="button" onClick={() => setPreview({
                  ...draft,
                  rotationEulerOffset: [0, 0, 0],
                  positionOffset: [0, 0, 0],
                })} disabled={timelinePlaying}>
                  <RotateCcw size={13} /> Zero preview
                </button>
              </div>

              <div className="bone-editor-reset-actions">
                <button type="button" onClick={resetBone}><XCircle size={12} /> Reset bone</button>
                <button type="button" onClick={resetAll}><XCircle size={12} /> Reset all overrides</button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
