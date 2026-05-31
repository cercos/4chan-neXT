import QuickReplyPage from './QR/QuickReply.html';
import $ from '../platform/$';
import Callbacks from '../classes/Callbacks';
import Notice from '../classes/Notice';
import Main from '../main/Main';
import Favicon from '../Monitoring/Favicon';
import $$ from '../platform/$$';
import CrossOrigin from '../platform/CrossOrigin';
import Captcha from './Captcha';
import meta from '../../package.json';
import Header from '../General/Header';
import { Conf, E, d, doc, g } from '../globals/globals';
import Menu from '../Menu/Menu';
import UI from '../General/UI';
import BoardConfig from '../General/BoardConfig';
import Get from '../General/Get';
import { VideoStripper } from './VideoStripper';
import { DAY, dict, platform, SECOND } from '../platform/helpers';
import Icon from '../Icons/icon';

interface ConvertOptions {
  /** Max file size, optional, but passing it will prevent re-calculation */
  maxSize?: number;
  /** Image bitmap, optional, but passing it will prevent re-calculation */
  img?: ImageBitmap | undefined;
  /** Target width, defaults to the current width of the image */
  width?: number;
  /** Target height, defaults to the current width of the image */
  height?: number;
};

var QR = {
  postingIsEnabled: false,

  // will be set at init
  captcha: undefined as typeof Captcha.v2 | typeof Captcha.t,
  min_width: 0,
  min_height: 0,
  max_width: 0,
  max_height: 0,
  max_size: 0,
  max_size_video: 0,
  max_comment: 0,
  max_name: 100,
  max_email: 100,
  max_sub: 100,
  max_width_video: 0,
  max_height_video: 0,
  max_duration_video: 0,
  forcedAnon: false,
  spoiler: false,
  link: undefined as HTMLElement,
  post: undefined as typeof post,
  posts: undefined as post[],
  nodes: undefined as {
    el: HTMLDivElement,
    move: HTMLDivElement,
    autohide: HTMLInputElement,
    close: HTMLAnchorElement,
    thread: HTMLSelectElement,
    form: HTMLFormElement,
    sjisToggle: HTMLButtonElement,
    texButton: HTMLButtonElement,
    name: HTMLInputElement,
    email: HTMLInputElement,
    sub: HTMLInputElement,
    com: HTMLTextAreaElement,
    charCount: HTMLSpanElement,
    texPreview: HTMLDivElement,
    dumpList: HTMLDivElement,
    addPost: HTMLAnchorElement,
    oekaki: HTMLDivElement,
    drawButton: HTMLInputElement,
    fileSubmit: HTMLDivElement,
    fileButton: HTMLInputElement,
    noFile: HTMLSpanElement,
    filename: HTMLInputElement,
    spoiler: HTMLInputElement,
    oekakiButton: HTMLAnchorElement,
    randomizeButton: HTMLAnchorElement,
    compress: HTMLAnchorElement,
    view: HTMLAnchorElement,
    restoreNameButton: HTMLAnchorElement,
    fileRM: HTMLAnchorElement,
    urlButton: HTMLAnchorElement,
    pasteArea: HTMLAnchorElement,
    customCooldown: HTMLAnchorElement,
    dumpButton: HTMLAnchorElement,
    status: HTMLInputElement,
    flashTag: HTMLSelectElement,
    fileInput: HTMLInputElement,
    flag?: HTMLSelectElement,
    preview?: HTMLDivElement;
    splitPost?: HTMLAnchorElement;
    comPreview: HTMLDivElement,
  },
  shortcut: undefined as HTMLAnchorElement,
  hasFocus: false,
  pendingFiles: [] as {
    file: File,
    post: post,
    isText: boolean,
  }[],
  dropTargetPost: undefined as post | undefined,
  isDroppingFiles: false,
  isProcessingPendingFiles: false,
  fileBatchSize: 3,
  heavyBatchFileCount: 8,
  heavyBatchSize: 64 * 1024 * 1024,
  metadataStrippedFlag: '__4chanXTMetadataStripped',
  commentPreviewInputBound: false,

  req: undefined as (XMLHttpRequest & { isUploadFinished: boolean, progress: string }) | undefined,
  selected: undefined as post,

  mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/vnd.adobe.flash.movie', 'application/x-shockwave-flash', 'video/webm', 'video/mp4'],

  validExtension: /\.(jpe?g|png|gif|pdf|swf|webm|mp4)$/i,

  markMetadataStripped(file: File) {
    (file as File & { [key: string]: any })[QR.metadataStrippedFlag] = true;
    return file;
  },

  isMetadataStripped(file: File) {
    return !!(file as File & { [key: string]: any })[QR.metadataStrippedFlag];
  },

  typeFromExtension: {
    'jpg':  'image/jpeg',
    'jpeg': 'image/jpeg',
    'png':  'image/png',
    'gif':  'image/gif',
    'pdf':  'application/pdf',
    'swf':  'application/vnd.adobe.flash.movie',
    'webm': 'video/webm',
    'mp4': 'video/mp4'
  },

  extensionFromType: {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
    'application/vnd.adobe.flash.movie': 'swf',
    'application/x-shockwave-flash': 'swf',
    'video/webm': 'webm',
    'video/mp4': 'mp4'
  },

  init() {
    let sc;
    if (!Conf['Quick Reply']) { return; }

    this.posts = [];

    $.on(d, '4chanXInitFinished', () => BoardConfig.ready(QR.initReady));

    Callbacks.Post.push({
      name: 'Quick Reply',
      cb:   this.node
    });

    this.shortcut = (sc = $.el('a', {
      className: 'disabled',
      title: 'Quick Reply',
      href: 'javascript:;',
    }));
    Icon.set(this.shortcut, 'comment', 'Quick Reply')
    $.on(sc, 'click', function() {
      if (!QR.postingIsEnabled) { return; }
      if (Conf['Persistent QR'] || !QR.nodes || QR.nodes.el.hidden) {
        QR.open();
        QR.nodes.com.focus();
      } else {
        QR.close();
      }
    });

    Header.addShortcut('qr', sc, 540);

    window.addEventListener('message', event => {
      if (event.data?.twister?.error) {
        QR.error($.el('div', { innerHTML: event.data.twister.error }));
      }
    });
  },

  initReady() {
    let origToggle;
    const captchaVersion = $('#t-root') ?
      't'
    :
      $('#g-recaptcha, #captcha-forced-noscript') ?
        'v2'
      :
        (g.SITE.software === 'yotsuba' ? 't' : 'v2');
    QR.captcha = Captcha[captchaVersion];
    QR.postingIsEnabled = true;

    const {config} = g.BOARD;
    const prop = (key, def) => +(config[key] ?? def);

    QR.min_width  = prop('min_image_width',  1);
    QR.min_height = prop('min_image_height', 1);
    QR.max_width  = (QR.max_height = 10000);

    QR.max_size       = prop('max_filesize',      4194304);
    QR.max_size_video = prop('max_webm_filesize', QR.max_size);
    QR.max_comment    = prop('max_comment_chars', 2000);
    QR.max_name       = prop('max_name_chars', 100);
    QR.max_email      = prop('max_email_chars', 100);
    QR.max_sub        = prop('max_subject_chars', 100);

    QR.max_width_video = (QR.max_height_video = 2048);
    QR.max_duration_video = prop('max_webm_duration', 120);

    QR.forcedAnon = !!config.forced_anon;
    QR.spoiler    = !!config.spoilers;

    if (origToggle = $.id('togglePostFormLink')) {
      const link = $.el('h1',
        {className: "qr-link-container"});
      $.extend(link, {
        innerHTML:
          `<a href="javascript:;" class="qr-link">${g.VIEW === "thread" ? "Reply to Thread" : "Start a Thread"}</a>`
      });

      QR.link = link.firstElementChild as HTMLElement;
      $.on(link.firstChild, 'click', function() {
        QR.open();
        return QR.nodes.com.focus();
      });

      $.before(origToggle, link);
      origToggle.firstElementChild.textContent = 'Original Form';
    }

    if (g.VIEW === 'thread') {
      let navLinksBot;
      const linkBot = $.el('div',
        {className: "brackets-wrap qr-link-container-bottom"});
      $.extend(linkBot, {innerHTML: '<a href="javascript:;" class="qr-link-bottom">Reply to Thread</a>'});

      $.on(linkBot.firstElementChild, 'click', function() {
        QR.open();
        return QR.nodes.com.focus();
      });

      if (navLinksBot = $('.navLinksBot')) { $.prepend(navLinksBot, linkBot); }
    }

    $.on(d, 'QRGetFile',          QR.getFile);
    $.on(d, 'QRDrawFile',         QR.drawFile);
    $.on(d, 'QRSetFile',          QR.setFile);
    $.on(d, 'QRCommentPreviewChanged', QR.applyCommentPreviewSettings);
    $.sync('Comment Preview', (value: boolean | undefined) => {
      Conf['Comment Preview'] = !!value;
      QR.applyCommentPreviewSettings();
    });
    $.sync('Comment Preview Position', (value: string | undefined) => {
      Conf['Comment Preview Position'] = ['below', 'right', 'left'].includes(value || '') ? value! : 'below';
      QR.applyCommentPreviewSettings();
    });

    $.on(d, 'paste',              QR.paste);
    $.on(d, 'dragover',           QR.dragOver);
    $.on(d, 'drop',               QR.dropFile);
    $.on(d, 'dragstart dragend',  QR.drag);

    $.on(d, 'IndexRefreshInternal', QR.generatePostableThreadsList);
    $.on(d, 'ThreadUpdate', QR.statusCheck);

    if (!Conf['Persistent QR']) { return; }
    QR.open();
    if (Conf['Auto Hide QR']) { return QR.hide(); }
  },

  statusCheck() {
    if (!QR.nodes) { return; }
    const {thread} = QR.posts[0];
    if ((thread !== 'new') && g.threads.get(`${g.BOARD}.${thread}`).isDead) {
      return QR.abort();
    } else {
      return QR.status();
    }
  },

  node() {
    $.on(this.nodes.quote, 'click', QR.quote);
    if (this.isFetchedQuote) { return QR.generatePostableThreadsList(); }
  },

  open() {
    if (QR.nodes) {
      if (QR.nodes.el.hidden) { QR.captcha.setup(); }
      QR.nodes.el.hidden = false;
      QR.unhide();
    } else {
      try {
        QR.dialog();
      } catch (err) {
        delete QR.nodes;
        Main.handleErrors({
          message: 'Quick Reply dialog creation crashed.',
          error: err
        });
        return;
      }
    }
    return $.rmClass(QR.shortcut, 'disabled');
  },

  close() {
    if (QR.req) {
      QR.abort();
      return;
    }
    QR.nodes.el.hidden = true;
    QR.cleanNotifications();
    QR.blur();
    $.rmClass(QR.nodes.el, 'dump');
    $.addClass(QR.shortcut, 'disabled');
    new QR.post(true);
    for (var post of QR.posts.splice(0, QR.posts.length - 1)) {
      post.delete();
    }
    QR.cooldown.auto = false;
    QR.status();
    return QR.captcha.destroy();
  },

  focus() {
    return $.queueTask(function() {
      if (!QR.inBubble()) {
        QR.hasFocus = d.activeElement && QR.nodes.el.contains(d.activeElement);
        return QR.nodes.el.classList.toggle('focus', QR.hasFocus);
      }
    });
  },

  inBubble() {
    const bubbles = $$('iframe[src^="https://www.google.com/recaptcha/api2/frame"]');
    return bubbles.includes(d.activeElement) || bubbles.some(el => (getComputedStyle(el).visibility !== 'hidden') && (el.getBoundingClientRect().bottom > 0));
  },

  hide() {
    QR.blur();
    $.addClass(QR.nodes.el, 'autohide');
    return QR.nodes.autohide.checked = true;
  },

  unhide() {
    $.rmClass(QR.nodes.el, 'autohide');
    return QR.nodes.autohide.checked = false;
  },

  toggleHide() {
    if (this.checked) {
      return QR.hide();
    } else {
      return QR.unhide();
    }
  },

  blur() {
    if (QR.nodes.el.contains(d.activeElement)) { return d.activeElement.blur(); }
  },

  toggleSJIS(e) {
    e.preventDefault();
    Conf['sjisPreview'] = !Conf['sjisPreview'];
    $.set('sjisPreview', Conf['sjisPreview']);
    return QR.nodes.el.classList.toggle('sjis-preview', Conf['sjisPreview']);
  },

  texPreviewShow() {
    if ($.hasClass(QR.nodes.el, 'tex-preview')) { return QR.texPreviewHide(); }
    $.addClass(QR.nodes.el, 'tex-preview');
    QR.nodes.texPreview.textContent = QR.nodes.com.value;
    return $.event('mathjax', null, QR.nodes.texPreview);
  },

  texPreviewHide() {
    return $.rmClass(QR.nodes.el, 'tex-preview');
  },

  updateComPreview() {
    if (!QR.nodes?.comPreview) return;
    QR.nodes.comPreview.innerHTML = QR.renderComPreview(QR.nodes.com.value);
  },

  applyCommentPreviewSettings() {
    if (!QR.nodes?.el || !QR.nodes?.com) return;
    const { classList } = QR.nodes.el;
    const enabled = !!Conf['Comment Preview'];
    const pos = ['below', 'right', 'left'].includes(Conf['Comment Preview Position']) ? Conf['Comment Preview Position'] : 'below';
    classList.toggle('has-com-preview', enabled);
    classList.remove('com-preview-below', 'com-preview-right', 'com-preview-left');
    classList.add(`com-preview-${pos}`);
    if (enabled) {
      if (!QR.commentPreviewInputBound) {
        $.on(QR.nodes.com, 'input', QR.updateComPreview);
        QR.commentPreviewInputBound = true;
      }
      QR.updateComPreview();
    } else if (QR.commentPreviewInputBound) {
      $.off(QR.nodes.com, 'input', QR.updateComPreview);
      QR.commentPreviewInputBound = false;
    }
  },

  comPreviewTagWraps: {
    spoiler: { wrap: (i: string) => `<s>${i}</s>`,                                       format: true  },
    code:    { wrap: (i: string) => `<pre class="prettyprint">${i}</pre>`,               format: false },
    math:    { wrap: (i: string) => `<span class="math">[math]${i}[/math]</span>`,       format: false },
    eqn:     { wrap: (i: string) => `<span class="math">[eqn]${i}[/eqn]</span>`,         format: false },
    sjis:    { wrap: (i: string) => `<span class="sjis">${i}</span>`,                    format: true  },
    b:       { wrap: (i: string) => `<b>${i}</b>`,                                       format: true  },
    i:       { wrap: (i: string) => `<span class="mu-i">${i}</span>`,                    format: true  },
    red:     { wrap: (i: string) => `<span class="mu-r">${i}</span>`,                    format: true  },
    green:   { wrap: (i: string) => `<span class="mu-g">${i}</span>`,                    format: true  },
    blue:    { wrap: (i: string) => `<span class="mu-b">${i}</span>`,                    format: true  },
  } as Record<string, { wrap: (i: string) => string; format: boolean }>,

  // Per-board extra tags that 4chan renders but aren't surfaced via boards.json flags.
  comPreviewBoardExtras: {
    mu:  ['b', 'i', 'red', 'green', 'blue'],
    qst: ['b', 'i', 'red', 'green', 'blue'],
  } as Record<string, string[]>,

  renderComPreview(text: string): string {
    const config = g.BOARD.config;
    const names: string[] = [];
    if (QR.spoiler)        names.push('spoiler');
    if (config.code_tags)  names.push('code');
    if (config.math_tags)  names.push('math', 'eqn');
    if (config.sjis_tags)  names.push('sjis');
    const extras = QR.comPreviewBoardExtras[g.BOARD.ID] || [];
    for (const t of extras) if (!names.includes(t)) names.push(t);

    if (!names.length) return QR.formatComPreviewText(text);

    const tagRe = new RegExp(`\\[(${names.join('|')})\\]([\\s\\S]*?)\\[\\/\\1\\]`, 'g');
    let html = '';
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(text))) {
      html += QR.formatComPreviewText(text.slice(last, m.index));
      const tag = QR.comPreviewTagWraps[m[1]];
      const inner = tag.format ? QR.formatComPreviewText(m[2]) : E(m[2]);
      html += tag.wrap(inner);
      last = m.index + m[0].length;
    }
    html += QR.formatComPreviewText(text.slice(last));
    return html;
  },

  formatComPreviewText(text: string): string {
    const escaped = E(text);
    // Treat >>NNN and >>>/board/NNN as quotelinks (greentext detection skips these).
    const withQuotes = escaped.replace(
      /&gt;&gt;(?:&gt;\/[a-z\d]+\/)?\d+/g,
      m => `<a class="quotelink" href="javascript:;">${m}</a>`
    );
    return withQuotes.split('\n').map(line =>
      /^&gt;(?!&gt;)/.test(line) ? `<span class="quote">${line}</span>` : line
    ).join('\n');
  },

  addPost() {
    const wasOpen = (QR.nodes && !QR.nodes.el.hidden);
    QR.open();
    if (wasOpen) {
      $.addClass(QR.nodes.el, 'dump');
      new QR.post(true);
    }
    return QR.nodes.com.focus();
  },

  clearDumpList() {
    if (!QR.posts?.length) { return; }
    QR.pendingFiles.length = 0;
    new QR.post(true);
    for (var post of QR.posts.splice(0, QR.posts.length - 1)) {
      post.delete();
    }
    QR.cleanNotifications();
    $.rmClass(QR.nodes.el, 'dump');
    QR.status();
    QR.captcha.updateThread?.();
  },

  toggleDumpList(e: MouseEvent) {
    if (e.shiftKey) {
      e.preventDefault();
      QR.clearDumpList();
      return;
    }
    QR.nodes.el.classList.toggle('dump');
  },

  blurMouseFocusedAction(e: MouseEvent) {
    // Keep keyboard focus behavior; only blur on pointer click.
    QR.blurPointerFocusedElement(e.currentTarget as HTMLElement | null, e.detail);
  },

  blurPointerFocusedElement(el: HTMLElement | null, detail: number) {
    // Keep keyboard focus behavior; only blur on pointer click.
    if (detail > 0) {
      el?.blur?.();
    }
  },

  setCustomCooldown(enabled) {
    Conf['customCooldownEnabled'] = enabled;
    QR.cooldown.customCooldown = enabled;
    return QR.nodes.customCooldown.classList.toggle('disabled', !enabled);
  },

  toggleCustomCooldown() {
    const enabled = $.hasClass(QR.nodes.customCooldown, 'disabled');
    QR.setCustomCooldown(enabled);
    return $.set('customCooldownEnabled', enabled);
  },

  error(err: any, focusOverride?: boolean) {
    let el;
    QR.open();
    if (typeof err === 'string') {
      el = $.tn(err);
    } else {
      el = err;
      el.removeAttribute('style');
    }
    const notice = new Notice('warning', el);
    QR.notifications.push(notice);
    if (!Header.areNotificationsEnabled) {
      if (d.hidden && !QR.cooldown.auto) { return alert(el.textContent); }
    } else if (d.hidden || !(focusOverride || d.hasFocus())) {
      const notif = new Notification(el.textContent, {
        body: el.textContent,
        icon: Favicon.logo
      }
      );
      notif.onclick = () => window.focus();
      if ($.engine !== 'gecko') {
        // Firefox automatically closes notifications
        // so we can't control the onclose properly.
        notif.onclose = () => notice.close();
        return notif.onshow  = () => setTimeout(function() {
          notif.onclose = null;
          return notif.close();
        }
        , 7 * SECOND);
      }
    }
  },

  connectionError() {
    return $.el('span',
      { innerHTML:
        'Connection error while posting. ' +
        '[<a href="' + E(meta.upstreamFaq) + '#connection-errors" target="_blank">More info</a>]'
      }
    );
  },

  notifications: [],

  cleanNotifications() {
    for (var notification of QR.notifications) {
      notification.close();
    }
    return QR.notifications = [];
  },

  /* Returns true if the QR is disabled. */
  status() {
    let disabled, value;
    if (!QR.nodes) { return; }
    const {thread} = QR.posts[0];
    if ((thread !== 'new') && g.threads.get(`${g.BOARD}.${thread}`).isDead) {
      value    = 'Dead';
      disabled = true;
      QR.cooldown.auto = false;
    }

    value = QR.req ?
      QR.req.progress
    :
      QR.cooldown.seconds || value;

    const {status} = QR.nodes;
    status.value = !value ?
      'Submit'
    : QR.cooldown.auto ?
      `Auto ${value}`
    :
      value;
    status.disabled = disabled || false;
    return status.disabled;
  },

  openPost() {
    QR.open();
    if (QR.selected.isLocked) {
      const index = QR.posts.indexOf(QR.selected);
      (QR.posts[index+1] || new QR.post()).select();
      $.addClass(QR.nodes.el, 'dump');
      return QR.cooldown.auto = true;
    }
  },

  quote(e) {
    let range;
    e?.preventDefault();
    if (!QR.postingIsEnabled) { return; }
    const sel  = d.getSelection();
    const post = Get.postFromNode(this);
    const {root} = post.nodes;
    const postRange = new Range();
    postRange.selectNode(root);
    let text = post.board.ID === g.BOARD.ID ? `>>${post}\n` : `>>>/${post.board}/${post}\n`;
    for (let i = 0; i < sel.rangeCount; i++) {
      try {
        var insideCode, node;
        range = sel.getRangeAt(i);
        // Trim range to be fully inside post
        if (range.compareBoundaryPoints(Range.START_TO_START, postRange) < 0) {
          range.setStartBefore(root);
        }
        if (range.compareBoundaryPoints(Range.END_TO_END, postRange) > 0) {
          range.setEndAfter(root);
        }

        if (!range.toString().trim()) { continue; }

        var frag  = range.cloneContents();
        var ancestor = range.commonAncestorContainer;
        // Quoting the insides of a spoiler/code tag.
        if ($.x('ancestor-or-self::*[self::s or contains(@class,"removed-spoiler")]', ancestor)) {
          $.prepend(frag, $.tn('[spoiler]'));
          $.add(frag, $.tn('[/spoiler]'));
        }
        if (insideCode = $.x('ancestor-or-self::pre[contains(@class,"prettyprint")]', ancestor)) {
          $.prepend(frag, $.tn('[code]'));
          $.add(frag, $.tn('[/code]'));
        }
        for (node of $$((insideCode ? 'br' : '.prettyprint br'), frag)) {
          $.replace(node, $.tn('\n'));
        }
        for (node of $$('br', frag)) {
          if (node !== frag.lastChild) { $.replace(node, $.tn('\n>')); }
        }
        g.SITE.insertTags?.(frag);
        for (node of $$('.linkify[data-original]', frag)) {
          $.replace(node, $.tn(node.dataset.original));
        }
        for (node of $$('.embedder', frag)) {
          if (node.previousSibling?.nodeValue === ' ') { $.rm(node.previousSibling); }
          $.rm(node);
        }
        text += `>${frag.textContent.trim()}\n`;
      } catch (error) { }
    }

    QR.openPost();
    const {com, thread} = QR.nodes;
    if (!com.value) { thread.value = Get.threadFromNode(this); }

    const wasOnlyQuotes = QR.selected.isOnlyQuotes();

    const caretPos = com.selectionStart;
    // Replace selection for text.
    com.value = com.value.slice(0, caretPos) + text + com.value.slice(com.selectionEnd);
    // Move the caret to the end of the new quote.
    range = caretPos + text.length;
    com.setSelectionRange(range, range);
    com.focus();

    // This allows us to determine if any text other than quotes has been typed.
    if (wasOnlyQuotes) { QR.selected.quotedText = com.value; }

    QR.selected.save(com);
    return QR.selected.save(thread);
  },

  characterCount() {
    const counter = QR.nodes.charCount;
    const count   = QR.nodes.com.value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '_').length;
    counter.textContent = count.toString();
    counter.hidden      = count < (QR.max_comment/2);

    const splitPost = QR.nodes.splitPost;
    splitPost.hidden = count < QR.max_comment;

    return (count > QR.max_comment ? $.addClass : $.rmClass)(counter, 'warning');
  },

  splitPost() {
    if (QR.selected.isLocked) return;
    const count = QR.nodes.com.value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '_').length;
    if (count < QR.max_comment) return;
    const text = QR.nodes.com.value;
    let lastPostLength = 0;
    let splitCount = 0;
    const idx = QR.posts.indexOf(QR.selected);
    QR.selected.setComment("");

    for (const line of text.split("\n")) {
      const currentLength = line.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '_').length + 1 // +1 for newline at end
      if (currentLength + lastPostLength > QR.max_comment) {
        const post = new QR.post(true);
        post.setComment(line);
        lastPostLength = currentLength;
        splitCount++;
      } else {
        const newComment = [QR.selected.com, line].filter(el => el !== null).join('\n');
        QR.selected.setComment(newComment);
        lastPostLength += currentLength;
      }
    }
    const newPostIdx = QR.posts.length - splitCount;
    const newPosts = QR.posts.splice(newPostIdx, splitCount)
    QR.posts.splice(idx + 1, 0, ...newPosts);
    const rearrangedDumpList = [...QR.nodes.dumpList.children];
    const newDumps = rearrangedDumpList.splice(newPostIdx, splitCount);
    rearrangedDumpList.splice(idx + 1, 0, ...newDumps);

    for (const e of rearrangedDumpList) {
      QR.nodes.dumpList.appendChild(e);
    }

    QR.nodes.el.classList.add('dump');
  },

  getFile() {
    return $.event('QRFile', QR.selected?.file);
  },

  drawFile(e) {
    const file = QR.selected?.file;
    if (!file || !/^(image|video)\//.test(file.type)) { return; }
    const isVideo = /^video\//.test(file);
    const el = $.el((isVideo ? 'video' : 'img'));
    $.on(el, 'error', () => QR.openError());
    $.on(el, (isVideo ? 'loadeddata' : 'load'), function() {
      e.target.getContext('2d').drawImage(el, 0, 0);
      URL.revokeObjectURL(el.src);
      return $.event('QRImageDrawn', null, e.target);
    });
    return el.src = URL.createObjectURL(file);
  },

  openError() {
    const div = $.el('div');
    $.extend(div, {
      innerHTML:
        'Could not open file. [<a href="' + E(meta.upstreamFaq) + '#error-reading-metadata" target="_blank">More info</a>]'
    });
    return QR.error(div);
  },

  setFile(e) {
    const {file, name, source} = e.detail;
    if (name != null) { file.name   = name; }
    if (source != null) { file.source = source; }
    QR.open();
    return QR.handleFiles([file]);
  },

  drag(e) {
    // Let it drag anything from the page.
    const toggle = e.type === 'dragstart' ? $.off : $.on;
    toggle(d, 'dragover', QR.dragOver);
    return toggle(d, 'drop',     QR.dropFile);
  },

  dragOver(e) {
    e.preventDefault();
    return e.dataTransfer.dropEffect = 'copy';
  }, // cursor feedback

  dropFile(e) {
    // Let it only handle files from the desktop.
    if (!e.dataTransfer.files.length) { return; }
    e.preventDefault();
    QR.open();
    QR.dropTargetPost = QR.findPostFromDropTarget(e.target);
    QR.isDroppingFiles = true;
    try {
      return QR.handleFiles(e.dataTransfer.files);
    } finally {
      QR.dropTargetPost = undefined;
      QR.isDroppingFiles = false;
    }
  },

  paste(e) {
    if (!e.clipboardData.items) { return; }
    let file = null;
    let score = -1;
    for (var item of e.clipboardData.items) {
      var file2;
      if ((item.kind === 'file') && (file2 = item.getAsFile())) {
        var score2 = (2* +(file2.size <= QR.max_size)) + +(file2.type === 'image/png');
        if (score2 > score) {
          file = file2;
          score = score2;
        }
      }
    }
    if (file) {
      const {type} = file;
      const blob = new Blob([file], {type});
      blob.name = `${Conf['pastedname']}.${$.getOwn(QR.extensionFromType, type) || 'jpg'}`;
      QR.open();
      QR.handleFiles([blob]);
    }
  },

  pasteFF() {
    const {pasteArea} = QR.nodes;
    if (!pasteArea.childNodes.length) { return; }
    const images = $$('img', pasteArea);
    $.rmAll(pasteArea);
    for (var img of images) {
      var m;
      var {src} = img;
      if (m = src.match(/data:(image\/(\w+));base64,(.+)/)) {
        var bstr = atob(m[3]);
        var arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) {
          arr[i] = bstr.charCodeAt(i);
        }
        var blob = new Blob([arr], {type: m[1]});
        blob.name = `${Conf['pastedname']}.${m[2]}`;
        QR.handleFiles([blob]);
      } else if (/^https?:\/\//.test(src)) {
        QR.handleUrl(src);
      }
    }
  },

  handleUrl(urlDefault) {
    QR.open();
    const { selected } = QR;
    selected.preventAutoPost();
    CrossOrigin.permission(function() {
      const url = prompt('Enter a URL:', urlDefault);
      if (!url) return;
      QR.nodes.fileButton.focus();
      CrossOrigin.file(url, function(blob) {
        if (blob && !/^text\//.test(blob.type)) {
          selected.setFile(blob);
          $.addClass(QR.nodes.el, 'dump');
        } else {
          QR.error("Can't load file.");
        }
      });
    });
  },

  handleFiles(files: File[] | FileList) {
    if (this !== QR) { // file input
      files  = Array.from(this.files as ArrayLike<File>);
      this.value = null;
    } else {
      files = Array.from(files as ArrayLike<File>);
    }
    if (!files.length) { return; }
    QR.cleanNotifications();
    QR.warnHeavyBatch(files);
    for (const file of files) {
      QR.queueFile(file, files.length);
    }
    QR.processPendingFiles();
    $.addClass(QR.nodes.el, 'dump');
    if ((d.activeElement === QR.nodes.fileButton) && $.hasClass(QR.nodes.fileSubmit, 'has-file')) {
      return QR.nodes.filename.focus();
    }
  },

  queueFile(file: File, nfiles: number) {
    const post = QR.pickPostForFile(file, nfiles);
    const isText = /^text\//.test(file.type);
    if (!post) { return; }
    if (isText) {
      post.pasting = true;
    } else {
      post.pendingFile = true;
    }
    QR.pendingFiles.push({ file, post, isText });
  },

  pickPostForFile(file: File, nfiles: number) {
    let post;
    const isText = /^text\//.test(file.type);
    if (nfiles === 1) {
      if (QR.isDroppingFiles) {
        const target = QR.dropTargetPost;
        if (target && QR.postCanTakeFile(target, isText)) {
          post = target;
        } else if (target) {
          post = new QR.post();
        } else if (QR.postCanTakeFile(QR.selected, isText)) {
          post = QR.selected;
        } else {
          post = new QR.post();
        }
      } else {
        post = QR.selected;
      }
    } else {
      post = QR.posts[QR.posts.length - 1];
      if (!post) { post = new QR.post(); }
      if (isText ? post.com || post.pasting : post.file || post.pendingFile) {
        post = new QR.post();
      }
    }
    return post;
  },

  postCanTakeFile(post: post, isText: boolean) {
    if (!post) { return false; }
    return isText ?
      !(post.com || post.pasting)
    :
      !(post.file || post.pendingFile);
  },

  findPostFromDropTarget(target: EventTarget | null) {
    let node = target as Node;
    while (node?.parentNode && !(node instanceof HTMLAnchorElement && $.hasClass(node, 'qr-preview'))) {
      node = node.parentNode;
    }
    if (!(node instanceof HTMLAnchorElement) || !$.hasClass(node, 'qr-preview')) { return; }
    return QR.posts.find(post => post.nodes.el === node);
  },

  async processPendingFiles() {
    if (QR.isProcessingPendingFiles) { return; }
    QR.isProcessingPendingFiles = true;
    try {
      while (QR.pendingFiles.length) {
        const batch = QR.pendingFiles.splice(0, QR.fileBatchSize);
        await Promise.all(batch.map(({ file, post, isText }) => (
          isText ? Promise.resolve(post.pasteText(file)) : post.setFile(file)
        )));
      }
    } finally {
      QR.isProcessingPendingFiles = false;
    }
  },

  warnHeavyBatch(files: File[] | FileList) {
    const fileList = Array.from(files as ArrayLike<File>);
    const mediaFiles = fileList.filter(file => /^(image|video)\//.test(file.type));
    if (!mediaFiles.length) { return; }
    const totalSize = mediaFiles.reduce((size, file) => size + file.size, 0);
    if ((mediaFiles.length < QR.heavyBatchFileCount) && (totalSize < QR.heavyBatchSize)) { return; }
    const sizeLabel = $.bytesToString(totalSize);
    new Notice('warning',
      `Large media batch queued (${mediaFiles.length} files, ${sizeLabel}). Files will be processed in batches of ${QR.fileBatchSize}.`,
      8
    );
  },

  openFileInput() {
    if (QR.nodes.fileButton.disabled) { return; }
    QR.nodes.fileInput.click();
    return QR.nodes.fileButton.focus();
  },

  generatePostableThreadsList() {
    if (!QR.nodes) { return; }
    const list    = QR.nodes.thread;
    const options = [list.firstElementChild];
    for (var thread of g.BOARD.threads.keys) {
      options.push($.el('option', {
        value: thread,
        textContent: `Thread ${thread}`
      }
      )
      );
    }
    const val = list.value;
    $.rmAll(list);
    $.add(list, options);
    list.value = val;
    if (list.value === val) { return; }
    // Fix the value if the option disappeared.
    list.value = g.VIEW === 'thread' ?
      g.THREADID
    :
      'new';
    return (g.VIEW === 'thread' ? $.addClass : $.rmClass)(QR.nodes.el, 'reply-to-thread');
  },

  dialog() {
    let dialog, event, nodes: typeof QR.nodes;
    let name;
    QR.nodes = (nodes = {
      el: (dialog = UI.dialog('qr',
        { innerHTML: QuickReplyPage }))
    } as typeof QR.nodes);

    const setNode = (name, query) => nodes[name] = $(query, dialog);

    setNode('move',           '.move');
    setNode('autohide',       '#autohide');
    setNode('close',          '.close');
    setNode('thread',         'select');
    setNode('form',           'form');
    setNode('sjisToggle',     '#sjis-toggle');
    setNode('texButton',      '#tex-preview-button');
    setNode('name',           '[data-name=name]');
    setNode('email',          '[data-name=email]');
    setNode('sub',            '[data-name=sub]');
    setNode('com',            '[data-name=com]');
    setNode('charCount',      '#char-count');
    setNode('texPreview',     '#tex-preview');
    setNode('comPreview',     '#qr-com-preview');
    setNode('dumpList',       '#dump-list');
    setNode('addPost',        '#add-post');
    setNode('oekaki',         '.oekaki');
    setNode('drawButton',     '#qr-draw-button');
    setNode('randomizeButton','#qr-randomize');
    setNode('compress',       '#qr-jpg');
    setNode('view',           '#qr-view');
    setNode('restoreNameButton','#qr-restore-name');
    setNode('fileSubmit',     '#file-n-submit');
    setNode('fileButton',     '#qr-file-button');
    setNode('noFile',         '#qr-no-file');
    setNode('filename',       '#qr-filename');
    setNode('spoiler',        '#qr-file-spoiler');
    setNode('oekakiButton',   '#qr-oekaki-button');
    setNode('fileRM',         '#qr-filerm');
    setNode('urlButton',      '#url-button');
    setNode('pasteArea',      '#paste-area');
    setNode('customCooldown', '#custom-cooldown-button');
    setNode('dumpButton',     '#dump-button');
    setNode('status',         '[type=submit]');
    setNode('flashTag',       '[name=filetag]');
    setNode('fileInput',      '[type=file]');
    setNode('splitPost',      '#split-post')

    const {config} = g.BOARD;
    const {classList} = QR.nodes.el;
    classList.toggle('forced-anon',  QR.forcedAnon);
    classList.toggle('has-spoiler',  QR.spoiler);
    classList.toggle('has-sjis',     !!config.sjis_tags);
    classList.toggle('has-math',     !!config.math_tags);
    classList.toggle('sjis-preview', !!config.sjis_tags && Conf['sjisPreview']);
    classList.toggle('show-new-thread-option', Conf['Show New Thread Option in Threads']);
    QR.applyCommentPreviewSettings();

    if (parseInt(Conf['customCooldown'], 10) > 0) {
      $.addClass(QR.nodes.fileSubmit, 'custom-cooldown');
      $.get('customCooldownEnabled', Conf['customCooldownEnabled'], function({customCooldownEnabled}) {
        QR.setCustomCooldown(customCooldownEnabled);
        return $.sync('customCooldownEnabled', QR.setCustomCooldown);
      });
    }

    QR.flagsInput();
    nodes.name.maxLength = QR.max_name;
    nodes.email.maxLength = QR.max_email;
    nodes.sub.maxLength = QR.max_sub;
    nodes.com.maxLength = QR.max_comment;

    $.on(nodes.autohide,       'change',    QR.toggleHide);
    $.on(nodes.close,          'click',     QR.close);
    $.on(nodes.status,         'click',     QR.submit);
    $.on(nodes.form,           'submit',    QR.submit);
    $.on(nodes.sjisToggle,     'click',     QR.toggleSJIS);
    $.on(nodes.texButton,      'mousedown', QR.texPreviewShow);
    $.on(nodes.texButton,      'mouseup',   QR.texPreviewHide);
    $.on(nodes.addPost,        'click',     () => new QR.post(true));
    $.on(nodes.drawButton,     'click',     QR.oekaki.draw);
    $.on(nodes.fileButton,     'click',     QR.openFileInput);
    $.on(nodes.noFile,         'click',     QR.openFileInput);
    $.on(nodes.randomizeButton,'click',     e => {
      QR.selected.randomizeName();
      QR.blurMouseFocusedAction(e);
    });
    $.on(nodes.compress,       'click',     async e => {
      // `currentTarget` is not stable after `await`, so capture and blur now.
      const action = e.currentTarget as HTMLElement | null;
      QR.blurPointerFocusedElement(action, e.detail);
      if (!QR.selected.file) { return; }
      QR.handleFiles([await QR.convert(QR.selected.file)]);
    });
    $.on(nodes.view,           'click',     QR.preview);
    $.on(nodes.restoreNameButton,'click',   e => {
      QR.selected.restoreName();
      QR.blurMouseFocusedAction(e);
    });
    $.on(nodes.filename,       'focus',     function() { return $.addClass(this.parentNode, 'focus'); });
    $.on(nodes.filename,       'blur',      function() { return $.rmClass(this.parentNode, 'focus'); });
    $.on(nodes.spoiler,        'change',    () => QR.selected.nodes.spoiler.click());
    $.on(nodes.oekakiButton,   'click',     e => {
      QR.oekaki.button();
      QR.blurMouseFocusedAction(e);
    });
    $.on(nodes.fileRM,         'click',     () => QR.selected.rmFile());
    $.on(nodes.urlButton,      'click',     () => QR.handleUrl(''));
    $.on(nodes.customCooldown, 'click',     QR.toggleCustomCooldown);
    $.on(nodes.dumpButton,     'click',     QR.toggleDumpList);
    $.on(nodes.fileInput,      'change',    QR.handleFiles);
    $.on(nodes.splitPost,      'click',     QR.splitPost);
    $.on(dialog, 'click', e => {
      const anchor = (e.target as HTMLElement)?.closest?.('a[href^="javascript:"]');
      if (anchor) { e.preventDefault(); }
    });

    window.addEventListener('focus', QR.focus, true);
    window.addEventListener('blur',  QR.focus, true);
    // We don't receive blur events from captcha iframe.
    $.on(d, 'click', QR.focus);

    // XXX Workaround for image pasting in Firefox, obsolete as of v50.
    // https://bugzilla.mozilla.org/show_bug.cgi?id=906420
    if (($.engine === 'gecko') && !window.DataTransferItemList) {
      nodes.pasteArea.hidden = false;
    }
    new MutationObserver(QR.pasteFF).observe(nodes.pasteArea, {childList: true});

    // save selected post's data
    const items = ['thread', 'name', 'email', 'sub', 'com', 'filename', 'flag'];
    let i = 0;
    const save = function() { QR.selected.save(this); };
    while ((name = items[i++])) {
      var node;
      if (!(node = nodes[name])) { continue; }
      event = node.nodeName === 'SELECT' ? 'change' : 'input';
      $.on(nodes[name], event, save);
    }

    if (Conf['Remember QR Size']) {
      $.get('QR Size', '', item => nodes.com.style.cssText = item['QR Size']);
      $.on(nodes.com, 'mouseup', function(e) {
        if (e.button !== 0) { return; }
        $.set('QR Size', this.style.cssText);
      });
    }

    QR.generatePostableThreadsList();
    QR.persona.load();
    new QR.post(true);
    QR.status();
    QR.cooldown.setup();
    QR.captcha.init();

    $.add(d.body, dialog);
    QR.captcha.setup();
    QR.oekaki.setup();

    // Create a custom event when the QR dialog is first initialized.
    // Use it to extend the QR's functionalities, or for XTRM RICE.
    $.event('QRDialogCreation', null, dialog);

    Icon.set(nodes.oekakiButton, 'pencil');
    Icon.set(nodes.urlButton, 'link');
    Icon.set(nodes.pasteArea, 'clipboard');
    Icon.set(nodes.customCooldown, 'clock');
    Icon.set(nodes.randomizeButton, 'shuffle');
    Icon.set(nodes.compress, 'shrink');
    Icon.set(nodes.view, 'eye');
    Icon.set(nodes.restoreNameButton, 'undo');
    Icon.set(nodes.splitPost, 'scissors');
    Icon.set(nodes.fileRM, 'xmark');
    Icon.set(nodes.close, 'xmark');
    Icon.set(nodes.dumpButton, 'squarePlus');
    Icon.set(nodes.addPost, 'plus');
  },

  flags() {
    const select = $.el('select', {
      name:      'flag',
      className: 'flagSelector'
    }) as HTMLSelectElement;

    const picker = $.el('div', {className: 'flagSelector-picker'}) as HTMLDivElement;

    const toggle = $.el('button', {
      type: 'button',
      className: 'flagSelector-toggle field'
    }) as HTMLButtonElement;
    toggle.setAttribute('aria-expanded', 'false');

    const icon = $.el('span', {className: 'flagSelector-icon flagSelector-icon-empty'});
    icon.setAttribute('aria-hidden', 'true');

    const label = $.el('span', {className: 'flagSelector-label'});

    $.add(toggle, [icon, label]);
    $.add(picker, toggle);

    const menu = $.el('div', {className: 'flagSelector-menu', hidden: true}) as HTMLDivElement;

    const entries: Record<string, {text: string, iconClass: string}> = {};
    let open = false;

    const closeMenu = () => {
      if (!open) return;
      open = false;
      picker.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    };

    const updateMenuPosition = () => {
      const rect = toggle.getBoundingClientRect();
      const width = Math.max(rect.width, 180);
      const pad = 8;
      const left = Math.min(Math.max(rect.left, pad), Math.max(pad, window.innerWidth - width - pad));
      const spaceBelow = window.innerHeight - rect.bottom - pad;
      const spaceAbove = rect.top - pad;
      const desired = Math.min(menu.scrollHeight || 320, 320);
      const openUpward = spaceBelow < 150 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(100, openUpward ? spaceAbove : spaceBelow);
      const height = Math.min(desired, maxHeight);
      const top = openUpward ? rect.top - height : rect.bottom;
      menu.style.left = `${left}px`;
      menu.style.top = `${Math.max(pad, top)}px`;
      menu.style.width = `${width}px`;
      menu.style.maxHeight = `${maxHeight}px`;
    };

    const openMenu = () => {
      if (open) return;
      open = true;
      picker.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      menu.hidden = false;
      updateMenuPosition();
    };

    const syncSelected = () => {
      let value = '' + (select.value || '');
      if (!(value in entries)) {
        value = '' + (select.options[0]?.value || '0');
        select.value = value;
      }
      const data = entries[value];
      icon.className = `flagSelector-icon ${data.iconClass}`.trim();
      if (!data.iconClass) icon.classList.add('flagSelector-icon-empty');
      label.textContent = data.text;
      for (const opt of Array.from(menu.querySelectorAll<HTMLElement>('.flagSelector-option'))) {
        opt.classList.toggle('selected', opt.dataset.value === value);
      }
    };

    const addFlag = (value: string, textContent: string) => {
      $.add(select, $.el('option', {value, textContent}));
      const valueStr = '' + value;
      const code = valueStr.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      const iconClass = valueStr !== '0' ? `bfl bfl-${code}` : '';

      entries[valueStr] = {text: textContent, iconClass};

      const option = $.el('button', {
        type: 'button',
        className: 'flagSelector-option'
      }) as HTMLButtonElement;
      option.dataset.value = valueStr;

      const optionIcon = $.el('span', {className: `flagSelector-icon ${iconClass}`.trim()});
      if (!iconClass) optionIcon.classList.add('flagSelector-icon-empty');
      optionIcon.setAttribute('aria-hidden', 'true');

      const optionLabel = $.el('span', {className: 'flagSelector-label', textContent});

      $.add(option, [optionIcon, optionLabel]);
      $.on(option, 'click', () => {
        if (select.disabled) return;
        select.value = valueStr;
        select.dispatchEvent(new Event('change', {bubbles: true}));
        closeMenu();
      });
      $.add(menu, option);
    };

    addFlag('0', g.BOARD.config.country_flags ? 'Geographic Location' : 'None');
    for (const value in g.BOARD.config.board_flags) {
      addFlag(value, g.BOARD.config.board_flags[value]);
    }

    const onToggleClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (select.disabled) return;
      if (open) closeMenu(); else openMenu();
    };

    const onOutsideMouseDown = (e: Event) => {
      if (!open) return;
      const target = e.target as Node;
      if (picker.contains(target) || menu.contains(target)) return;
      closeMenu();
    };

    const onDocKeydown = (e: Event) => {
      if (!open) return;
      if ((e as KeyboardEvent).key === 'Escape') {
        closeMenu();
        toggle.focus();
      }
    };

    const onViewportChange = () => { if (open) closeMenu(); };

    $.on(toggle, 'click', onToggleClick);
    $.on(d, 'mousedown', onOutsideMouseDown);
    $.on(d, 'keydown', onDocKeydown);
    $.on(window, 'resize', onViewportChange);
    $.on(window, 'scroll', onViewportChange);
    $.on(QR.nodes.form, 'scroll', onViewportChange);
    $.on(select, 'change', syncSelected);

    new MutationObserver(() => {
      toggle.disabled = select.disabled;
      if (select.disabled) closeMenu();
    }).observe(select, {attributes: true, attributeFilter: ['disabled']});

    (select as any)._syncFlagPicker = syncSelected;
    (select as any)._destroyFlagPicker = () => {
      closeMenu();
      $.off(toggle, 'click', onToggleClick);
      $.off(d, 'mousedown', onOutsideMouseDown);
      $.off(d, 'keydown', onDocKeydown);
      $.off(window, 'resize', onViewportChange);
      $.off(window, 'scroll', onViewportChange);
      $.off(QR.nodes.form, 'scroll', onViewportChange);
      $.off(select, 'change', syncSelected);
      $.rm(menu);
    };

    $.add(d.body, menu);
    syncSelected();
    return {select, picker};
  },

  flagsInput() {
    const {nodes} = QR;
    if (!nodes) { return; }
    if (nodes.flag) {
      (nodes.flag as any)._destroyFlagPicker?.();
      const picker = (nodes.flag as any)._picker as HTMLElement | undefined;
      if (picker) $.rm(picker);
      $.rm(nodes.flag);
      delete nodes.flag;
    }

    if (!g.BOARD.config.board_flags) return;

    const {select, picker} = QR.flags();
    select.dataset.name    = 'flag';
    select.dataset.default = '0';
    nodes.flag = select;
    (nodes.flag as any)._picker = picker;

    $.add(nodes.form, select);
    $.add(nodes.form, picker);
  },

  updateFlagSelector() {
    (QR.nodes?.flag as any)?._syncFlagPicker?.();
  },

  submit(e) {
    let captcha, err, filetag;
    e?.preventDefault();
    const force = e?.shiftKey;

    if (QR.req) {
      QR.abort();
      return;
    }

    $.forceSync('cooldowns');
    if (QR.cooldown.seconds) {
      if (force) {
        QR.cooldown.clear();
      } else {
        QR.cooldown.auto = !QR.cooldown.auto;
        QR.status();
        return;
      }
    }

    const post = QR.posts[0];
    delete post.quotedText;
    post.forceSave();
    let threadID = post.thread;
    const thread = g.BOARD.threads.get(threadID);
    if ((g.BOARD.ID === 'f') && (threadID === 'new')) {
      filetag = QR.nodes.flashTag.value;
    }

    // prevent errors
    if (threadID === 'new') {
      threadID = null;
      if (!!g.BOARD.config.require_subject && !post.sub) {
        err = 'New threads require a subject.';
      } else if (!!!g.BOARD.config.text_only && !post.file) {
        err = 'No file selected.';
      }
    } else if (g.BOARD.threads.get(threadID).isClosed) {
      err = 'You can\'t reply to this thread anymore.';
    } else if (!post.com && !post.file) {
      err = 'No comment or file.';
    } else if (post.file && thread.fileLimit) {
      err = 'Max limit of image replies has been reached.';
    }

    if ((g.BOARD.ID === 'r9k') && !post.com?.match(/[a-z-]/i)) {
      if (!err) { err = 'Original comment required.'; }
    }

    const unitLength = str => (str || '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '_').length;
    if (!err && !QR.forcedAnon && unitLength(post.name) > QR.max_name) {
      err = `Name is too long (${unitLength(post.name)}/${QR.max_name}).`;
    }
    if (!err && unitLength(post.email) > QR.max_email) {
      err = `Options is too long (${unitLength(post.email)}/${QR.max_email}).`;
    }
    if (!err && unitLength(post.sub) > QR.max_sub) {
      err = `Subject is too long (${unitLength(post.sub)}/${QR.max_sub}).`;
    }
    if (!err && unitLength(post.com) > QR.max_comment) {
      err = `Comment is too long (${unitLength(post.com)}/${QR.max_comment}).`;
    }

    if (QR.captcha.isEnabled && !((QR.captcha === Captcha.v2) && /\b_ct=/.test(d.cookie) && threadID) && !(err && !force)) {
      captcha = QR.captcha.getOne(!!threadID);
      if (QR.captcha === Captcha.v2) {
        if (!captcha) { captcha = Captcha.cache.request(!!threadID); }
      }
      if (!captcha) {
        err = 'No valid captcha.';
        QR.captcha.setup(!QR.cooldown.auto || (d.activeElement === QR.nodes.status));
      }
    }

    QR.cleanNotifications();
    if (err && !force) {
      // stop auto-posting
      QR.cooldown.auto = false;
      QR.status();
      QR.error(err);
      return;
    }

    // Enable auto-posting if we have stuff to post, disable it otherwise.
    QR.cooldown.auto = QR.posts.length > 1;

    post.lock();

    const formData = {
      MAX_FILE_SIZE: QR.max_size,
      mode:     'regist',
      pwd:      QR.persona.getPassword(),
      resto:    threadID,
      name:     (!QR.forcedAnon ? post.name : undefined),
      email:    post.email,
      sub:      (!QR.forcedAnon && !threadID ? post.sub : undefined),
      com:      post.com,
      upfile:   post.file,
      filetag,
      spoiler:  post.spoiler,
      flag:     post.flag,
    };

    const options = {
      responseType: 'document',
      withCredentials: true,
      onloadend: QR.response,
      form: $.formData(formData)
    };
    if (Conf['Show Upload Progress']) {
      options.onprogress = function(e) {
        if (this !== QR.req?.upload) { return; } // aborted
        if (e.loaded < e.total) {
          // Uploading...
          QR.req.progress = `${Math.round((e.loaded / e.total) * 100)}%`;
        } else {
          // Upload done, waiting for server response.
          QR.req.isUploadFinished = true;
          QR.req.progress = '...';
        }
        return QR.status();
      };
    }

    let cb = function(response) {
      if (response != null) {
        QR.currentCaptcha = response;
        if (QR.captcha === Captcha.v2) {
          if (response.challenge != null) {
            options.form.append('recaptcha_challenge_field', response.challenge);
            options.form.append('recaptcha_response_field', response.response);
          } else {
            options.form.append('g-recaptcha-response', response.response);
          }
        } else {
          for (var key in response) {
            var val = response[key];
            options.form.append(key, val);
          }
        }
      }
      QR.req = $.ajax(`https://sys.${location.hostname.split('.')[1]}.org/${g.BOARD}/post`, options);
      QR.req.progress = '...';
    };

    if (typeof captcha === 'function') {
      // Wait for captcha to be verified before submitting post.
      QR.req = {
        progress: '...',
        abort() {
          if (QR.captcha === Captcha.v2) {
            Captcha.cache.abort();
          }
          cb = null;
        }
      };
      captcha(function(response) {
        if ((QR.captcha === Captcha.v2) && Captcha.cache.haveCookie()) {
          cb?.();
          if (response) { return Captcha.cache.save(response); }
        } else if (response) {
          cb?.(response);
        } else {
          delete QR.req;
          post.unlock();
          QR.cooldown.auto = !!Captcha.cache.getCount();
          QR.status();
        }
      });
    } else {
      cb(captcha);
    }

    // Starting to upload might take some time.
    // Provide some feedback that we're starting to submit.
    QR.status();
  },

  response() {
    let connErr, err;
    if (this !== QR.req) { return; } // aborted
    delete QR.req;
    const submittedCaptcha = QR.currentCaptcha;

    const post = QR.posts[0];
    post.unlock();

    if (err = this.response?.getElementById('errmsg')) { // error!
      const el = $('a', err);
      if (el) el.target = '_blank'; // duplicate image link
    } else if (connErr = (!this.response || (this.response.title !== 'Post successful!'))) {
      err = QR.connectionError();
      if ((QR.captcha === Captcha.v2) && submittedCaptcha) { Captcha.cache.save(submittedCaptcha); }
    } else if (this.status !== 200) {
      err = `Error ${this.statusText} (${this.status})`;
    }

    if (!connErr) { QR.captcha.setUsed?.(); }
    delete QR.currentCaptcha;

    if (err) {
      let m;
      QR.errorCount = (QR.errorCount || 0) + 1;
      if (/captcha|verification/i.test(err.textContent)) {
        const wasNoopTCaptcha = (QR.captcha === Captcha.t) &&
          !!submittedCaptcha?.['t-challenge'] &&
          !submittedCaptcha?.['t-response'];
        if (wasNoopTCaptcha) {
          QR.captcha.setState?.('failed');
          QR.captcha.forceLoad?.();
          err = 'Captcha is now required. A new captcha has been requested.';
        } else {
          // Remove the obnoxious 4chan Pass ad.
          if (/mistyped/i.test(err.textContent)) {
            err = 'You mistyped the CAPTCHA, or the CAPTCHA malfunctioned.';
            QR.captcha.setState?.('failed');
          } else if (/expired/i.test(err.textContent)) {
            err = 'This CAPTCHA is no longer valid because it has expired.';
            QR.captcha.setState?.('expired');
          } else {
            QR.captcha.setState?.('failed');
          }
        }
        // Do not auto post with a wrong captcha.
        QR.cooldown.auto = false;
      } else if (connErr) {
        if (QR.errorCount >= 5) {
          // Too many posting errors can ban you. Stop autoposting after 5 errors.
          QR.cooldown.auto = false;
        } else {
          // Something must've gone terribly wrong if you get captcha errors without captchas.
          // Don't auto-post indefinitely in that case.
          QR.cooldown.auto = QR.captcha.isEnabled || connErr;
          // Too many frequent mistyped captchas will auto-ban you!
          // On connection error, the post most likely didn't go through.
          // If the post did go through, it should be stopped by the duplicate reply cooldown.
          QR.cooldown.addDelay(post, 2);
        }
      } else if (err.textContent && (m = err.textContent.match(/\d+\s+(?:minute|second)/gi)) && !/duplicate|hour/i.test(err.textContent)) {
        QR.cooldown.auto = !/have\s+been\s+muted/i.test(err.textContent);
        let seconds = 0;
        for (var mi of m) {
          seconds += (/minute/i.test(mi) ? 60 : 1) * (+mi.match(/\d+/)[0]);
        }
        if (/muted/i.test(err.textContent)) {
          QR.cooldown.addMute(seconds);
        } else {
          QR.cooldown.addDelay(post, seconds);
        }
      } else { // stop auto-posting
        QR.cooldown.auto = false;
      }
      QR.captcha.setup(QR.cooldown.auto && [QR.nodes.status, d.body].includes(d.activeElement));
      QR.status();
      QR.error(err);
      return;
    }

    delete QR.errorCount;

    const h1 = $('h1', this.response);

    let [_, threadID, postID] = h1.nextSibling.textContent.match(/thread:(\d+),no:(\d+)/);
    postID   = +postID;
    threadID = +threadID || postID;
    const isReply  = threadID !== postID;

    // Post/upload confirmed as successful.
    $.event('QRPostSuccessful', {
      boardID: g.BOARD.ID,
      threadID,
      postID
    });
    // XXX deprecated
    $.event('QRPostSuccessful_', {boardID: g.BOARD.ID, threadID, postID});

    // Enable auto-posting if we have stuff left to post, disable it otherwise.
    const postsCount = QR.posts.length - 1;
    QR.cooldown.auto = postsCount && isReply;

    const lastPostToThread = !((function() { for (var p of QR.posts.slice(1)) { if (p.thread === post.thread) { return true; } } })());

    if (postsCount) {
      post.rm();
      QR.captcha.setup(d.activeElement === QR.nodes.status);
    } else if (Conf['Persistent QR']) {
      post.rm();
      if (Conf['Auto Hide QR']) {
        QR.hide();
      } else {
        QR.blur();
      }
    } else {
      QR.close();
    }

    QR.cleanNotifications();
    if (Conf['Posting Success Notifications']) {
      QR.notifications.push(new Notice('success', h1.textContent, 5));
    }

    QR.cooldown.add(threadID, postID);

    const URL = threadID === postID ? ( // new thread
      `${window.location.origin}/${g.BOARD}/thread/${threadID}`
    ) : (threadID !== g.THREADID) && lastPostToThread && Conf['Open Post in New Tab'] ? ( // replying from the index or a different thread
      `${window.location.origin}/${g.BOARD}/thread/${threadID}#p${postID}`
    ) : undefined;

    if (URL) {
      const open = Conf['Open Post in New Tab'] || postsCount ?
        () => $.open(URL)
      :
        () => location.href = URL;

      if (threadID === postID) {
        // XXX 4chan sometimes responds before the thread exists.
        QR.waitForThread(URL, open);
      } else {
        open();
      }
    }

    QR.status();
  },

  waitForThread(url, cb) {
    let attempts = 0;
    var check = function() {
      $.ajax(url, {
        onloadend() {
          attempts++;
          if ((attempts >= 6) || (this.status === 200)) {
            return cb();
          } else {
            return setTimeout(check, attempts * SECOND);
          }
        },
        responseType: 'text',
        type: 'HEAD'
      }
      );
    };
    check();
  },

  abort() {
    let oldReq;
    if ((oldReq = QR.req) && !QR.req.isUploadFinished) {
      delete QR.req;
      oldReq.abort();
      if ((QR.captcha === Captcha.v2) && QR.currentCaptcha) { Captcha.cache.save(QR.currentCaptcha); }
      delete QR.currentCaptcha;
      QR.posts[0].unlock();
      QR.cooldown.auto = false;
      QR.notifications.push(new Notice('info', 'QR upload aborted.', 5));
    }
    QR.status();
  },

  getMaxSize(file: File) {
    let max = QR.max_size;
    if (file.type.startsWith('video/')) max = Math.min(max, QR.max_size_video);
    return max;
  },

  async convert(file: File, type: 'jpeg' | 'png' = 'jpeg', options?: ConvertOptions): Promise<File> {
    const maxSize = options?.maxSize || this.getMaxSize(file);
    const img = options?.img || await createImageBitmap(file);
    const width = options?.width || img.width;
    const height = options?.height || img.height;
    const newName = file.name.replace(/\.[a-z]+$/i, '.' + type);
    const mime = 'image/' + type;

    // Fallback to HTMLCanvasElement is for old firefox versions. Once the minimum firefox >= 105, this can be
    // simplified to just the OffscreenCanvas implementation.
    // Conf['Avoid OffscreenCanvas'] is for https://codeberg.org/librewolf/issues/issues/2174
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let toBlob: (mime: string, quality: number) => Promise<Blob>;
    if (window.OffscreenCanvas && !Conf['Avoid OffscreenCanvas']) {
      canvas = new OffscreenCanvas(width, height);
      toBlob = (mime, quality) => (canvas as OffscreenCanvas).convertToBlob({ type: mime, quality });
    } else {
      canvas = $.el('canvas', { width, height }) as HTMLCanvasElement;
      toBlob = (mime, quality) => new Promise(resolve => {
        (canvas as HTMLCanvasElement).toBlob(resolve, mime, quality);
      });
    }

    let newFile: File;
    let quality = .9;

    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    do {
      newFile = new File([await toBlob(mime, quality)], newName, { type: mime });
      quality -= .1;
    } while (type === 'jpeg' && newFile.size > maxSize && quality >= .1);

    if (newFile.size >= file.size && newFile.type === file.type) {
      new Notice('warning', "New jpeg file isn't smaller than the old one, so it won't be used.", 3);
      return file;
    }

    return QR.markMetadataStripped(newFile);
  },

  previewUrl: undefined as string | undefined,

  preview() {
    if (!QR.selected.file) return;

    QR.nodes.preview = $.el('div', { id: 'overlay', className: 'media-preview' }) as HTMLDivElement;
    $.add(d.body, QR.nodes.preview);
    QR.previewUrl = URL.createObjectURL(QR.selected.file);
    if (QR.selected.file.type.startsWith('video/')) {
      const video = $.el('video', { controls: true, src: QR.previewUrl, autoplay: true });
      $.add(QR.nodes.preview, video);
      video.focus();
    } else {
      $.add(QR.nodes.preview, $.el('img', { src: QR.previewUrl }));
    }
    QR.nodes.preview.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName !== 'VIDEO') QR.closePreview();
    });
  },

  closePreview() {
    QR.nodes.preview.remove();
    URL.revokeObjectURL(QR.previewUrl);
  },

  cooldown: {
    seconds: 0,
    delays: {
      deletion: 60
    }, // cooldown for deleting posts/files

    // set in setup
    maxDelay: 0,
    isSetup: false,
    auto: false,
    data: {} as Record<string, any>,

    // Called from Main
    init() {
      if (!Conf['Quick Reply']) { return; }
      this.data = Conf['cooldowns'];
      this.changes = dict();
      $.sync('cooldowns', this.sync);
    },

    // Called from QR
    setup() {
      // Read cooldown times
      $.extend(QR.cooldown.delays, g.BOARD.cooldowns());

      // The longest reply cooldown, for use in pruning old reply data
      QR.cooldown.maxDelay = 0;
      for (var type in QR.cooldown.delays) {
        var delay = QR.cooldown.delays[type];
        if (!['thread', 'thread_global'].includes(type)) {
          QR.cooldown.maxDelay = Math.max(QR.cooldown.maxDelay, delay);
        }
      }

      QR.cooldown.isSetup = true;
      QR.cooldown.start();
    },

    start() {
      const { data } = QR.cooldown;
      if (
        !Conf['Cooldown'] ||
        !QR.cooldown.isSetup ||
        !!QR.cooldown.isCounting ||
        ((Object.keys(data[g.BOARD.ID] || {}).length + Object.keys(data.global || {}).length) <= 0)
      ) { return; }
      QR.cooldown.isCounting = true;
      QR.cooldown.count();
    },

    sync(data) {
      QR.cooldown.data = data || dict();
      QR.cooldown.start();
    },

    add(threadID, postID) {
      if (!Conf['Cooldown']) { return; }
      const start = Date.now();
      const boardID = g.BOARD.ID;
      QR.cooldown.set(boardID, start, { threadID, postID });
      if (threadID === postID) { QR.cooldown.set('global', start, { boardID, threadID, postID }); }
      QR.cooldown.save();
      QR.cooldown.start();
    },

    addDelay(post, delay) {
      if (!Conf['Cooldown']) { return; }
      const cooldown = QR.cooldown.categorize(post);
      cooldown.delay = delay;
      QR.cooldown.set(g.BOARD.ID, Date.now(), cooldown);
      QR.cooldown.save();
      QR.cooldown.start();
    },

    addMute(delay) {
      if (!Conf['Cooldown']) { return; }
      QR.cooldown.set(g.BOARD.ID, Date.now(), { type: 'mute', delay });
      QR.cooldown.save();
      QR.cooldown.start();
    },

    delete(post) {
      let cooldown;
      if (!QR.cooldown.data) { return; }
      const cooldowns = (QR.cooldown.data[post.board.ID] || (QR.cooldown.data[post.board.ID] = dict()));
      for (var id in cooldowns) {
        cooldown = cooldowns[id];
        if ((cooldown.delay == null) && (cooldown.threadID === post.thread.ID) && (cooldown.postID === post.ID)) {
          QR.cooldown.set(post.board.ID, id, null);
        }
      }
      QR.cooldown.save();
    },

    secondsDeletion(post) {
      if (!QR.cooldown.data || !Conf['Cooldown']) { return 0; }
      const cooldowns = QR.cooldown.data[post.board.ID] || dict();
      for (var start in cooldowns) {
        var cooldown = cooldowns[start];
        if ((cooldown.delay == null) && (cooldown.threadID === post.thread.ID) && (cooldown.postID === post.ID)) {
          var seconds = QR.cooldown.delays.deletion - Math.floor((Date.now() - start) / SECOND);
          return Math.max(seconds, 0);
        }
      }
      return 0;
    },

    categorize(post) {
      if (post.thread === 'new') {
        return { type: 'thread' };
      } else {
        return {
          type: !!post.file ? 'image' : 'reply',
          threadID: +post.thread
        };
      }
    },

    mergeChange(data, scope, id, value) {
      if (value) {
        (data[scope] || (data[scope] = dict()))[id] = value;
      } else if (scope in data) {
        delete data[scope][id];
        if (Object.keys(data[scope]).length === 0) delete data[scope];
      }
    },

    set(scope, id, value) {
      QR.cooldown.mergeChange(QR.cooldown.data, scope, id, value);
      (QR.cooldown.changes[scope] || (QR.cooldown.changes[scope] = dict()))[id] = value;
    },

    save() {
      const { changes } = QR.cooldown;
      if (!Object.keys(changes).length) { return; }
      $.get('cooldowns', dict(), function ({ cooldowns }) {
        for (var scope in QR.cooldown.changes) {
          for (var id in QR.cooldown.changes[scope]) {
            var value = QR.cooldown.changes[scope][id];
            QR.cooldown.mergeChange(cooldowns, scope, id, value);
          }
          QR.cooldown.data = cooldowns;
        }
        $.set('cooldowns', cooldowns, () => QR.cooldown.changes = dict());
      });
    },

    clear() {
      QR.cooldown.data = dict();
      QR.cooldown.changes = dict();
      QR.cooldown.auto = false;
      QR.cooldown.update();
      $.queueTask($.delete, 'cooldowns');
    },

    update() {
      let cooldown;
      if (!QR.cooldown.isCounting) { return; }

      let save = false;
      let nCooldowns = 0;
      const now = Date.now();
      const { type, threadID } = QR.cooldown.categorize(QR.posts[0]);
      let seconds = 0;

      if (Conf['Cooldown']) {
        for (var scope of [g.BOARD.ID, 'global']) {
          var cooldowns = (QR.cooldown.data[scope] || (QR.cooldown.data[scope] = dict()));

          for (var start in cooldowns) {
            cooldown = cooldowns[start];
            start = +start;
            var elapsed = Math.floor((now - start) / SECOND);
            if (elapsed < 0) { // clock changed since then?
              QR.cooldown.set(scope, start, null);
              save = true;
              continue;
            }

            // Explicit delays from error messages
            if (cooldown.delay != null) {
              if (cooldown.delay <= elapsed) {
                QR.cooldown.set(scope, start, null);
                save = true;
              } else if (((cooldown.type === type) && (cooldown.threadID === threadID)) || (cooldown.type === 'mute')) {
                // Delays only apply to the given post type and thread.
                seconds = Math.max(seconds, cooldown.delay - elapsed);
              }
              continue;
            }

            // Clean up expired cooldowns
            var maxDelay = cooldown.threadID !== cooldown.postID ?
              QR.cooldown.maxDelay
              :
              QR.cooldown.delays[scope === 'global' ? 'thread_global' : 'thread'];
            if (QR.cooldown.customCooldown) {
              maxDelay = Math.max(maxDelay, parseInt(Conf['customCooldown'], 10));
            }
            if (maxDelay <= elapsed) {
              QR.cooldown.set(scope, start, null);
              save = true;
              continue;
            }

            if (((type === 'thread') === (cooldown.threadID === cooldown.postID)) && (cooldown.boardID !== g.BOARD.ID)) {
              // Only cooldowns relevant to this post can set the seconds variable:
              //   reply cooldown with a reply, thread cooldown with a thread.
              // Inter-board thread cooldowns only apply on boards other than the one they were posted on.
              var suffix = scope === 'global' ?
                '_global'
                :
                '';
              seconds = Math.max(seconds, QR.cooldown.delays[type + suffix] - elapsed);

              // If additional cooldown is enabled, add the configured seconds to the count.
              if (QR.cooldown.customCooldown) {
                seconds = Math.max(seconds, parseInt(Conf['customCooldown'], 10) - elapsed);
              }
            }
          }

          nCooldowns += Object.keys(cooldowns).length;
        }
      }

      if (save) { QR.cooldown.save; }

      if (nCooldowns) {
        clearTimeout(QR.cooldown.timeout);
        QR.cooldown.timeout = setTimeout(QR.cooldown.count, SECOND);
      } else {
        delete QR.cooldown.isCounting;
      }

      // Update the status when we change posting type.
      // Don't get stuck at some random number.
      // Don't interfere with progress status updates.
      const update = seconds !== QR.cooldown.seconds;
      QR.cooldown.seconds = seconds;
      if (update) QR.status();
    },

    count() {
      QR.cooldown.update();
      if ((QR.cooldown.seconds === 0) && QR.cooldown.auto && !QR.req) QR.submit();
    }
  },

  oekaki: {
    loadPromise: null as Promise<boolean> | null,
    loadFailed: false,

    pageWindow() {
      return window.wrappedJSObject || (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
    },

    getTegaki() {
      const page = QR.oekaki.pageWindow() as any;
      return page?.Tegaki || (window as any).Tegaki || (globalThis as any).Tegaki;
    },

    async loadUserscriptTegaki() {
      if (QR.oekaki.getTegaki()) { return true; }
      if (QR.oekaki.loadFailed) { return false; }
      if (QR.oekaki.loadPromise) { return QR.oekaki.loadPromise; }
      QR.oekaki.loadPromise = (async () => {
        try {
          // GM_addElement bypasses the page's CSP (which on 4chan only allows hCaptcha scripts).
          // Direct script-tag injection or new Function() would be blocked.
          if (typeof GM_addElement !== 'function') {
            throw new Error('GM_addElement is unavailable; cannot bypass site CSP to load Tegaki.');
          }
          const cacheBust = Date.now();
          const style = GM_addElement(d.head, 'link', {
            rel: 'stylesheet',
            href: `https://s.4cdn.org/css/tegaki.${cacheBust}.css`
          }) as HTMLLinkElement;
          const script = GM_addElement(d.head, 'script', {
            src: `https://s.4cdn.org/js/tegaki.min.${cacheBust}.js`
          }) as HTMLScriptElement;
          if (!script) {
            throw new Error('GM_addElement did not return a script element.');
          }
          await new Promise<void>((resolve, reject) => {
            let pending = style ? 2 : 1;
            const done = () => { if (--pending === 0) resolve(); };
            $.on(script, 'load', done);
            $.on(script, 'error', () => reject(new Error('Failed to load Tegaki script.')));
            if (style) {
              $.on(style, 'load', done);
              // CSS failure shouldn't block the editor from working.
              $.on(style, 'error', done);
            }
          });
          if (!QR.oekaki.getTegaki()) {
            throw new Error('Tegaki script loaded but did not expose the Tegaki global.');
          }
          return true;
        } catch (error) {
          console.error(error);
          QR.oekaki.loadFailed = true;
          QR.error('Failed to load Tegaki from userscript context.');
          return false;
        } finally {
          QR.oekaki.loadPromise = null;
        }
      })();
      return QR.oekaki.loadPromise;
    },

    setupDirect() {
      const page = QR.oekaki.pageWindow();
      if (!page) { return false; }
      page.FCX ||= {};
      page.FCX.oekakiCB = () => QR.oekaki.getTegaki()?.flatten().toBlob((file) => {
        const source = `oekaki-${Date.now()}`;
        page.FCX.oekakiLatest = source;
        $.event('QRSetFile', {
          file,
          name: page.FCX.oekakiName,
          source
        });
      });
      if (QR.oekaki.getTegaki()) {
        QR.nodes.oekaki.hidden = false;
      }
      return true;
    },

    drawDirect() {
      const page = QR.oekaki.pageWindow();
      const Tegaki = QR.oekaki.getTegaki();
      const FCX = page?.FCX;
      if (!(Tegaki && FCX)) { return false; }
      if (Tegaki.bg) { Tegaki.destroy(); }
      FCX.oekakiName = 'tegaki.png';
      Tegaki.open({
        onDone: FCX.oekakiCB,
        onCancel() { Tegaki.bgColor = '#ffffff'; },
        width: +$('#qr [name=oekaki-width]')?.value,
        height: +$('#qr [name=oekaki-height]')?.value,
        bgColor:
          $('#qr [name=oekaki-bg]')?.checked ?
            $('#qr [name=oekaki-bgcolor]')?.value
          :
            'transparent'
      });
      return true;
    },

    loadDirect() {
      const page = QR.oekaki.pageWindow();
      const Tegaki = QR.oekaki.getTegaki();
      const FCX = page?.FCX;
      if (!(Tegaki && FCX)) { return false; }
      const name = QR.nodes.filename.value.replace(/\.\w+$/, '') + '.png';
      const { source } = QR.nodes.fileSubmit.dataset;
      const error = content => QR.error(content);
      const cb = function(e?) {
        if (e) { this.removeEventListener('QRMetadata', cb, false); }
        const selected = QR.selected?.nodes?.el;
        if (!selected?.dataset.type) return error('No file to edit.');
        if (!/^(image|video)\//.test(selected.dataset.type)) { return error('Not an image.'); }
        if (!selected.dataset.height || !selected.dataset.width) return error('Metadata not available.');
        if (selected.dataset.height === 'loading') {
          selected.addEventListener('QRMetadata', cb, false);
          return;
        }
        const width = +selected.dataset.width;
        const height = +selected.dataset.height;
        if (!(width > 0) || !(height > 0)) return error('Metadata not available.');
        if (Tegaki.bg) { Tegaki.destroy(); }
        FCX.oekakiName = name;
        Tegaki.open({
          onDone: FCX.oekakiCB,
          onCancel() { Tegaki.bgColor = '#ffffff'; },
          width,
          height,
          bgColor: 'transparent'
        });
        const canvas = $.el('canvas', {
          width,
          height,
          hidden: true
        }) as HTMLCanvasElement;
        $.add(d.body, canvas);
        canvas.addEventListener('QRImageDrawn', function() {
          this.remove();
          // Tegaki.onOpenImageLoaded reads this.naturalWidth/naturalHeight,
          // which only <img> has — passing the canvas directly throws inside
          // resizeCanvas/createBuffers. Round-trip the pixels through an <img>.
          canvas.toBlob(blob => {
            if (!blob) { return error('Could not snapshot image for the editor.'); }
            const img = $.el('img') as HTMLImageElement;
            const url = URL.createObjectURL(blob);
            $.on(img, 'load', () => {
              URL.revokeObjectURL(url);
              Tegaki.onOpenImageLoaded.call(img);
            });
            $.on(img, 'error', () => {
              URL.revokeObjectURL(url);
              error('Could not load image into the editor.');
            });
            img.src = url;
          });
        }, false);
        $.event('QRDrawFile', null, canvas);
      };
      if (Tegaki.bg && (Tegaki.onDoneCb === FCX.oekakiCB) && (source === FCX.oekakiLatest)) {
        FCX.oekakiName = name;
        Tegaki.resume();
      } else {
        cb();
      }
      return true;
    },

    menu: {
      init() {
        if (!['index', 'thread'].includes(g.VIEW) || !Conf['Menu'] || !Conf['Edit Link'] || !Conf['Quick Reply']) { return; }

        const a = $.el('a', {
          className: 'edit-link',
          href: 'javascript:;',
          textContent: 'Edit image'
        }
        );
        $.on(a, 'click', this.editFile);

        Menu.menu.addEntry({
          el: a,
          order: 90,
          open(post) {
            QR.oekaki.menu.post = post;
            const { file } = post;
            return QR.postingIsEnabled && !!file && (file.isImage || file.isVideo);
          }
        });
      },

      editFile() {
        const { post } = QR.oekaki.menu;
        QR.quote.call(post.nodes.post);
        const { isVideo } = post.file;
        const currentTime = post.file.fullImage?.currentTime || 0;
        return CrossOrigin.file(post.file.url, function (blob) {
          if (!blob) {
            QR.error("Can't load file.");
          } else if (isVideo) {
            const video = $.el('video') as HTMLVideoElement;
            $.on(video, 'loadedmetadata', function () {
              $.on(video, 'seeked', function () {
                const canvas = $.el('canvas', {
                  width: video.videoWidth,
                  height: video.videoHeight
                }) as HTMLCanvasElement;
                canvas.getContext('2d').drawImage(video, 0, 0);
                canvas.toBlob(function (snapshot) {
                  snapshot.name = post.file.name.replace(/\.\w+$/, '') + '.png';
                  QR.handleFiles([snapshot]);
                  QR.oekaki.edit();
                });
              });
              video.currentTime = currentTime;
            });
            $.on(video, 'error', () => QR.openError());
            video.src = URL.createObjectURL(blob);
          } else {
            blob.name = post.file.name;
            QR.handleFiles([blob]);
            QR.oekaki.edit();
          }
        });
      }
    },

    setup() {
      if (platform === 'userscript' && QR.oekaki.setupDirect()) { return; }
      $.global('setupQR');
    },

    load(cb) {
      if (QR.oekaki.getTegaki()) {
        cb();
      } else if (platform === 'userscript') {
        QR.oekaki.loadUserscriptTegaki().then(ok => {
          if (ok && QR.oekaki.getTegaki()) { cb(); }
        });
      } else {
        const styleAttrs = {
          rel: 'stylesheet',
          href: `//s.4cdn.org/css/tegaki.${Date.now()}.css`
        };
        const scriptAttrs = { src: `//s.4cdn.org/js/tegaki.min.${Date.now()}.js` };
        const add = (tagName, attrs) => {
          if ((platform === 'userscript') && (typeof GM_addElement === 'function')) {
            return GM_addElement(d.head, tagName, attrs);
          }
          const el = $.el(tagName, attrs);
          $.add(d.head, el);
          return el;
        };
        const style = add('link', styleAttrs) as HTMLLinkElement;
        const script = add('script', scriptAttrs) as HTMLScriptElement;
        let n = 0;
        let errored = false;
        const onload = function () {
          if (++n === 2 && !errored) cb();
        };
        const onerror = function () {
          errored = true;
          QR.error('Failed to load Tegaki. This site CSP blocked the script.');
        };
        $.on(style, 'load', onload);
        $.on(script, 'load', onload);
        $.on(style, 'error', onerror);
        $.on(script, 'error', onerror);
      }
    },

    draw() {
      if (platform === 'userscript' && QR.oekaki.drawDirect()) { return; }
      return $.global('qrTegakiDraw');
    },

    button() {
      if (QR.selected.file) {
        QR.oekaki.edit();
      } else {
        QR.oekaki.toggle();
      }
    },

    edit() {
      QR.oekaki.load(() => {
        if (platform === 'userscript' && QR.oekaki.loadDirect()) { return; }
        $.global('qrTegakiLoad');
      });
    },

    toggle() {
      QR.nodes.oekaki.hidden = !QR.nodes.oekaki.hidden;
      if (!QR.nodes.oekaki.hidden && !QR.oekaki.getTegaki()) {
        QR.oekaki.load(() => {});
      }
    }
  },

  persona: {
    always: {} as Record<string, string>,
    types: {
      name: [],
      email: [],
      sub: []
    },

    init() {
      if (!Conf['Quick Reply'] && (!Conf['Menu'] || !Conf['Delete Link'])) { return; }
      for (var item of Conf['QR.personas'].split('\n')) {
        QR.persona.parseItem(item.trim());
      }
    },

    parseItem(item: string) {
      if (item[0] === '#') return;
      const regexMatch = item.match(/(name|options|email|subject|password):"(.*)"/i);
      if(!regexMatch) return;
      let needle: string;
      let [match, type, val] = regexMatch;

      // Don't mix up item settings with val.
      item = item.replace(match, '');

      const boards = item.match(/boards:([^;]+)/i)?.[1].toLowerCase() || 'global';
      if ((boards !== 'global') && (needle = g.BOARD.ID, !boards.split(',').includes(needle))) { return; }


      if (type === 'password') {
        QR.persona.pwd = val;
        return;
      }

      if (type === 'options') { type = 'email'; }
      if (type === 'subject') { type = 'sub'; }

      if (/always/i.test(item)) {
        QR.persona.always[type] = val;
      }

      if (!QR.persona.types[type].includes(val)) {
        QR.persona.types[type].push(val);
      }
    },

    load() {
      for (var type in QR.persona.types) {
        var arr = QR.persona.types[type];
        var list = $(`#list-${type}`, QR.nodes.el);
        for (var val of arr) {
          if (val) {
            $.add(list, $.el('option',
              { textContent: val })
            );
          }
        }
      }
    },

    getPassword() {
      let m;
      if (QR.persona.pwd != null) {
        return QR.persona.pwd;
      } else if (m = d.cookie.match(/4chan_pass=([^;]+)/)) {
        return decodeURIComponent(m[1]);
      } else {
        return '';
      }
    },

    get(cb) {
      $.get('QR.persona', {}, ({ 'QR.persona': persona }) => cb(persona));
    },

    set(post) {
      $.get('QR.persona', {}, function ({ 'QR.persona': persona }) {
        persona = {
          name: post.name,
          flag: post.flag
        };
        $.set('QR.persona', persona);
      });
    }
  },
};

// moved outside QR for type inference
class post {
  declare nodes: {
    el: HTMLElement,
    rm: HTMLElement,
    spoiler: HTMLInputElement,
    span: HTMLElement,
    spanFileName: HTMLElement,
  };
  declare spoiler: boolean;
  declare thread: number | 'new';
  declare name: string;
  declare email: string;
  declare sub: string;
  declare isLocked: boolean;
  declare flag?: string;
  declare file?: File;
  declare filename?: string;
  declare originalName?: string;
  declare filesize?: string;
  declare URL?: string;
  declare com?: string;
  declare pasting?: boolean;
  declare pendingFile?: boolean;

  constructor(select) {
    this.select = this.select.bind(this);
    const el = $.el('a', {
      className: 'qr-preview',
      draggable: true,
      href: 'javascript:;'
    }) as HTMLAnchorElement;
    $.extend(el, {
      innerHTML: `<a href="javascript:;" class="remove" title="Remove">${Icon.get('xmark')}</a>` +
      '<label class="qr-preview-spoiler"><input type="checkbox"> Spoiler</label>' +
      '<span id="qr-preview-comment"></span><br /><span id="qr-preview-name"></span>'
    });

    const [rm, spoiler, span, /*br*/, spanFileName] = el.childNodes as NodeListOf<HTMLElement>;

    this.nodes = {
      el,
      rm,
      spoiler: spoiler.firstChild as HTMLInputElement,
      span,
      spanFileName,
    };

    $.on(el, 'click', this.select);
    $.on(this.nodes.rm, 'click', e => {
      e.stopPropagation();
      if (!QR.posts.includes(this)) { return; }
      if (Conf['QR Thumbnail Remove File First'] && this.file) {
        this.rmFile();
      } else {
        this.rm();
      }
    });
    $.on(this.nodes.spoiler, 'change', e => {
      this.spoiler = e.target.checked;
      if (this === QR.selected) { QR.nodes.spoiler.checked = this.spoiler; }
      return this.preventAutoPost();
    });
    for (var label of $$('label', el)) {
      $.on(label, 'click', e => e.stopPropagation());
    }
    $.add(QR.nodes.dumpList, el);

    for (var event of ['dragStart', 'dragEnter', 'dragLeave', 'dragOver', 'dragEnd', 'drop']) {
      $.on(el, event.toLowerCase(), this[event]);
    }

    this.thread = g.VIEW === 'thread' ?
      g.THREADID
      :
      'new';

    const prev = QR.posts[QR.posts.length - 1];
    QR.posts.push(this);
    this.nodes.spoiler.checked = (this.spoiler = prev && Conf['Remember Spoiler'] ?
      prev.spoiler
      :
      false);
    QR.persona.get(persona => {
      this.name = 'name' in QR.persona.always ?
        QR.persona.always.name
        : prev ?
          prev.name
          :
          persona.name;

      this.email = 'email' in QR.persona.always ?
        QR.persona.always.email
        :
        '';

      this.sub = 'sub' in QR.persona.always ?
        QR.persona.always.sub
        :
        '';

      if (QR.nodes.flag) {
        this.flag = (() => {
          if (prev) {
            return prev.flag;
          } else if (persona.flag && persona.flag in g.BOARD.config.board_flags) {
            return persona.flag;
          }
        })();
      }
      if (QR.selected === this) this.load();
    }); // load persona
    if (select) { this.select(); }
    this.unlock();
    QR.captcha.moreNeeded();
  }

  rm() {
    this.delete();
    const index = QR.posts.indexOf(this);
    if (QR.posts.length === 1) {
      new QR.post(true);
      $.rmClass(QR.nodes.el, 'dump');
    } else if (this === QR.selected) {
      (QR.posts[index - 1] || QR.posts[index + 1]).select();
    }
    QR.posts.splice(index, 1);
    QR.status();
    QR.captcha.updateThread?.();
  }

  delete() {
    $.rm(this.nodes.el);
    URL.revokeObjectURL(this.URL);
    this.dismissErrors();
  }

  lock(lock = true) {
    this.isLocked = lock;
    if (this !== QR.selected) { return; }
    for (var name of ['thread', 'name', 'email', 'sub', 'com', 'fileButton', 'filename', 'spoiler', 'flag']) {
      var node;
      if ((node = QR.nodes[name])) {
        node.disabled = lock;
      }
    }
    this.nodes.rm.style.visibility = lock ? 'hidden' : '';
    this.nodes.spoiler.disabled = lock;
    this.nodes.el.draggable = !lock;
  }

  unlock() {
    this.lock(false);
  }

  select() {
    if (QR.selected) {
      QR.selected.nodes.el.removeAttribute('id');
      QR.selected.forceSave();
    }
    QR.selected = this;
    this.lock(this.isLocked);
    this.nodes.el.id = 'selected';
    // Scroll the list to center the focused post.
    const rectEl = this.nodes.el.getBoundingClientRect();
    const rectList = this.nodes.el.parentNode.getBoundingClientRect();
    this.nodes.el.parentNode.scrollLeft += (rectEl.left + (rectEl.width / 2)) - rectList.left - (rectList.width / 2);
    this.load();
  }

  load() {
    // Load this post's values.

    for (var name of ['thread', 'name', 'email', 'sub', 'com', 'filename', 'flag']) {
      var node;
      if (!(node = QR.nodes[name])) { continue; }
      node.value = this[name] || node.dataset.default || '';
    }
    QR.updateFlagSelector?.();

    (this.thread !== 'new' ? $.addClass : $.rmClass)(QR.nodes.el, 'reply-to-thread');

    this.showFileData();
    QR.characterCount();
  }

  save(input: HTMLInputElement, forced?: boolean) {
    if (input.type === 'checkbox') {
      this.spoiler = input.checked;
      return;
    }
    const { name } = input.dataset;
    if (!['thread', 'name', 'email', 'sub', 'com', 'filename', 'flag'].includes(name)) { return; }
    const prev = this[name] || input.dataset.default || null;
    this[name] = input.value || input.dataset.default || null;
    switch (name) {
      case 'thread':
        (this.thread !== 'new' ? $.addClass : $.rmClass)(QR.nodes.el, 'reply-to-thread');
        QR.status();
        QR.captcha.updateThread?.();
        break;
      case 'com':
        this.updateComment();
        break;
      case 'filename':
        if (!this.file) { return; }
        this.saveFilename();
        this.updateFilename();
        break;
      case 'name': case 'flag':
        if (this[name] !== prev) { // only save manual changes, not values filled in by persona settings
          QR.persona.set(this);
        }
        break;
    }
    if (!forced) this.preventAutoPost();
  }

  forceSave() {
    if (this !== QR.selected) { return; }
    // Do this in case people use extensions
    // that do not trigger the `input` event.
    for (var name of ['thread', 'name', 'email', 'sub', 'com', 'filename', 'spoiler', 'flag']) {
      var node;
      if (!(node = QR.nodes[name])) { continue; }
      this.save(node, true);
    }
  }

  preventAutoPost() {
    // Disable auto-posting if you're editing the first post
    // during the last 5 seconds of the cooldown.
    if (QR.cooldown.auto && (this === QR.posts[0])) {
      QR.cooldown.update(); // adding/removing file can change cooldown
      if (QR.cooldown.seconds <= 5) QR.cooldown.auto = false;
    }
  }

  setComment(com) {
    this.com = com || null;
    if (this === QR.selected) {
      QR.nodes.com.value = this.com;
    }
    return this.updateComment();
  }

  updateComment() {
    if (this === QR.selected) {
      QR.characterCount();
    }
    this.nodes.span.textContent = this.com;
    QR.captcha.moreNeeded();
  }

  isOnlyQuotes() {
    return (this.com || '').trim() === (this.quotedText || '').trim();
  }

  static rmErrored(e) {
    e.stopPropagation();
    for (let i = QR.posts.length - 1; i >= 0; i--) {
      var errors;
      var post = QR.posts[i];
      if ((errors = post.errors)) {
        for (var error of errors) {
          if (doc.contains(error)) {
            post.rm();
            break;
          }
        }
      }
    }
  }

  error(className: string, message: string, link?: string) {
    const div = $.el('div', { className });
    $.extend(div, {
      innerHTML: message + (link ? ` [<a href="${E(link)}" target="_blank">More info</a>]` : '') +
        `<br>[<a href="javascript:;">delete post</a>] [<a href="javascript:;">delete all</a>]`
    });
    (this.errors || (this.errors = [])).push(div);
    const [rm, rmAll] = $$('a', div);
    $.on(div, 'click', () => {
      if (QR.posts.includes(this)) this.select();
    });
    $.on(rm, 'click', e => {
      e.stopPropagation();
      if (QR.posts.includes(this)) this.rm();
    });
    $.on(rmAll, 'click', QR.post.rmErrored);
    QR.error(div, true);
  }

  fileError(message: string, link?: string) {
    this.error('file-error', `${this.filename}: ${message}`, link);
  }

  dismissErrors(test = () => true) {
    if (this.errors) {
      for (var error of this.errors) {
        if (doc.contains(error) && test(error)) {
          error.parentNode.previousElementSibling.click();
        }
      }
    }
  }

  shouldStripMetadata(file: File) {
    if (Conf['Strip All Media Metadata']) { return true; }
    const category = file.type.split('/')[0];
    switch (category) {
      case 'image': return !!Conf['Image Metadata'];
      case 'video': return !!Conf['Video Metadata'];
      case 'audio': return !!Conf['Audio Metadata'];
      default:      return !!Conf['Other Metadata'];
    }
  }

  async stripImageMetadata(file: File): Promise<File> {
    if (QR.isMetadataStripped(file)) { return file; }
    const type = file.type.toLowerCase();
    if (!['image/jpeg', 'image/png'].includes(type)) { return file; }
    const outputType = type === 'image/jpeg' ? 'jpeg' : 'png';
    const img = await createImageBitmap(file);
    const width = img.width;
    const height = img.height;
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let toBlob: (mime: string, quality: number) => Promise<Blob>;

    if (window.OffscreenCanvas && !Conf['Avoid OffscreenCanvas']) {
      canvas = new OffscreenCanvas(width, height);
      toBlob = (mime, quality) => (canvas as OffscreenCanvas).convertToBlob({ type: mime, quality });
    } else {
      canvas = $.el('canvas', { width, height }) as HTMLCanvasElement;
      toBlob = (mime, quality) => new Promise((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob(blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to strip image metadata.'));
          }
        }, mime, quality);
      });
    }
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    const mime = `image/${outputType}`;
    const stripped = await toBlob(mime, .92);
    return QR.markMetadataStripped(new File([stripped], file.name, { type: file.type }));
  }

  async stripMetadata(file: File): Promise<File> {
    if (QR.isMetadataStripped(file)) { return file; }
    if (!this.shouldStripMetadata(file)) { return file; }
    if (file.type.startsWith('image/')) {
      const stripped = await this.stripImageMetadata(file);
      if (stripped === file && !['image/jpeg', 'image/png'].includes(file.type.toLowerCase())) {
        new Notice('warning', `Metadata stripping is not supported for ${file.type || 'this image type'}.`, 4);
      }
      return stripped;
    }
    if (file.type.startsWith('video/')) {
      let stripped = await VideoStripper.stripMetadata(file);
      if (stripped !== file) {
        stripped = QR.markMetadataStripped(stripped);
      }
      if (stripped === file && !(/^video\/mp4$/i.test(file.type) || /\.mp4$/i.test(file.name))) {
        new Notice('warning', `Metadata stripping is not supported for ${file.type || 'this video type'}.`, 4);
      }
      return stripped;
    }
    new Notice('warning', `Metadata stripping is not supported for ${file.type || 'this file type'}.`, 4);
    return file;
  }

  /**
   * Checks if the mime type and file size are valid. If "Auto-process Images" is enabled, it can convert unsupported
   * image formats to png, shrink oversized images, and convert to jpeg when the file is too large.
   * @param file The old file.
   * @returns A promise with the old file if it was valid, or a new file if it wasn't.
   */
  async validateFile(file: File): Promise<File> {
    const autoProcessImages = !!Conf['Auto-process Images'];

    // Do not check on altchans, those might support types 4chan doesn't
    if (location.hostname.endsWith('4chan.org') && !QR.mimeTypes.includes(file.type)) {
      if (autoProcessImages && file.type.startsWith('image/')) {
        const msg = `The ${file.type.slice(6)} image was converted to png.`;
        file = await QR.convert(file, 'png');
        new Notice('info', msg, 3);
      } else {
        throw new Error('Unsupported file type.');
      }
    }

    const maxSize = QR.getMaxSize(file)
    if (file.type.startsWith('image/')) {
      let img = await createImageBitmap(file);
      const { width: originalW, height: originalH } = img;
      let width = originalW, height = originalH;

      if (autoProcessImages) {
        if (width > QR.max_width) {
          height = Math.round(height * (QR.max_width / width));
          width = QR.max_width;
        }
        if (height > QR.max_height) {
          width = Math.round(width * (QR.max_height / height));
          height = QR.max_height;
        }
        if (width !== originalW || height !== originalH) {
          file = await QR.convert(file, file.type === 'image/jpeg' ? 'jpeg' : 'png', { width, height, img });
          img = undefined // just in case the file size shrinkage also needs to run using the new file
          new Notice('warning',
            `Image was too large got shrunk from ${originalW} * ${originalH} to ${width} * ${height}.` +
            'It might have lost animation.'
          );
        }
      } else if ((width > QR.max_width) || (height > QR.max_height)) {
        throw new Error(`Image too large (image: ${originalW}x${originalH}px, max: ${QR.max_width}x${QR.max_height}px).`);
      }

      if (file.size > maxSize) {
        if (!autoProcessImages) {
          throw new Error(`File too large (file: ${$.bytesToString(file.size)}, max: ${$.bytesToString(maxSize)}).`);
        }
          const originalSize = file.size;
          file = await QR.convert(file, 'jpeg', { maxSize, img });
          new Notice('warning',
            `Image was too large (${$.bytesToString(originalSize)}) and got converted to jpg (` +
            `${$.bytesToString(file.size)}). It might have lost transparency or animation.`
          );
      }
    } else if (file.size > maxSize) {
      throw new Error(`File too large (file: ${$.bytesToString(file.size)}, max: ${$.bytesToString(maxSize)}).`);
    }

    return file;
  }

  async setFile(file: File) {
    this.pendingFile = true;
    try {
      if (
        Conf['Strip Video Audio'] &&
        BoardConfig.noAudio(g.BOARD.ID) &&
        (/^video\/(webm|mp4)$/.test(file.type) || /\.(webm|mp4)$/i.test(file.name))
      ) {
        const stripped = await VideoStripper.stripAudio(file);
        if (stripped !== file) {
          file = stripped;
          new Notice('info', 'Removed audio from video for this board.', 4);
        }
      }

      const strippedMetadata = await this.stripMetadata(file);
      if (strippedMetadata !== file) {
        file = strippedMetadata;
        new Notice('info', 'Removed media metadata from file.', 4);
      }

      // Needs to be set before the validation for some error messages.
      this.file = file;
      this.filename = file.name;
      this.originalName = file.name;

      this.file = await this.validateFile(file);
      this.originalName = file.name;
      if (Conf['Randomize Filename'] && (g.BOARD.ID !== 'f') && (!this.file.name.toLowerCase().includes('[sound='))) {
        this.randomizeName(false);
      } else {
        this.filename = this.file.name;
      }
      this.filesize = $.bytesToString(this.file.size);
      $.addClass(this.nodes.el, 'has-file', 'has-' + this.file.type.split('/')[0] );
      QR.captcha.moreNeeded();
      URL.revokeObjectURL(this.URL);
      this.saveFilename();
      if (this === QR.selected) {
        this.showFileData();
      } else {
        this.updateFilename();
      }
      this.rmMetadata();
      this.nodes.el.dataset.type = this.file.type;
      this.nodes.el.style.backgroundImage = '';
      if (/^(image|video)\//.test(this.file.type)) {
        this.nodes.spanFileName.textContent = '';
        this.readFile();
      } else {
        this.nodes.spanFileName.textContent = this.file.name.match(/\.([^\.]+)$/)[1];
      }
    } catch (error) {
      console.error(error);
      this.fileError(error?.message || error || 'unknown error when setting a file');
    } finally {
      delete this.pendingFile;
    }
    this.preventAutoPost();
  }

  randomizeName(set = true) {
    this.filename = `${Date.now() * 1000 - Math.floor(Math.random() * 365 * DAY * 1000)}`;
    const ext = this.file.name.match(QR.validExtension)
    if (ext) this.filename += ext[0];
    if (set) QR.nodes.filename.value = this.filename;
  }

  restoreName() {
    QR.nodes.filename.value = this.filename = this.originalName;
  }

  readFile() {
    const isVideo = /^video\//.test(this.file.type);
    const el = $.el(isVideo ? 'video' : 'img');
    if (isVideo && !el.canPlayType(this.file.type)) { return; }

    const event = isVideo ? 'loadeddata' : 'load';
    var onload = () => {
      $.off(el, event, onload);
      $.off(el, 'error', onerror);
      this.checkDimensions(el);
      this.setThumbnail(el);
      $.event('QRMetadata', null, this.nodes.el);
    };
    var onerror = () => {
      $.off(el, event, onload);
      $.off(el, 'error', onerror);
      this.fileError(`Corrupt ${isVideo ? 'video' : 'image'} or error reading metadata.`, meta.upstreamFaq + '#error-reading-metadata');
      URL.revokeObjectURL(el.src);
      // XXX https://bugzilla.mozilla.org/show_bug.cgi?id=1021289
      this.nodes.el.removeAttribute('data-height');
      $.event('QRMetadata', null, this.nodes.el);
    };
    this.nodes.el.dataset.height = 'loading';
    $.on(el, event, onload);
    $.on(el, 'error', onerror);
    el.src = URL.createObjectURL(this.file);
  }

  checkDimensions(el) {
    let height, width;
    if (el.tagName === 'IMG') {
      ({ height, width } = el);
      this.nodes.el.dataset.height = height;
      this.nodes.el.dataset.width = width;
      if ((height > QR.max_height) || (width > QR.max_width)) {
        this.fileError(`Image too large (image: ${height}x${width}px, max: ${QR.max_height}x${QR.max_width}px)`);
      }
      if ((height < QR.min_height) || (width < QR.min_width)) {
        this.fileError(`Image too small (image: ${height}x${width}px, min: ${QR.min_height}x${QR.min_width}px)`);
      }
    } else {
      const { videoHeight, videoWidth, duration } = el;
      this.nodes.el.dataset.height = videoHeight;
      this.nodes.el.dataset.width = videoWidth;
      this.nodes.el.dataset.duration = duration;
      const max_height = Math.min(QR.max_height, QR.max_height_video);
      const max_width = Math.min(QR.max_width, QR.max_width_video);
      if ((videoHeight > max_height) || (videoWidth > max_width)) {
        this.fileError(`Video too large (video: ${videoHeight}x${videoWidth}px, max: ${max_height}x${max_width}px)`);
      }
      if ((videoHeight < QR.min_height) || (videoWidth < QR.min_width)) {
        this.fileError(`Video too small (video: ${videoHeight}x${videoWidth}px, min: ${QR.min_height}x${QR.min_width}px)`);
      }
      if (!isFinite(duration)) {
        this.fileError('Video lacks duration metadata (try remuxing)');
      } else if (duration > QR.max_duration_video) {
        this.fileError(`Video too long (video: ${duration}s, max: ${QR.max_duration_video}s)`);
      }
      if (BoardConfig.noAudio(g.BOARD.ID) && $.hasAudio(el)) {
        this.fileError('Audio not allowed');
      }
    }
  }

  setThumbnail(el) {
    // Create a redimensioned thumbnail.
    let height, width;
    const isVideo = el.tagName === 'VIDEO';

    // Generate thumbnails only if they're really big.
    // Resized pictures through canvases look like ass,
    // so we generate thumbnails `s` times bigger then expected
    // to avoid crappy resized quality.
    let s = 90 * 2 * window.devicePixelRatio;
    if (this.file.type === 'image/gif') { s *= 3; } // let them animate
    if (isVideo) {
      height = el.videoHeight;
      width = el.videoWidth;
    } else {
      ({ height, width } = el);
      if ((height < s) || (width < s)) {
        this.URL = el.src;
        this.nodes.el.style.backgroundImage = `url(${this.URL})`;
        return;
      }
    }

    if (height <= width) {
      width = (s / height) * width;
      height = s;
    } else {
      height = (s / width) * height;
      width = s;
    }
    const cv = $.el('canvas') as HTMLCanvasElement;
    cv.height = height;
    cv.width = width;

    const drawThumbNail = () => {
      cv.getContext('2d').drawImage(el, 0, 0, width, height);
      URL.revokeObjectURL(el.src);
      cv.toBlob(blob => {
        this.URL = URL.createObjectURL(blob);
        this.nodes.el.style.backgroundImage = `url(${this.URL})`;
      });
    };
    if (isVideo) {
      el.currentTime = 0;
      el.addEventListener("seeked", drawThumbNail);
    } else {
      drawThumbNail();
    }
  }

  rmFile() {
    if (this.isLocked) { return; }
    delete this.file;
    delete this.filename;
    delete this.filesize;
    this.nodes.el.removeAttribute('title');
    QR.nodes.filename.removeAttribute('title');
    this.rmMetadata();
    this.nodes.el.style.backgroundImage = '';
    $.rmClass(this.nodes.el, 'has-file', 'has-image', 'has-video');
    this.showFileData();
    URL.revokeObjectURL(this.URL);
    this.dismissErrors(error => $.hasClass(error, 'file-error'));
    this.preventAutoPost();
  }

  rmMetadata() {
    for (var attr of ['type', 'height', 'width', 'duration']) {
      // XXX https://bugzilla.mozilla.org/show_bug.cgi?id=1021289
      this.nodes.el.removeAttribute(`data-${attr}`);
    }
  }

  saveFilename() {
    this.file.newName = (this.filename || '').replace(/[/\\]/g, '-');
    if (!QR.validExtension.test(this.filename)) {
      // 4chan will truncate the filename if it has no extension.
      this.file.newName += `.${$.getOwn(QR.extensionFromType, this.file.type) || 'jpg'}`;
    }
  }

  updateFilename() {
    const long = `${this.filename} (${this.filesize})`;
    this.nodes.el.title = long;
    if (this !== QR.selected) { return; }
    QR.nodes.filename.title = long;
  }

  showFileData() {
    if (this.file) {
      this.updateFilename();
      QR.nodes.filename.value = this.filename;
      $.addClass(QR.nodes.oekaki, 'has-file');
      $.addClass(QR.nodes.fileSubmit, 'has-file', 'has-' + this.file.type.split('/')[0]);
    } else {
      $.rmClass(QR.nodes.oekaki, 'has-file');
      $.rmClass(QR.nodes.fileSubmit, 'has-file', 'has-image', 'has-video');
    }
    if (this.file?.source != null) {
      QR.nodes.fileSubmit.dataset.source = this.file.source;
    } else {
      QR.nodes.fileSubmit.removeAttribute('data-source');
    }
    QR.nodes.spoiler.checked = this.spoiler;
  }

  pasteText(file) {
    this.pasting = true;
    this.preventAutoPost();
    const reader = new FileReader();
    reader.onload = e => {
      const { result } = e.target;
      this.setComment((this.com ? `${this.com}\n${result}` : result));
      delete this.pasting;
    };
    reader.readAsText(file);
  }

  dragStart(e) {
    const { left, top } = this.getBoundingClientRect();
    e.dataTransfer.setDragImage(this, e.clientX - left, e.clientY - top);
    $.addClass(this, 'drag');
  }
  dragEnd() { $.rmClass(this, 'drag'); }
  dragEnter() { $.addClass(this, 'over'); }
  dragLeave() { $.rmClass(this, 'over'); }

  dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  drop(e) {
    $.rmClass(this, 'over');
    if (e.dataTransfer?.files?.length) { return; }
    if (!this.draggable) { return; }
    const el = $('.drag', this.parentNode);
    if (!el) { return; }
    const index = el => {
      for (let i = 0; i < el.parentNode.children.length; i++) {
        if (el.parentNode.children[i] === el) return i;
      }
      return -1;
    }
    const oldIndex = index(el);
    const newIndex = index(this);
    if (QR.posts[oldIndex].isLocked || QR.posts[newIndex].isLocked) { return; }
    (oldIndex < newIndex ? $.after : $.before)(this, el);
    const post = QR.posts.splice(oldIndex, 1)[0];
    QR.posts.splice(newIndex, 0, post);
    QR.status();
    QR.captcha.updateThread?.();
  }
};
QR.post = post;

export default QR;
