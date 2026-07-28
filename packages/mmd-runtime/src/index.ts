import {
  AmbientLight,
  AxesHelper,
  Clock,
  Color,
  DirectionalLight,
  Euler,
  GridHelper,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SkinnedMesh,
  Vector3,
  WebGLRenderer,
} from 'three';
import { MMDAnimationHelper } from 'three/addons/animation/MMDAnimationHelper.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { MMDLoader } from 'three/addons/loaders/MMDLoader.js';

export type RuntimeQuality = 'draft' | 'preview' | 'final';
export type Vector3Tuple = [number, number, number];

export interface MotionProbe {
  fromTime: number;
  toTime: number;
  changedBones: number;
  maxPositionDelta: number;
  maxRotationDeltaRadians: number;
}

export interface MmdModelDiagnostics {
  name: string;
  bones: number;
  boneNames: string[];
  morphTargets: number;
  morphNames: string[];
  materials: number;
  meshes: number;
  physicsAvailable: boolean;
  renderer: string;
}

export interface MmdRuntimeState {
  modelLoaded: boolean;
  motionLoaded: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  diagnostics: MmdModelDiagnostics | null;
  motionProbe: MotionProbe | null;
  error: string | null;
}

export type RuntimeListener = (state: MmdRuntimeState) => void;

interface HelperObjectState {
  mixer?: {
    time: number;
    update: (delta: number) => void;
  };
  physics?: { reset: () => void };
}

interface BonePose {
  position: Vector3Tuple;
  quaternion: [number, number, number, number];
}

interface BoneOverrideBase {
  position: Vector3;
  quaternion: Quaternion;
}

export class ThreeMmdRuntime {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(35, 1, 0.1, 2000);
  readonly renderer: WebGLRenderer;

  private readonly effect: OutlineEffect;
  private readonly controls: OrbitControls;
  private readonly loader = new MMDLoader();
  private readonly helper = new MMDAnimationHelper({ afterglow: 0, pmxAnimation: true });
  private readonly clock = new Clock();
  private readonly listeners = new Set<RuntimeListener>();
  private readonly ambient: AmbientLight;
  private readonly key: DirectionalLight;
  private readonly fill: DirectionalLight;
  private readonly selectedBoneMarker = new AxesHelper(1.6);
  private readonly overrideBases = new Map<string, BoneOverrideBase>();

  private model: SkinnedMesh | null = null;
  private frameHandle: number | null = null;
  private loadedMotionId: string | null = null;
  private loadingMotionId: string | null = null;
  private loadingMotionPromise: Promise<void> | null = null;
  private fixedOutputSize: { width: number; height: number } | null = null;
  private selectedBoneName: string | null = null;
  private state: MmdRuntimeState = {
    modelLoaded: false,
    motionLoaded: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    diagnostics: null,
    motionProbe: null,
    error: null,
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.effect = new OutlineEffect(this.renderer, {
      defaultThickness: 0.0025,
      defaultColor: [0.08, 0.05, 0.12],
    });
    this.scene.background = new Color('#17131f');
    this.camera.position.set(0, 12, 34);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 10, 0);
    this.controls.enableDamping = true;

    this.ambient = new AmbientLight('#ffffff', 1.25);
    this.key = new DirectionalLight('#fff4fb', 2.4);
    this.key.position.set(8, 18, 14);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.fill = new DirectionalLight('#aa9cff', 0.8);
    this.fill.position.set(-10, 9, -4);

    this.selectedBoneMarker.visible = false;
    this.selectedBoneMarker.renderOrder = 20;
    this.scene.add(
      this.ambient,
      this.key,
      this.fill,
      new GridHelper(40, 40, '#554768', '#30283b'),
      this.selectedBoneMarker,
    );

