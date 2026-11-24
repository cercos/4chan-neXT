import { buildWebm, MuxChunk, opusHead, regionAudioChunks, WebmMuxInput } from './DogiriWebCodecs';

export interface Mp4Sample { offset: number; size: number; timestampMs: number; keyframe: boolean }

export interface Mp4VideoTrack {
  fourcc: string;
  width: number;
  height: number;
  durationMs: number;
  samples: Mp4Sample[];
}

export interface Mp4Info {
  fragmented: boolean;
  video: Mp4VideoTrack | null;
  audioFourcc: string | null;
}

export interface RemuxResult {
  file?: File;
  audioDropped?: false | 'board' | 'unsupported';
  warning?: string;
}

interface Box { type: string; dataStart: number; end: number }

function* boxes(u8: Uint8Array, view: DataView, start: number, end: number): Generator<Box> {
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset, false);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) return;
      size = view.getUint32(offset + 8, false) * 2 ** 32 + view.getUint32(offset + 12, false);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) return;
    const type = String.fromCharCode(u8[offset + 4], u8[offset + 5], u8[offset + 6], u8[offset + 7]);
    yield { type, dataStart: offset + headerSize, end: offset + size };
    offset += size;
  }
}

function findBox(u8: Uint8Array, view: DataView, start: number, end: number, type: string): Box | null {
  for (const box of boxes(u8, view, start, end)) {
    if (box.type === type) return box;
  }
  return null;
}

function str4(u8: Uint8Array, offset: number): string {
  return String.fromCharCode(u8[offset], u8[offset + 1], u8[offset + 2], u8[offset + 3]);
}

function firstStsdEntry(u8: Uint8Array, view: DataView, stsd: Box): { fourcc: string, start: number } | null {
  if (stsd.dataStart + 16 > stsd.end || !view.getUint32(stsd.dataStart + 4, false)) return null;
  const start = stsd.dataStart + 8;
  return { fourcc: str4(u8, start + 4), start };
}

function buildVideoTrack(
  u8: Uint8Array, view: DataView, mdhd: Box, stbl: Box, entry: { fourcc: string, start: number },
): Mp4VideoTrack | null {
  const mdhdVersion = u8[mdhd.dataStart];
  const timescale = view.getUint32(mdhd.dataStart + (mdhdVersion ? 20 : 12), false);
  const mdhdDuration = mdhdVersion
    ? Number(view.getBigUint64(mdhd.dataStart + 24, false))
    : view.getUint32(mdhd.dataStart + 16, false);
  if (!timescale) return null;

  const stts = findBox(u8, view, stbl.dataStart, stbl.end, 'stts');
  const ctts = findBox(u8, view, stbl.dataStart, stbl.end, 'ctts');
  const stss = findBox(u8, view, stbl.dataStart, stbl.end, 'stss');
  const stsz = findBox(u8, view, stbl.dataStart, stbl.end, 'stsz');
  const stsc = findBox(u8, view, stbl.dataStart, stbl.end, 'stsc');
  const stco = findBox(u8, view, stbl.dataStart, stbl.end, 'stco');
  const co64 = stco ? null : findBox(u8, view, stbl.dataStart, stbl.end, 'co64');
  if (!stts || !stsz || !stsc || !(stco || co64)) return null;

  const sampleCount = view.getUint32(stsz.dataStart + 8, false);
  if (!sampleCount) return null;
  const uniformSize = view.getUint32(stsz.dataStart + 4, false);
  const sampleSize = (i: number) => uniformSize || view.getUint32(stsz.dataStart + 12 + i * 4, false);

  const pts = new Float64Array(sampleCount);
  let decodeTime = 0;
  {
    const entryCount = view.getUint32(stts.dataStart + 4, false);
    let sample = 0;
    for (let e = 0; e < entryCount && sample < sampleCount; e++) {
      const count = view.getUint32(stts.dataStart + 8 + e * 8, false);
      const delta = view.getUint32(stts.dataStart + 12 + e * 8, false);
      for (let i = 0; i < count && sample < sampleCount; i++) {
        pts[sample++] = decodeTime;
        decodeTime += delta;
      }
    }
  }
  if (ctts) {
    const entryCount = view.getUint32(ctts.dataStart + 4, false);
    let sample = 0;
    for (let e = 0; e < entryCount && sample < sampleCount; e++) {
      const count = view.getUint32(ctts.dataStart + 8 + e * 8, false);
      const cts = view.getInt32(ctts.dataStart + 12 + e * 8, false);
      for (let i = 0; i < count && sample < sampleCount; i++) {
        pts[sample++] += cts;
      }
    }
  }

  let syncSamples: Set<number> | null = null;
  if (stss) {
    syncSamples = new Set();
    const entryCount = view.getUint32(stss.dataStart + 4, false);
    for (let e = 0; e < entryCount; e++) {
      syncSamples.add(view.getUint32(stss.dataStart + 8 + e * 4, false));
    }
  }

  const chunkBox = (stco || co64)!;
  const chunkCount = view.getUint32(chunkBox.dataStart + 4, false);
  const chunkOffset = (i: number) => stco
    ? view.getUint32(chunkBox.dataStart + 8 + i * 4, false)
    : Number(view.getBigUint64(chunkBox.dataStart + 8 + i * 8, false));

  const samples: Mp4Sample[] = [];
  const stscCount = view.getUint32(stsc.dataStart + 4, false);
  let sample = 0;
  for (let e = 0; e < stscCount && sample < sampleCount; e++) {
    const firstChunk = view.getUint32(stsc.dataStart + 8 + e * 12, false);
    const samplesPerChunk = view.getUint32(stsc.dataStart + 12 + e * 12, false);
    const lastChunk = e + 1 < stscCount
      ? view.getUint32(stsc.dataStart + 20 + e * 12, false) - 1
      : chunkCount;
    for (let chunk = firstChunk; chunk <= lastChunk && sample < sampleCount; chunk++) {
      if (chunk < 1 || chunk > chunkCount) return null;
      let offset = chunkOffset(chunk - 1);
      for (let i = 0; i < samplesPerChunk && sample < sampleCount; i++) {
        const size = sampleSize(sample);
        if (offset + size > u8.length) return null;
        samples.push({
          offset,
          size,
          timestampMs: pts[sample] * 1000 / timescale,
          keyframe: !syncSamples || syncSamples.has(sample + 1),
        });
        offset += size;
        sample++;
      }
    }
  }
  if (samples.length !== sampleCount) return null;

  return {
    fourcc: entry.fourcc,
    width: view.getUint16(entry.start + 32, false),
    height: view.getUint16(entry.start + 34, false),
    durationMs: (mdhdDuration || decodeTime) * 1000 / timescale,
    samples,
  };
}

