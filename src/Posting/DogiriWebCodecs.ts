export interface MuxChunk { data: Uint8Array, timestampMs: number, keyframe: boolean }

export interface WebmMuxInput {
  durationMs: number;
  video: { codecId: 'V_VP8' | 'V_VP9', width: number, height: number };
  audio?: { sampleRate: number, channels: number, codecPrivate: Uint8Array };
  videoChunks: MuxChunk[];
  audioChunks: MuxChunk[];
}

export interface WebCodecsSupport { codec: string, codecId: 'V_VP8' | 'V_VP9' }

export function clipTimelineOffsets(regions: { start: number, end: number }[]): number[] {
  const offsets: number[] = [];
  let acc = 0;
  for (const region of regions) {
    offsets.push(acc);
    acc += Math.max(0, region.end - region.start);
  }
  return offsets;
}

export function opusHead(channels: number, sampleRate: number): Uint8Array {
  const head = new Uint8Array(19);
  head.set(new TextEncoder().encode('OpusHead'), 0);
  head[8] = 1;
  head[9] = channels;
  const view = new DataView(head.buffer);
  view.setUint16(10, 312, true);
  view.setUint32(12, sampleRate, true);
  return head;
}

const VIDEO_CODEC_CANDIDATES: WebCodecsSupport[] = [
  { codec: 'vp09.00.50.08', codecId: 'V_VP9' },
  { codec: 'vp09.00.40.08', codecId: 'V_VP9' },
  { codec: 'vp8', codecId: 'V_VP8' },
];

export async function webCodecsSupport(
  width: number, height: number, keepAudio: boolean, scope: any = window,
): Promise<WebCodecsSupport | null> {
  if (typeof scope.VideoEncoder?.isConfigSupported !== 'function' || !scope.VideoFrame) {
    return null;
  }
  if (keepAudio) {
    if (typeof scope.AudioEncoder?.isConfigSupported !== 'function'
      || !scope.AudioData || !scope.OfflineAudioContext) { return null; }
    try {
      const audio = await scope.AudioEncoder.isConfigSupported({
        codec: 'opus', sampleRate: 48_000, numberOfChannels: 2,
      });
      if (!audio?.supported) { return null; }
    } catch {
      return null;
    }
  }
  for (const candidate of VIDEO_CODEC_CANDIDATES) {
    try {
      const result = await scope.VideoEncoder.isConfigSupported({
        codec: candidate.codec, width, height, bitrate: 1_000_000,
      });
      if (result?.supported) { return candidate; }
    } catch {}
  }
  return null;
}

export interface RegionAudio {
  channels: number;
  sampleRate: number;
  chunks: { data: Float32Array, frames: number, offsetFrames: number }[];
}

export function regionAudioChunks(
  buffer: AudioBuffer, startSeconds: number, endSeconds: number, chunkFrames: number,
): RegionAudio {
  const sampleRate = buffer.sampleRate;
  const channels = Math.min(2, buffer.numberOfChannels);
  const first = Math.min(buffer.length, Math.max(0, Math.round(startSeconds * sampleRate)));
  const last = Math.min(buffer.length, Math.max(first, Math.round(endSeconds * sampleRate)));
  const chunks: RegionAudio['chunks'] = [];
  for (let frame = first; frame < last; frame += chunkFrames) {
    const frames = Math.min(chunkFrames, last - frame);
    const data = new Float32Array(frames * channels);
    for (let channel = 0; channel < channels; channel++) {
      data.set(buffer.getChannelData(channel).subarray(frame, frame + frames), channel * frames);
    }
    chunks.push({ data, frames, offsetFrames: frame - first });
  }
  return { channels, sampleRate, chunks };
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) { length += part.length; }
  const out = new Uint8Array(length);
  let off = 0;
  for (const part of parts) {
    out.set(part, off);
    off += part.length;
  }
  return out;
}

function idBytes(id: number): Uint8Array {
  const bytes: number[] = [];
  let value = id;
  while (value > 0) {
    bytes.unshift(value % 256);
    value = Math.floor(value / 256);
  }
  return Uint8Array.from(bytes);
}

