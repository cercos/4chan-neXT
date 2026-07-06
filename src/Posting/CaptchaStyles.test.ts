// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  CAPTCHA_STYLE_VALUES,
  applyCaptchaStyleClass,
  captchaNarration,
  normalizeCaptchaStyle,
} from './CaptchaStyles';

describe('normalizeCaptchaStyle', () => {
  it('passes through every known style', () => {
    for (const style of CAPTCHA_STYLE_VALUES) {
      expect(normalizeCaptchaStyle(style)).toBe(style);
    }
  });

  it('falls back to inline for unknown or missing values', () => {
    expect(normalizeCaptchaStyle('fancy')).toBe('inline');
    expect(normalizeCaptchaStyle('grid')).toBe('inline');
    expect(normalizeCaptchaStyle(undefined)).toBe('inline');
    expect(normalizeCaptchaStyle(null)).toBe('inline');
    expect(normalizeCaptchaStyle(42)).toBe('inline');
    expect(normalizeCaptchaStyle('')).toBe('inline');
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