    this.resize();
    this.animate = this.animate.bind(this);
    this.frameHandle = requestAnimationFrame(this.animate);
  }

  subscribe(listener: RuntimeListener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState() { return this.state; }
  getCanvas() { return this.canvas; }
  getLoadedMotionId() { return this.loadedMotionId; }
  getBoneNames() { return this.model?.skeleton.bones.map((bone) => bone.name) ?? []; }

  async loadModel(url: string, displayName = 'Imported PMX') {
    this.setState({ error: null, playing: false, motionProbe: null });
    try {
      const mesh = await new Promise<SkinnedMesh>((resolve, reject) =>
        this.loader.load(url, resolve, undefined, reject),
      );
      this.clearModel();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.traverse((object) => {
        const candidate = object as Object3D & {
          castShadow?: boolean;
          receiveShadow?: boolean;
        };
        candidate.castShadow = true;
        candidate.receiveShadow = true;
      });
      this.model = mesh;
      this.scene.add(mesh);
      this.helper.add(mesh, { physics: false });
      this.frameModel(mesh);
      this.loadedMotionId = null;
      this.setState({
        modelLoaded: true,
        motionLoaded: false,
        currentTime: 0,
        duration: 0,
        diagnostics: this.inspectModel(mesh, displayName),
        motionProbe: null,
      });
      this.updateSelectedBoneMarker();
    } catch (error) {
      this.setState({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async loadMotion(url: string, motionId = url) {
    if (!this.model) throw new Error('Load a PMX model before loading a VMD motion.');
    if (this.loadedMotionId === motionId && this.state.motionLoaded) return;
    if (this.loadingMotionId === motionId && this.loadingMotionPromise) {
      return this.loadingMotionPromise;
    }
    if (this.loadingMotionPromise) await this.loadingMotionPromise.catch(() => undefined);
    if (this.loadedMotionId === motionId && this.state.motionLoaded) return;

    const task = this.performMotionLoad(url, motionId);
    this.loadingMotionId = motionId;
    this.loadingMotionPromise = task;
    try {
      await task;
    } finally {
      if (this.loadingMotionPromise === task) {
        this.loadingMotionId = null;
        this.loadingMotionPromise = null;
      }
    }
  }

  private async performMotionLoad(url: string, motionId: string) {
    if (!this.model) throw new Error('Load a PMX model before loading a VMD motion.');
    try {
      const target = this.model;
      const animation = await new Promise<import('three').AnimationClip>((resolve, reject) =>
        this.loader.loadAnimation(url, target, resolve, undefined, reject),
      );
      if (this.model !== target) return;

      this.clearPoseOverrides();
      this.helper.remove(target);
      this.helper.add(target, { animation, physics: false });
      this.loadedMotionId = motionId;
      this.setState({
        motionLoaded: true,
        duration: animation.duration,
        currentTime: 0,
        motionProbe: null,
        error: null,
      });

      this.seek(0);
      const probeTime = Math.min(animation.duration, 5 / 30);
      const motionProbe = probeTime > 0 ? this.probeMotion(0, probeTime) : null;
      this.setState({ currentTime: 0, motionProbe });
    } catch (error) {
      this.loadedMotionId = null;
      this.setState({
        motionLoaded: false,
        motionProbe: null,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  play() {
    if (!this.state.motionLoaded) return;
    this.clock.start();
    this.setState({ playing: true });
  }

  pause() {
    this.clock.stop();
    this.setState({ playing: false });
  }

  seek(seconds: number) {
    const duration = this.state.duration || Number.POSITIVE_INFINITY;
    const time = Math.max(0, Math.min(seconds, duration));
    const objectState = this.model ? this.getHelperObject(this.model) : undefined;
    const mixer = objectState?.mixer;

    if (mixer) {
      const delta = time - mixer.time;
      this.helper.update(delta);
    }

    this.setState({ currentTime: time });
    this.renderNow();
  }

  probeMotion(fromTime: number, toTime: number): MotionProbe {
    if (!this.model || !this.state.motionLoaded) {
      return {
        fromTime,
        toTime,
        changedBones: 0,
        maxPositionDelta: 0,
        maxRotationDeltaRadians: 0,
      };
    }

    this.clearPoseOverrides();
    const originalTime = this.state.currentTime;
    this.seek(fromTime);
    const before = this.captureBonePose();
    this.seek(toTime);
    const after = this.captureBonePose();

    let changedBones = 0;
    let maxPositionDelta = 0;
    let maxRotationDeltaRadians = 0;
    for (let index = 0; index < Math.min(before.length, after.length); index += 1) {
      const first = before[index];
      const second = after[index];
      if (!first || !second) continue;
      const dx = second.position[0] - first.position[0];
      const dy = second.position[1] - first.position[1];
      const dz = second.position[2] - first.position[2];
      const positionDelta = Math.hypot(dx, dy, dz);
      const dot = Math.min(1, Math.abs(
        first.quaternion[0] * second.quaternion[0]
        + first.quaternion[1] * second.quaternion[1]
        + first.quaternion[2] * second.quaternion[2]
        + first.quaternion[3] * second.quaternion[3],
      ));
      const rotationDelta = 2 * Math.acos(dot);
      maxPositionDelta = Math.max(maxPositionDelta, positionDelta);
      maxRotationDeltaRadians = Math.max(maxRotationDeltaRadians, rotationDelta);
      if (positionDelta > 1e-4 || rotationDelta > 1e-4) changedBones += 1;
    }

    this.seek(originalTime);
    return {
      fromTime,
      toTime,
      changedBones,
      maxPositionDelta,
      maxRotationDeltaRadians,
    };
  }

  reset() {
    this.pause();
    this.clearPoseOverrides();
    this.getHelperObject(this.model)?.physics?.reset();
    this.seek(0);
  }

  setMorph(name: string, weight: number) {
    if (!this.model) return;
    const index = (this.model.morphTargetDictionary ?? {})[name];
    if (index === undefined || !this.model.morphTargetInfluences) return;
    this.model.morphTargetInfluences[index] = Math.min(1, Math.max(0, weight));
  }

  resetMorphs() { this.model?.morphTargetInfluences?.fill(0); }

  setActorTransform(transform: {
    position: Vector3Tuple;
    rotationEuler: Vector3Tuple;
    scale: Vector3Tuple;
  }) {
    if (!this.model) return;
    this.model.position.set(...transform.position);
    this.model.rotation.set(...transform.rotationEuler);
    this.model.scale.set(...transform.scale);
    this.model.updateMatrixWorld(true);
  }

  /** Restore the last unmodified VMD pose before evaluating another frame. */
  clearPoseOverrides() {
    if (!this.model || this.overrideBases.size === 0) {
      this.overrideBases.clear();
      return;
    }
    for (const bone of this.model.skeleton.bones) {
      const base = this.overrideBases.get(bone.name);
      if (!base) continue;
      bone.position.copy(base.position);
      bone.quaternion.copy(base.quaternion);
    }
    this.overrideBases.clear();
    this.model.updateMatrixWorld(true);
  }

  /** Capture the current VMD-evaluated local pose as the additive override base. */
  beginPoseOverrides() {
    this.overrideBases.clear();
    if (!this.model) return;
    for (const bone of this.model.skeleton.bones) {
      this.overrideBases.set(bone.name, {
        position: bone.position.clone(),
        quaternion: bone.quaternion.clone(),
      });
    }
  }

  applyBoneOverride(
    boneName: string,
    rotationEulerOffset: Vector3Tuple,
    positionOffset: Vector3Tuple,
  ): boolean {
    if (!this.model) return false;
    const bone = this.model.skeleton.bones.find((item) => item.name === boneName);
    if (!bone) return false;
    const base = this.overrideBases.get(boneName) ?? {
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
    };
    if (!this.overrideBases.has(boneName)) this.overrideBases.set(boneName, base);

    bone.position.copy(base.position).add(new Vector3(...positionOffset));
    const offset = new Quaternion().setFromEuler(new Euler(
      rotationEulerOffset[0],
      rotationEulerOffset[1],
      rotationEulerOffset[2],
      'XYZ',
    ));
    bone.quaternion.copy(base.quaternion).multiply(offset).normalize();
    bone.updateMatrix();
    this.model.updateMatrixWorld(true);
    this.updateSelectedBoneMarker();
    return true;
  }

  setSelectedBone(boneName: string | null) {
    this.selectedBoneName = boneName;
    this.updateSelectedBoneMarker();
  }

  applyCameraPreset(presetId: string) {
    const presets: Record<string, {
      position: Vector3Tuple;
      target: Vector3Tuple;
      fov: number;
    }> = {
      wide: { position: [0, 12, 44], target: [0, 9, 0], fov: 40 },
      'full-body': { position: [0, 11, 31], target: [0, 9, 0], fov: 35 },
      medium: { position: [0, 13, 23], target: [0, 12, 0], fov: 32 },
      'close-up': { position: [0, 15, 14], target: [0, 15, 0], fov: 28 },
    };
    const preset = presets[presetId] ?? presets.medium;
    if (!preset) return;
    this.camera.position.set(...preset.position);
    this.camera.fov = preset.fov;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(...preset.target);
    this.controls.update();
  }

  applyRenderPreset(presetId: string) {
    const presets = {
      'classic-mmd': {
        background: '#e9e6ee', ambient: 1.45, key: '#ffffff',
        keyIntensity: 1.9, fill: '#d8d0ff', fillIntensity: 0.35, exposure: 1,
      },
      'soft-our-series': {
        background: '#17131f', ambient: 1.25, key: '#fff4fb',
        keyIntensity: 2.4, fill: '#aa9cff', fillIntensity: 0.8, exposure: 1.05,
      },
      'cyan-magenta-outline': {
        background: '#0c1320', ambient: 1.05, key: '#ff88c7',
        keyIntensity: 2.25, fill: '#6ce7ff', fillIntensity: 1.4, exposure: 1.12,
      },
    } as const;
    const preset = presets[presetId as keyof typeof presets] ?? presets['soft-our-series'];
    this.scene.background = new Color(preset.background);
    this.ambient.intensity = preset.ambient;
    this.key.color.set(preset.key);
    this.key.intensity = preset.keyIntensity;
    this.fill.color.set(preset.fill);
    this.fill.intensity = preset.fillIntensity;
    this.renderer.toneMappingExposure = preset.exposure;
  }

  setQuality(quality: RuntimeQuality) {
    const ratio = quality === 'draft'
      ? 0.75
      : quality === 'preview'
        ? 1
        : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(ratio);
    this.resize(true);
  }

  setOutputSize(width: number, height: number) {
    this.fixedOutputSize = {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
    this.renderer.setPixelRatio(1);
    this.resize(true);
  }

  clearOutputSize() {
    this.fixedOutputSize = null;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.resize(true);
  }

  renderNow() {
    this.updateSelectedBoneMarker();
    this.controls.update();
    this.effect.render(this.scene, this.camera);
  }

  dispose() {
    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
    this.clearModel();
    this.controls.dispose();
    this.renderer.dispose();
    this.listeners.clear();
  }

  private animate() {
    this.frameHandle = requestAnimationFrame(this.animate);
    this.resize();
    if (this.state.playing) {
      const delta = Math.min(this.clock.getDelta(), 0.1);
      const next = this.state.currentTime + delta;
      if (this.state.duration > 0 && next >= this.state.duration) this.seek(0);
      else {
        this.clearPoseOverrides();
        this.helper.update(delta);
        this.setState({ currentTime: next });
      }
    }
    this.renderNow();
  }

  private captureBonePose(): BonePose[] {
    return this.model?.skeleton.bones.map((bone) => ({
      position: [bone.position.x, bone.position.y, bone.position.z],
      quaternion: [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w],
    })) ?? [];
  }

  private updateSelectedBoneMarker() {
    const bone = this.model && this.selectedBoneName
      ? this.model.skeleton.bones.find((item) => item.name === this.selectedBoneName)
      : null;
    if (!bone) {
      this.selectedBoneMarker.visible = false;
      return;
    }
    const worldPosition = new Vector3();
    const worldQuaternion = new Quaternion();
    bone.getWorldPosition(worldPosition);
    bone.getWorldQuaternion(worldQuaternion);
    this.selectedBoneMarker.position.copy(worldPosition);
    this.selectedBoneMarker.quaternion.copy(worldQuaternion);
    this.selectedBoneMarker.visible = true;
  }

  private resize(force = false) {
    const width = this.fixedOutputSize?.width ?? Math.max(1, this.canvas.clientWidth);
    const height = this.fixedOutputSize?.height ?? Math.max(1, this.canvas.clientHeight);
    if (force || this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  private clearModel() {
    if (!this.model) return;
    this.clearPoseOverrides();
    this.helper.remove(this.model);
    this.scene.remove(this.model);
    this.model.traverse((object) => {
      const resource = object as Object3D & {
        geometry?: { dispose: () => void };
        material?: { dispose: () => void } | Array<{ dispose: () => void }>;
      };
      resource.geometry?.dispose();
      if (Array.isArray(resource.material)) {
        resource.material.forEach((material) => material.dispose());
      } else {
        resource.material?.dispose();
      }
    });
    this.model = null;
    this.loadedMotionId = null;
    this.loadingMotionId = null;
    this.loadingMotionPromise = null;
    this.selectedBoneMarker.visible = false;
    this.overrideBases.clear();
  }

  private frameModel(model: Object3D) {
    const center = new Vector3();
    model.getWorldPosition(center);
    this.controls.target.set(center.x, center.y + 10, center.z);
    this.camera.position.set(center.x, center.y + 12, center.z + 34);
    this.controls.update();
  }

  private inspectModel(model: Object3D, name: string): MmdModelDiagnostics {
    let meshes = 0;
    let materials = 0;
    model.traverse((object) => {
      const mesh = object as Object3D & { isMesh?: boolean; material?: unknown | unknown[] };
      if (mesh.isMesh) {
        meshes += 1;
        materials += Array.isArray(mesh.material) ? mesh.material.length : mesh.material ? 1 : 0;
      }
    });
    const skinned = model as Object3D & {
      skeleton?: { bones: Object3D[] };
      morphTargetDictionary?: Record<string, number>;
    };
    const context = this.renderer.getContext();
    const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo
      ? String(context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : 'WebGL renderer';
    return {
      name,
      bones: skinned.skeleton?.bones.length ?? 0,
      boneNames: skinned.skeleton?.bones.map((bone) => bone.name) ?? [],
      morphTargets: Object.keys(skinned.morphTargetDictionary ?? {}).length,
      morphNames: Object.keys(skinned.morphTargetDictionary ?? {}),
      materials,
      meshes,
      physicsAvailable: false,
      renderer,
    };
  }

  private getHelperObject(model: SkinnedMesh | null) {
    if (!model) return undefined;
    return (this.helper as unknown as {
      objects: WeakMap<SkinnedMesh, HelperObjectState>;
    }).objects.get(model);
  }

  private setState(patch: Partial<MmdRuntimeState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
}

export class DeterministicFrameClock {
  constructor(readonly fps: number) {
    if (!Number.isFinite(fps) || fps <= 0) throw new Error('FPS must be positive.');
  }

  timeAt(frameIndex: number) {
    if (!Number.isInteger(frameIndex) || frameIndex < 0) {
      throw new Error('Frame index must be a non-negative integer.');
    }
    return frameIndex / this.fps;
  }

  frameCount(durationSeconds: number) {
    return Math.ceil(durationSeconds * this.fps);
  }
}