function sizeVint(value: number): Uint8Array {
  let length = 1;
  while (value >= 2 ** (7 * length) - 1 && length < 8) { length++; }
  const bytes = new Uint8Array(length);
  let remaining = value;
  for (let i = length - 1; i > 0; i--) {
    bytes[i] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
  bytes[0] = (0x80 >> (length - 1)) | remaining;
  return bytes;
}

function el(id: number, body: Uint8Array | Uint8Array[]): Uint8Array {
  const data = Array.isArray(body) ? concatBytes(body) : body;
  return concatBytes([idBytes(id), sizeVint(data.length), data]);
}

function uintEl(id: number, value: number): Uint8Array {
  const bytes: number[] = [];
  let remaining = Math.round(value);
  do {
    bytes.unshift(remaining % 256);
    remaining = Math.floor(remaining / 256);
  } while (remaining > 0);
  return el(id, Uint8Array.from(bytes));
}

function strEl(id: number, text: string): Uint8Array {
  return el(id, new TextEncoder().encode(text));
}

function floatEl(id: number, value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, false);
  return el(id, bytes);
}

function simpleBlock(track: number, relativeTs: number, keyframe: boolean, data: Uint8Array): Uint8Array {
  const head = new Uint8Array(4);
  head[0] = 0x80 | track;
  new DataView(head.buffer).setInt16(1, relativeTs, false);
  head[3] = keyframe ? 0x80 : 0;
  return el(0xA3, [head, data]);
}

const CLUSTER_MAX_RELATIVE_MS = 32_000;

export function buildWebm(input: WebmMuxInput): Uint8Array {
  const header = el(0x1A45DFA3, [
    uintEl(0x4286, 1), uintEl(0x42F7, 1), uintEl(0x42F2, 4), uintEl(0x42F3, 8),
    strEl(0x4282, 'webm'), uintEl(0x4287, 4), uintEl(0x4285, 2),
  ]);
  const info = el(0x1549A966, [
    uintEl(0x2AD7B1, 1_000_000),
    floatEl(0x4489, input.durationMs),
    strEl(0x4D80, '4chan-neXT'),
    strEl(0x5741, '4chan-neXT'),
  ]);
  const trackEntries = [el(0xAE, [
    uintEl(0xD7, 1), uintEl(0x73C5, 1), uintEl(0x83, 1), uintEl(0x9C, 0),
    strEl(0x86, input.video.codecId),
    el(0xE0, [uintEl(0xB0, input.video.width), uintEl(0xBA, input.video.height)]),
  ])];
  if (input.audio) {
    trackEntries.push(el(0xAE, [
      uintEl(0xD7, 2), uintEl(0x73C5, 2), uintEl(0x83, 2), uintEl(0x9C, 0),
      strEl(0x86, 'A_OPUS'),
      uintEl(0x56AA, 6_500_000), uintEl(0x56BB, 80_000_000),
      el(0x63A2, input.audio.codecPrivate),
      el(0xE1, [floatEl(0xB5, input.audio.sampleRate), uintEl(0x9F, input.audio.channels)]),
    ]));
  }
  const tracks = el(0x1654AE6B, trackEntries);

  const blocks = [
    ...input.videoChunks.map(chunk => ({ ...chunk, track: 1 })),
    ...input.audioChunks.map(chunk => ({ ...chunk, track: 2 })),
  ].sort((a, b) => (a.timestampMs - b.timestampMs) || (a.track - b.track));

  const clusters: Uint8Array[] = [];
  let clusterTs = 0;
  let clusterBlocks: Uint8Array[] = [];
  const flushCluster = () => {
    if (clusterBlocks.length) {
      clusters.push(el(0x1F43B675, [uintEl(0xE7, clusterTs), ...clusterBlocks]));
    }
    clusterBlocks = [];
  };
  for (const block of blocks) {
    const ts = Math.max(0, Math.round(block.timestampMs));
    if (clusterBlocks.length
      && ((block.track === 1 && block.keyframe) || ts - clusterTs > CLUSTER_MAX_RELATIVE_MS)) {
      flushCluster();
    }
    if (!clusterBlocks.length) { clusterTs = ts; }
    clusterBlocks.push(simpleBlock(block.track, ts - clusterTs, block.keyframe, block.data));
  }
  flushCluster();

  return concatBytes([header, el(0x18538067, [info, tracks, ...clusters])]);
}

