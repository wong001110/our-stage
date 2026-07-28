import { describe, expect, it } from 'vitest';
import { createFramePlan } from '@our-stage/video-export';

describe('deterministic export frame plan', () => {
  it('creates exactly 300 frames for a ten-second 30 FPS video', () => {
    const plan = createFramePlan({ durationSeconds: 10, fps: 30, width: 720, height: 1280 });
    expect(plan.frameCount).toBe(300);
    expect(plan.timeAt(0)).toBe(0);
    expect(plan.timeAt(299)).toBeCloseTo(299 / 30);
  });

  it('rejects out-of-range frames', () => {
    const plan = createFramePlan({ durationSeconds: 1, fps: 30, width: 720, height: 1280 });
    expect(() => plan.timeAt(-1)).toThrow();
    expect(() => plan.timeAt(30)).toThrow();
  });
});
