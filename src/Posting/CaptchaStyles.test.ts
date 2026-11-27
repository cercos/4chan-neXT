// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isStripTask, pngSize } from './CaptchaStyles';

function fakePng(w: number, h: number): string {
  const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
    (w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255,
    (h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255, 8, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  return btoa(String.fromCharCode(...bytes));
}

describe('pngSize / isStripTask', () => {
  it('reads the size from a PNG header', () => {
    expect(pngSize(fakePng(300, 80))).toEqual({ w: 300, h: 80 });
  });
  it('tells wide strips from square tiles', () => {
    expect(isStripTask([fakePng(300, 80)])).toBe(true);
    expect(isStripTask([fakePng(80, 80)])).toBe(false);
  });
  it('is false for missing or non-PNG data', () => {
    expect(isStripTask(undefined)).toBe(false);
    expect(isStripTask([])).toBe(false);
    expect(isStripTask(['not base64 png data at all'])).toBe(false);
  });
});
