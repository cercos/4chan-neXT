import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportSignature, fitSettings, nextVideoFrame } from './DogiriExport';
import { type CaptionSize } from './DogiriState';

const caption = (start: number, end: number, text: string, y = 85, size: CaptionSize = 'medium') =>
  ({ start, end, text, y, size });

const base = () => ({
  regions: [{ start: 1, end: 3 }, { start: 5, end: 8 }],
  captions: [caption(1, 2, 'hello')],
  keepAudio: true,
  quality: 'medium' as const,
});

describe('exportSignature', () => {
  it('is stable for identical inputs', () => {
    expect(exportSignature(base())).toBe(exportSignature(base()));
  });

  it('ignores region order and empty regions', () => {
    const reordered = {
      ...base(),
      regions: [{ start: 5, end: 8 }, { start: 4, end: 4 }, { start: 1, end: 3 }],
    };
    expect(exportSignature(reordered)).toBe(exportSignature(base()));
  });

  it('changes when regions change', () => {
    const moved = { ...base(), regions: [{ start: 1, end: 3.5 }, { start: 5, end: 8 }] };
    expect(exportSignature(moved)).not.toBe(exportSignature(base()));
  });

  it('changes when captions change', () => {
    expect(exportSignature({ ...base(), captions: [caption(1, 2, 'bye')] }))
      .not.toBe(exportSignature(base()));
    expect(exportSignature({ ...base(), captions: [caption(1, 2, 'hello', 10)] }))
      .not.toBe(exportSignature(base()));
    expect(exportSignature({ ...base(), captions: [caption(1, 2, 'hello', 85, 'large')] }))
      .not.toBe(exportSignature(base()));
    expect(exportSignature({ ...base(), captions: [] }))
      .not.toBe(exportSignature(base()));
  });

  it('changes when audio or quality change', () => {
    expect(exportSignature({ ...base(), keepAudio: false })).not.toBe(exportSignature(base()));
    expect(exportSignature({ ...base(), quality: 'high' })).not.toBe(exportSignature(base()));
  });

  it('includes the target size in fit mode', () => {
    const fit = { ...base(), quality: 'fit' as const };
    expect(exportSignature({ ...fit, fitTargetBytes: 3_000_000 }))
      .not.toBe(exportSignature({ ...fit, fitTargetBytes: 4_000_000 }));
  });

  it('ignores the target size outside fit mode', () => {
    expect(exportSignature({ ...base(), fitTargetBytes: 3_000_000 }))
      .toBe(exportSignature(base()));
  });
});

describe('fitSettings', () => {
  it('derives the bitrate from the target size minus the audio budget', () => {
    const settings = fitSettings(1920, 1080, 10, 4_000_000, true, 1);
    expect(settings).toEqual({ width: 1280, height: 720, videoBps: 2_912_000, reachable: true });
  });

  it('keeps source resolution and caps the bitrate when the target is ample', () => {
    const settings = fitSettings(640, 360, 5, 50_000_000, false, 1);
    expect(settings).toEqual({ width: 640, height: 360, videoBps: 1_382_400, reachable: true });
  });

  it('floors at 360p and minimum bitrate and flags an unreachable target', () => {
    const settings = fitSettings(1920, 1080, 60, 500_000, false, 1);
    expect(settings).toEqual({ width: 640, height: 360, videoBps: 300_000, reachable: false });
  });

  it('reserves less video bitrate when audio is kept', () => {
    const withAudio = fitSettings(1280, 720, 10, 3_000_000, true, 1);
    const without = fitSettings(1280, 720, 10, 3_000_000, false, 1);
    expect(withAudio.width).toBe(without.width);
    expect(without.videoBps - withAudio.videoBps).toBe(128_000);
  });

  it('shrinks the budget when calibration says renders overshoot', () => {
    const trusted = fitSettings(1920, 1080, 10, 4_000_000, false, 1);
    const corrected = fitSettings(1920, 1080, 10, 4_000_000, false, 2);
    expect(trusted).toMatchObject({ width: 1280, height: 720, videoBps: 3_040_000 });
    expect(corrected).toMatchObject({ width: 854, height: 480, videoBps: 1_520_000 });
  });

  it('is unreachable with no clipped duration', () => {
    const settings = fitSettings(1920, 1080, 0, 4_000_000, false, 1);
    expect(settings.reachable).toBe(false);
    expect(settings.videoBps).toBe(300_000);
  });
});

describe('nextVideoFrame', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when the video presents a new frame', async () => {
    const video = document.createElement('video');
    let frameCallback: (() => void) | undefined;
    (video as any).requestVideoFrameCallback = (callback: () => void) => { frameCallback = callback; };
    const promise = nextVideoFrame(video, 60_000);
    frameCallback!();
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves on ended when no further frame is ever presented', async () => {
    const video = document.createElement('video');
    (video as any).requestVideoFrameCallback = () => {};
    const promise = nextVideoFrame(video, 60_000);
    video.dispatchEvent(new Event('ended'));
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves via the timeout when the video stalls silently', async () => {
    vi.useFakeTimers();
    const video = document.createElement('video');
    (video as any).requestVideoFrameCallback = () => {};
    const promise = nextVideoFrame(video, 250);
    vi.advanceTimersByTime(250);
    await expect(promise).resolves.toBeUndefined();
  });
});
