/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import galleryPage from './Gallery/Gallery.html';
import $ from '../platform/$';
import Callbacks from '../classes/Callbacks';
import Notice from '../classes/Notice';
import Main from '../main/Main';
import Keybinds from '../Miscellaneous/Keybinds';
import $$ from '../platform/$$';
import ImageCommon from './ImageCommon';
import Sauce from './Sauce';
import Volume from './Volume';
import Header from '../General/Header';
import { Conf, d, doc, g } from '../globals/globals';
import UI from '../General/UI';
import Get from '../General/Get';
import { debounce, dict, SECOND } from '../platform/helpers';
import Icon from '../Icons/icon';

var Gallery = {
  // Assigned later; declared so the singleton's type includes them. Loosely typed
  // where a precise type would cascade new errors; tighten during the strict pass.
  enabled: false,
  delay: 0,
  nodes: null as any,
  images: [] as any,
  fileIDs: null as any,
  slideshow: false,
  cache: null as any,
  timeoutID: 0,
  fullscreen: false,
  colInput: null as any,
  colLabelText: null as any,

  init() {
    if (!(this.enabled = Conf['Gallery'] && (g.VIEW === 'index' || g.VIEW === 'thread'))) { return; }

    this.delay = Conf['Slide Delay'];

    const el = $.el('a', {
      href: 'javascript:;',
      title: 'Gallery',
    });
    Icon.set(el, 'image', 'Gallery');

    $.on(el, 'click', this.cb.toggle);

    Header.addShortcut('gallery', el, 530);

    return Callbacks.Post.push({
      name: 'Gallery',
      cb:   this.node
    });
  },

  node() {
    return (() => {
      const result: any[] = [];
      for (var file of this.files) {
        if (file.thumb) {
          if (Gallery.nodes) {
            Gallery.generateThumb(this, file);
            Gallery.nodes.total.textContent = Gallery.images.length;
          }

          if (!Conf['Image Expansion'] && ((g.SITE!.software !== 'tinyboard') || !(Main as any).jsEnabled)) {
            result.push($.on(file.thumbLink, 'click', Gallery.cb.image));
          } else {
            result.push(undefined);
          }
        }
      }
      return result;
    })();
  },

  build(image?) {
    let dialog, thumb;
    const {cb} = Gallery;

    if (Conf['Fullscreen Gallery']) {
      $.one(d, 'fullscreenchange mozfullscreenchange webkitfullscreenchange', () => $.on(d, 'fullscreenchange mozfullscreenchange webkitfullscreenchange', cb.close));
      (doc as any).mozRequestFullScreen?.();
      (doc as any).webkitRequestFullScreen?.((Element as any).ALLOW_KEYBOARD_INPUT);
    }

    Gallery.images  = [];
    const nodes = (Gallery.nodes = {} as any);
    Gallery.fileIDs = dict();
    Gallery.slideshow = false;

    nodes.el = (dialog = $.el('div',
      {id: 'a-gallery'}));
    $.extend(dialog, {innerHTML: galleryPage });

    const object = {
      buttons: '.gal-buttons',
      frame:   '.gal-image',
      name:    '.gal-name',
      count:   '.count',
      total:   '.total',
      sauce:   '.gal-sauce',
      thumbs:  '.gal-thumbnails',
      next:    '.gal-image a',
      current: '.gal-image img'
    };
    for (var key in object) { var value = object[key]; nodes[key] = $(value, dialog); }

    const menuButton = $('.menu-button', dialog);
    nodes.menu = new UI.Menu('gallery');

    $.on(nodes.frame, 'click', cb.blank);
    if (Conf['Mouse Wheel Volume']) { $.on(nodes.frame, 'wheel', Volume.wheel); }
    $.on(nodes.next,  'click', cb.click);
    $.on(nodes.name,  'click', ImageCommon.download);
    $.on(nodes.thumbs, 'click', cb.thumbsBlank);

    const prev =  $('.gal-prev',  dialog);
    const next =  $('.gal-next',  dialog);
    const start = $('.gal-start', dialog);
    const stop =  $('.gal-stop',  dialog);
    const close = $('.gal-close', dialog);

    $.on(prev,  'click', cb.prev);
    $.on(next,  'click', cb.next);
    $.on(start, 'click', cb.start);
    $.on(stop,  'click', cb.stop);
    $.on(close, 'click', cb.close);

    $.on(menuButton, 'click', function(e) {
      return nodes.menu.toggle(e, this, g);
    });

    Icon.set(menuButton, 'caretDown');
    Icon.set(start, 'play');
    Icon.set(stop, 'stop');
    Icon.set(close, 'xmark');
    Icon.set(prev, 'caretLeft');
    Icon.set(next, 'caretRight');

    for (var entry of Gallery.menu.createSubEntries() as any[]) {
      entry.order = 0;
      nodes.menu.addEntry(entry);
    }

    Gallery.cb.setLayout();

    $.on(d, 'keydown', cb.keybinds);
    if (Conf['Keybinds']) { $.off(d, 'keydown', Keybinds.keydown); }

    $.on(window, 'resize', Gallery.cb.setHeight);
    $.on(window, 'resize', Gallery.cb.setLayout);

    for (var postThumb of $$(g.SITE!.selectors.file.thumb)) {
      var post;
      if (!(post = Get.postFromNode(postThumb))) { continue; }
      for (var file of post.files) {
        if (file.thumb) {
          Gallery.generateThumb(post, file);
          // If no image to open is given, pick image we have scrolled to.
          if (!image && Gallery.fileIDs[`${post.fullID}.${file.index}`]) {
            var candidate = file.thumbLink;
            if ((Header.getTopOf(candidate) + candidate.getBoundingClientRect().height) >= 0) {
              image = candidate;
            }
          }
        }
      }
    }
    $.addClass(doc, 'gallery-open');

    $.add(d.body, dialog);

    nodes.thumbs.scrollTop = 0;
    nodes.current.parentElement.scrollTop = 0;

    if (image) { thumb = $(`[href='${image.href}']`, nodes.thumbs); }
    if (!thumb) { thumb = Gallery.images[Gallery.images.length-1]; }
    if (thumb) { Gallery.open(thumb); }

    doc.style.overflow = 'hidden';
    return nodes.total.textContent = Gallery.images.length;
  },

  generateThumb(post, file) {
    if (post.isClone || post.isHidden) { return; }
    if (!file || !file.thumb || (!file.isImage && !file.isVideo && !Conf['PDF in Gallery'])) { return; }
    if (Gallery.fileIDs[`${post.fullID}.${file.index}`]) { return; }

    Gallery.fileIDs[`${post.fullID}.${file.index}`] = true;

    const thumb = $.el('a', {
      className: 'gal-thumb',
      href:      file.url,
      target:    '_blank',
      title:     file.name
    }
    );

    thumb.dataset.id   = Gallery.images.length;
    thumb.dataset.post = post.fullID;
    thumb.dataset.file = file.index;

    const thumbImg = file.thumb.cloneNode(false);
    thumbImg.style.cssText = '';
    $.add(thumb, thumbImg);

    $.on(thumb, 'click', Gallery.cb.open);

    Gallery.images.push(thumb);
    return $.add(Gallery.nodes.thumbs, thumb);
  },

  load(thumb, errorCB) {
    const ext = thumb.href.match(/\w*$/);
    const elType = $.getOwn({'webm': 'video', 'mp4': 'video', 'ogv': 'video', 'pdf': 'iframe'}, ext) || 'img';
    const file = $.el(elType);
    $.extend(file.dataset, thumb.dataset);
    $.on(file, 'error', errorCB);
    file.src = thumb.href;
    return file;
  },

  open(thumb) {
    let el, file, post;
    const {nodes} = Gallery;
    const oldID = +nodes.current.dataset.id;
    const newID = +thumb.dataset.id;

    // Highlight, center selected thumbnail
    if (el = Gallery.images[oldID]) { $.rmClass(el,    'gal-highlight'); }
    $.addClass(thumb, 'gal-highlight');
    nodes.thumbs.scrollTop = (thumb.offsetTop + (thumb.offsetHeight/2)) - (nodes.thumbs.clientHeight/2);

    // Load image or use preloaded image
    if (Gallery.cache?.dataset.id === (''+newID)) {
      file = Gallery.cache;
      $.off(file, 'error', Gallery.cacheError);
      $.on(file, 'error', Gallery.error);
    } else {
      file = Gallery.load(thumb, Gallery.error);
    }

    // Replace old image with new one
    $.off(nodes.current, 'error', Gallery.error);
    ImageCommon.pause(nodes.current);
    $.replace(nodes.current, file);
    nodes.current = file;

    if (file.nodeName === 'VIDEO') {
      file.loop = true;
      Volume.setup(file);
      if (Conf['Autoplay']) { file.play(); }
      if (Conf['Show Controls']) file.controls = true;
    }

    doc.classList.toggle('gal-pdf', file.nodeName === 'IFRAME');
    Gallery.cb.setHeight();
    nodes.count.textContent = +thumb.dataset.id + 1;
    nodes.name.download     = (nodes.name.textContent = thumb.title);
    nodes.name.href         = thumb.href;
    nodes.frame.scrollTop   = 0;
    nodes.next.focus();

    // Set sauce links
    $.rmAll(nodes.sauce);
    if (Conf['Sauce'] && Sauce.links && (post = g.posts!.get(file.dataset.post))) {
      const sauces: any[] = [];
      for (var link of Sauce.links) {
        var node;
        if (node = Sauce.createSauceLink(link, post, post.files[+file.dataset.file])) {
          sauces.push($.tn(' '), node);
        }
      }
      $.add(nodes.sauce, sauces);
    }

    // Continue slideshow if moving forward, stop otherwise
    if (Gallery.slideshow && ((newID > oldID) || ((oldID === (Gallery.images.length-1)) && (newID === 0)))) {
      Gallery.setupTimer();
    } else {
      Gallery.cb.stop();
    }

    // Scroll to post
    if (Conf['Scroll to Post'] && (post = g.posts!.get(file.dataset.post))) {
      Header.scrollTo(post.nodes.root);
    }

    // Preload next image
    if (isNaN(oldID) || (newID === ((oldID + 1) % Gallery.images.length))) {
      return Gallery.cache = Gallery.load(Gallery.images[(newID + 1) % Gallery.images.length], Gallery.cacheError);
    }
  },

  error() {
    if (this.error?.code === MediaError.MEDIA_ERR_DECODE) {
      return new Notice('error', 'Corrupt or unplayable video', 30);
    }
    if (ImageCommon.isFromArchive(this)) { return; }
    const post = g.posts!.get(this.dataset.post);
    const file = post.files[+this.dataset.file];
    return ImageCommon.error(this, post, file, null, url => {
      if (!url) { return; }
      Gallery.images[+this.dataset.id].href = url;
      if (Gallery.nodes.current === this) { return this.src = url; }
    });
  },

  cacheError() {
    return delete Gallery.cache;
  },

  cleanupTimer() {
    clearTimeout(Gallery.timeoutID);
    const {current} = Gallery.nodes;
    $.off(current, 'canplaythrough load', Gallery.startTimer);
    return $.off(current, 'ended', Gallery.cb.next);
  },

  startTimer() {
    return Gallery.timeoutID = setTimeout(Gallery.checkTimer, Gallery.delay * SECOND);
  },

  setupTimer() {
    Gallery.cleanupTimer();
    const {current} = Gallery.nodes;
    const isVideo = current.nodeName === 'VIDEO';
    if (isVideo) { current.play(); }
    if ((isVideo ? current.readyState >= 4 : current.complete) || (current.nodeName === 'IFRAME')) {
      return Gallery.startTimer();
    } else {
      return $.on(current, (isVideo ? 'canplaythrough' : 'load'), Gallery.startTimer);
    }
  },

  checkTimer() {
    const {current} = Gallery.nodes;
    if ((current.nodeName === 'VIDEO') && !current.paused) {
      $.on(current, 'ended', Gallery.cb.next);
      return current.loop = false;
    } else {
      return Gallery.cb.next();
    }
  },

  cb: {
    keybinds(e) {
      let key;
      if (!(key = Keybinds.keyCode(e))) { return; }

      const cb = (() => { switch (key) {
        case Conf['Close']: case Conf['Open Gallery']:
          return (Gallery.fullscreen && doc.classList.contains('gal-lightbox-open'))
            ? Gallery.cb.closeLightbox : Gallery.cb.close;
        case Conf['Next Gallery Image']:
          return Gallery.cb.next;
        case Conf['Advance Gallery']:
          return Gallery.cb.advance;
        case Conf['Previous Gallery Image']:
          return Gallery.cb.prev;
        case Conf['Pause']:
          return Gallery.cb.pause;
        case Conf['Slideshow']:
          return Gallery.cb.toggleSlideshow;
        case Conf['Rotate image anticlockwise']:
          return Gallery.cb.rotateLeft;
        case Conf['Rotate image clockwise']:
          return Gallery.cb.rotateRight;
        case Conf['Download Gallery Image']:
          return Gallery.cb.download;
      } })();

      if (!cb) { return; }
      e.stopPropagation();
      e.preventDefault();
      return cb();
    },

    open(e?: Event) {
      if (e) { e.preventDefault(); }
      // In fullscreen-thumbnails mode a click opens the image as a lightbox
      // overlaid on the grid rather than in the (collapsed) inline preview.
      if (Gallery.fullscreen) { $.addClass(doc, 'gal-lightbox-open'); }
      if (this) { return Gallery.open(this); }
    },

    closeLightbox() { return $.rmClass(doc, 'gal-lightbox-open'); },

    image(e) {
      e.preventDefault();
      e.stopPropagation();
      return Gallery.build(this);
    },

    prev() {
      return Gallery.cb.open.call(
        Gallery.images[+Gallery.nodes.current.dataset.id - 1] || Gallery.images[Gallery.images.length - 1],
        undefined
      );
    },
    next() {
      return Gallery.cb.open.call(
        Gallery.images[+Gallery.nodes.current.dataset.id + 1] || Gallery.images[0],
        undefined
      );
    },

    click(e) {
      if (ImageCommon.onControls(e)) { return; }
      e.preventDefault();
      return Gallery.cb.advance();
    },

    advance() { if (!Conf['Autoplay'] && Gallery.nodes.current.paused) { return Gallery.nodes.current.play(); } else { return Gallery.cb.next(); } },
    toggle() { return (Gallery.nodes ? Gallery.cb.close : Gallery.build)(); },
    blank(e) {
      if (e.target !== this) { return; }
      // Clicking the dimmed area behind a fullscreen lightbox returns to the
      // grid; everywhere else it closes the gallery.
      if (Gallery.fullscreen && doc.classList.contains('gal-lightbox-open')) {
        return Gallery.cb.closeLightbox();
      }
      return Gallery.cb.close();
    },

    // In fullscreen-thumbnails mode, clicking the empty grid background closes
    // the gallery — but only well below the last image, so a row that holds
    // images (including its blank/trailing spots) never closes, and a near-miss
    // just under an image is forgiven by a 70px buffer.
    thumbsBlank(e) {
      if (!Gallery.fullscreen || (e.target !== this)) { return; }
      const last = Gallery.images[Gallery.images.length - 1];
      if (last && (e.clientY > (last.getBoundingClientRect().bottom + 70))) {
        return Gallery.cb.close();
      }
    },
    toggleSlideshow() {  return Gallery.cb[Gallery.slideshow ? 'stop' : 'start'](); },

    download() {
      const name = $('.gal-name');
      return name.click();
    },

    pause() {
      Gallery.cb.stop();
      const {current} = Gallery.nodes;
      if (current.nodeName === 'VIDEO') { return current[current.paused ? 'play' : 'pause'](); }
    },

    start() {
      $.addClass(Gallery.nodes.buttons, 'gal-playing');
      Gallery.slideshow = true;
      return Gallery.setupTimer();
    },

    stop() {
      if (!Gallery.slideshow) { return; }
      Gallery.cleanupTimer();
      const {current} = Gallery.nodes;
      if (current.nodeName === 'VIDEO') { current.loop = true; }
      $.rmClass(Gallery.nodes.buttons, 'gal-playing');
      return Gallery.slideshow = false;
    },

    rotateLeft() { return (Gallery.cb.rotate as any)(270); },
    rotateRight() { return (Gallery.cb.rotate as any)(90); },

    rotate: debounce(100, function(delta) {
      const {current} = Gallery.nodes;
      if (current.nodeName === 'IFRAME') { return; }
      current.dataRotate = ((current.dataRotate || 0) + delta) % 360;
      current.style.transform = `rotate(${current.dataRotate}deg)`;
      return Gallery.cb.setHeight();
    }),

    close() {
      $.off(Gallery.nodes.current, 'error', Gallery.error);
      ImageCommon.pause(Gallery.nodes.current);
      $.rm(Gallery.nodes.el);
      $.rmClass(doc, 'gallery-open');
      if (Conf['Fullscreen Gallery']) {
        $.off(d, 'fullscreenchange mozfullscreenchange webkitfullscreenchange', Gallery.cb.close);
        (d as any).mozCancelFullScreen?.();
        (d as any).webkitExitFullscreen?.();
      }
      delete Gallery.nodes;
      delete Gallery.fileIDs;
      delete Gallery.colInput;
      delete Gallery.colLabelText;
      Gallery.fullscreen = false;
      $.rmClass(doc, 'gal-lightbox-open');
      for (var p of Gallery.cb.positions) { $.rmClass(doc, `gal-thumbs-${p}`); }
      doc.style.overflow = '';

      $.off(d, 'keydown', Gallery.cb.keybinds);
      if (Conf['Keybinds']) { $.on(d, 'keydown', Keybinds.keydown); }
      $.off(window, 'resize', Gallery.cb.setHeight);
      $.off(window, 'resize', Gallery.cb.setLayout);
      return clearTimeout(Gallery.timeoutID);
    },

    setFitness() {
      return (this.checked ? $.addClass : $.rmClass)(doc, `gal-${this.name.toLowerCase().replace(/\s+/g, '-')}`);
    },

    positions: ['top', 'bottom', 'left', 'right'],

    // Drive thumbnail-strip extent, column count and dock edge from config, so
    // the grid, the strip size and the fixed label/button offsets all stay in
    // sync. The strip never grows past MAX_EXTENT of the relevant viewport
    // dimension; once a column would cross that line we stop adding columns
    // rather than squashing the cells. Columns of 0 in grid mode is the special
    // "fullscreen thumbnails" view (no image preview, lightbox on click).
    //
    // --gal-thumbs-width is the strip's extent along whichever edge it docks to:
    // a width for the left/right (vertical) strips, a height for the top/bottom
    // (horizontal) ones. Because #a-gallery switches to flex-direction:column
    // for top/bottom, the same flex-basis variable reads as height there.
    setLayout() {
      const THUMB_CELL = 131;           // approx px per thumb incl. padding
      const MAX_EXTENT = 0.75;          // strip caps at 75% of its docking axis
      const cols   = Math.max(0, parseInt(Conf['Gallery Columns'], 10) || 0);
      const hidden = Conf['Hide Thumbnails'];
      const grid   = Conf['Grid Thumbnails'] && !hidden;
      const pos    = Gallery.cb.positions.includes(Conf['Gallery Thumbnails Position'])
        ? Conf['Gallery Thumbnails Position'] : 'right';
      const horizontal = (pos === 'top') || (pos === 'bottom');

      for (var p of Gallery.cb.positions) { doc.classList.toggle(`gal-thumbs-${p}`, p === pos); }

      // The number means columns for the vertical (left/right) strips and rows
      // for the horizontal (top/bottom) ones; relabel the field to match.
      if (Gallery.colLabelText) { Gallery.colLabelText.nodeValue = horizontal ? 'Grid Rows: ' : 'Grid Columns: '; }

      Gallery.fullscreen = grid && (cols === 0);
      doc.classList.toggle('gal-fullscreen-thumbs', Gallery.fullscreen);
      if (!Gallery.fullscreen) { doc.classList.remove('gal-lightbox-open'); }

      // Largest column count that keeps the strip within the cap, measured along
      // the strip's docking axis. Exposed as the input's `max` so the spinner
      // won't tick past what actually fits.
      const axis = horizontal ? doc.clientHeight : doc.clientWidth;
      const maxCols = Math.max(1, Math.floor(((MAX_EXTENT * axis) - 8) / THUMB_CELL));
      if (Gallery.colInput) { Gallery.colInput.max = maxCols; }

      let effCols = cols, extent;
      if (hidden || Gallery.fullscreen) {
        extent = 0;                     // no inline strip (or strip is the whole screen)
      } else if (grid) {
        effCols = Math.min(cols, maxCols);
        extent = (effCols * THUMB_CELL) + 8;
      } else {
        extent = 150;
      }
      doc.style.setProperty('--gal-cols', String(effCols || 1));
      return doc.style.setProperty('--gal-thumbs-width', `${extent}px`);
    },

    // Keep a typed-in column count within [0, max-that-fits] so the field can't
    // hold a value larger than the cap allows.
    clampColumns() {
      const max = parseInt(this.max, 10);
      let v = parseInt(this.value, 10);
      if (isNaN(v)) { return; }
      v = Math.max(0, v);
      if (max && (v > max)) { v = max; }
      this.value = v;
    },

    setHeight: debounce(100, function () {
      let dim, margin, minHeight;
      const {current, frame} = Gallery.nodes;
      const {style} = current;

      if (Conf['Stretch to Fit'] && (dim = g.posts!.get(current.dataset.post)?.files[+current.dataset.file].dimensions)) {
        const [width, height] = dim.split('x');
        let containerWidth = frame.clientWidth;
        let containerHeight = doc.clientHeight - 25;
        if (((current.dataRotate || 0) % 180) === 90) {
          [containerWidth, containerHeight] = [containerHeight, containerWidth];
        }
        minHeight = Math.min(containerHeight, (height / width) * containerWidth);
        style.minHeight = minHeight + 'px';
        style.minWidth = ((width / height) * minHeight) + 'px';
      } else {
        style.minHeight = (style.minWidth = '');
      }

      if (((current.dataRotate || 0) % 180) === 90) {
        style.maxWidth  = Conf['Fit Height'] ? `${doc.clientHeight - 25}px` : 'none';
        style.maxHeight = Conf['Fit Width']  ? `${frame.clientWidth}px`     : 'none';
        margin = (current.clientWidth - current.clientHeight)/2;
        return style.margin = `${margin}px ${-margin}px`;
      } else {
        return style.maxWidth = (style.maxHeight = (style.margin = ''));
      }
    }),

    setDelay() { return Gallery.delay = +this.value; }
  },

  menu: {
    init() {
      if (!Gallery.enabled) { return; }

      const el = $.el('span', {
        textContent: 'Gallery',
        className: 'gallery-link'
      }
      );

      return Header.menu.addEntry({
        el,
        order: 105,
        subEntries: Gallery.menu.createSubEntries()
      });
    },

    createSubEntry(name) {
      const label = UI.checkbox(name, name);
      const input = label.firstElementChild as HTMLInputElement;
      if (['Hide Thumbnails', 'Fit Width', 'Fit Height'].includes(name)) { $.on(input, 'change', Gallery.cb.setFitness); }
      $.event('change', null, input);
      $.on(input, 'change', $.cb.checked);
      if (['Hide Thumbnails'].includes(name)) { $.on(input, 'change', Gallery.cb.setLayout); }
      if (['Hide Thumbnails', 'Fit Width', 'Fit Height', 'Stretch to Fit'].includes(name)) { $.on(input, 'change', Gallery.cb.setHeight); }
      return {el: label};
    },

    createSubEntries() {
      const subEntries: any[] = (['Hide Thumbnails', 'Fit Width', 'Fit Height', 'Stretch to Fit', 'Scroll to Post'].map((item) => Gallery.menu.createSubEntry(item)));

      // Grid toggle and its track count share one row: [✓] Grid Columns: [N].
      // The checkbox drives 'Grid Thumbnails'; the number drives 'Gallery Columns',
      // whose label setLayout() flips between Columns/Rows with the dock edge. The
      // checkbox and number sit in separate labels so editing one never toggles
      // the other.
      const gridRow = $.el('span', {className: 'gal-grid-entry'});
      const gridCheck = UI.checkbox('Grid Thumbnails', '');
      const gridInput = gridCheck.firstElementChild as HTMLInputElement;
      $.on(gridInput, 'change', Gallery.cb.setFitness);
      $.event('change', null, gridInput);
      $.on(gridInput, 'change', $.cb.checked);
      $.on(gridInput, 'change', Gallery.cb.setLayout);

      const colLabel = $.el('label', {title: '0 disables the image preview and shows fullscreen thumbnails.', innerHTML: 'Grid Columns: <input type="number" name="Gallery Columns" min="0" step="1" class="field gal-col-input" title="0 disables the image preview and shows fullscreen thumbnails.">'});
      const colInput = colLabel.firstElementChild as HTMLInputElement;
      colInput.value = String(Math.max(0, parseInt(Conf['Gallery Columns'], 10) || 0));
      Gallery.colInput = colInput;
      Gallery.colLabelText = colLabel.firstChild;   // "Grid Columns: " text node, relabelled per dock
      $.on(colInput, 'change', Gallery.cb.clampColumns);
      $.on(colInput, 'change', $.cb.value);
      $.on(colInput, 'change', Gallery.cb.setLayout);

      $.add(gridRow, [gridCheck, colLabel]);
      subEntries.push({el: gridRow});

      const posOptions = Gallery.cb.positions.map(p =>
        `<option value="${p}">${p[0].toUpperCase()}${p.slice(1)}</option>`).join('');
      const posLabel = $.el('label', {innerHTML: `Thumbnails Position: <select name="Gallery Thumbnails Position" class="field gal-field">${posOptions}</select>`});
      const posInput = posLabel.firstElementChild as HTMLSelectElement;
      posInput.value = Gallery.cb.positions.includes(Conf['Gallery Thumbnails Position'])
        ? Conf['Gallery Thumbnails Position'] : 'right';
      $.on(posInput, 'change', $.cb.value);
      $.on(posInput, 'change', Gallery.cb.setLayout);
      subEntries.push({el: posLabel});

      const delayLabel = $.el('label', {innerHTML: 'Slide Delay: <input type="number" name="Slide Delay" min="0" step="any" class="field">'});
      const delayInput = delayLabel.firstElementChild as HTMLInputElement;
      delayInput.value = String(Gallery.delay);
      $.on(delayInput, 'change', Gallery.cb.setDelay);
      $.on(delayInput, 'change', $.cb.value);
      subEntries.push({el: delayLabel});

      return subEntries;
    }
  }
};
export default Gallery;
