import Notice from "../classes/Notice";
import Header from "../General/Header";
import UI from "../General/UI";
import { dragstart } from "../General/UI";
import { Conf, d, g } from "../globals/globals";
import Icon from "../Icons/icon";
import $ from "../platform/$";
import $$ from "../platform/$$";
import CrossOrigin from "../platform/CrossOrigin";
import { dict, SECOND } from "../platform/helpers";

type FilterKind = 'all' | 'image' | 'video';

interface MediaItem {
  url: string;
  name: string;
  isImage: boolean;
  isVideo: boolean;
}

const DownloadAll = {
  busy: false,
  dialog: null as HTMLDivElement | null,
  catalogItems: null as MediaItem[] | null,
  catalogFetching: false,

  init() {
    if (!(Conf['Download All Media'] && ['thread', 'index', 'catalog'].includes(g.VIEW))) return;

    const el = $.el('a', {
      href: 'javascript:;',
      title: 'Download all media',
    });
    Icon.set(el, 'download', 'Download all media');
    $.on(el, 'click', DownloadAll.cb.open);
    Header.addShortcut('download-all', el, 525);

    const onPostsReady = () => {
      if (DownloadAll.dialog && !DownloadAll.dialog.hidden) DownloadAll.refreshDialog();
    };
    $.on(d, '4chanXInitFinished PostsInserted ThreadUpdate IndexRefresh', onPostsReady);

    if (Conf['Persistent Download Media']) DownloadAll.show();
  },

  menu: {
    init() {
      if (!(Conf['Download All Media'] && ['thread', 'index', 'catalog'].includes(g.VIEW))) return;

      const el = $.el('span', {
        textContent: 'Download Media',
        className: 'download-all-link',
      });
      (Header as any).menu.addEntry({
        el,
        order: 106,
        subEntries: DownloadAll.menu.createSubEntries(),
      });
    },

    createSubEntries() {
      const all = $.el('a', { href: 'javascript:;', textContent: 'Download all media' });
      $.on(all, 'click', () => DownloadAll.start('all'));

      const images = $.el('a', { href: 'javascript:;', textContent: 'Download images only' });
      $.on(images, 'click', () => DownloadAll.start('image'));

      const videos = $.el('a', { href: 'javascript:;', textContent: 'Download videos only' });
      $.on(videos, 'click', () => DownloadAll.start('video'));

      const zipLabel = UI.checkbox('Download All as ZIP', 'Bundle as ZIP');
      const zipInput = zipLabel.firstElementChild as HTMLInputElement;
      $.on(zipInput, 'change', $.cb.checked);

      return [
        { el: all },
        { el: images },
        { el: videos },
        { el: zipLabel },
      ];
    },
  },

  cb: {
    open(e?: Event) {
      if (e) e.preventDefault();
      DownloadAll.toggle();
    },
  },

  toggle() {
    if (DownloadAll.dialog && !DownloadAll.dialog.hidden) {
      DownloadAll.hide();
    } else {
      DownloadAll.show();
    }
  },

  hide() {
    if (DownloadAll.dialog) DownloadAll.dialog.hidden = true;
  },

  show() {
    if (!DownloadAll.dialog) DownloadAll.buildDialog();
    DownloadAll.dialog.hidden = false;
    DownloadAll.refreshDialog();
    if (g.VIEW === 'catalog' && !DownloadAll.catalogItems) {
      DownloadAll.fetchCatalog(() => DownloadAll.refreshDialog());
    }
  },

  buildDialog() {
    const dialog = $.el('div', { id: 'download-all-picker', className: 'dialog' }) as HTMLDivElement;
    dialog.style.cssText = Conf['download-all-picker.position'] || '';
    dialog.innerHTML =
      '<div class="move">' +
        '<label title="Keep open across page loads">' +
          '<input type="checkbox" name="Persistent Download Media"> Download media' +
        '</label>' +
        '<a href="javascript:;" class="jump close" title="Hide">' + Icon.get('xmark') + '</a>' +
      '</div>' +
      '<div class="da-body">' +
        '<div class="da-buttons">' +
          '<button type="button" data-filter="all">All (0)</button>' +
          '<button type="button" data-filter="image">Images (0)</button>' +
          '<button type="button" data-filter="video">Videos (0)</button>' +
        '</div>' +
        '<label><input type="checkbox" name="Download All as ZIP"> Bundle as a single ZIP archive</label>' +
      '</div>';

    const zipBox = $('input[name="Download All as ZIP"]', dialog) as HTMLInputElement;
    zipBox.checked = !!Conf['Download All as ZIP'];
    $.on(zipBox, 'change', $.cb.checked);

    const persistBox = $('input[name="Persistent Download Media"]', dialog) as HTMLInputElement;
    persistBox.checked = !!Conf['Persistent Download Media'];
    $.on(persistBox, 'change', $.cb.checked);
    // Don't drag the dialog when toggling the persist checkbox.
    $.on(persistBox, 'mousedown touchstart', (e: Event) => e.stopPropagation());

    const closeBtn = $('.close', dialog);
    $.on(closeBtn, 'click', () => DownloadAll.hide());
    // Don't trigger drag when grabbing the close icon.
    $.on(closeBtn, 'mousedown touchstart', (e: Event) => e.stopPropagation());

    const moveHandle = $('.move', dialog);
    $.on(moveHandle, 'mousedown touchstart', dragstart);

    for (const btn of $$('button[data-filter]', dialog) as HTMLButtonElement[]) {
      $.on(btn, 'click', () => {
        const filter = btn.dataset.filter as FilterKind;
        DownloadAll.start(filter);
      });
    }

    $.add(d.body, dialog);
    DownloadAll.dialog = dialog;
  },

  refreshDialog() {
    if (!DownloadAll.dialog) return;
    const items = DownloadAll.collect('all');
    const images = items.filter(i => i.isImage).length;
    const videos = items.filter(i => i.isVideo).length;
    const counts = { all: items.length, image: images, video: videos };
    for (const btn of $$('button[data-filter]', DownloadAll.dialog) as HTMLButtonElement[]) {
      const k = btn.dataset.filter as FilterKind;
      const n = counts[k];
      const label = k === 'all' ? 'All' : k === 'image' ? 'Images' : 'Videos';
      btn.textContent = `${label} (${n})`;
      btn.disabled = n === 0;
    }
  },

  start(filter: FilterKind) {
    if (DownloadAll.busy) {
      new Notice('warning', 'A download is already in progress.', 5);
      return;
    }

    if (g.VIEW === 'catalog' && !DownloadAll.catalogItems) {
      DownloadAll.fetchCatalog(() => {
        DownloadAll.refreshDialog();
        DownloadAll.start(filter);
      });
      return;
    }

    const items = DownloadAll.collect(filter);
    if (!items.length) {
      new Notice('warning', `No matching media found.`, 5);
      return;
    }

    DownloadAll.busy = true;
    const progress = DownloadAll.makeProgress(items.length);
    const done = () => { DownloadAll.busy = false; progress.close(); };

    if (Conf['Download All as ZIP']) {
      DownloadAll.runZip(items, progress, done);
    } else {
      DownloadAll.runIndividual(items, progress, done);
    }
  },

  fetchCatalog(cb: () => void) {
    if (DownloadAll.catalogFetching) return;
    const url = g.SITE.urls.catalogJSON?.(g.BOARD);
    if (!url) {
      DownloadAll.catalogItems = [];
      cb();
      return;
    }
    DownloadAll.catalogFetching = true;
    $.ajax(url, {
      onloadend(this: XMLHttpRequest) {
        DownloadAll.catalogFetching = false;
        const items: MediaItem[] = [];
        if (this.status === 200 && Array.isArray(this.response)) {
          const seen = dict() as Record<string, true>;
          const usedNames = dict() as Record<string, number>;
          for (const page of this.response) {
            for (const data of (page.threads || [])) {
              if (!data || !data.ext) continue;
              let file: any;
              try {
                file = g.SITE.Build.parseJSONFile(data, { siteID: g.SITE.ID, boardID: g.BOARD.ID });
              } catch (e) { continue; }
              if (!file?.url || seen[file.url]) continue;
              seen[file.url] = true;
              const isImage = $.isImage(file.url);
              const isVideo = $.isVideo(file.url);
              if (!isImage && !isVideo) continue;
              items.push({ url: file.url, name: makeName(file.name || file.url, usedNames), isImage, isVideo });
            }
          }
        } else {
          new Notice('warning', 'Failed to fetch catalog data.', 5);
        }
        DownloadAll.catalogItems = items;
        cb();
      },
    });
  },

  collect(filter: FilterKind): MediaItem[] {
    if (g.VIEW === 'catalog') {
      const items = DownloadAll.catalogItems || [];
      return items.filter(i =>
        filter === 'image' ? i.isImage :
        filter === 'video' ? i.isVideo :
        (i.isImage || i.isVideo)
      );
    }

    const seen = dict() as Record<string, true>;
    const out: MediaItem[] = [];
    const usedNames = dict() as Record<string, number>;

    for (const key of g.posts.keys) {
      const post = g.posts[key];
      if (!post || post.isHidden) continue;
      for (const file of (post.files || [])) {
        if (!file || file.isDead || !file.url) continue;
        if (filter === 'image' && !file.isImage) continue;
        if (filter === 'video' && !file.isVideo) continue;
        if (filter === 'all' && !file.isImage && !file.isVideo) continue;
        if (seen[file.url]) continue;
        seen[file.url] = true;

        out.push({
          url: file.url,
          name: makeName(file.name || file.url.split('/').pop() || 'file', usedNames),
          isImage: !!file.isImage,
          isVideo: !!file.isVideo,
        });
      }
    }
    return out;
  },

  makeProgress(total: number) {
    const wrap = $.el('div', { className: 'da-progress' });
    wrap.innerHTML = `<span class="da-progress-label">Downloading 0 / ${total}…</span> ` +
      `<a href="javascript:;" class="da-progress-cancel">cancel</a>`;
    const notice = new Notice('info', wrap, 0);

    let cancelled = false;
    $.on($('.da-progress-cancel', wrap), 'click', () => { cancelled = true; notice.close(); });

    return {
      update(done: number, failed: number) {
        const label = $('.da-progress-label', wrap);
        if (label) {
          label.textContent = failed
            ? `Downloading ${done} / ${total} (${failed} failed)…`
            : `Downloading ${done} / ${total}…`;
        }
      },
      isCancelled: () => cancelled,
      close: () => notice.close(),
    };
  },

  runIndividual(items: MediaItem[], progress: ReturnType<typeof DownloadAll.makeProgress>, done: () => void) {
    let i = 0, failed = 0;
    const step = () => {
      if (progress.isCancelled() || i >= items.length) {
        done();
        if (!progress.isCancelled()) {
          new Notice('success', `Saved ${i - failed} file(s)${failed ? `, ${failed} failed` : ''}.`, 5);
        }
        return;
      }
      const item = items[i++];
      CrossOrigin.binary(item.url, (data: Uint8Array | null) => {
        if (!data) {
          failed++;
        } else {
          const blob = new Blob([data]);
          const a = $.el('a', { href: URL.createObjectURL(blob), download: item.name, hidden: true }) as HTMLAnchorElement;
          $.add(d.body, a);
          a.click();
          $.rm(a);
          setTimeout(() => URL.revokeObjectURL(a.href), 30 * SECOND);
        }
        progress.update(i, failed);
        // Small gap to avoid the browser collapsing/blocking rapid downloads.
        setTimeout(step, 250);
      });
    };
    step();
  },

  runZip(items: MediaItem[], progress: ReturnType<typeof DownloadAll.makeProgress>, done: () => void) {
    const entries: Array<{ name: string; data: Uint8Array }> = [];
    let i = 0, failed = 0;

    const finish = () => {
      done();
      if (progress.isCancelled()) return;
      if (!entries.length) {
        new Notice('error', 'No files could be downloaded.', 10);
        return;
      }
      const blob = buildZip(entries);
      const url = URL.createObjectURL(blob);
      const a = $.el('a', { href: url, download: zipFileName(), hidden: true }) as HTMLAnchorElement;
      $.add(d.body, a);
      a.click();
      $.rm(a);
      setTimeout(() => URL.revokeObjectURL(url), 60 * SECOND);
      new Notice('success', `Saved ZIP with ${entries.length} file(s)${failed ? `, ${failed} failed` : ''}.`, 5);
    };

    const step = () => {
      if (progress.isCancelled() || i >= items.length) {
        finish();
        return;
      }
      const item = items[i++];
      CrossOrigin.binary(item.url, (data: Uint8Array | null) => {
        if (!data) {
          failed++;
        } else {
          entries.push({ name: item.name, data });
        }
        progress.update(i, failed);
        step();
      });
    };
    step();
  },
};

