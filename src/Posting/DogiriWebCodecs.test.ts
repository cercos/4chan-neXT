import { describe, expect, it } from 'vitest';
import {
  buildWebm, clipTimelineOffsets, createRateController, opusHead, regionAudioChunks, webCodecsSupport,
} from './DogiriWebCodecs';

const readVintLength = (byte: number) => {
  for (let i = 0; i < 8; i++) {
    if (byte & (0x80 >> i)) { return i + 1; }
  }
  return 8;
};

const readId = (bytes: Uint8Array, off: number) => {
  const length = readVintLength(bytes[off]);
  let id = 0;
  for (let i = 0; i < length; i++) { id = id * 256 + bytes[off + i]; }
  return { id, length };
};

const readSize = (bytes: Uint8Array, off: number) => {
  const length = readVintLength(bytes[off]);
  let value = bytes[off] & (0xFF >> length);
  for (let i = 1; i < length; i++) { value = value * 256 + bytes[off + i]; }
  return { value, length };
};

interface EbmlChild { id: number, dataStart: number, dataEnd: number }

const childrenOf = (bytes: Uint8Array, start: number, end: number): EbmlChild[] => {
  const out: EbmlChild[] = [];
  let off = start;
  while (off < end) {
    const id = readId(bytes, off);
    const size = readSize(bytes, off + id.length);
    const dataStart = off + id.length + size.length;
    out.push({ id: id.id, dataStart, dataEnd: dataStart + size.value });
    off = dataStart + size.value;
  }
  return out;
};

const findChild = (bytes: Uint8Array, scope: EbmlChild, id: number) =>
  childrenOf(bytes, scope.dataStart, scope.dataEnd).find(child => child.id === id);

const uintOf = (bytes: Uint8Array, child: EbmlChild) => {
  let value = 0;
  for (let i = child.dataStart; i < child.dataEnd; i++) { value = value * 256 + bytes[i]; }
  return value;
};

const textOf = (bytes: Uint8Array, child: EbmlChild) =>
  new TextDecoder().decode(bytes.subarray(child.dataStart, child.dataEnd));

const floatOf = (bytes: Uint8Array, child: EbmlChild) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset + child.dataStart);
  return child.dataEnd - child.dataStart === 8 ? view.getFloat64(0, false) : view.getFloat32(0, false);
};

const topLevel = (bytes: Uint8Array) => childrenOf(bytes, 0, bytes.length);

const segmentOf = (bytes: Uint8Array) => {
  const segment = topLevel(bytes).find(child => child.id === 0x18538067);
  if (!segment) { throw new Error('no segment'); }
  return segment;
};

const chunk = (timestampMs: number, keyframe: boolean, bytes: number[]) =>
  ({ data: Uint8Array.from(bytes), timestampMs, keyframe });

const videoOnly = (videoChunks = [chunk(0, true, [1, 2, 3])]) => buildWebm({
  durationMs: 2000,
  video: { codecId: 'V_VP9' as const, width: 640, height: 360 },
  videoChunks,
  audioChunks: [],
});

describe('clipTimelineOffsets', () => {
  it('accumulates clip durations into output offsets', () => {
    expect(clipTimelineOffsets([{ start: 1, end: 3 }, { start: 5, end: 8 }])).toEqual([0, 2]);
    expect(clipTimelineOffsets([{ start: 0, end: 0.5 }, { start: 2, end: 3 }, { start: 4, end: 6 }]))
      .toEqual([0, 0.5, 1.5]);
  });

  it('is empty for no regions', () => {
    expect(clipTimelineOffsets([])).toEqual([]);
  });
});

describe('opusHead', () => {
  it('encodes a valid OpusHead structure', () => {
    const head = opusHead(2, 44100);
    expect(head.length).toBe(19);
    expect(new TextDecoder().decode(head.subarray(0, 8))).toBe('OpusHead');
    expect(head[8]).toBe(1);
    expect(head[9]).toBe(2);
    const view = new DataView(head.buffer);
    expect(view.getUint16(10, true)).toBe(312);
    expect(view.getUint32(12, true)).toBe(44100);
    expect(view.getUint16(16, true)).toBe(0);
    expect(head[18]).toBe(0);
  });
});

