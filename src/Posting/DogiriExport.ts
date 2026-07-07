import {
  CAPTION_LINE_HEIGHT, CAPTION_MAX_WIDTH_FRACTION, captionBlockTop, SIZE_FRACTIONS,
  wrapCaptionLines, type CaptionSize,
} from './DogiriState';
import { runWebCodecsCapture, webCodecsSupport } from './DogiriWebCodecs';

export type ExportQuality = 'high' | 'medium' | 'low' | 'min';
export type RenderQuality = ExportQuality | 'fit';

export interface DogiriExportOptions {
  file: File;
  regions: { start: number, end: number }[];
  captions: { start: number, end: number, text: string, y: number, size: CaptionSize }[];
  keepAudio: boolean;
  quality: RenderQuality;
  fitTargetBytes?: number;
  fitCalibration?: number;
  onProgress?: (fraction: number) => void;
}

export const AUDIO_BPS = 128_000;

const QUALITY_TIERS: Record<ExportQuality, { maxHeight: number, perPixel: number, cap: number }> = {
  high:   { maxHeight: Infinity, perPixel: 6,   cap: 12_000_000 },
  medium: { maxHeight: Infinity, perPixel: 4,   cap: 8_000_000 },
  low:    { maxHeight: 720,      perPixel: 3,   cap: 4_000_000 },
  min:    { maxHeight: 480,      perPixel: 2.5, cap: 2_000_000 },
};

export function exportSettings(width: number, height: number, quality: ExportQuality) {
  const tier = QUALITY_TIERS[quality] || QUALITY_TIERS.medium;
  const scale = height > 0 ? Math.min(1, tier.maxHeight / height) : 1;
  const outWidth = Math.max(2, Math.round((width * scale) / 2) * 2);
  const outHeight = Math.max(2, Math.round((height * scale) / 2) * 2);
  const videoBps = Math.min(tier.cap, Math.max(500_000, Math.round(outWidth * outHeight * tier.perPixel)));
  return { width: outWidth, height: outHeight, videoBps };
}

export const FIT_MIN_VIDEO_BPS = 300_000;
const FIT_SAFETY = 0.95;
const FIT_MIN_PER_PIXEL = 2.5;
const FIT_HEIGHT_STEPS = [Infinity, 720, 480, 360];

export function fitSettings(
  width: number, height: number, clippedSeconds: number, targetBytes: number,
  keepAudio: boolean, calibration = 1,
) {
  const audioBps = keepAudio ? AUDIO_BPS : 0;
  const budgetBps = clippedSeconds > 0
    ? ((targetBytes * 8) / clippedSeconds) * FIT_SAFETY / (calibration > 0 ? calibration : 1) - audioBps
    : 0;
  let outWidth = 2;
  let outHeight = 2;
  for (const maxHeight of FIT_HEIGHT_STEPS) {
    const scale = height > 0 ? Math.min(1, maxHeight / height) : 1;
    outWidth = Math.max(2, Math.round((width * scale) / 2) * 2);
    outHeight = Math.max(2, Math.round((height * scale) / 2) * 2);
    if (budgetBps >= outWidth * outHeight * FIT_MIN_PER_PIXEL) { break; }
  }
  const cap = Math.min(12_000_000, outWidth * outHeight * 6);
  const videoBps = Math.max(FIT_MIN_VIDEO_BPS, Math.min(cap, Math.round(budgetBps)));
  return { width: outWidth, height: outHeight, videoBps, reachable: budgetBps >= FIT_MIN_VIDEO_BPS };
}

export function exportSignature(opts: {
  regions: { start: number, end: number }[],
  captions: { start: number, end: number, text: string, y: number, size: CaptionSize }[],
  keepAudio: boolean,
  quality: RenderQuality,
  fitTargetBytes?: number,
}): string {
  return JSON.stringify({
    regions: opts.regions
      .filter(region => region.end - region.start > 0)
      .map(region => [region.start, region.end])
      .sort((a, b) => a[0] - b[0]),
    captions: opts.captions.map(caption =>
      [caption.start, caption.end, caption.text, caption.y, caption.size]),
    keepAudio: opts.keepAudio,
    quality: opts.quality,
    ...(opts.quality === 'fit' ? { fitTargetBytes: opts.fitTargetBytes || 0 } : {}),
  });
}