export function parseMp4(u8: Uint8Array): Mp4Info {
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let fragmented = false;
  let moov: Box | null = null;
  for (const box of boxes(u8, view, 0, u8.length)) {
    if (box.type === 'moof') fragmented = true;
    if (box.type === 'moov' && !moov) moov = box;
  }
  if (!moov) throw new Error('No moov box found');

  let video: Mp4VideoTrack | null = null;
  let audioFourcc: string | null = null;
  for (const box of boxes(u8, view, moov.dataStart, moov.end)) {
    if (box.type === 'mvex') fragmented = true;
    if (box.type !== 'trak') continue;
    const mdia = findBox(u8, view, box.dataStart, box.end, 'mdia');
    if (!mdia) continue;
    const hdlr = findBox(u8, view, mdia.dataStart, mdia.end, 'hdlr');
    const mdhd = findBox(u8, view, mdia.dataStart, mdia.end, 'mdhd');
    const minf = findBox(u8, view, mdia.dataStart, mdia.end, 'minf');
    const stbl = minf && findBox(u8, view, minf.dataStart, minf.end, 'stbl');
    const stsd = stbl && findBox(u8, view, stbl.dataStart, stbl.end, 'stsd');
    if (!hdlr || !mdhd || !stbl || !stsd) continue;
    const entry = firstStsdEntry(u8, view, stsd);
    if (!entry) continue;
    const handler = str4(u8, hdlr.dataStart + 8);
    if (handler === 'soun') {
      if (!audioFourcc) audioFourcc = entry.fourcc;
    } else if (handler === 'vide' && !video) {
      video = buildVideoTrack(u8, view, mdhd, stbl, entry);
    }
  }
  return { fragmented, video, audioFourcc };
}

function toUint8(source: any): Uint8Array { // loose: WebCodecs description is BufferSource
  if (source instanceof Uint8Array) return new Uint8Array(source);
  if (source instanceof ArrayBuffer) return new Uint8Array(source.slice(0));
  return new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
}

const AUDIO_CHUNK_FRAMES = 9600;

