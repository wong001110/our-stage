import {
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  GridHelper,
  Object3D,
  PerspectiveCamera,
  SkinnedMesh,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { MMDAnimationHelper } from 'three/addons/animation/MMDAnimationHelper.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { MMDLoader } from 'three/addons/loaders/MMDLoader.js';

export type RuntimeQuality = 'draft' | 'preview' | 'final';

export interface MmdModelDiagnostics {
  name: string;
  bones: number;
  morphTargets: number;
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
  error: string | null;
}

export type RuntimeListener = (state: MmdRuntimeState) => void;

interface HelperObjectState {
  mixer?: { setTime: (time: number) => void; update: (delta: number) => void };
  physics?: { reset: () => void };
}

export class ThreeMmdRuntime {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(35, 1, 0.1, 2000);
  readonly renderer: WebGLRenderer;

  private readonly effect: OutlineEffect;
  private readonly controls: OrbitControls;
  private readonly loader = new MMDLoader();
  private readonly helper = new MMDAnimationHelper({ afterglow: 0.0 });
  private readonly clock = new Clock();
  private readonly listeners = new Set<RuntimeListener>();
  private model: SkinnedMesh | null = null;
  private frameHandle: number | null = null;
  private state: MmdRuntimeState = {
    modelLoaded: false,
    motionLoaded: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    diagnostics: null,
    error: null,
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.effect = new OutlineEffect(this.renderer, { defaultThickness: 0.0025, defaultColor: [0.08, 0.05, 0.12] });

    this.scene.background = new Color('#17131f');
    this.camera.position.set(0, 12, 34);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 10, 0);
    this.controls.enableDamping = true;

    const ambient = new AmbientLight('#ffffff', 1.25);
    const key = new DirectionalLight('#fff4fb', 2.4);
    key.position.set(8, 18, 14);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const fill = new DirectionalLight('#aa9cff', 0.8);
    fill.position.set(-10, 9, -4);
    const grid = new GridHelper(40, 40, '#554768', '#30283b');
    this.scene.add(ambient, key, fill, grid);

    this.resize();
    this.animate = this.animate.bind(this);
    this.frameHandle = requestAnimationFrame(this.animate);
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): MmdRuntimeState {
    return this.state;
  }

  async loadModel(url: string, displayName = 'Imported PMX'): Promise<void> {
    this.setState({ error: null, playing: false });
    try {
      const mesh = await new Promise<SkinnedMesh>((resolve, reject) => {
        this.loader.load(url, resolve, undefined, reject);
      });
      this.clearModel();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.traverse((object) => {
        const candidate = object as Object3D & { castShadow?: boolean; receiveShadow?: boolean };
        candidate.castShadow = true;
        candidate.receiveShadow = true;
      });
      this.model = mesh;
      this.scene.add(mesh);
      this.helper.add(mesh, { animation: undefined, physics: false });
      this.frameModel(mesh);
      this.setState({
        modelLoaded: true,
        motionLoaded: false,
        currentTime: 0,
        duration: 0,
        diagnostics: this.inspectModel(mesh, displayName),
      });
    } catch (error) {
      this.setState({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async loadMotion(url: string): Promise<void> {
    if (!this.model) throw new Error('Load a PMX model before loading a VMD motion.');
    try {
      const animation = await new Promise<import('three').AnimationClip>((resolve, reject) => {
        this.loader.loadAnimation(url, this.model as SkinnedMesh, resolve, undefined, reject);
      });
      this.helper.remove(this.model);
      this.helper.add(this.model, { animation, physics: false });
      this.setState({ motionLoaded: true, duration: animation.duration, currentTime: 0, error: null });
      this.seek(0);
    } catch (error) {
      this.setState({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  play(): void {
    if (!this.state.motionLoaded) return;
    this.clock.start();
    this.setState({ playing: true });
  }

  pause(): void {
    this.clock.stop();
    this.setState({ playing: false });
  }

  seek(seconds: number): void {
    const duration = this.state.duration || Number.POSITIVE_INFINITY;
    const time = Math.max(0, Math.min(seconds, duration));
    const objectState = this.model ? this.getHelperObject(this.model) : undefined;
    objectState?.mixer?.setTime(time);
    this.helper.update(0);
    this.setState({ currentTime: time });
    this.render();
  }

  reset(): void {
    this.pause();
    this.getHelperObject(this.model)?.physics?.reset();
    this.seek(0);
  }

  setQuality(quality: RuntimeQuality): void {
    const ratio = quality === 'draft' ? 0.75 : quality === 'preview' ? 1 : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(ratio);
    this.resize();
  }

  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  captureDataUrl(type: 'image/png' | 'image/jpeg' = 'image/png'): string {
    this.render();
    return this.canvas.toDataURL(type);
  }

  dispose(): void {
    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
    this.clearModel();
    this.controls.dispose();
    this.renderer.dispose();
    this.listeners.clear();
  }

  private animate(): void {
    this.frameHandle = requestAnimationFrame(this.animate);
    this.resize();
    if (this.state.playing) {
      const delta = Math.min(this.clock.getDelta(), 1 / 10);
      const next = this.state.currentTime + delta;
      if (this.state.duration > 0 && next >= this.state.duration) this.seek(0);
      else {
        this.helper.update(delta);
        this.setState({ currentTime: next });
      }
    }
    this.controls.update();
    this.render();
  }

  private render(): void {
    this.effect.render(this.scene, this.camera);
  }

  private clearModel(): void {
    if (!this.model) return;
    this.helper.remove(this.model);
    this.scene.remove(this.model);
    this.model.traverse((object) => {
      const resource = object as Object3D & { geometry?: { dispose: () => void }; material?: { dispose: () => void } | Array<{ dispose: () => void }> };
      resource.geometry?.dispose();
      if (Array.isArray(resource.material)) resource.material.forEach((material) => material.dispose());
      else resource.material?.dispose();
    });
    this.model = null;
  }

  private frameModel(model: Object3D): void {
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
    const skinned = model as Object3D & { skeleton?: { bones: Object3D[] }; morphTargetDictionary?: Record<string, number> };
    const context = this.renderer.getContext();
    const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ? String(context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : 'WebGL renderer';
    return {
      name,
      bones: skinned.skeleton?.bones.length ?? 0,
      morphTargets: Object.keys(skinned.morphTargetDictionary ?? {}).length,
      materials,
      meshes,
      physicsAvailable: false,
      renderer,
    };
  }

  private getHelperObject(model: SkinnedMesh | null): HelperObjectState | undefined {
    if (!model) return undefined;
    const helper = this.helper as unknown as { objects: WeakMap<SkinnedMesh, HelperObjectState> };
    return helper.objects.get(model);
  }

  private setState(patch: Partial<MmdRuntimeState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
}

export class DeterministicFrameClock {
  constructor(readonly fps: number) {
    if (!Number.isFinite(fps) || fps <= 0) throw new Error('FPS must be positive.');
  }

  timeAt(frameIndex: number): number {
    if (!Number.isInteger(frameIndex) || frameIndex < 0) throw new Error('Frame index must be a non-negative integer.');
    return frameIndex / this.fps;
  }

  frameCount(durationSeconds: number): number {
    return Math.ceil(durationSeconds * this.fps);
  }
}