export type ExportEngine = 'webcodecs' | 'mediarecorder';

export interface DogiriExportResult {
  blob: Blob;
  durationOk: boolean;
  engine: ExportEngine;
}

export interface DogiriExportJob {
  promise: Promise<DogiriExportResult>;
  cancel: () => void;
}

export const EXPORT_CANCELLED = 'dogiri-export-cancelled';

export function nextVideoFrame(video: HTMLVideoElement, timeoutMs = 250): Promise<void> {
  return new Promise(resolve => {
    let timer = 0;
    let settled = false;
    const finish = () => {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      video.removeEventListener('ended', finish);
      resolve();
    };
    timer = window.setTimeout(finish, timeoutMs);
    video.addEventListener('ended', finish, { once: true });
    const rvfc = (video as any).requestVideoFrameCallback;
    if (typeof rvfc === 'function') {
      rvfc.call(video, finish);
    } else {
      requestAnimationFrame(finish);
    }
  });
}

export function exportClips(opts: DogiriExportOptions): DogiriExportJob {
  let cancelled = false;

  const promise = (async () => {
    const regions = opts.regions
      .map(region => ({ ...region }))
      .filter(region => region.end - region.start > 0)
      .sort((a, b) => a.start - b.start);
    if (!regions.length) { throw new Error('No clips to export.'); }
    const total = regions.reduce((sum, region) => sum + (region.end - region.start), 0);

    const url = URL.createObjectURL(opts.file);
    const video = document.createElement('video');
    video.preload = 'auto';
    (video as any).playsInline = true;
    video.src = url;

    let audioCtx: AudioContext | null = null;
    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      audioCtx?.close().catch(() => {});
    };

    try {
      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 1) { resolve(); return; }
        video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        video.addEventListener('error', () => reject(new Error('Could not decode the video.')), { once: true });
      });
      if (!(video.videoWidth && video.videoHeight)) { throw new Error('Video has no visible frames.'); }

      const settings = opts.quality === 'fit'
        ? fitSettings(video.videoWidth, video.videoHeight, total, opts.fitTargetBytes || 0,
            opts.keepAudio, opts.fitCalibration)
        : exportSettings(video.videoWidth, video.videoHeight, opts.quality);
      const canvas = document.createElement('canvas');
      canvas.width = settings.width;
      canvas.height = settings.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { throw new Error('Canvas is unavailable.'); }
      ctx.imageSmoothingQuality = 'high';

      const seekTo = (time: number) => new Promise<void>(resolve => {
        if (Math.abs(video.currentTime - time) < 0.001) {
          if (video.readyState >= 2) { resolve(); return; }
          video.addEventListener('canplay', () => resolve(), { once: true });
          return;
        }
        video.addEventListener('seeked', () => resolve(), { once: true });
        video.currentTime = time;
      });

      const drawFrame = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const time = video.currentTime;
        for (const caption of opts.captions) {
          if (time < caption.start || time >= caption.end) { continue; }
          const px = Math.max(12, Math.round(canvas.height * SIZE_FRACTIONS[caption.size]));
          ctx.font = `bold ${px}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.lineWidth = Math.max(2, px / 8);
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#000';
          ctx.fillStyle = '#fff';
          const x = canvas.width / 2;
          const maxWidth = canvas.width * CAPTION_MAX_WIDTH_FRACTION;
          const lines = wrapCaptionLines(text => ctx.measureText(text).width, caption.text, maxWidth);
          const lineHeight = px * CAPTION_LINE_HEIGHT;
          const blockHeightPct = ((lines.length * lineHeight) / canvas.height) * 100;
          const top = (captionBlockTop(caption.y, blockHeightPct) / 100) * canvas.height;
          lines.forEach((line, index) => {
            const y = top + index * lineHeight;
            ctx.strokeText(line, x, y, maxWidth);
            ctx.fillText(line, x, y, maxWidth);
          });
        }
      };

      const support = await webCodecsSupport(settings.width, settings.height, opts.keepAudio);
      if (support) {
        try {
          const muxed = await runWebCodecsCapture({
            video,
            canvas,
            regions,
            total,
            file: opts.file,
            keepAudio: opts.keepAudio,
            videoBps: settings.videoBps,
            audioBps: AUDIO_BPS,
            support,
            drawFrame,
            seekTo,
            nextFrame: nextVideoFrame,
            isCancelled: () => cancelled,
            onProgress: opts.onProgress,
          });
          if (cancelled || !muxed) { throw new Error(EXPORT_CANCELLED); }
          if (!muxed.size) { throw new Error('Encoding produced no data.'); }
          opts.onProgress?.(1);
          return { blob: muxed, durationOk: await probeDuration(muxed), engine: 'webcodecs' as const };
        } catch (error) {
          if (cancelled || (error as Error)?.message === EXPORT_CANCELLED) { throw error; }
        }
      }

      let stream = canvas.captureStream(0);
      const videoTrack = stream.getVideoTracks()[0] as any;
      let captureFrame: (() => void) | null = null;
      if (typeof videoTrack?.requestFrame === 'function') {
        captureFrame = () => videoTrack.requestFrame();
      } else if (typeof (stream as any).requestFrame === 'function') {
        captureFrame = () => (stream as any).requestFrame();
      } else {
        stream = canvas.captureStream(30);
      }
      if (opts.keepAudio) {
        try {
          video.muted = false;
          audioCtx = new AudioContext();
          await audioCtx.resume();
          const source = audioCtx.createMediaElementSource(video);
          const dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);
          for (const track of dest.stream.getAudioTracks()) { stream.addTrack(track); }
        } catch {
          video.muted = true;
        }
      } else {
        video.muted = true;
      }

      const codecSuffix = opts.keepAudio ? ',opus' : '';
      const mimeType = [
        `video/webm;codecs=vp9${codecSuffix}`,
        `video/webm;codecs=vp8${codecSuffix}`,
        'video/webm',
      ].find(candidate => (window as any).MediaRecorder?.isTypeSupported?.(candidate)) || 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: settings.videoBps,
        audioBitsPerSecond: AUDIO_BPS,
      });
      const chunks: Blob[] = [];
      recorder.addEventListener('dataavailable', e => { if (e.data?.size) { chunks.push(e.data); } });

      const drawAndCapture = () => {
        drawFrame();
        captureFrame?.();
      };

      const playCurrentRegion = async () => {
        try {
          await video.play();
        } catch {
          video.muted = true;
          await video.play();
        }
      };

      let done = 0;
      for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        if (cancelled) { break; }
        await seekTo(region.start);
        if (cancelled) { break; }
        drawAndCapture();
        await playCurrentRegion();
        if (i === 0) { recorder.start(); } else { recorder.resume(); }
        let lastTime = -1;
        let stalledTicks = 0;
        while (!cancelled) {
          await nextVideoFrame(video);
          if (video.currentTime >= region.end || video.ended) { break; }
          if (video.currentTime === lastTime) {
            if (++stalledTicks >= 12) { break; }
            continue;
          }
          lastTime = video.currentTime;
          stalledTicks = 0;
          drawAndCapture();
          opts.onProgress?.(Math.min(1, (done + (video.currentTime - region.start)) / total));
        }
        video.pause();
        done += region.end - region.start;
        if (i < regions.length - 1 && !cancelled) { recorder.pause(); }
      }

      if (cancelled) {
        if (recorder.state !== 'inactive') { recorder.stop(); }
        throw new Error(EXPORT_CANCELLED);
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener('stop', () => {
          resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
        }, { once: true });
        recorder.addEventListener('error', () => reject(new Error('Recording failed.')), { once: true });
        recorder.stop();
      });
      if (!blob.size) { throw new Error('Recording produced no data.'); }
      opts.onProgress?.(1);
      const patched = await patchWebmDuration(blob, total * 1000);
      return { blob: patched, durationOk: await probeDuration(patched), engine: 'mediarecorder' as const };
    } finally {
      cleanup();
    }
  })();

  return { promise, cancel: () => { cancelled = true; } };
}

function probeDuration(blob: Blob): Promise<boolean> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const probe = document.createElement('video');
    const finish = (ok: boolean) => {
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    probe.preload = 'metadata';
    probe.addEventListener('loadedmetadata', () => {
      finish(Number.isFinite(probe.duration) && probe.duration > 0);
    }, { once: true });
    probe.addEventListener('error', () => finish(false), { once: true });
    probe.src = url;
  });
}

function readIdLength(byte: number): number {
  for (let i = 0; i < 4; i++) {
    if (byte & (0x80 >> i)) { return i + 1; }
  }
  return 4;
}

function readSizeVint(bytes: Uint8Array, off: number): { value: number, length: number, unknown: boolean } {
  const first = bytes[off];
  let length = 1;
  let mask = 0x80;
  while (!(first & mask) && length < 8) {
    mask >>= 1;
    length++;
  }
  let value = first & (mask - 1);
  let allOnes = (first & (mask - 1)) === (mask - 1);
  for (let i = 1; i < length; i++) {
    value = value * 256 + bytes[off + i];
    if (bytes[off + i] !== 0xFF) { allOnes = false; }
  }
  return { value, length, unknown: allOnes };
}

function idAt(bytes: Uint8Array, off: number): number {
  const length = readIdLength(bytes[off]);
  let id = 0;
  for (let i = 0; i < length; i++) { id = id * 256 + bytes[off + i]; }
  return id;
}

export async function patchWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  try {
    const headSize = Math.min(blob.size, 1 << 20);
    const head = new Uint8Array(await blob.slice(0, headSize).arrayBuffer());
    let off = 0;

    if (idAt(head, off) !== 0x1A45DFA3) { return blob; }
    let size = readSizeVint(head, off + 4);
    off += 4 + size.length + size.value;

    if (idAt(head, off) !== 0x18538067) { return blob; }
    size = readSizeVint(head, off + 4);
    const segmentSizeUnknown = size.unknown;
    off += 4 + size.length;

    while (off < head.length - 12) {
      const id = idAt(head, off);
      if (id === 0x1F43B675) { return blob; }
      const idLength = readIdLength(head[off]);
      const elSize = readSizeVint(head, off + idLength);
      const dataStart = off + idLength + elSize.length;
      if (id !== 0x1549A966) {
        off = dataStart + elSize.value;
        continue;
      }

      let timestampScale = 1_000_000;
      let durationOffset = -1;
      let durationLength = 0;
      let inner = dataStart;
      const dataEnd = dataStart + elSize.value;
      while (inner < dataEnd && inner < head.length - 2) {
        const innerId = idAt(head, inner);
        const innerIdLength = readIdLength(head[inner]);
        const innerSize = readSizeVint(head, inner + innerIdLength);
        const innerDataStart = inner + innerIdLength + innerSize.length;
        if (innerId === 0x2AD7B1) {
          let value = 0;
          for (let i = 0; i < innerSize.value; i++) { value = value * 256 + head[innerDataStart + i]; }
          if (value > 0) { timestampScale = value; }
        } else if (innerId === 0x4489) {
          durationOffset = innerDataStart;
          durationLength = innerSize.value;
        }
        inner = innerDataStart + innerSize.value;
      }

      const durationValue = (durationMs * 1_000_000) / timestampScale;
      if (durationOffset >= 0 && (durationLength === 8 || durationLength === 4)) {
        const view = new DataView(head.buffer);
        if (durationLength === 8) {
          view.setFloat64(durationOffset, durationValue, false);
        } else {
          view.setFloat32(durationOffset, durationValue, false);
        }
        return new Blob([head, blob.slice(headSize)], { type: blob.type });
      }

      if (durationOffset >= 0) { return blob; }
      if (!segmentSizeUnknown) { return blob; }
      const durationElement = new Uint8Array(11);
      durationElement[0] = 0x44;
      durationElement[1] = 0x89;
      durationElement[2] = 0x88;
      new DataView(durationElement.buffer).setFloat64(3, durationValue, false);

      const newDataLength = elSize.value + durationElement.length;
      const sizeVint = new Uint8Array(8);
      sizeVint[0] = 0x01;
      let remaining = newDataLength;
      for (let i = 7; i >= 1; i--) {
        sizeVint[i] = remaining % 256;
        remaining = Math.floor(remaining / 256);
      }

      const infoId = head.subarray(off, off + idLength);
      return new Blob([
        head.subarray(0, off),
        infoId,
        sizeVint,
        head.subarray(dataStart, dataEnd),
        durationElement,
        blob.slice(dataEnd),
      ], { type: blob.type });
    }
    return blob;
  } catch {
    return blob;
  }
}
