import { describe, expect, it } from 'vitest';

import { parseMp4, VideoRemuxer } from './VideoRemuxer';

const ascii = (s: string) => new TextEncoder().encode(s);

const zeros = (length: number) => new Uint8Array(length);

function u32(...values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((value, i) => view.setUint32(i * 4, value >>> 0, false));
  return out;
}

function u16(...values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 2);
  const view = new DataView(out.buffer);
  values.forEach((value, i) => view.setUint16(i * 2, value, false));
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const body = concat(...parts);
  return concat(u32(8 + body.length), ascii(type), body);
}

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function videoTrak(fourcc: string, opts: { ctts?: Uint8Array } = {}): Uint8Array {
  const stsdEntry = concat(u32(86), ascii(fourcc), zeros(24), u16(64, 48), zeros(50));
  const stbl = box('stbl',
    box('stsd', u32(0), u32(1), stsdEntry),
    box('stts', u32(0), u32(2), u32(2, 100), u32(1, 100)),
    ...(opts.ctts ? [opts.ctts] : []),
    box('stsc', u32(0), u32(2), u32(1, 2, 1), u32(2, 1, 1)),
    box('stsz', u32(0), u32(0), u32(3), u32(3, 4, 5)),
    box('stco', u32(0), u32(2), u32(24, 31)),
    box('stss', u32(0), u32(1), u32(1)),
  );
  return box('trak', box('mdia',
    box('mdhd', u32(0), u32(0), u32(0), u32(1000), u32(300)),
    box('hdlr', u32(0), u32(0), ascii('vide'), u32(0, 0, 0)),
    box('minf', stbl),
  ));
}

function audioTrak(fourcc: string): Uint8Array {
  return box('trak', box('mdia',
    box('mdhd', u32(0), u32(0), u32(0), u32(48000), u32(14400)),
    box('hdlr', u32(0), u32(0), ascii('soun'), u32(0, 0, 0)),
    box('minf', box('stbl', box('stsd', u32(0), u32(1), concat(u32(36), ascii(fourcc), zeros(28))))),
  ));
}

// ftyp (16 bytes) + mdat header (8 bytes) puts the first sample at offset 24,
// matching the stco offsets above. Samples: 3 + 4 bytes in chunk 1, 5 in chunk 2.
function makeMp4(fourcc = 'vp09', opts: { audio?: string, moof?: boolean, ctts?: Uint8Array } = {}): Uint8Array {
  return concat(
    box('ftyp', ascii('isom'), u32(0)),
    box('mdat', Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])),
    ...(opts.moof ? [box('moof')] : []),
    box('moov', videoTrak(fourcc, { ctts: opts.ctts }), ...(opts.audio ? [audioTrak(opts.audio)] : [])),
  );
}

describe('parseMp4', () => {
  it('parses the video track sample table', () => {
    const info = parseMp4(makeMp4());
    expect(info.fragmented).toBe(false);
    expect(info.audioFourcc).toBeNull();
    expect(info.video).toMatchObject({ fourcc: 'vp09', width: 64, height: 48, durationMs: 300 });
    expect(info.video!.samples).toEqual([
      { offset: 24, size: 3, timestampMs: 0, keyframe: true },
      { offset: 27, size: 4, timestampMs: 100, keyframe: false },
      { offset: 31, size: 5, timestampMs: 200, keyframe: false },
    ]);
  });

  it('applies ctts composition offsets', () => {
    const ctts = box('ctts', u32(0), u32(2), u32(1, 50), u32(2, 0));
    const info = parseMp4(makeMp4('vp09', { ctts }));
    expect(info.video!.samples.map(s => s.timestampMs)).toEqual([50, 100, 200]);
  });

  it('detects the audio track codec', () => {
    expect(parseMp4(makeMp4('vp09', { audio: 'mp4a' })).audioFourcc).toBe('mp4a');
    expect(parseMp4(makeMp4('avc1', { audio: 'Opus' })).audioFourcc).toBe('Opus');
  });

  it('flags fragmented files', () => {
    expect(parseMp4(makeMp4('vp09', { moof: true })).fragmented).toBe(true);
  });

  it('throws without a moov box', () => {
    expect(() => parseMp4(box('ftyp', ascii('isom'), u32(0)))).toThrow();
  });
});

describe('VideoRemuxer.process', () => {
  const asFile = (bytes: Uint8Array, name = 'clip.mp4') =>
    new File([bytes], name, { type: 'video/mp4' });

  it('remuxes VP9 in MP4 to WebM losslessly', async () => {
    const result = await VideoRemuxer.process(asFile(makeMp4()), { keepAudio: true });
    expect(result.warning).toBeUndefined();
    expect(result.audioDropped).toBe(false);
    expect(result.file!.name).toBe('clip.webm');
    expect(result.file!.type).toBe('video/webm');
    const bytes = new Uint8Array(await result.file!.arrayBuffer());
    expect([...bytes.subarray(0, 4)]).toEqual([0x1A, 0x45, 0xDF, 0xA3]);
    expect(contains(bytes, ascii('V_VP9'))).toBe(true);
    expect(contains(bytes, Uint8Array.from([8, 9, 10, 11, 12]))).toBe(true);
  });

  it('drops the audio track for no-audio boards', async () => {
    const result = await VideoRemuxer.process(asFile(makeMp4('vp09', { audio: 'mp4a' })), { keepAudio: false });
    expect(result.audioDropped).toBe('board');
    const bytes = new Uint8Array(await result.file!.arrayBuffer());
    expect(contains(bytes, ascii('A_OPUS'))).toBe(false);
  });

  it('reports dropped audio when the browser cannot encode opus', async () => {
    const result = await VideoRemuxer.process(asFile(makeMp4('vp09', { audio: 'mp4a' })), { keepAudio: true });
    expect(result.audioDropped).toBe('unsupported');
    expect(result.file!.name).toBe('clip.webm');
  });

  it('leaves h264 files alone', async () => {
    const result = await VideoRemuxer.process(asFile(makeMp4('avc1')), { keepAudio: true });
    expect(result).toEqual({});
  });

  it('warns about h264 with an unsupported audio codec', async () => {
    const result = await VideoRemuxer.process(asFile(makeMp4('avc1', { audio: 'Opus' })), { keepAudio: true });
    expect(result.file).toBeUndefined();
    expect(result.warning).toMatch(/audio/);
  });

  it('warns about codecs 4chan does not accept', async () => {
    const result = await VideoRemuxer.process(asFile(makeMp4('hvc1')), { keepAudio: true });
    expect(result.file).toBeUndefined();
    expect(result.warning).toMatch(/HEVC/);
  });

  it('warns about fragmented files instead of remuxing', async () => {
    const result = await VideoRemuxer.process(asFile(makeMp4('vp09', { moof: true })), { keepAudio: true });
    expect(result.file).toBeUndefined();
    expect(result.warning).toMatch(/fragmented/);
  });
});