function makeName(raw: string, usedNames: Record<string, number>): string {
  let name = raw.replace(/[\\/:*?"<>|\r\n]/g, '_');
  if (usedNames[name] != null) {
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    name = `${stem}_${++usedNames[name]}${ext}`;
  }
  usedNames[name] = usedNames[name] || 0;
  return name;
}

function zipFileName(): string {
  const parts = ['media', g.BOARD?.ID || 'thread'];
  if (g.THREADID) parts.push(String(g.THREADID));
  return parts.join('-') + '.zip';
}

// --- Minimal store-mode ZIP encoder (no compression).
// Images/videos are already compressed; store mode is appropriate and tiny.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function dosDateTime(d: Date): { date: number; time: number } {
  const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() / 2) & 0x1F);
  const date = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
  return { date, time };
}

function buildZip(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const { date, time } = dosDateTime(new Date());

  for (const f of files) {
    const nameBytes = utf8(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    // Local file header: 30 bytes + name
    const lfh = new Uint8Array(30 + nameBytes.length);
    const dvLfh = new DataView(lfh.buffer);
    dvLfh.setUint32(0, 0x04034b50, true);
    dvLfh.setUint16(4, 20, true);           // version needed
    dvLfh.setUint16(6, 0x0800, true);       // general purpose (bit 11 = UTF-8 filename)
    dvLfh.setUint16(8, 0, true);            // method = store
    dvLfh.setUint16(10, time, true);
    dvLfh.setUint16(12, date, true);
    dvLfh.setUint32(14, crc, true);
    dvLfh.setUint32(18, size, true);        // compressed size
    dvLfh.setUint32(22, size, true);        // uncompressed size
    dvLfh.setUint16(26, nameBytes.length, true);
    dvLfh.setUint16(28, 0, true);           // extra field length
    lfh.set(nameBytes, 30);
    parts.push(lfh, f.data);

    // Central directory record: 46 bytes + name
    const cdr = new Uint8Array(46 + nameBytes.length);
    const dvCdr = new DataView(cdr.buffer);
    dvCdr.setUint32(0, 0x02014b50, true);
    dvCdr.setUint16(4, 20, true);           // version made by
    dvCdr.setUint16(6, 20, true);           // version needed
    dvCdr.setUint16(8, 0x0800, true);
    dvCdr.setUint16(10, 0, true);
    dvCdr.setUint16(12, time, true);
    dvCdr.setUint16(14, date, true);
    dvCdr.setUint32(16, crc, true);
    dvCdr.setUint32(20, size, true);
    dvCdr.setUint32(24, size, true);
    dvCdr.setUint16(28, nameBytes.length, true);
    dvCdr.setUint16(30, 0, true);           // extra field length
    dvCdr.setUint16(32, 0, true);           // comment length
    dvCdr.setUint16(34, 0, true);           // disk number
    dvCdr.setUint16(36, 0, true);           // internal attrs
    dvCdr.setUint32(38, 0, true);           // external attrs
    dvCdr.setUint32(42, offset, true);      // local header offset
    cdr.set(nameBytes, 46);
    central.push(cdr);

    offset += lfh.length + f.data.length;
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const cdOffset = offset;

  // End of central directory: 22 bytes
  const eocd = new Uint8Array(22);
  const dvEocd = new DataView(eocd.buffer);
  dvEocd.setUint32(0, 0x06054b50, true);
  dvEocd.setUint16(4, 0, true);
  dvEocd.setUint16(6, 0, true);
  dvEocd.setUint16(8, files.length, true);
  dvEocd.setUint16(10, files.length, true);
  dvEocd.setUint32(12, cdSize, true);
  dvEocd.setUint32(16, cdOffset, true);
  dvEocd.setUint16(20, 0, true);

  return new Blob([...parts, ...central, eocd], { type: 'application/zip' });
}

export default DownloadAll;
