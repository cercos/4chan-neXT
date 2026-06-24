import Callbacks from "../classes/Callbacks";
import Post from "../classes/Post";
import { g, Conf } from "../globals/globals";
import $ from "../platform/$";
import CrossOrigin from "../platform/CrossOrigin";

/*
 * Overlays a YouTube-style duration badge on webm/mp4 thumbnails. 4chan doesn't
 * expose video length in its post data, so the length is read from each file's
 * metadata. Probes are lazy (IntersectionObserver, only as a thumb nears the
 * viewport) and cached by MD5 so a video in multiple posts is fetched once.
 *
 * For webm we range-fetch just the header and parse the duration out of the EBML
 * (a few KB), which is far cheaper than decoding the file with a media element.
 * mp4 (and any webm the parse misses) falls back to a throwaway <video>.
 */
const VideoDuration = {
  cache: new Map<string, string>(),
  observer: undefined as IntersectionObserver | undefined,

  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread' && g.VIEW !== 'archive') || !Conf['Video Duration Badge']) {
      return;
    }

    if (window.IntersectionObserver) {
      VideoDuration.observer = new IntersectionObserver(VideoDuration.onIntersect, { rootMargin: '200px' });
    }

    return Callbacks.Post.push({
      name: 'Video Duration Badge',
      cb:   VideoDuration.node,
    });
  },

  node(this: Post) {
    const { file } = this;
    if (!file || !file.isVideo || !file.thumbLink) { return; }
    const thumbLink = file.thumbLink as HTMLElement;

    const cached = file.MD5 ? VideoDuration.cache.get(file.MD5) : undefined;
    if (cached) { VideoDuration.addBadge(thumbLink, cached); return; }

    if (VideoDuration.observer) {
      (thumbLink as any)._vdFile = file;
      VideoDuration.observer.observe(thumbLink);
    } else {
      VideoDuration.probe(thumbLink, file);
    }
  },

  onIntersect(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
    for (const entry of entries) {
      if (!entry.isIntersecting) { continue; }
      const thumbLink = entry.target as HTMLElement;
      observer.unobserve(thumbLink);
      const file = (thumbLink as any)._vdFile;
      delete (thumbLink as any)._vdFile;
      if (file) { VideoDuration.probe(thumbLink, file); }
    }
  },

  probe(thumbLink: HTMLElement, file: Post['file']) {
    const md5 = file.MD5;
    if (md5 && VideoDuration.cache.has(md5)) {
      VideoDuration.addBadge(thumbLink, VideoDuration.cache.get(md5)!);
      return;
    }

    const apply = (seconds: number) => {
      const text = VideoDuration.format(seconds);
      if (md5) { VideoDuration.cache.set(md5, text); }
      VideoDuration.addBadge(thumbLink, text);
    };

    // webm: read the duration from the header bytes; fall back to <video> on miss.
    if (/\.webm$/i.test(file.url)) {
      CrossOrigin.binary(file.url, (data: Uint8Array | null) => {
        let seconds: number | null = null;
        if (data) { try { seconds = VideoDuration.parseWebmDuration(data); } catch {} }
        if (seconds != null && isFinite(seconds) && seconds > 0) {
          apply(seconds);
        } else {
          VideoDuration.probeElement(file, apply);
        }
      }, { Range: 'bytes=0-16383' });
      return;
    }

    VideoDuration.probeElement(file, apply);
  },

  probeElement(file: Post['file'], apply: (seconds: number) => void) {
    const video = $.el('video', { preload: 'metadata' }) as HTMLVideoElement;
    const cleanup = () => { video.removeAttribute('src'); video.load(); };
    $.on(video, 'loadedmetadata', () => {
      const seconds = video.duration;
      if (isFinite(seconds) && seconds > 0) { apply(seconds); }
      cleanup();
    });
    $.on(video, 'error', cleanup);
    video.src = file.url;
  },

  // Walks the EBML header far enough to read Segment > Info > Duration (a float in
  // TimecodeScale units). Returns seconds, or null if not found in the given bytes.
  // IDs are the marker-stripped values produced by the vint reader (e.g. Duration
  // 0x4489 -> 0x489), matching the convention in Metadata.ts.
  parseWebmDuration(data: Uint8Array): number | null {
    let i = 0;
    const readVint = () => {
      let n = data[i++];
      let len = 0;
      while (n < (0x80 >> len)) { len++; }
      n ^= (0x80 >> len);
      while (len-- && (i < data.length)) { n = (n << 8) ^ data[i++]; }
      return n;
    };

    let timecodeScale = 1000000; // EBML default: nanoseconds per tick
    let durationTicks: number | null = null;

    while (i < data.length) {
      const element = readVint();
      const size = readVint();
      if (element === 0x8538067 || element === 0x549A966) { // Segment / Info: descend
        continue;
      } else if (element === 0xAD7B1) { // TimecodeScale (uint)
        let v = 0;
        for (let k = 0; (k < size) && (i < data.length); k++) { v = (v * 256) + data[i++]; }
        timecodeScale = v;
      } else if (element === 0x489) { // Duration (float)
        if (((size === 4) || (size === 8)) && ((i + size) <= data.length)) {
          const dv = new DataView(data.buffer, data.byteOffset + i, size);
          durationTicks = (size === 4) ? dv.getFloat32(0, false) : dv.getFloat64(0, false);
        }
        i += size;
      } else {
        i += size;
      }
    }

    if (durationTicks == null) { return null; }
    return (durationTicks * timecodeScale) / 1e9;
  },

  addBadge(thumbLink: HTMLElement, text: string) {
    if ($('.video-duration-badge', thumbLink)) { return; }
    $.addClass(thumbLink, 'has-video-duration');
    $.add(thumbLink, $.el('span', { className: 'video-duration-badge', textContent: text }));
  },

  format(seconds: number) {
    seconds = Math.round(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  },
};

export default VideoDuration;