async function encodeOpusAudio(
  source: ArrayBuffer,
): Promise<{ audio: NonNullable<WebmMuxInput['audio']>, chunks: MuxChunk[] } | null> {
  const scope = window as any; // loose: WebCodecs types not in lib.dom for this target
  if (typeof scope.AudioEncoder?.isConfigSupported !== 'function'
    || !scope.AudioData || !scope.OfflineAudioContext) { return null; }
  try {
    const support = await scope.AudioEncoder.isConfigSupported({
      codec: 'opus', sampleRate: 48_000, numberOfChannels: 2,
    });
    if (!support?.supported) return null;
  } catch {
    return null;
  }

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await new scope.OfflineAudioContext(2, 1, 48_000).decodeAudioData(source);
  } catch {
    return null;
  }

  const channels = Math.min(2, audioBuffer.numberOfChannels);
  const chunks: MuxChunk[] = [];
  let codecPrivate: Uint8Array | null = null;
  let audioError: Error | null = null;
  const encoder = new scope.AudioEncoder({
    output: (chunk: any, metadata: any) => { // loose: WebCodecs types not in lib.dom for this target
      const description = metadata?.decoderConfig?.description;
      if (description && !codecPrivate) { codecPrivate = toUint8(description); }
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({ data, timestampMs: chunk.timestamp / 1000, keyframe: true });
    },
    error: (error: any) => {
      audioError = error instanceof Error ? error : new Error(String(error));
    },
  });
  try {
    encoder.configure({
      codec: 'opus', sampleRate: audioBuffer.sampleRate, numberOfChannels: channels, bitrate: 128_000,
    });
    const sliced = regionAudioChunks(audioBuffer, 0, audioBuffer.duration, AUDIO_CHUNK_FRAMES);
    for (const part of sliced.chunks) {
      if (audioError) { throw audioError; }
      const data = new scope.AudioData({
        format: 'f32-planar',
        sampleRate: sliced.sampleRate,
        numberOfFrames: part.frames,
        numberOfChannels: sliced.channels,
        timestamp: Math.round(part.offsetFrames / sliced.sampleRate * 1_000_000),
        data: part.data,
      });
      encoder.encode(data);
      data.close();
    }
    await encoder.flush();
    if (audioError) { throw audioError; }
  } catch (err) {
    console.warn('Opus audio encode failed:', err);
    return null;
  } finally {
    try {
      if (encoder.state !== 'closed') { encoder.close(); }
    } catch {}
  }
  if (!chunks.length) return null;
  return {
    audio: {
      sampleRate: audioBuffer.sampleRate,
      channels,
      codecPrivate: codecPrivate || opusHead(channels, audioBuffer.sampleRate),
    },
    chunks,
  };
}

const CODEC_NAMES: Record<string, string> = {
  hvc1: 'HEVC', hev1: 'HEVC', av01: 'AV1', mp4v: 'MPEG-4 Part 2',
};

export class VideoRemuxer {
  static matches(file: File): boolean {
    return /^video\/(mp4|quicktime)$/.test(file.type) || /\.(mp4|m4v|mov)$/i.test(file.name);
  }

  static async process(file: File, opts: { keepAudio: boolean }): Promise<RemuxResult> {
    let buffer: ArrayBuffer;
    let u8: Uint8Array;
    let info: Mp4Info;
    try {
      buffer = await file.arrayBuffer();
      u8 = new Uint8Array(buffer);
      info = parseMp4(u8);
    } catch (error) {
      console.warn('Failed to parse video container:', error);
      return {};
    }
    const video = info.video;
    if (!video) return {};

    if (video.fourcc === 'avc1' || video.fourcc === 'avc3') {
      if (info.audioFourcc && info.audioFourcc !== 'mp4a') {
        return { warning: `${file.name} has a ${info.audioFourcc.trim()} audio track, which 4chan does not accept in MP4. Posting will fail unless the audio is removed.` };
      }
      return {};
    }
    if (video.fourcc !== 'vp09' && video.fourcc !== 'vp08') {
      const codecName = CODEC_NAMES[video.fourcc] || video.fourcc.trim();
      return { warning: `${file.name} will be rejected by 4chan: ${codecName} video is not supported. It needs to be re-encoded (e.g. in Dōgiri).` };
    }
    if (info.fragmented) {
      return { warning: `${file.name} is a fragmented MP4, which cannot be rewrapped as WebM. It needs to be re-encoded (e.g. in Dōgiri).` };
    }
    if (!video.samples.length || !video.width || !video.height) return {};

    let audio: WebmMuxInput['audio'];
    let audioChunks: MuxChunk[] = [];
    let audioDropped: RemuxResult['audioDropped'] = false;
    if (info.audioFourcc) {
      if (opts.keepAudio) {
        const encoded = await encodeOpusAudio(buffer.slice(0));
        if (encoded) {
          ({ audio, chunks: audioChunks } = encoded);
        } else {
          audioDropped = 'unsupported';
        }
      } else {
        audioDropped = 'board';
      }
    }

    let bytes: Uint8Array;
    try {
      bytes = buildWebm({
        durationMs: video.durationMs,
        video: {
          codecId: video.fourcc === 'vp09' ? 'V_VP9' : 'V_VP8',
          width: video.width,
          height: video.height,
        },
        audio,
        videoChunks: video.samples.map(sample => ({
          data: u8.subarray(sample.offset, sample.offset + sample.size),
          timestampMs: sample.timestampMs,
          keyframe: sample.keyframe,
        })),
        audioChunks,
      });
    } catch (error) {
      console.warn('Failed to remux video:', error);
      return {};
    }
    const name = file.name.replace(/\.(mp4|m4v|mov)$/i, '') + '.webm';
    return { file: new File([bytes], name, { type: 'video/webm' }), audioDropped };
  }
}