export interface RateDecision { rate: number, rewind: boolean }

const RATE_STEPS = [1, 2, 4];
const RATE_CLEAN_STREAK = 24;
const RATE_DROP_FACTOR = 1.6;
const RATE_MAX_FAILURES = 2;

export function createRateController() {
  let step = 0;
  let minDelta = Infinity;
  let cleanStreak = 0;
  const failures = new Map<number, number>();

  return {
    rate: () => RATE_STEPS[step],
    onDelta(delta: number): RateDecision {
      if (delta <= 0) { return { rate: RATE_STEPS[step], rewind: false }; }
      minDelta = Math.min(minDelta, delta);
      if (delta > minDelta * RATE_DROP_FACTOR) {
        cleanStreak = 0;
        if (step > 0) {
          const failed = RATE_STEPS[step];
          failures.set(failed, (failures.get(failed) || 0) + 1);
          step--;
          return { rate: RATE_STEPS[step], rewind: true };
        }
        return { rate: RATE_STEPS[step], rewind: false };
      }
      cleanStreak++;
      if (cleanStreak >= RATE_CLEAN_STREAK && step < RATE_STEPS.length - 1
        && (failures.get(RATE_STEPS[step + 1]) || 0) < RATE_MAX_FAILURES) {
        step++;
        cleanStreak = 0;
      }
      return { rate: RATE_STEPS[step], rewind: false };
    },
  };
}

export interface WebCodecsCaptureOpts {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  regions: { start: number, end: number }[];
  total: number;
  file: File;
  keepAudio: boolean;
  videoBps: number;
  audioBps: number;
  support: WebCodecsSupport;
  drawFrame: () => void;
  seekTo: (time: number) => Promise<void>;
  nextFrame: (video: HTMLVideoElement) => Promise<void>;
  isCancelled: () => boolean;
  onProgress?: (fraction: number) => void;
}

const KEYFRAME_INTERVAL_US = 4_000_000;
const AUDIO_CHUNK_FRAMES = 9600;

function toUint8(source: any): Uint8Array {
  if (source instanceof Uint8Array) { return new Uint8Array(source); }
  if (source instanceof ArrayBuffer) { return new Uint8Array(source.slice(0)); }
  return new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
}

