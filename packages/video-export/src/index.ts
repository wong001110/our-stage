import type { OutputSettings } from '@our-stage/project-schema';

export interface FramePlan {
  fps: number;
  frameCount: number;
  durationSeconds: number;
  timeAt(frameIndex: number): number;
}

export function createFramePlan(output: OutputSettings): FramePlan {
  const frameCount = Math.ceil(output.durationSeconds * output.fps);
  return {
    fps: output.fps,
    frameCount,
    durationSeconds: output.durationSeconds,
    timeAt(frameIndex: number) {
      if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= frameCount) {
        throw new Error(`Frame index ${frameIndex} is outside the export plan.`);
      }
      return frameIndex / output.fps;
    },
  };
}

export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('Canvas PNG encoding failed.'));
    }, 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}