describe('webCodecsSupport', () => {
  const videoScope = (supportedCodecs: (codec: string) => boolean) => ({
    VideoFrame: class {},
    VideoEncoder: {
      isConfigSupported: async (config: { codec: string }) =>
        ({ supported: supportedCodecs(config.codec) }),
    },
  });

  it('is null when VideoEncoder is missing', async () => {
    expect(await webCodecsSupport(640, 360, false, {})).toBeNull();
  });

  it('prefers vp9 and reports the matching webm codec id', async () => {
    const support = await webCodecsSupport(640, 360, false,
      videoScope(codec => codec.startsWith('vp09')));
    expect(support).toMatchObject({ codecId: 'V_VP9' });
    expect(support!.codec.startsWith('vp09')).toBe(true);
  });

  it('falls back to vp8 when vp9 is unsupported', async () => {
    const support = await webCodecsSupport(640, 360, false, videoScope(codec => codec === 'vp8'));
    expect(support).toEqual({ codec: 'vp8', codecId: 'V_VP8' });
  });

  it('is null when no codec is supported', async () => {
    expect(await webCodecsSupport(640, 360, false, videoScope(() => false))).toBeNull();
  });

  it('is null when VideoFrame is missing', async () => {
    const scope = videoScope(() => true) as any;
    delete scope.VideoFrame;
    expect(await webCodecsSupport(640, 360, false, scope)).toBeNull();
  });

  it('requires audio machinery when audio is kept', async () => {
    expect(await webCodecsSupport(640, 360, true, videoScope(() => true))).toBeNull();
    const withAudio = {
      ...videoScope(() => true),
      OfflineAudioContext: class {},
      AudioData: class {},
      AudioEncoder: { isConfigSupported: async () => ({ supported: true }) },
    };
    expect(await webCodecsSupport(640, 360, true, withAudio)).toMatchObject({ codecId: 'V_VP9' });
  });

  it('is null when opus encoding is unsupported and audio is kept', async () => {
    const scope = {
      ...videoScope(() => true),
      OfflineAudioContext: class {},
      AudioData: class {},
      AudioEncoder: { isConfigSupported: async () => ({ supported: false }) },
    };
    expect(await webCodecsSupport(640, 360, true, scope)).toBeNull();
  });

  it('survives isConfigSupported throwing on a codec string', async () => {
    const scope = {
      VideoFrame: class {},
      VideoEncoder: {
        isConfigSupported: async (config: { codec: string }) => {
          if (config.codec !== 'vp8') { throw new TypeError('unknown codec'); }
          return { supported: true };
        },
      },
    };
    expect(await webCodecsSupport(640, 360, false, scope)).toEqual({ codec: 'vp8', codecId: 'V_VP8' });
  });
});

describe('regionAudioChunks', () => {
  const fakeBuffer = (channels: Float32Array[], sampleRate: number) => ({
    numberOfChannels: channels.length,
    length: channels[0].length,
    sampleRate,
    getChannelData: (index: number) => channels[index],
  });

  it('slices the region into planar chunks with frame offsets', () => {
    const ch0 = Float32Array.from({ length: 10 }, (_, i) => i);
    const ch1 = Float32Array.from({ length: 10 }, (_, i) => i + 100);
    const result = regionAudioChunks(fakeBuffer([ch0, ch1], 2) as any, 1, 4, 2);
    expect(result.channels).toBe(2);
    expect(result.sampleRate).toBe(2);
    expect(result.chunks.map(part => part.offsetFrames)).toEqual([0, 2, 4]);
    expect(result.chunks.map(part => part.frames)).toEqual([2, 2, 2]);
    expect([...result.chunks[0].data]).toEqual([2, 3, 102, 103]);
    expect([...result.chunks[2].data]).toEqual([6, 7, 106, 107]);
  });

  it('clamps the region to the buffer and emits a short tail chunk', () => {
    const ch0 = Float32Array.from({ length: 5 }, (_, i) => i);
    const result = regionAudioChunks(fakeBuffer([ch0], 2) as any, 1, 99, 2);
    expect(result.channels).toBe(1);
    expect(result.chunks.map(part => part.frames)).toEqual([2, 1]);
    expect([...result.chunks[1].data]).toEqual([4]);
  });

  it('caps at two channels', () => {
    const make = () => Float32Array.from({ length: 4 }, (_, i) => i);
    const result = regionAudioChunks(fakeBuffer([make(), make(), make()], 2) as any, 0, 2, 4);
    expect(result.channels).toBe(2);
    expect(result.chunks[0].data.length).toBe(8);
  });

  it('is empty for a region past the end of the buffer', () => {
    const result = regionAudioChunks(fakeBuffer([new Float32Array(4)], 2) as any, 10, 12, 4);
    expect(result.chunks).toEqual([]);
  });
});

