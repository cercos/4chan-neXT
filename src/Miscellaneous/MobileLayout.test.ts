import { describe, expect, it } from 'vitest';
import { applyBarLayout, applyMobileLayout, barLayoutClasses, detectMobileDevice, iconsInMobileBar, resolveBarLayout, resolveMobileLayout } from './MobileLayout';

function fakeWin({ coarse = false, touchPoints = 0, width = 1920, height = 1080 } = {}) {
  return {
    matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)' && coarse }),
    navigator: { maxTouchPoints: touchPoints },
    screen: { width, height },
  } as unknown as Window;
}

describe('detectMobileDevice', () => {
  it('detects a phone (coarse pointer, touch, small screen)', () => {
    expect(detectMobileDevice(fakeWin({ coarse: true, touchPoints: 5, width: 412, height: 915 }))).toBe(true);
  });

  it('detects a phone in landscape', () => {
    expect(detectMobileDevice(fakeWin({ coarse: true, touchPoints: 5, width: 915, height: 412 }))).toBe(true);
  });

  it('rejects a desktop (fine pointer, no touch, large screen)', () => {
    expect(detectMobileDevice(fakeWin())).toBe(false);
  });

  it('rejects a touch laptop (touch but fine pointer and large screen)', () => {
    expect(detectMobileDevice(fakeWin({ touchPoints: 10, width: 1920, height: 1080 }))).toBe(false);
  });

  it('rejects a large tablet with touch (screen above the phone cutoff)', () => {
    expect(detectMobileDevice(fakeWin({ coarse: true, touchPoints: 5, width: 768, height: 1024 }))).toBe(false);
  });

  it('returns false when matchMedia is unavailable', () => {
    const win = fakeWin({ coarse: true, touchPoints: 5, width: 412, height: 915 });
    delete (win as any).matchMedia;
    expect(detectMobileDevice(win)).toBe(false);
  });

  it('returns false when matchMedia throws', () => {
    const win = fakeWin({ coarse: true, touchPoints: 5, width: 412, height: 915 });
    (win as any).matchMedia = () => { throw new Error('nope'); };
    expect(detectMobileDevice(win)).toBe(false);
  });
});

describe('resolveMobileLayout', () => {
  it('forces on regardless of detection', () => {
    expect(resolveMobileLayout('on', false)).toBe(true);
    expect(resolveMobileLayout('on', true)).toBe(true);
  });

  it('forces off regardless of detection', () => {
    expect(resolveMobileLayout('off', true)).toBe(false);
    expect(resolveMobileLayout('off', false)).toBe(false);
  });

  it('follows detection on auto', () => {
    expect(resolveMobileLayout('auto', true)).toBe(true);
    expect(resolveMobileLayout('auto', false)).toBe(false);
  });

  it('treats unknown values as auto', () => {
    expect(resolveMobileLayout('bogus', true)).toBe(true);
    expect(resolveMobileLayout('', false)).toBe(false);
  });
});

describe('applyMobileLayout', () => {
  it('adds and removes the xt-mobile class on the root element', () => {
    const root = document.createElement('div');
    const phone = fakeWin({ coarse: true, touchPoints: 5, width: 412, height: 915 });
    expect(applyMobileLayout('auto', root, phone)).toBe(true);
    expect(root.classList.contains('xt-mobile')).toBe(true);
    expect(applyMobileLayout('off', root, phone)).toBe(false);
    expect(root.classList.contains('xt-mobile')).toBe(false);
  });
});

describe('resolveBarLayout', () => {
  it('passes through valid modes', () => {
    for (const mode of ['icons-bottom', 'icons-top']) {
      expect(resolveBarLayout(mode)).toBe(mode);
    }
  });

  it('maps legacy modes by header position', () => {
    expect(resolveBarLayout('combined-top')).toBe('icons-bottom');
    expect(resolveBarLayout('combined-bottom')).toBe('icons-top');
    expect(resolveBarLayout('split-icons-bottom')).toBe('icons-bottom');
    expect(resolveBarLayout('split-icons-top')).toBe('icons-top');
  });

  it('falls back to icons-bottom on unknown values', () => {
    expect(resolveBarLayout('bogus')).toBe('icons-bottom');
    expect(resolveBarLayout('')).toBe('icons-bottom');
    expect(resolveBarLayout(undefined as unknown as string)).toBe('icons-bottom');
  });
});

describe('barLayoutClasses', () => {
  it('maps each mode to its root classes', () => {
    expect(barLayoutClasses('icons-bottom')).toEqual(['xt-bar-split', 'xt-icons-bottom']);
    expect(barLayoutClasses('icons-top')).toEqual(['xt-bar-split', 'xt-icons-top']);
  });

  it('treats unknown modes as icons-bottom', () => {
    expect(barLayoutClasses('bogus')).toEqual(['xt-bar-split', 'xt-icons-bottom']);
  });
});

describe('iconsInMobileBar', () => {
  it('is true for every mode now that combined is gone', () => {
    expect(iconsInMobileBar('icons-bottom')).toBe(true);
    expect(iconsInMobileBar('icons-top')).toBe(true);
    expect(iconsInMobileBar('combined-top')).toBe(true);
    expect(iconsInMobileBar('bogus')).toBe(true);
  });
});

describe('applyBarLayout', () => {
  it('applies, switches, and clears stale bar classes', () => {
    const root = document.createElement('div');
    root.classList.add('xt-bar-bottom');
    applyBarLayout('icons-bottom', root);
    expect(root.classList.contains('xt-bar-split')).toBe(true);
    expect(root.classList.contains('xt-icons-bottom')).toBe(true);
    expect(root.classList.contains('xt-bar-bottom')).toBe(false);
    applyBarLayout('icons-top', root);
    expect(root.classList.contains('xt-icons-bottom')).toBe(false);
    expect(root.classList.contains('xt-icons-top')).toBe(true);
    expect(root.classList.contains('xt-bar-split')).toBe(true);
  });
});