export async function runWebCodecsCapture(opts: WebCodecsCaptureOpts): Promise<Blob | null> {
  const { video, canvas, regions, total, support } = opts;
  const scope = window as any;
  const offsets = clipTimelineOffsets(regions);

  let audioBuffer: AudioBuffer | null = null;
  if (opts.keepAudio) {
    const offline = new scope.OfflineAudioContext(2, 1, 48_000);
    audioBuffer = await offline.decodeAudioData(await opts.file.arrayBuffer());
  }

  let encodeError: Error | null = null;
  const videoChunks: MuxChunk[] = [];
  const encoder = new scope.VideoEncoder({
    output: (chunk: any) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      videoChunks.push({ data, timestampMs: chunk.timestamp / 1000, keyframe: chunk.type === 'key' });
    },
    error: (error: any) => {
      encodeError = error instanceof Error ? error : new Error(String(error));
    },
  });

  try {
    encoder.configure({
      codec: support.codec,
      width: canvas.width,
      height: canvas.height,
      bitrate: opts.videoBps,
      framerate: 30,
    });

    let lastOutputUs = -1;
    let lastKeyUs = 0;
    const encodeCanvasFrame = (regionIndex: number, sourceTime: number, forceKey = false) => {
      if (encodeError) { throw encodeError; }
      const region = regions[regionIndex];
      const clamped = Math.min(Math.max(sourceTime, region.start), region.end);
      let timestamp = Math.round((offsets[regionIndex] + (clamped - region.start)) * 1_000_000);
      if (timestamp <= lastOutputUs) { timestamp = lastOutputUs + 1000; }
      const keyFrame = forceKey || lastOutputUs < 0 || timestamp - lastKeyUs >= KEYFRAME_INTERVAL_US;
      if (keyFrame) { lastKeyUs = timestamp; }
      lastOutputUs = timestamp;
      const frame = new scope.VideoFrame(canvas, { timestamp });
      try {
        encoder.encode(frame, { keyFrame });
      } finally {
        frame.close();
      }
    };

    video.muted = true;
    const rateControl = createRateController();
    let done = 0;
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      if (opts.isCancelled()) { break; }
      await opts.seekTo(region.start);
      if (opts.isCancelled()) { break; }
      opts.drawFrame();
      encodeCanvasFrame(i, region.start, true);
      video.playbackRate = rateControl.rate();
      await video.play();
      let lastTime = -1;
      let stalledTicks = 0;
      let rewindsLeft = 4;
      while (!opts.isCancelled()) {
        await opts.nextFrame(video);
        if (video.currentTime >= region.end || video.ended) { break; }
        if (video.currentTime === lastTime) {
          if (++stalledTicks >= 12) { break; }
          continue;
        }
        if (lastTime >= 0) {
          const decision = rateControl.onDelta(video.currentTime - lastTime);
          if (video.playbackRate !== decision.rate) { video.playbackRate = decision.rate; }
          if (decision.rewind && rewindsLeft > 0) {
            rewindsLeft--;
            video.pause();
            await opts.seekTo(lastTime);
            await video.play();
            continue;
          }
        }
        lastTime = video.currentTime;
        stalledTicks = 0;
        opts.drawFrame();
        encodeCanvasFrame(i, video.currentTime);
        opts.onProgress?.(Math.min(1, (done + (video.currentTime - region.start)) / total));
      }
      video.pause();
      done += region.end - region.start;
    }
    if (opts.isCancelled()) { return null; }

    let audio: WebmMuxInput['audio'];
    const audioChunks: MuxChunk[] = [];
    if (audioBuffer) {
      let audioError: Error | null = null;
      let codecPrivate: Uint8Array | null = null;
      const audioEncoder = new scope.AudioEncoder({
        output: (chunk: any, metadata: any) => {
          const description = metadata?.decoderConfig?.description;
          if (description && !codecPrivate) { codecPrivate = toUint8(description); }
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          audioChunks.push({ data, timestampMs: chunk.timestamp / 1000, keyframe: true });
        },
        error: (error: any) => {
          audioError = error instanceof Error ? error : new Error(String(error));
        },
      });
      const channels = Math.min(2, audioBuffer.numberOfChannels);
      try {
        audioEncoder.configure({
          codec: 'opus',
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: channels,
          bitrate: opts.audioBps,
        });
        for (let i = 0; i < regions.length; i++) {
          const sliced = regionAudioChunks(audioBuffer, regions[i].start, regions[i].end, AUDIO_CHUNK_FRAMES);
          for (const part of sliced.chunks) {
            if (audioError) { throw audioError; }
            const data = new scope.AudioData({
              format: 'f32-planar',
              sampleRate: sliced.sampleRate,
              numberOfFrames: part.frames,
              numberOfChannels: sliced.channels,
              timestamp: Math.round((offsets[i] + part.offsetFrames / sliced.sampleRate) * 1_000_000),
              data: part.data,
            });
            audioEncoder.encode(data);
            data.close();
          }
        }
        await audioEncoder.flush();
        if (audioError) { throw audioError; }
      } finally {
        try {
          if (audioEncoder.state !== 'closed') { audioEncoder.close(); }
        } catch {}
      }
      audio = {
        sampleRate: audioBuffer.sampleRate,
        channels,
        codecPrivate: codecPrivate || opusHead(channels, audioBuffer.sampleRate),
      };
    }

    await encoder.flush();
    if (encodeError) { throw encodeError; }
    if (!videoChunks.length) { throw new Error('Encoding produced no frames.'); }
    const bytes = buildWebm({
      durationMs: total * 1000,
      video: { codecId: support.codecId, width: canvas.width, height: canvas.height },
      audio,
      videoChunks,
      audioChunks,
    });
    return new Blob([bytes], { type: 'video/webm' });
  } finally {
    video.playbackRate = 1;
    try {
      if (encoder.state !== 'closed') { encoder.close(); }
    } catch {}
  }
}
