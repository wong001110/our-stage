import type { AnimationClip, SkinnedMesh } from 'three';
import 'three/addons/loaders/MMDLoader.js';

declare module 'three/addons/loaders/MMDLoader.js' {
  interface MMDLoader {
    loadAnimation(
      url: string,
      object: SkinnedMesh,
      onLoad: (animation: AnimationClip) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (error: unknown) => void,
    ): void;
  }
}
