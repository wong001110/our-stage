import type { ThreeMmdRuntime } from '@our-stage/mmd-runtime';

let activeRuntime: ThreeMmdRuntime | null = null;

export function registerActiveRuntime(runtime: ThreeMmdRuntime | null): void {
  activeRuntime = runtime;
}

export function getActiveRuntime(): ThreeMmdRuntime | null {
  return activeRuntime;
}