describe('buildWebm', () => {
  it('produces an EBML header declaring webm and a size-known segment', () => {
    const bytes = videoOnly();
    const [header, segment] = topLevel(bytes);
    expect(header.id).toBe(0x1A45DFA3);
    expect(segment.id).toBe(0x18538067);
    expect(segment.dataEnd).toBe(bytes.length);
    const docType = findChild(bytes, header, 0x4282);
    expect(docType && textOf(bytes, docType)).toBe('webm');
  });

  it('writes the timestamp scale and duration into Info', () => {
    const bytes = videoOnly();
    const info = findChild(bytes, segmentOf(bytes), 0x1549A966);
    expect(info).toBeDefined();
    const scale = findChild(bytes, info!, 0x2AD7B1);
    expect(scale && uintOf(bytes, scale)).toBe(1_000_000);
    const duration = findChild(bytes, info!, 0x4489);
    expect(duration && floatOf(bytes, duration)).toBe(2000);
  });

  it('describes the video track', () => {
    const bytes = videoOnly();
    const tracks = findChild(bytes, segmentOf(bytes), 0x1654AE6B);
    const entries = childrenOf(bytes, tracks!.dataStart, tracks!.dataEnd)
      .filter(child => child.id === 0xAE);
    expect(entries.length).toBe(1);
    const codec = findChild(bytes, entries[0], 0x86);
    expect(codec && textOf(bytes, codec)).toBe('V_VP9');
    const video = findChild(bytes, entries[0], 0xE0);
    const width = findChild(bytes, video!, 0xB0);
    const height = findChild(bytes, video!, 0xBA);
    expect(width && uintOf(bytes, width)).toBe(640);
    expect(height && uintOf(bytes, height)).toBe(360);
  });

  it('describes an opus audio track when audio is present', () => {
    const bytes = buildWebm({
      durationMs: 1000,
      video: { codecId: 'V_VP8', width: 320, height: 240 },
      audio: { sampleRate: 48000, channels: 2, codecPrivate: opusHead(2, 48000) },
      videoChunks: [chunk(0, true, [1])],
      audioChunks: [chunk(0, true, [9, 9])],
    });
    const tracks = findChild(bytes, segmentOf(bytes), 0x1654AE6B);
    const entries = childrenOf(bytes, tracks!.dataStart, tracks!.dataEnd)
      .filter(child => child.id === 0xAE);
    expect(entries.length).toBe(2);
    const codec = findChild(bytes, entries[1], 0x86);
    expect(codec && textOf(bytes, codec)).toBe('A_OPUS');
    const codecPrivate = findChild(bytes, entries[1], 0x63A2);
    expect(codecPrivate && textOf(bytes, { ...codecPrivate, dataEnd: codecPrivate.dataStart + 8 }))
      .toBe('OpusHead');
    const audio = findChild(bytes, entries[1], 0xE1);
    const frequency = findChild(bytes, audio!, 0xB5);
    expect(frequency && floatOf(bytes, frequency)).toBe(48000);
    const channels = findChild(bytes, audio!, 0x9F);
    expect(channels && uintOf(bytes, channels)).toBe(2);
  });

  it('stores chunks as simpleblocks with cluster-relative timestamps', () => {
    const bytes = videoOnly([chunk(0, true, [1, 2, 3]), chunk(40, false, [4, 5])]);
    const clusters = childrenOf(bytes, segmentOf(bytes).dataStart, segmentOf(bytes).dataEnd)
      .filter(child => child.id === 0x1F43B675);
    expect(clusters.length).toBe(1);
    const parts = childrenOf(bytes, clusters[0].dataStart, clusters[0].dataEnd);
    expect(parts[0].id).toBe(0xE7);
    expect(uintOf(bytes, parts[0])).toBe(0);
    const blocks = parts.filter(part => part.id === 0xA3);
    expect(blocks.length).toBe(2);
    const first = bytes.subarray(blocks[0].dataStart, blocks[0].dataEnd);
    expect([...first]).toEqual([0x81, 0, 0, 0x80, 1, 2, 3]);
    const second = bytes.subarray(blocks[1].dataStart, blocks[1].dataEnd);
    expect([...second]).toEqual([0x81, 0, 40, 0, 4, 5]);
  });

  it('starts a new cluster on a later keyframe', () => {
    const bytes = videoOnly([
      chunk(0, true, [1]), chunk(40, false, [2]), chunk(6000, true, [3]),
    ]);
    const clusters = childrenOf(bytes, segmentOf(bytes).dataStart, segmentOf(bytes).dataEnd)
      .filter(child => child.id === 0x1F43B675);
    expect(clusters.length).toBe(2);
    const parts = childrenOf(bytes, clusters[1].dataStart, clusters[1].dataEnd);
    expect(uintOf(bytes, parts[0])).toBe(6000);
    const block = bytes.subarray(parts[1].dataStart, parts[1].dataEnd);
    expect([...block]).toEqual([0x81, 0, 0, 0x80, 3]);
  });

  it('interleaves audio and video blocks by timestamp', () => {
    const bytes = buildWebm({
      durationMs: 100,
      video: { codecId: 'V_VP9', width: 320, height: 240 },
      audio: { sampleRate: 48000, channels: 2, codecPrivate: opusHead(2, 48000) },
      videoChunks: [chunk(0, true, [1]), chunk(40, false, [2])],
      audioChunks: [chunk(0, true, [3]), chunk(20, true, [4])],
    });
    const clusters = childrenOf(bytes, segmentOf(bytes).dataStart, segmentOf(bytes).dataEnd)
      .filter(child => child.id === 0x1F43B675);
    expect(clusters.length).toBe(1);
    const blocks = childrenOf(bytes, clusters[0].dataStart, clusters[0].dataEnd)
      .filter(part => part.id === 0xA3)
      .map(part => [...bytes.subarray(part.dataStart, part.dataEnd)]);
    expect(blocks).toEqual([
      [0x81, 0, 0, 0x80, 1],
      [0x82, 0, 0, 0x80, 3],
      [0x82, 0, 20, 0x80, 4],
      [0x81, 0, 40, 0, 2],
    ]);
  });

  it('splits clusters rather than overflowing relative timestamps', () => {
    const bytes = videoOnly([
      chunk(0, true, [1]), chunk(40_000, false, [2]),
    ]);
    const clusters = childrenOf(bytes, segmentOf(bytes).dataStart, segmentOf(bytes).dataEnd)
      .filter(child => child.id === 0x1F43B675);
    expect(clusters.length).toBe(2);
    const parts = childrenOf(bytes, clusters[1].dataStart, clusters[1].dataEnd);
    expect(uintOf(bytes, parts[0])).toBe(40_000);
  });
});

