import { describe, expect, it } from 'vitest';
import { DeterministicFrameClock } from './index';

describe('DeterministicFrameClock', () => {
  it('maps frames to exact timeline time', () => {
    const clock = new DeterministicFrameClock(30);
    expect(clock.timeAt(30)).toBe(1);
    expect(clock.frameCount(10)).toBe(300);
  });
});
