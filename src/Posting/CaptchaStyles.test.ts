// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  CAPTCHA_STYLE_VALUES,
  applyCaptchaStyleClass,
  captchaNarration,
  isStripTask,
  normalizeCaptchaStyle,
  pngSize,
} from './CaptchaStyles';

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

describe('normalizeCaptchaStyle', () => {
  it('passes through every known style', () => {
    for (const style of CAPTCHA_STYLE_VALUES) {
      expect(normalizeCaptchaStyle(style)).toBe(style);
    }
  });

  it('falls back to the answer stack for unknown or missing values', () => {
    expect(normalizeCaptchaStyle('fancy')).toBe('stack');
    expect(normalizeCaptchaStyle('grid')).toBe('stack');
    expect(normalizeCaptchaStyle(undefined)).toBe('stack');
    expect(normalizeCaptchaStyle(null)).toBe('stack');
    expect(normalizeCaptchaStyle(42)).toBe('stack');
    expect(normalizeCaptchaStyle('')).toBe('stack');
  });
});

describe('applyCaptchaStyleClass', () => {
  it('adds the class for the given style', () => {
    const root = document.createElement('div');
    applyCaptchaStyleClass(root, 'dots');
    expect(root.classList.contains('fourchanx-captcha-style-dots')).toBe(true);
  });

  it('removes any previous style class when switching', () => {
    const root = document.createElement('div');
    applyCaptchaStyleClass(root, 'inline');
    applyCaptchaStyleClass(root, 'dots');
    expect(root.classList.contains('fourchanx-captcha-style-inline')).toBe(false);
    expect(root.classList.contains('fourchanx-captcha-style-dots')).toBe(true);
  });

  it('removes all style classes when style is null', () => {
    const root = document.createElement('div');
    applyCaptchaStyleClass(root, 'classic');
    applyCaptchaStyleClass(root, null);
    for (const style of CAPTCHA_STYLE_VALUES) {
      expect(root.classList.contains(`fourchanx-captcha-style-${style}`)).toBe(false);
    }
  });

  it('leaves unrelated classes alone', () => {
    const root = document.createElement('div');
    root.className = 'fourchanx-stacked-captcha';
    applyCaptchaStyleClass(root, 'inline');
    applyCaptchaStyleClass(root, null);
    expect(root.classList.contains('fourchanx-stacked-captcha')).toBe(true);
  });
});

describe('captchaNarration', () => {
  it('keeps the classic narration strings', () => {
    expect(captchaNarration('classic', 'complete')).toBe('Done.');
    expect(captchaNarration('classic', 'review')).toBe('Click an image to edit, or post.');
  });

  it('suppresses narration for the other styles', () => {
    for (const style of ['inline', 'dots'] as const) {
      expect(captchaNarration(style, 'complete')).toBe('');
      expect(captchaNarration(style, 'review')).toBe('');
    }
  });
});