describe('createRateController', () => {
  const BASE = 1 / 30;
  const feedClean = (controller: ReturnType<typeof createRateController>, count: number) => {
    let last: { rate: number, rewind: boolean } = { rate: controller.rate(), rewind: false };
    for (let i = 0; i < count; i++) { last = controller.onDelta(BASE); }
    return last;
  };

  it('starts at 1x and holds it until a sustained clean streak', () => {
    const controller = createRateController();
    expect(controller.rate()).toBe(1);
    feedClean(controller, 23);
    expect(controller.rate()).toBe(1);
    feedClean(controller, 1);
    expect(controller.rate()).toBe(2);
  });

  it('escalates stepwise to 4x and stays there', () => {
    const controller = createRateController();
    feedClean(controller, 24);
    expect(controller.rate()).toBe(2);
    feedClean(controller, 24);
    expect(controller.rate()).toBe(4);
    feedClean(controller, 100);
    expect(controller.rate()).toBe(4);
  });

  it('tolerates timing jitter below the drop threshold', () => {
    const controller = createRateController();
    for (let i = 0; i < 24; i++) { controller.onDelta(i % 2 ? BASE : BASE * 1.4); }
    expect(controller.rate()).toBe(2);
  });

  it('steps down and requests a rewind on a dropped frame at elevated rate', () => {
    const controller = createRateController();
    feedClean(controller, 24);
    expect(controller.rate()).toBe(2);
    const decision = controller.onDelta(BASE * 2.5);
    expect(decision).toEqual({ rate: 1, rewind: true });
    expect(controller.rate()).toBe(1);
  });

  it('never requests a rewind at 1x', () => {
    const controller = createRateController();
    feedClean(controller, 5);
    const decision = controller.onDelta(BASE * 3);
    expect(decision).toEqual({ rate: 1, rewind: false });
  });

  it('irregular timing at 1x keeps resetting the streak', () => {
    const controller = createRateController();
    for (let i = 0; i < 200; i++) {
      controller.onDelta(i % 10 === 9 ? BASE * 2 : BASE);
    }
    expect(controller.rate()).toBe(1);
  });

  it('stops retrying a rate after two failures at it', () => {
    const controller = createRateController();
    feedClean(controller, 24);
    controller.onDelta(BASE * 2.5);
    feedClean(controller, 24);
    expect(controller.rate()).toBe(2);
    controller.onDelta(BASE * 2.5);
    feedClean(controller, 200);
    expect(controller.rate()).toBe(1);
  });

  it('retries a higher rate once after a single failure', () => {
    const controller = createRateController();
    feedClean(controller, 48);
    expect(controller.rate()).toBe(4);
    controller.onDelta(BASE * 2.5);
    expect(controller.rate()).toBe(2);
    feedClean(controller, 24);
    expect(controller.rate()).toBe(4);
  });
});
