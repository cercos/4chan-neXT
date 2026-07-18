import { describe, expect, it } from 'vitest';
import { QR_OVERFLOW_ACTION_IDS, actionLabel, keyboardInset, shouldAutoExpand, shouldCloseAfterPost } from './QRMobileLogic';

describe('actionLabel', () => {
  it('uses the title text as the label', () => {
    expect(actionLabel('Compress to jpg')).toBe('Compress to jpg');
  });

  it('strips parenthesized shortcut hints', () => {
    expect(actionLabel('Dump list (Shift+Click: Clear list)')).toBe('Dump list');
  });

  it('trims surrounding whitespace', () => {
    expect(actionLabel('  Preview ')).toBe('Preview');
  });

  it('returns an empty string for an empty title', () => {
    expect(actionLabel('')).toBe('');
  });
});

describe('QR_OVERFLOW_ACTION_IDS', () => {
  it('contains the rare file actions', () => {
    for (const id of ['qr-oekaki-button', 'qr-dogiri-button', 'qr-jpg', 'qr-view',
      'qr-randomize', 'qr-restore-name', 'url-button', 'custom-cooldown-button',
      'split-post', 'dump-button']) {
      expect(QR_OVERFLOW_ACTION_IDS).toContain(id);
    }
  });

  it('leaves remove-file and the FF paste hack in the file row', () => {
    expect(QR_OVERFLOW_ACTION_IDS).not.toContain('qr-filerm');
    expect(QR_OVERFLOW_ACTION_IDS).not.toContain('paste-area');
  });
});

describe('shouldCloseAfterPost', () => {
  it('closes when the mobile dump list empties after its last post', () => {
    expect(shouldCloseAfterPost(true, true, 0)).toBe(true);
  });

  it('stays open while posts remain in the dump list', () => {
    expect(shouldCloseAfterPost(true, true, 2)).toBe(false);
  });

  it('leaves single non-dump posts to the Persistent QR setting', () => {
    expect(shouldCloseAfterPost(true, false, 0)).toBe(false);
  });

  it('never closes on desktop', () => {
    expect(shouldCloseAfterPost(false, true, 0)).toBe(false);
  });
});

describe('keyboardInset', () => {
  it('measures the keyboard height when the visual viewport shrinks', () => {
    expect(keyboardInset(800, 500, 0)).toBe(300);
  });

  it('accounts for visual viewport scroll offset', () => {
    expect(keyboardInset(800, 500, 100)).toBe(200);
  });

  it('is zero when no keyboard is open', () => {
    expect(keyboardInset(800, 800, 0)).toBe(0);
  });

  it('is zero when the layout viewport already resized', () => {
    expect(keyboardInset(500, 500, 0)).toBe(0);
  });

  it('never goes negative', () => {
    expect(keyboardInset(500, 800, 0)).toBe(0);
  });

  it('rounds fractional viewport heights', () => {
    expect(keyboardInset(800, 499.6, 0)).toBe(300);
  });
});

describe('shouldAutoExpand', () => {
  it('expands when dump mode turns on while collapsed', () => {
    expect(shouldAutoExpand('dump-on', false)).toBe(true);
  });

  it('does nothing when already expanded', () => {
    expect(shouldAutoExpand('dump-on', true)).toBe(false);
  });

  it('ignores unknown triggers', () => {
    expect(shouldAutoExpand('resize', false)).toBe(false);
  });
});
