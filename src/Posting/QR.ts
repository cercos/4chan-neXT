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
import QRFileStore from '../platform/QRFileStore';
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
    previewToggle: HTMLButtonElement,
    close: HTMLAnchorElement,
    draftsButton: HTMLAnchorElement,
    draftsBadge: HTMLSpanElement,
    draftsPanel: HTMLDivElement,
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

  // Page-stitched literal preview post (when style = 'thread')
  previewPost: null as HTMLDivElement | null,

  // Floating window preview (the default placement)
  previewFloat: null as HTMLDivElement | null,

  // Runtime-only toggle (never persisted): when true and we can actually stitch into
  // the current thread, the preview is "docked" inline as a literal post instead of
  // floating. Flipped by the header arrow icon and seeded from the default-mode setting
  // each time QR opens.
  previewInline: false,
  commentPreviewModeInitialized: false,
  commentPreviewDefaultModeApplied: '',
  commentPreviewRestoreDetachedFloat: false,

  // While an inline-default preview is waiting for the QR's target thread to sync to
  // this page (right at open), we suppress the floating fallback so the user never sees
  // a float-then-dock flash — it just loads docked. Cleared once it docks or gives up.
  commentPreviewInlinePending: false,
  _inlineStartRetryPending: false,
  _inlineStartTries: 0,
  // Runtime-only (never persisted): in the 'manual' visibility behavior the preview stays
  // hidden until the user reveals it with the titlebar icon. Reset on every QR close so
  // each fresh open starts hidden again.
  commentPreviewManualRevealed: false,
  // Set only by a manual "dock preview" click so the scroll-to-bottom inline behavior
  // fires on an explicit dock, never on the automatic startup dock.
  _scrollPreviewOnDock: false,

  // Internal: bound scroll/resize handler for the 'inplace' inline-follow behavior.
  _inplaceScrollHandler: undefined as ((e?: Event) => void) | undefined,
  _inplaceRafPending: false,

  // Remembers a user-dragged float position so undocking (inline -> floating) returns
  // the preview to where it was, instead of snapping back to the QR. Only set when the
  // float was actually dragged. It is kept for the current QR session and optionally
  // persisted when "Remember Floating Position" is enabled.
  previewFloatPos: null as { left: string, top: string } | null,

  // Internal: ResizeObserver for keeping floating preview docked to QR on size changes.
  _qrResizeObs: undefined as ResizeObserver | undefined,

  req: undefined as (XMLHttpRequest & { isUploadFinished: boolean, progress: string }) | undefined,
  selected: undefined as post,

  mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/vnd.adobe.flash.movie', 'application/x-shockwave-flash', 'video/webm', 'video/mp4'],

  validExtension: /\.(jpe?g|png|gif|pdf|swf|webm|mp4)$/i,

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

      // The native post form is collapsed by default everywhere except the board
      // index, where 4chan shows it expanded at the top. Hide it there too so it
      // behaves like the other views; the "Original Form" toggle expands it on
      // demand. We own the visibility via a class (CSS uses !important to beat
      // 4chan core's inline display toggle) so the toggle stays in sync.
      if (Conf['Hide Original Post Form'] && g.VIEW === 'index') {
        $.addClass(doc, 'hide-original-post-form');
        $.on(origToggle.firstElementChild, 'click', function() {
          const shown = $.toggleClass(doc, 'show-original-post-form');
          this.textContent = shown ? 'Hide Original Form' : 'Original Form';
        });
      }
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
    $.on(d, 'PostsInserted', QR.onPostsInsertedPreview);
    $.on(d, 'QRPostSuccessful', QR.removeThreadPreviewPost);
    // The inline-toggle arrow lives inside the preview post shell (float + inline).
    // The float is fully drag-grabbable, so intercept the icon's mousedown in the
    // capture phase to stop a drag from starting, and handle the click to flip mode.
    document.addEventListener('mousedown', QR.onPreviewInlineToggleMouseDown, true);
    $.on(d, 'click', QR.onPreviewInlineToggleClick);
    $.sync('Comment Preview', (value: boolean | undefined) => {
      Conf['Comment Preview'] = !!value;
      QR.applyCommentPreviewSettings();
    });
    $.sync('Comment Preview Default Mode', (value: string | undefined) => {
      Conf['Comment Preview Default Mode'] = QR.normalizeCommentPreviewDefaultMode(value);
      QR.commentPreviewModeInitialized = false;
      QR.applyCommentPreviewSettings();
    });
    $.sync('Comment Preview Attach Location', (value: string | undefined) => {
      Conf['Comment Preview Attach Location'] = QR.normalizeCommentPreviewAttachLocation(value);
      QR.repositionFloatingPreview();
    });
    $.sync('Comment Preview Inline Behavior', (value: string | undefined) => {
      Conf['Comment Preview Inline Behavior'] = value === 'inplace' ? 'inplace' : 'scroll';
      QR.applyCommentPreviewSettings();
    });
    $.sync('Comment Preview Remember Float Position', (value: boolean | undefined) => {
      Conf['Comment Preview Remember Float Position'] = !!value;
      if (!QR.commentPreviewRemembersFloat()) {
        QR.clearStoredCommentPreviewFloatPos(false);
      }
    });
    $.sync('Comment Preview Thread Behavior', (value: string | undefined) => {
      Conf['Comment Preview Thread Behavior'] = QR.normalizeCommentPreviewVisibility(value);
      QR.applyCommentPreviewSettings();
    });
    $.sync('Comment Preview Catalog Behavior', (value: string | undefined) => {
      Conf['Comment Preview Catalog Behavior'] = QR.normalizeCommentPreviewVisibility(value);
      QR.applyCommentPreviewSettings();
    });
    $.sync('Show Comment Preview Header Icon', (value: boolean | undefined) => {
      Conf['Show Comment Preview Header Icon'] = value !== false;
      QR.applyCommentPreviewSettings();
    });
    $.sync('Show QR Drafts Icon', (value: boolean | undefined) => {
      Conf['Show QR Drafts Icon'] = value !== false;
      QR.drafts.updateButton();
    });
    $.sync('Allow Browser Autofill', (value: boolean | undefined) => {
      Conf['Allow Browser Autofill'] = !!value;
      QR.disablePersonaFieldAutofill();
    });

    $.on(d, 'paste',              QR.paste);
    $.on(d, 'dragover',           QR.dragOver);
    $.on(d, 'drop',               QR.dropFile);
    $.on(d, 'dragstart dragend',  QR.drag);

    $.on(d, 'IndexRefreshInternal', QR.generatePostableThreadsList);
    $.on(d, 'ThreadUpdate', QR.statusCheck);
    // When a thread 404s/archives, move its unsent draft to the discard bin.
    $.on(d, 'ThreadUpdate', QR.drafts.onThreadUpdate);

    // Keep floating comment preview docked under the QR and keep the inline preview
    // width cap current when the viewport/QR dimensions change.
    $.on(d, '4chanXQRMove', QR.repositionFloatingPreview);
    $.on(window, 'resize', QR.repositionFloatingPreview);

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
      const wasHidden = QR.nodes.el.hidden;
      if (wasHidden) { QR.captcha.setup(); }
      QR.nodes.el.hidden = false;
      QR.unhide();
      // close() resets the in-memory QR post list to a blank post while the
      // saved draft stays in storage. Rehydrate it before rebuilding previews.
      if (wasHidden) { QR.drafts.restore(); }
      // Restore the comment preview if it was on when the QR was closed. The toggle
      // (Conf['Comment Preview']) persists, but close()'s teardown left no preview node.
      // Use the SAME full path dialog() uses on first open so the rebuilt preview is
      // identical — including the inline/dock toggle icon, header toggle state, and the
      // com input listener — not just refreshCommentPreview()'s lighter re-show.
      QR.applyCommentPreviewSettings();
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
	    QR.drafts.flush();
	    QR.storeCommentPreviewLastMode();
	    QR.removeThreadPreviewPost();
	    QR.removeFloatingPreview();
	    if (!QR.commentPreviewRemembersFloat()) {
	      QR.clearStoredCommentPreviewFloatPos();
	    }
	    // Startup placement is recalculated on the next QR open from the default-mode setting.
	    QR.previewInline = false;
	    QR.commentPreviewModeInitialized = false;
	    QR.commentPreviewDefaultModeApplied = '';
	    QR.commentPreviewRestoreDetachedFloat = false;
	    QR.commentPreviewInlinePending = false;
	    QR.commentPreviewManualRevealed = false;
	    QR._inlineStartTries = 0;
	    QR._scrollPreviewOnDock = false;
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

  toggleCommentPreview(e) {
    e.preventDefault();
    // 'manual' visibility mode: when the feature is already enabled but the preview is
    // being withheld, the icon reveals/hides it for this session rather than disabling the
    // whole feature (which persists and would also affect the other view).
    if (Conf['Comment Preview'] && QR.commentPreviewVisibility() === 'manual') {
      QR.commentPreviewManualRevealed = !QR.commentPreviewManualRevealed;
      return $.event('QRCommentPreviewChanged', null);
    }
    Conf['Comment Preview'] = !Conf['Comment Preview'];
    $.set('Comment Preview', Conf['Comment Preview']);
    // Enabling in a manual-mode view should visibly do something: reveal the preview
    // straight away instead of leaving it withheld.
    if (Conf['Comment Preview'] && QR.commentPreviewVisibility() === 'manual') {
      QR.commentPreviewManualRevealed = true;
    }
    return $.event('QRCommentPreviewChanged', null);
  },

  // Capture-phase guard: the whole floating preview is grabbable for dragging, so we must
  // stop the arrow icon's mousedown before it reaches the float's own drag handler.
  onPreviewInlineToggleMouseDown(e: MouseEvent) {
    const t = e.target as HTMLElement | null;
    if (t && t.closest && t.closest('.qr-preview-inline-toggle, .qr-preview-gutter-toggle')) {
      e.stopPropagation();
      e.preventDefault();
    }
  },

  onPreviewInlineToggleClick(e: MouseEvent) {
    const t = e.target as HTMLElement | null;
    if (t && t.closest && t.closest('.qr-preview-inline-toggle, .qr-preview-gutter-toggle')) {
      QR.toggleInlinePreview(e);
    }
  },

  // Flip between floating (default) and inline (stitched literal post in the thread).
  // Only one is shown at a time; refreshCommentPreview() removes the other.
  toggleInlinePreview(e?: Event) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    QR.previewInline = !QR.previewInline;
    // Defensive: can't dock inline where we can't stitch into the live thread.
	    if (QR.previewInline && !QR.canActuallyShowThreadPreview()) {
	      QR.previewInline = false;
	    }
	    // A manual dock is the only time the 'scroll to bottom' inline behavior should
	    // fire — the automatic startup dock must not scroll the page.
	    if (QR.previewInline) {
	      QR._scrollPreviewOnDock = true;
	    }
	    QR.refreshCommentPreview();
	    QR.storeCommentPreviewLastMode();
	  },

  texPreviewShow() {
    if ($.hasClass(QR.nodes.el, 'tex-preview')) { return QR.texPreviewHide(); }
    $.addClass(QR.nodes.el, 'tex-preview');
    QR.nodes.texPreview.innerHTML = QR.renderComPreview(QR.nodes.com.value);
    return QR.typesetMathjax(QR.nodes.texPreview);
  },

  texPreviewHide() {
    return $.rmClass(QR.nodes.el, 'tex-preview');
  },

  updateComPreview() {
    if (QR.usingThreadPreview()) {
      QR.updateThreadPreviewPost();
      return;
    }
    if (QR.usingFloatingPreview()) {
      QR.updateFloatingPreview();
      return;
    }
    if (!QR.nodes?.comPreview) return;
    QR.updateComPreviewQuoteColor();
    QR.nodes.comPreview.innerHTML = QR.renderComPreview(QR.nodes.com.value);
    if (g.BOARD.config.math_tags && /\[(math|eqn)\]/.test(QR.nodes.com.value)) {
      QR.typesetMathjax(QR.nodes.comPreview);
    }
  },

  typesetMathjax(node: HTMLElement) {
    if (!node.id) return;
    $.global('typesetMathjax', {id: node.id});
  },

  updateComPreviewQuoteColor() {
    if (!QR.nodes?.comPreview) return;
    const sample = $.el('blockquote', {
      className: 'postMessage',
      innerHTML: '<span class="quote">&gt;quote</span>'
    }) as HTMLElement;
    sample.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:-9999px;';
    $.add(d.body, sample);
    const quote = $('.quote', sample) as HTMLElement;
    const color = quote ? getComputedStyle(quote).color : '';
    $.rm(sample);
    if (color) {
      QR.nodes.comPreview.style.setProperty('--xt-qr-com-preview-quote-color', color);
    }
  },

  // The preview floats by default; it is only stitched inline when the user has
  // explicitly toggled inline (the header arrow) AND we can stitch into the live thread.
  usingThreadPreview(): boolean {
    return !!Conf['Comment Preview'] &&
           QR.previewInline === true &&
           QR.canActuallyShowThreadPreview() &&
           !QR.shouldSuppressCommentPreview();
  },

  // Floating is the default and the automatic fallback whenever we're not inline
  // (catalog, index, new thread from QR, replying to a different thread, etc.).
  usingFloatingPreview(): boolean {
    // While an inline-default dock is pending we deliberately show nothing (not the
    // floating fallback) so the preview loads straight into its docked position.
    if (!Conf['Comment Preview'] || QR.usingThreadPreview() || QR.commentPreviewInlinePending) return false;
    // The visibility setting for the current view can withhold the preview entirely.
    if (QR.shouldSuppressCommentPreview()) return false;
    return true;
  },

  normalizeCommentPreviewVisibility(value?: string): string {
    return value === 'until-content' || value === 'manual' ? value : 'normal';
  },

  // The visibility behavior for the current view: thread view has its own setting,
  // everywhere else (catalog, board index, archive) uses the catalog setting. Either
  // is independent of the placement settings (attach/inline/remember) — it only
  // decides *whether* the preview shows, not where.
  commentPreviewVisibility(): string {
    const key = g.VIEW === 'thread'
      ? 'Comment Preview Thread Behavior'
      : 'Comment Preview Catalog Behavior';
    return QR.normalizeCommentPreviewVisibility(Conf[key]);
  },

  // True when the post being composed has something to preview (comment text or a file).
  commentPreviewHasContent(): boolean {
    if ((QR.nodes?.com?.value || '').trim()) return true;
    return !!(QR.selected?.file || QR.selected?.pendingFile);
  },

  shouldSuppressCommentPreview(): boolean {
    switch (QR.commentPreviewVisibility()) {
      case 'manual':        return !QR.commentPreviewManualRevealed;
      case 'until-content': return !QR.commentPreviewHasContent();
      default:              return false; // 'normal'
    }
  },

  // In 'manual' mode the titlebar icon reveals/hides the preview for this QR session
  // instead of disabling the whole feature, so the icon is "active" only when the
  // preview is actually being shown.
  commentPreviewManualHidden(): boolean {
    return QR.commentPreviewVisibility() === 'manual' && !QR.commentPreviewManualRevealed;
  },

    canActuallyShowThreadPreview(): boolean {
      if (g.VIEW !== 'thread') return false;
      const currentThread = `${g.THREADID || g.threadID || ''}`;
      if (!currentThread) return false;
    const qrThread = QR.posts?.[0]?.thread;
    if (qrThread && qrThread !== 'new' && `${qrThread}` === currentThread) return true;

    // Fallback: the thread <select> (which may have been set by quote, catalog reply, or generatePostableThreadsList)
      // currently targets this page's thread. Treat as "can show inline" even if the post model
      // hasn't synced the .thread yet (programmatic value= does not fire change).
      const uiThread = QR.nodes?.thread?.value;
      if (uiThread && uiThread !== 'new' && `${uiThread}` === currentThread) return true;

      return false;
    },

    normalizeCommentPreviewDefaultMode(value?: string): string {
      return value === 'inline' || value === 'remember' ? value : 'attached';
    },

    normalizeCommentPreviewAttachLocation(value?: string): string {
      return value === 'bottom' || value === 'top' || value === 'left' || value === 'right'
        ? value
        : 'auto';
    },

    normalizeCommentPreviewMode(value?: string): string {
      return value === 'inline' || value === 'detached' ? value : 'attached';
    },

    commentPreviewDefaultMode(): string {
      return QR.normalizeCommentPreviewDefaultMode(Conf['Comment Preview Default Mode']);
    },

    // The dragged float position is persisted/restored when either the explicit
    // "Remember Floating Position" setting is on, OR the default mode is "Remember last
    // mode" — for which remembering *where* you left a floated preview is the whole point.
    commentPreviewRemembersFloat(): boolean {
      return !!Conf['Comment Preview Remember Float Position'] ||
        QR.commentPreviewDefaultMode() === 'remember';
    },

    commentPreviewLastMode(): string {
      return QR.normalizeCommentPreviewMode(Conf['Comment Preview Last Mode']);
    },

    storeCommentPreviewLastMode(mode?: string) {
      const normalized = QR.normalizeCommentPreviewMode(mode || QR.currentCommentPreviewMode());
      Conf['Comment Preview Last Mode'] = normalized;
      $.set('Comment Preview Last Mode', normalized);
    },

    currentCommentPreviewMode(): string {
      if (QR.usingThreadPreview()) return 'inline';
      if (QR.previewFloat?.dataset.userDragged === 'true' || QR.previewFloatPos) return 'detached';
      return 'attached';
    },

    parseCommentPreviewFloatPos(raw: any): { left: string, top: string } | null {
      if (!raw || typeof raw !== 'object') return null;
      const { left, top } = raw;
      return typeof left === 'string' && typeof top === 'string' && left && top
        ? { left, top }
        : null;
    },

    rememberedCommentPreviewFloatPos(): { left: string, top: string } | null {
      if (QR.previewFloatPos) return QR.previewFloatPos;
      if (!QR.commentPreviewRemembersFloat()) return null;
      // Decide from persistent state, not just the transient restore flag: on reload the
      // float can be (re)created before ensureCommentPreviewStartMode() sets that flag,
      // which would otherwise lose a remembered detached position. Restore the saved drag
      // position when this session flagged a detached restore OR the remembered last mode
      // was a detached float. (Attached mode clears the saved position, so it won't leak.)
      const wantsDetached = QR.commentPreviewRestoreDetachedFloat ||
        (QR.commentPreviewDefaultMode() === 'remember' && QR.commentPreviewLastMode() === 'detached');
      return wantsDetached
        ? QR.parseCommentPreviewFloatPos(Conf['Comment Preview Float Position'])
        : null;
    },

    setCommentPreviewFloatPos(pos: { left: string, top: string }) {
      QR.previewFloatPos = pos;
      if (QR.commentPreviewRemembersFloat()) {
        Conf['Comment Preview Float Position'] = pos;
        $.set('Comment Preview Float Position', pos);
      }
    },

    clearStoredCommentPreviewFloatPos(clearRuntime = true) {
      if (clearRuntime) {
        QR.previewFloatPos = null;
      }
      Conf['Comment Preview Float Position'] = {};
      $.set('Comment Preview Float Position', {});
    },

    ensureCommentPreviewStartMode() {
      const defaultMode = QR.commentPreviewDefaultMode();
      if (QR.commentPreviewModeInitialized && QR.commentPreviewDefaultModeApplied === defaultMode) return;

      QR.commentPreviewModeInitialized = true;
      QR.commentPreviewDefaultModeApplied = defaultMode;

	    const wantedMode = defaultMode === 'remember' ? QR.commentPreviewLastMode() : defaultMode;
	    const savedFloatPos = Conf['Comment Preview Remember Float Position']
	      ? QR.parseCommentPreviewFloatPos(Conf['Comment Preview Float Position'])
	      : null;
	    // "Remember Floating Position" is an explicit request to reopen at the dragged
	    // position. Keep inline as the only default mode that overrides that saved float.
	    QR.commentPreviewRestoreDetachedFloat =
	      wantedMode === 'detached' || (defaultMode === 'attached' && !!savedFloatPos);
	    if (wantedMode === 'inline') {
	      if (QR.canActuallyShowThreadPreview()) {
	        // Inline is possible now: dock and keep the latch set above for this session.
	        QR.commentPreviewInlinePending = false;
	        QR.previewInline = true;
	        return;
	      }
	      // Inline wanted but we can't stitch yet. Distinguish "target thread just hasn't
	      // synced to this page yet" (dock as soon as it does) from "inline can't apply
	      // here at all" (catalog/index/new-thread, or replying to a *different* thread).
	      const cur = `${g.THREADID || g.threadID || ''}`;
	      const tgt = `${QR.posts?.[0]?.thread ?? ''}`;
	      const uiTgt = `${QR.nodes?.thread?.value ?? ''}`;
	      const otherThread = (v: string) => !!v && v !== 'new' && v !== cur;
	      if (g.VIEW === 'thread' && cur && !otherThread(tgt) && !otherThread(uiTgt)) {
	        // Pending sync: do NOT show the floating fallback (avoids the float-then-dock
	        // flash) and re-check on a fast timer so it docks promptly, not after the next
	        // thread update. Un-latch so a later apply re-runs this.
	        QR.commentPreviewInlinePending = true;
	        QR.previewInline = false;
	        QR.commentPreviewModeInitialized = false;
	        QR.commentPreviewDefaultModeApplied = '';
	        QR.scheduleInlineStartRetry();
	        return;
	      }
	      // Inline can never apply on this view: fall through to the floating fallback.
	      QR.commentPreviewInlinePending = false;
	    } else {
	      QR.commentPreviewInlinePending = false;
	    }

	    QR.previewInline = false;
	    if (QR.commentPreviewRestoreDetachedFloat) {
	      const pos = QR.rememberedCommentPreviewFloatPos();
	      if (pos && QR.previewFloat) {
	        QR.previewFloat.style.left = pos.left;
          QR.previewFloat.style.top = pos.top;
          QR.previewFloat.style.right = '';
          QR.previewFloat.style.bottom = '';
          QR.previewFloat.dataset.userDragged = 'true';
          QR.previewFloat.title = 'Double-click to attach to QR';
        }
      } else {
        QR.previewFloatPos = null;
        if (QR.previewFloat) {
          delete QR.previewFloat.dataset.userDragged;
          QR.previewFloat.removeAttribute('title');
        }
      }
    },

    // Fast, bounded poll used while an inline-default dock is pending: re-apply every
    // ~50ms (cap ~2s) until the target thread syncs and the preview docks. If it never
    // becomes possible (give up), settle on the floating fallback so it's never blank.
    scheduleInlineStartRetry() {
      if (QR._inlineStartRetryPending) return;
      QR._inlineStartRetryPending = true;
      const tick = () => {
        QR._inlineStartRetryPending = false;
        // Stop if the preview was turned off, the QR closed, or it already settled.
        if (!Conf['Comment Preview'] || !QR.nodes?.el || QR.nodes.el.hidden || QR.commentPreviewModeInitialized) {
          QR._inlineStartTries = 0;
          return;
        }
        if (QR._inlineStartTries++ >= 40) {
          // Gave up waiting (~2s). Latch the floating fallback so nothing stays blank.
          QR._inlineStartTries = 0;
          QR.commentPreviewInlinePending = false;
          QR.previewInline = false;
          QR.commentPreviewModeInitialized = true;
          QR.commentPreviewDefaultModeApplied = QR.commentPreviewDefaultMode();
          QR.refreshCommentPreview();
          return;
        }
        QR.applyCommentPreviewSettings();
        if (!QR.commentPreviewModeInitialized) {
          QR._inlineStartRetryPending = true;
          setTimeout(tick, 50);
        } else {
          QR._inlineStartTries = 0;
        }
      };
      setTimeout(tick, 30);
    },

    refreshCommentPreview() {
    // When the QR is closed (hidden), never (re)spawn a preview — tear it down instead.
    // close() removes the previews and then creates a fresh blank post, whose load()
    // calls back in here; without this guard the floating/inline preview reappears,
    // orphaned under the now-hidden QR. autohide uses a class (not the hidden prop),
    // so this only triggers on a real close.
    if (!QR.nodes?.el || QR.nodes.el.hidden) {
      QR.removeThreadPreviewPost();
      QR.removeFloatingPreview();
      return;
    }

    const wantThread = QR.usingThreadPreview();
    const wantFloat = QR.usingFloatingPreview();

    if (wantThread) {
      QR.removeFloatingPreview();
      QR.updateThreadPreviewPost();
    } else if (wantFloat) {
      QR.removeThreadPreviewPost();
      QR.updateFloatingPreview();
    } else if (Conf['Comment Preview']) {
      QR.removeThreadPreviewPost();
      QR.removeFloatingPreview();
      QR.updateComPreview();
    } else {
      QR.removeThreadPreviewPost();
      QR.removeFloatingPreview();
    }
  },

  applyCommentPreviewSettings() {
	    if (!QR.nodes?.el || !QR.nodes?.com) return;
	    const { classList } = QR.nodes.el;
	    const enabled = !!Conf['Comment Preview'];
	    if (!QR.commentPreviewRemembersFloat() && QR.parseCommentPreviewFloatPos(Conf['Comment Preview Float Position'])) {
	      QR.clearStoredCommentPreviewFloatPos(false);
	    }
	    if (enabled) {
	      QR.ensureCommentPreviewStartMode();
	    }
	    const isThread = QR.usingThreadPreview();
	    const isFloating = QR.usingFloatingPreview();

    // The modern preview is always inline or floating; the legacy compact in-QR box is
    // never used. Defensively clear any stale legacy classes and mark the inline state.
    classList.toggle('has-com-preview', false);
    classList.remove('com-preview-below', 'com-preview-right', 'com-preview-left', 'com-preview-thread');
    if (isThread) {
      classList.add('com-preview-thread');
    }

    // In manual catalog mode the icon reflects whether the preview is currently revealed,
    // not just whether the feature is enabled, so the icon's lit state tracks what's shown.
    const iconActive = enabled && !QR.commentPreviewManualHidden();
    QR.nodes.previewToggle?.classList.toggle('enabled', iconActive);
    QR.nodes.previewToggle?.setAttribute('aria-pressed', iconActive ? 'true' : 'false');
    if (QR.nodes.previewToggle) {
      QR.nodes.previewToggle.hidden = Conf['Show Comment Preview Header Icon'] === false;
    }

    // Cleanup when disabled or style switched
    if (!enabled || !isThread) {
      QR.stopInplaceFollow();
      QR.removeThreadPreviewPost();
    }
    if (!enabled || !isFloating) {
      QR.removeFloatingPreview();
    }

    if (enabled) {
      // The normal QR input save path already refreshes the selected post preview
      // through post.updateComment(). Binding a second input listener here makes
      // Firefox do the expensive floating-preview render/measure path twice per key.
      QR.ensurePersonaPreviewListeners();
      if (isThread) {
        QR.updateThreadPreviewPost();
      } else if (isFloating) {
        QR.updateFloatingPreview();
      } else {
        QR.updateComPreview();
      }
    }
  },

  personaPreviewListenersBound: false,
  ensurePersonaPreviewListeners() {
    if (QR.personaPreviewListenersBound || !QR.nodes) return;
    const fields = [QR.nodes.name, QR.nodes.sub, QR.nodes.email].filter(Boolean);
    for (const f of fields) {
      $.on(f, 'input', QR.onPersonaFieldInputForPreview);
      $.on(f, 'change', QR.onPersonaFieldInputForPreview);
    }
    if (QR.nodes.thread) {
      $.on(QR.nodes.thread, 'change', QR.onQRThreadChangeForPreview);
    }
    // Also react to file changes on the selected post (attach/remove/spoiler/filename edits)
    $.on(d, 'QRSetFile', QR.onQRFileEventForPreview);
    $.on(d, 'QRFileRemoved', QR.onQRFileEventForPreview); // best-effort; we also call refresh explicitly from post code
    QR.personaPreviewListenersBound = true;
  },

  onPersonaFieldInputForPreview() {
    QR.refreshCommentPreview();
  },

  onQRFileEventForPreview() {
    QR.refreshCommentPreview();
  },

  onQRThreadChangeForPreview() {
    // Target thread changed (replying to a different thread or "new thread").
    // The shouldShow check inside update will clean it up if it no longer applies.
    // If an inline default is still waiting to engage (the target only just became this
    // page's thread), re-run the full apply so it can dock inline now.
    if (Conf['Comment Preview'] && !QR.commentPreviewModeInitialized) {
      QR.applyCommentPreviewSettings();
      return;
    }
    QR.refreshCommentPreview();
  },

  onPostsInsertedPreview() {
    QR.repositionThreadPreviewPost();
    // Thread content may have just been inserted (e.g. opening a thread from catalog/index).
    // Re-evaluate whether we can/should show the "in thread" preview vs floating.
    if (QR.nodes?.el) {
      // An inline default still waiting to engage can dock now that thread content exists.
      if (Conf['Comment Preview'] && !QR.commentPreviewModeInitialized) {
        QR.applyCommentPreviewSettings();
      } else {
        QR.refreshCommentPreview();
      }
    }
  },

  // --- Thread (literal) preview post management ---

  getThreadPreviewRoot(): HTMLElement | null {
    // The thread container that holds reply posts (same place ThreadUpdater appends new posts).
    const threadEl = $(g.SITE?.selectors?.thread || '.thread');
    if (threadEl) return threadEl;
    // Very late fallback (shouldn't normally be needed).
    return document.querySelector('.thread') as HTMLElement | null;
  },

  shouldShowThreadPreview(): boolean {
    if (!QR.usingThreadPreview()) return false;
    return QR.canActuallyShowThreadPreview();
  },

  createThreadPreviewPost(includeSideArrows = false): HTMLDivElement {
    const container = $.el('div', {
      className: 'postContainer replyContainer qr-preview-post',
    }) as HTMLDivElement;

    // Build a structure very close to a real reply post (desktop + mobile info)
    // so both the stitched inline and the floating versions look authentic.
    // The delete checkbox is included (on desktop postInfo) to match real posts.
    // We avoid real numeric IDs so nothing treats it as a live post.
    const now = new Date();
    const utc = Math.floor(now.getTime() / 1000);
    const timeStr = now.toLocaleString([], {
      month: '2-digit', day: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).replace(',', '');

    const sideArrows = includeSideArrows
      ? `<div class="replacedSideArrows qr-preview-side-arrows" id="sa-preview"><a href="javascript:;" class="hide-post-button hide-reply-button qr-preview-gutter-toggle" title="Undock preview"><span class="stub-icon">${Icon.get('squareMinus')}</span></a></div>`
      : '';

    container.innerHTML = `
      ${sideArrows}
      <div class="post reply" id="p-preview">
        <div class="postInfoM mobile" id="pim-preview">
          <input type="checkbox" name="preview" value="delete">
          <span class="nameBlock"><span class="name">Anonymous</span><br></span>
          <span class="dateTime postNum" data-utc="${utc}">
            <time datetime="${now.toISOString()}">${timeStr}</time>
            <a href="javascript:;" rel="nofollow" title="Link to this post">No.</a><span class="qr-preview-inline-toggle" role="button" tabindex="0" title="Dock preview into the thread">preview</span>
          </span>
        </div>
        <div class="postInfo desktop" id="pi-preview">
          <input type="checkbox" name="preview" value="delete">
          <span class="nameBlock">
            <span class="name" itemprop="author" itemscope="" itemtype="https://schema.org/Person">
              <span itemprop="name">Anonymous</span>
            </span>
          </span>
          <span class="dateTime" data-utc="${utc}" title="just now">${timeStr}</span>&nbsp;
          <span class="postNum desktop">
            <a href="javascript:;" rel="nofollow" title="Link to this post">No.</a><span class="qr-preview-inline-toggle" role="button" tabindex="0" title="Dock preview into the thread">preview</span>
          </span>
        </div>
        <blockquote class="postMessage" id="m-preview" itemprop="text"></blockquote>
      </div>
    `;

    container.dataset.previewPost = 'true';
    QR.refreshInlineToggleLabel(container);
    return container;
  },

  // The dock toggle IS the "preview" link itself (no separate icon). Its label states the
  // action a click performs: "dock preview" while floating, "undock preview" while docked
  // inline. Outside a thread there's nothing to stitch into, so it falls back to a plain,
  // non-actionable "preview" label (the click handler also no-ops to floating there).
  refreshInlineToggleLabel(container: HTMLElement) {
    const inThreadView = g.VIEW === 'thread';
    const toFloat = QR.previewInline; // currently inline -> next click pops back out to floating
    for (const link of $$('.qr-preview-inline-toggle', container) as HTMLElement[]) {
      if (!inThreadView) {
        link.textContent = 'preview';
        link.title = 'Comment preview';
        link.classList.toggle('is-dockable', false);
        continue;
      }
      link.textContent = toFloat ? 'undock preview' : 'dock preview';
      link.title = toFloat
        ? 'Undock: pop the preview back out to a floating window'
        : 'Dock the preview into the thread';
      link.classList.toggle('is-dockable', true);
    }
  },

  updateThreadPreviewPost() {
    if (!QR.shouldShowThreadPreview()) {
      QR.removeThreadPreviewPost();
      return;
    }

    // Ensure we don't leave a stale floating preview when the inline one is active.
    QR.removeFloatingPreview();

    const root = QR.getThreadPreviewRoot();
    if (!root) {
      // No thread root yet (e.g. very early init); try again shortly.
      setTimeout(() => QR.updateThreadPreviewPost(), 120);
      return;
    }

    const isNew = !QR.previewPost;
    if (isNew) {
      QR.previewPost = QR.createThreadPreviewPost(true);
      // Append; placement below depends on the chosen inline behavior.
      $.add(root, QR.previewPost);
    }

    QR.populatePreviewPost(QR.previewPost);

    if (Conf['Comment Preview Inline Behavior'] === 'inplace') {
      // Insert the preview after the reply nearest the bottom of the viewport and keep
      // it there as the user scrolls — no page jump.
      QR.startInplaceFollow();
    } else {
      // 'scroll': keep it stitched at the very end. Only jump there when the user just
      // manually docked — never on the automatic startup dock (which would yank the page
      // to the bottom on load).
      QR.stopInplaceFollow();
      QR.repositionThreadPreviewPost();
      if (QR._scrollPreviewOnDock) {
        QR._scrollPreviewOnDock = false;
        QR.previewPost.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  },

  // Shared population for any preview post shell (thread or floating).
  populatePreviewPost(container: HTMLDivElement) {
    const postEl = $('.post', container) as HTMLElement;
    // Prefer the desktop postInfo for name/date so we match real desktop rendering.
    const desktopInfo = $('.postInfo.desktop', container) || container;
    const nameBlock = $('.nameBlock', desktopInfo) as HTMLElement || $('.nameBlock', container) as HTMLElement;
    const dateEl = $('.dateTime', desktopInfo) as HTMLElement || $('.dateTime', container) as HTMLElement;
    const msg = $('.postMessage', container) as HTMLElement;

    // Persona (name / subject / trip etc). Keep it simple and literal-ish.
    const nameVal = (QR.nodes.name?.value || '').trim() || 'Anonymous';
    const subVal = (QR.nodes.sub?.value || '').trim();
    const emailVal = (QR.nodes.email?.value || '').trim();

    let nameHTML = `<span class="name">${E(nameVal)}</span>`;
    if (subVal) {
      const subj = $.el('span', { className: 'subject', textContent: subVal });
      if (nameBlock.parentNode) {
        const existingSub = $('.subject', container);
        if (existingSub) $.rm(existingSub);
        $.before(nameBlock, subj);
      }
    } else {
      const existingSub = $('.subject', container);
      if (existingSub) $.rm(existingSub);
    }

    if (emailVal) {
      nameHTML = `<a href="mailto:${E(emailVal)}" class="useremail">${nameHTML}</a>`;
    }
    nameBlock.innerHTML = nameHTML;

    // Timestamp
    const now = new Date();
    dateEl.textContent = now.toLocaleString([], { month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

    // The actual preview content
    msg.innerHTML = QR.renderComPreview(QR.nodes.com.value || '');
    if (g.BOARD.config.math_tags && /\[(math|eqn)\]/.test(QR.nodes.com.value || '')) {
      QR.typesetMathjax(msg);
    }

    // Preserve typed newlines. Do not enable soft-breaking for long unspaced runs:
    // that creates the visible "wrap, then jump back" while the width sync catches up.
    msg.style.whiteSpace = 'pre-wrap';
    msg.style.overflowWrap = 'normal';
    msg.style.wordBreak = 'normal';

    // Light file indicator
    QR.updatePreviewFileIndicator(container, postEl);

    QR.syncFloatingPreviewWidth(container);

    // Keep the inline-toggle arrow pointing the right way for the current mode.
    QR.refreshInlineToggleLabel(container);
  },

  syncFloatingPreviewWidth(container: HTMLElement) {
    const float = container.closest('.qr-preview-float') as HTMLElement | null;
    const shell = container.closest('.qr-preview-post') as HTMLElement | null;
    const reply = $('.reply', container) as HTMLElement | null;
    if (!reply) return;

    const measureRoot = $.el('div', {
      className: float?.className || '',
      style: 'position:fixed;visibility:hidden;pointer-events:none;left:-10000px;top:0;width:auto;max-width:none;z-index:-1;'
    }) as HTMLDivElement;
    const cloneShell = (shell || container).cloneNode(true) as HTMLElement;
    cloneShell.style.width = 'auto';
    cloneShell.style.maxWidth = 'none';
    const cloneReply = $('.reply', cloneShell) as HTMLElement | null;
    if (cloneReply) {
      cloneReply.style.width = 'auto';
      cloneReply.style.maxWidth = 'none';
      cloneReply.style.display = 'inline-block';
    }

    const cloneMsg = $('.postMessage', cloneShell) as HTMLElement | null;
    if (cloneMsg) {
      cloneMsg.style.whiteSpace = 'pre';
      cloneMsg.style.overflowWrap = 'normal';
      cloneMsg.style.wordBreak = 'normal';
      cloneMsg.style.maxWidth = 'none';
    }

    $.add(measureRoot, cloneShell);
    $.add(d.body, measureRoot);
    const px = (value: string) => parseFloat(value) || 0;
    const measuredWidth = (el: HTMLElement | null) => {
      if (!el) return 0;
      const style = getComputedStyle(el);
      return Math.max(
        el.scrollWidth,
        el.getBoundingClientRect().width,
        px(style.width),
        px(style.minWidth)
      );
    };
    const horizontalExtras = (el: HTMLElement | null, includePadding = false) => {
      if (!el) return 0;
      const style = getComputedStyle(el);
      let total = px(style.marginLeft) + px(style.marginRight);
      if (includePadding) {
        total += px(style.paddingLeft) + px(style.paddingRight) +
                 px(style.borderLeftWidth) + px(style.borderRightWidth);
      }
      return total;
    };
    const cloneThumb = $('.fileThumb', cloneShell) as HTMLElement | null;
    const cloneFileText = $('.fileText', cloneShell) as HTMLElement | null;
    const messageWidth = Math.ceil(measuredWidth(cloneMsg));
    const thumbWidth = cloneThumb
      ? Math.ceil(measuredWidth(cloneThumb) + horizontalExtras(cloneThumb))
      : 0;
    const fileTextWidth = cloneFileText
      ? Math.ceil(measuredWidth(cloneFileText) + horizontalExtras(cloneFileText))
      : 0;
    const replyExtras = horizontalExtras(cloneReply, true);
    const sideBySideWidth = thumbWidth + messageWidth + horizontalExtras(cloneMsg) + replyExtras;
    const natural = Math.ceil(Math.max(
      measuredWidth(cloneReply),
      fileTextWidth + replyExtras,
      sideBySideWidth
    ));
    $.rm(measureRoot);

    const visibleMsg = $('.postMessage', container) as HTMLElement | null;
    const setWrapping = (isCapped: boolean) => {
      if (!visibleMsg) return;
      visibleMsg.style.overflowWrap = isCapped ? 'anywhere' : 'normal';
      visibleMsg.style.wordBreak = isCapped ? 'break-word' : 'normal';
    };

    if (!float) {
      const minInlineWidth = 180;
      const viewportPad = 8;
      const shellRect = shell?.getBoundingClientRect();
      const parentRect = shell?.parentElement?.getBoundingClientRect();
      const gutter = shell ? $('.replacedSideArrows, .sideArrows', shell) as HTMLElement | null : null;
      const gutterRect = gutter?.getBoundingClientRect();
      const gutterChild = gutter?.firstElementChild as HTMLElement | null;
      const gutterChildRect = gutterChild?.getBoundingClientRect();
      const gutterVisualRight = Math.max(gutterRect?.right || 0, gutterChildRect?.right || 0);
      const gutterRight = gutterVisualRight
        ? gutterVisualRight + horizontalExtras(gutter) + horizontalExtras(gutterChild)
        : 0;
      const replyLeft = Math.max(
        viewportPad,
        gutterRight,
        shellRect?.left || 0
      );
      const rightEdge = Math.min(
        window.innerWidth - viewportPad,
        parentRect?.right || window.innerWidth - viewportPad
      );
      const inlineCap = Math.max(minInlineWidth, Math.floor(rightEdge - replyLeft));
      const isCapped = natural > inlineCap;
      setWrapping(isCapped);
      if (shell) shell.style.width = '';
      reply.style.width = '';
      reply.style.maxWidth = `${inlineCap}px`;
      return;
	    }

	    const minFloatWidth = 180;
	    const viewportPad = 8;
	    const attachedLoc = float.dataset.userDragged === 'true' ? '' : float.dataset.attachLocation || '';
	    const qrRect = attachedLoc && QR.nodes?.el ? QR.nodes.el.getBoundingClientRect() : null;
	    const viewportWidth = d.documentElement.clientWidth || window.innerWidth;
	    let viewportCap: number;
	    if (qrRect && attachedLoc === 'left') {
	      viewportCap = Math.max(minFloatWidth, Math.floor(qrRect.left - viewportPad - 2));
	    } else if (qrRect && attachedLoc === 'right') {
	      viewportCap = Math.max(minFloatWidth, Math.floor(viewportWidth - qrRect.right - viewportPad - 2));
	    } else if (qrRect && (attachedLoc === 'top' || attachedLoc === 'bottom')) {
	      viewportCap = Math.max(minFloatWidth, Math.floor(viewportWidth - Math.max(viewportPad, qrRect.left) - viewportPad));
	    } else {
	      const floatLeft = float.getBoundingClientRect().left || px(float.style.left);
	      viewportCap = Math.max(minFloatWidth, Math.floor(viewportWidth - Math.max(viewportPad, floatLeft) - viewportPad));
	    }
	    const isCapped = natural > viewportCap;
	    const width = Math.max(minFloatWidth, Math.min(natural, viewportCap));
	    setWrapping(isCapped);
	    float.style.width = `${width}px`;
	    if (shell) shell.style.width = `${width}px`;
	    reply.style.maxWidth = 'none';
	    reply.style.width = `${width}px`;
	    if (qrRect && attachedLoc) {
	      QR.applyFloatingPreviewAttachedPosition(float, attachedLoc, qrRect);
	    }
	  },

  // Render (or update) an attached file as a realistic post file block (thumb + text)
  // inside the preview post container. Supports images and videos with blob previews.
  // Non-media files get a simple fileText line. Cleans up previous blob URLs.
  updatePreviewFileIndicator(rootForQuery: HTMLElement, postElForAppend?: HTMLElement) {
    const container = rootForQuery;
    const sel = QR.selected;
    const file: File | undefined = sel && (sel.file as File | undefined);
    const hasPending = !!(sel && sel.pendingFile);
    const hasFile = !!file || hasPending;

    const targetParent = postElForAppend || $('.post', container) || container;
    const msg = $('.postMessage', targetParent) as HTMLElement | null;
    const fname = (QR.nodes?.filename?.value || (file && (file as any).name) || (hasPending ? 'file' : 'file')).toString();
    const sizeStr = file ? ($.bytesToString?.(file.size) || '') : (hasPending ? '' : '');
    const fileKey = hasFile
      ? [
          fname,
          file?.name || '',
          file?.size || 0,
          file?.lastModified || 0,
          file?.type || '',
          hasPending ? 'pending' : 'ready'
        ].join('\x1f')
      : '';

    const removePreviewFileBlocks = () => {
      $$('.qr-preview-file-block, .qr-preview-file-note', container).forEach((el: HTMLElement) => {
        $$('img, video', el).forEach((m: HTMLImageElement | HTMLVideoElement) => {
          if (m.src && m.src.startsWith('blob:')) {
            try { URL.revokeObjectURL(m.src); } catch {}
          }
        });
        if (el.dataset.previewBlobUrl) {
          try { URL.revokeObjectURL(el.dataset.previewBlobUrl); } catch {}
        }
        $.rm(el);
      });
      $$('.qr-preview-file-thumb', container).forEach((el: HTMLElement) => {
        if (!el.closest('.qr-preview-file-block')) {
          if (el.dataset.previewBlobUrl) {
            try { URL.revokeObjectURL(el.dataset.previewBlobUrl); } catch {}
          }
          $.rm(el);
        }
      });
    };

    if (!hasFile) {
      removePreviewFileBlocks();
      return;
    }

    const existingBlock = $('.qr-preview-file-block', container) as HTMLDivElement | null;
    if (existingBlock?.dataset.previewFileKey === fileKey) {
      if (msg && existingBlock.nextElementSibling !== msg) {
        $.before(msg, existingBlock);
      }
      return;
    }

    // Rebuild only when the selected file/filename actually changes. Recreating the
    // <img> on every keystroke temporarily gives the floated thumbnail zero width,
    // making the unbreakable comment line drop under it before the width sync catches up.
    removePreviewFileBlocks();

    // Caption ("File: name (size)") and thumb use the same sibling structure as a
    // real 4chan post: .file before blockquote.postMessage.
    const block = $.el('div', { className: 'file qr-preview-file-block' }) as HTMLDivElement;
    block.dataset.previewFileKey = fileKey;
    const fileText = $.el('div', { className: 'fileText' }) as HTMLDivElement;
    fileText.innerHTML = `File: <a href="javascript:;" class="qr-preview-file-link">${E(fname)}</a>${sizeStr ? ` (${E(sizeStr)})` : ''}`;
    $.add(block, fileText);

    const isImage = file && /^image\//.test(file.type);
    const isVideo = file && /^video\//.test(file.type);

    let thumbLink: HTMLAnchorElement | null = null;
    if ((isImage || isVideo) && file) {
      thumbLink = $.el('a', { className: 'fileThumb qr-preview-file-thumb' }) as HTMLAnchorElement;
      thumbLink.style.minWidth = '125px';
      let media: HTMLImageElement | HTMLVideoElement;
      const url = URL.createObjectURL(file);
      // Tag the thumb so removal can find/revoke if needed (belt + suspenders).
      thumbLink.dataset.previewBlobUrl = url;

      if (isVideo) {
        media = $.el('video', {
          src: url,
          muted: true,
          loop: true,
          playsInline: true,
          // Reasonable preview size; real CSS will constrain too.
          style: 'max-width: 125px; max-height: 125px; display: block;'
        }) as HTMLVideoElement;
      } else {
        media = $.el('img', {
          src: url,
          alt: fname,
          style: 'max-width: 125px; max-height: 125px; display: block;'
        }) as HTMLImageElement;
      }
      $.on(media, isVideo ? 'loadedmetadata' : 'load', () => QR.syncFloatingPreviewWidth(container));
      $.add(thumbLink, media);
    }

    if (thumbLink) $.add(block, thumbLink);
    if (msg && msg.parentNode) {
      $.before(msg, block);
    } else {
      $.add(targetParent, block);
    }
  },

  repositionThreadPreviewPost() {
    if (!QR.previewPost) return;
    // In 'inplace' mode the scroll-follower owns placement; don't fight it.
    if (Conf['Comment Preview Inline Behavior'] === 'inplace') return;
    const root = QR.getThreadPreviewRoot();
    if (!root) return;
    // If it's not the last child, move it to the end.
    if (root.lastElementChild !== QR.previewPost) {
      $.add(root, QR.previewPost);
    }
  },

  removeThreadPreviewPost() {
    QR.stopInplaceFollow();
    if (QR.previewPost && QR.previewPost.parentNode) {
      QR.revokePreviewFileBlobs(QR.previewPost);
      $.rm(QR.previewPost);
    }
    QR.previewPost = null;
  },

  // --- Inline 'inplace' follow: keep the stitched preview after the reply nearest the
  //     bottom of the viewport, relocating it as the user scrolls (no page jump). ---

  startInplaceFollow() {
    if (QR._inplaceScrollHandler) { QR.relocateInplacePreview(); return; }
    const handler = () => {
      if (QR._inplaceRafPending) return;
      QR._inplaceRafPending = true;
      requestAnimationFrame(QR.relocateInplacePreview);
    };
    QR._inplaceScrollHandler = handler;
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler, { passive: true });
    // Seed the initial position immediately.
    QR.relocateInplacePreview();
  },

  stopInplaceFollow() {
    if (!QR._inplaceScrollHandler) return;
    window.removeEventListener('scroll', QR._inplaceScrollHandler);
    window.removeEventListener('resize', QR._inplaceScrollHandler);
    QR._inplaceScrollHandler = undefined;
    QR._inplaceRafPending = false;
  },

  relocateInplacePreview() {
    QR._inplaceRafPending = false;
    if (!QR.previewPost || !QR.usingThreadPreview() || Conf['Comment Preview Inline Behavior'] !== 'inplace') {
      QR.stopInplaceFollow();
      return;
    }
    const root = QR.getThreadPreviewRoot();
    if (!root) return;
    // CSS selector for real (non-clone) replies; replyContainer in SITE is an XPath.
    const sel = (g.SITE?.selectors?.replyOriginal as string) || '.replyContainer:not([data-clone])';
    const vh = window.innerHeight;
    const replies = ($$(sel, root) as HTMLElement[]).filter(r => r !== QR.previewPost);
    const lastReply = replies[replies.length - 1] || null;
    let target: HTMLElement | null = null;
    // Last reply whose top is still above the bottom of the viewport = nearest the fold.
    for (const reply of replies) {
      if (reply.getBoundingClientRect().top < vh) {
        target = reply;
      } else {
        break;
      }
    }
    // When the thread's final reply is fully on screen (scrolled to the bottom), dock the
    // preview as the genuine last post so the real end of the thread is reachable.
    // Otherwise keep it one post ABOVE the reply nearest the fold: inserting it *after*
    // that reply would drop it below the viewport where it's hidden. The ~preview-height
    // gap between the two conditions gives natural hysteresis (no flicker at the seam).
    if (lastReply && lastReply.getBoundingClientRect().bottom <= vh) {
      if (lastReply.nextElementSibling !== QR.previewPost) {
        $.after(lastReply, QR.previewPost);
      }
    } else if (target) {
      if (target.previousElementSibling !== QR.previewPost) {
        $.before(target, QR.previewPost);
      }
    } else {
      // No reply sits above the fold (we're scrolled up near the top, e.g. an OP-only
      // thread or one with a single reply still below the fold). Keep the preview just
      // below the OP — never above it. We can't use root.firstElementChild here: the
      // thread root's first child may be a prepended seasonal "hat" <img>, a thread-hide
      // stub, etc., so anchoring there drops the preview between that node and the OP
      // (i.e. above the OP). Anchor on the first real post container instead — the OP —
      // skipping the preview (also a .postContainer) and any clones.
      const pcSel = (g.SITE?.selectors?.postContainer as string) || '.postContainer';
      let op: HTMLElement | null = null;
      for (const pc of $$(pcSel, root) as HTMLElement[]) {
        if (pc === QR.previewPost || pc.hasAttribute('data-clone')) continue;
        op = pc;
        break;
      }
      if (op) {
        if (op.nextElementSibling !== QR.previewPost) $.after(op, QR.previewPost);
      } else if (root.firstElementChild && root.firstElementChild !== QR.previewPost) {
        $.prepend(root, QR.previewPost);
      }
    }
    QR.syncFloatingPreviewWidth(QR.previewPost);
  },

  // --- Floating preview (just the post, no window frame, draggable, positioned near QR initially) ---

  createFloatingPreview(): HTMLDivElement {
    // The root IS the floating post preview itself (no dialog chrome, no .move bar, no extra window).
    // It is literally a realistic post (as it would appear in the thread) but taken out of flow,
    // positioned near the QR, and draggable by its header.
	    const float = $.el('div', {
	      className: 'qr-preview-float',
	      style: 'position:fixed;'
	    }) as HTMLDivElement;

    // Create the post shell WITHOUT side arrows (floating standalone post).
    const shell = QR.createThreadPreviewPost(false);
    $.add(float, shell);

    $.add(d.body, float);

    // Restore a remembered drag position (e.g. undocking from inline) so the float
    // reappears where the user last left it instead of jumping back to the QR.
    const rememberedPos = QR.rememberedCommentPreviewFloatPos();
    if (rememberedPos) {
      QR.previewFloatPos = rememberedPos;
      float.style.left = rememberedPos.left;
      float.style.top = rememberedPos.top;
      float.style.right = '';
      float.style.bottom = '';
      float.dataset.userDragged = 'true';
      float.title = 'Double-click to attach to QR';
    }

    // Attach drag behavior (grab the postInfo area to move the whole preview).
    QR.attachDragToFloatingPreview(float);

    return float;
  },

  updateFloatingPreview() {
    if (!QR.usingFloatingPreview()) {
      QR.removeFloatingPreview();
      return;
    }

    // Ensure we don't leave a stale inline thread preview when the floating one is active.
    QR.removeThreadPreviewPost();

    if (!QR.previewFloat) {
      QR.previewFloat = QR.createFloatingPreview();
    }

    QR.previewFloat.hidden = false;

    // Position or re-position against the configured QR side unless the user dragged it away.
    if (QR.nodes?.el && QR.previewFloat.dataset.userDragged !== 'true') {
      QR.positionFloatingPreviewNearQR(QR.previewFloat);
    }

    // Find the post shell we created and populate it.
    const postShell = $('.qr-preview-post', QR.previewFloat) as HTMLDivElement | null;
    if (postShell) {
      QR.populatePreviewPost(postShell);
    }
  },

  resolvedCommentPreviewAttachLocation(): string {
    const preferred = QR.normalizeCommentPreviewAttachLocation(Conf['Comment Preview Attach Location']);
    if (preferred !== 'auto') return preferred;

    const blocked = new Set<string>();
    if (Conf['Thread Watcher Attach Controls'] !== false && Conf['Thread Watcher Attached']) {
      const watcherLoc = Conf['Thread Watcher Attach Location'];
      blocked.add((watcherLoc === 'top' || watcherLoc === 'left' || watcherLoc === 'right') ? watcherLoc : 'bottom');
    }
    return ['bottom', 'right', 'left', 'top'].find(loc => !blocked.has(loc)) || 'bottom';
  },

  applyFloatingPreviewAttachedPosition(float: HTMLElement, loc: string, qrRect: DOMRect) {
    const viewportWidth = d.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = d.documentElement.clientHeight || window.innerHeight;
    float.style.position = 'fixed';
    if (loc === 'top') {
      float.style.left = `${qrRect.left}px`;
      float.style.bottom = `${viewportHeight - qrRect.top}px`;
      float.style.top = '';
      float.style.right = '';
    } else if (loc === 'left') {
      float.style.top = `${qrRect.top}px`;
      float.style.right = `${viewportWidth - qrRect.left + 2}px`;
      float.style.left = '';
      float.style.bottom = '';
    } else if (loc === 'right') {
      float.style.top = `${qrRect.top}px`;
      float.style.left = `${qrRect.right + 2}px`;
      float.style.right = '';
      float.style.bottom = '';
    } else {
      float.style.left = `${qrRect.left}px`;
      float.style.top = `${qrRect.bottom}px`;
      float.style.right = '';
      float.style.bottom = '';
    }
  },

  positionFloatingPreviewNearQR(float: HTMLElement) {
    if (!QR.nodes?.el || !float) return;
    const qrRect = QR.nodes.el.getBoundingClientRect();
    const loc = QR.resolvedCommentPreviewAttachLocation();
    float.dataset.attachLocation = loc;
    QR.applyFloatingPreviewAttachedPosition(float, loc, qrRect);
  },

  repositionFloatingPreview(e?: Event | boolean) {
    const skipWidthSync = e === true || !!((e as CustomEvent | undefined)?.detail?.dragging);
    const float = QR.previewFloat;
    if (float && QR.nodes?.el && float.dataset.userDragged !== 'true') {
      QR.positionFloatingPreviewNearQR(float);
    }
    const postShell = float ? $('.qr-preview-post', float) as HTMLDivElement | null : null;
    if (!skipWidthSync && postShell) {
      QR.syncFloatingPreviewWidth(postShell);
    }
    if (!skipWidthSync && QR.previewPost) {
      QR.syncFloatingPreviewWidth(QR.previewPost);
    }
  },

  attachDragToFloatingPreview(float: HTMLElement) {
    let dragging = false;
    let startClientX = 0;
    let startClientY = 0;
    let startLeft = 0;
    let startTop = 0;
    let moved = false;
    let widthSyncRaf = 0;

    const scheduleWidthSync = () => {
      if (widthSyncRaf) return;
      widthSyncRaf = requestAnimationFrame(() => {
        widthSyncRaf = 0;
        const postShell = $('.qr-preview-post', float) as HTMLDivElement | null;
        if (postShell) {
          QR.syncFloatingPreviewWidth(postShell);
        }
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      // The entire floating preview is grabbable for dragging (including the content area / postMessage),
      // not just the header. This matches the desired behavior for positioning the preview anywhere.
      if (!float.contains(e.target as HTMLElement)) return;

      dragging = true;
      moved = false;
      startClientX = e.clientX;
      startClientY = e.clientY;

      // Use viewport rect because we are position:fixed.
      const rect = float.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      // Keep it fixed while the user drags it around the viewport.
      float.style.position = 'fixed';

      document.addEventListener('mousemove', onMouseMove, { passive: false });
      document.addEventListener('mouseup', onMouseUp, { once: true, passive: false });

      e.preventDefault();
      e.stopPropagation();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      e.preventDefault();

      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      moved = true;

      float.style.left = `${startLeft + dx}px`;
      float.style.top = `${startTop + dy}px`;
      float.style.right = '';
      float.style.bottom = '';
      delete float.dataset.attachLocation;
    };

    const onMouseUp = () => {
      dragging = false;
      document.removeEventListener('mousemove', onMouseMove as any);
      if (moved) {
        // Mark so future content updates don't reset the user's chosen position.
        float.dataset.userDragged = 'true';
        float.title = 'Double-click to attach to QR';
        QR.setCommentPreviewFloatPos({ left: float.style.left, top: float.style.top });
        QR.storeCommentPreviewLastMode('detached');
        scheduleWidthSync();
      }
    };

    float.addEventListener('mousedown', onMouseDown);

    // Double-click re-attaches the float to the QR (clears the dragged position).
    // (mousedown preventDefault already blocks text selection, so dblclick is free.)
    float.addEventListener('dblclick', (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.('.qr-preview-inline-toggle')) return;
      delete float.dataset.userDragged;
      float.removeAttribute('title');
      QR.clearStoredCommentPreviewFloatPos();
      QR.storeCommentPreviewLastMode('attached');
      QR.positionFloatingPreviewNearQR(float);
      scheduleWidthSync();
    });
    },

    removeFloatingPreview() {
    if (QR.previewFloat) {
      // Snapshot a user-dragged position so a later re-show (e.g. undocking from inline)
      // returns the float to where it was rather than snapping back to the QR.
      if (QR.previewFloat.dataset.userDragged === 'true') {
        QR.setCommentPreviewFloatPos({ left: QR.previewFloat.style.left, top: QR.previewFloat.style.top });
      }
      if (QR.previewFloat.parentNode) {
        QR.revokePreviewFileBlobs(QR.previewFloat);
        $.rm(QR.previewFloat);
      }
    }
    QR.previewFloat = null;
  },

  // Revoke any blob: URLs we created for file thumbs inside a preview post (thread or floating).
  revokePreviewFileBlobs(root: HTMLElement | null) {
    if (!root) return;
    $$('img, video', root).forEach((m: HTMLImageElement | HTMLVideoElement) => {
      const src = m.src || (m as any).currentSrc;
      if (src && src.startsWith('blob:')) {
        try { URL.revokeObjectURL(src); } catch {}
      }
    });
    // Also check our tagged thumb links
    $$('[data-preview-blob-url]', root).forEach((el: HTMLElement) => {
      const u = el.dataset.previewBlobUrl;
      if (u && u.startsWith('blob:')) {
        try { URL.revokeObjectURL(u); } catch {}
      }
      delete el.dataset.previewBlobUrl;
    });
  },

  comPreviewTagWraps: {
    spoiler: { wrap: (i: string) => `<s>${i}</s>`,                                       format: true  },
    code:    { wrap: (i: string) => `<pre class="prettyprint">${i}</pre>`,               format: false },
    math:    { wrap: (i: string, fallback = i) => `<span class="qr-math-fallback">[math]${fallback}[/math]</span><script type="math/tex">${i}</script>`, format: false, raw: true },
    eqn:     { wrap: (i: string, fallback = i) => `<span class="qr-math-fallback">[eqn]${fallback}[/eqn]</span><script type="math/tex; mode=display">${i}</script>`, format: false, raw: true },
    sjis:    { wrap: (i: string) => `<span class="sjis">${i}</span>`,                    format: true  },
    b:       { wrap: (i: string) => `<b>${i}</b>`,                                       format: true  },
    i:       { wrap: (i: string) => `<span class="mu-i">${i}</span>`,                    format: true  },
    red:     { wrap: (i: string) => `<span class="mu-r">${i}</span>`,                    format: true  },
    green:   { wrap: (i: string) => `<span class="mu-g">${i}</span>`,                    format: true  },
    blue:    { wrap: (i: string) => `<span class="mu-b">${i}</span>`,                    format: true  },
  } as Record<string, { wrap: (i: string, fallback?: string) => string; format: boolean; raw?: boolean }>,

  // Per-board extra tags that 4chan renders but aren't surfaced via boards.json flags.
  comPreviewBoardExtras: {
    mu:  ['b', 'i', 'red', 'green', 'blue'],
    qst: ['b', 'i', 'red', 'green', 'blue'],
  } as Record<string, string[]>,

  // Tags whose [tag]…[/tag] markup the current board actually renders. Shared by
  // the comment-preview renderer and the auto-close-on-type behavior so both agree
  // on what counts as a "real" tag here.
  supportedTags(): string[] {
    const config = g.BOARD?.config;
    if (!config) return [];
    const names: string[] = [];
    if (config.spoilers)   names.push('spoiler');
    if (config.code_tags)  names.push('code');
    if (config.math_tags)  names.push('math', 'eqn');
    if (config.sjis_tags)  names.push('sjis');
    const extras = QR.comPreviewBoardExtras[g.BOARD.ID] || [];
    for (const t of extras) if (!names.includes(t)) names.push(t);
    return names;
  },

  // When the user finishes typing a supported opening tag (the `]` of `[code]`),
  // insert the matching closing tag and leave the caret between the two.
  onAutoCloseTag(e?: Event) {
    if (Conf['Auto-close Tags'] === false) return;
    // Only react to a literally-typed character, never deletes/replacements. A
    // synthetic 'input' (no inputType) is allowed through but is caught by the
    // "already closed" guard below, so it can't recurse.
    const inputType = (e as InputEvent | undefined)?.inputType;
    if (inputType && inputType !== 'insertText') return;
    const ta = QR.nodes?.com;
    if (!ta) return;
    const pos = ta.selectionStart;
    if (pos !== ta.selectionEnd) return;          // a selection is active
    if (ta.value[pos - 1] !== ']') return;        // last char typed wasn't `]`
    const m = ta.value.slice(0, pos).match(/\[([a-z]+)\]$/i);
    if (!m) return;                               // not an opening tag (e.g. `[/code]`)
    const tag = m[1].toLowerCase();
    if (!QR.supportedTags().includes(tag)) return;
    if (ta.value.slice(pos).startsWith(`[/${tag}]`)) return; // already closed
    ta.value = ta.value.slice(0, pos) + `[/${tag}]` + ta.value.slice(pos);
    ta.setSelectionRange(pos, pos);               // caret between the tags
    $.event('input', null, ta);                   // refresh preview / counters
  },

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
      const inner = tag.raw ? QR.escapeMathJaxScript(m[2]) : tag.format ? QR.formatComPreviewText(m[2]) : E(m[2]);
      const fallback = tag.raw ? E(m[2]) : undefined;
      html += tag.wrap(inner, fallback);
      last = m.index + m[0].length;
    }
    html += QR.formatComPreviewText(text.slice(last));
    return html;
  },

  escapeMathJaxScript(text: string): string {
    return text.replace(/<\/script/gi, '<\\/script');
  },

  formatComPreviewText(text: string): string {
    const escaped = E(text);
    // Treat >>NNN, >>>/board/NNN, and >>>/board/ as 4chan quote/board links.
    const withQuotes = escaped.replace(
      /&gt;&gt;(?:\d+|&gt;\/[a-z\d]+\/(?:\d+)?)(?=$|[\s<.,!?;:)])/g,
      m => QR.renderComPreviewQuoteLink(m)
    );
    const withLinks = withQuotes.replace(
      /(^|[\s(])((?:https?:\/\/|www\.)[^\s<>"']+)/g,
      (m, prefix, url) => `${prefix}${QR.renderComPreviewLink(url)}`
    );
    return withLinks.split('\n').map(line => {
      const quotePrefix = line.match(/^(&gt;)+(?!&gt;\/[a-z\d]+\/\d+)/)?.[0];
      const content = quotePrefix ? `<span class="quote">${line}</span>` : line;
      return content;
    }).join('<br>');
  },

  renderComPreviewQuoteLink(text: string): string {
    const match = text.match(/^&gt;&gt;(?:(\d+)|&gt;\/([a-z\d]+)\/(\d+)?)$/);
    if (!match) return text;
    const boardID = match[2] || g.BOARD.ID;
    const postID = match[1] || match[3];
    if (!postID) {
      const href = Get.url('index', {siteID: g.BOARD.siteID, boardID}) || `/${boardID}/`;
      return `<a class="quotelink" href="${E(href)}">${text}</a>`;
    }
    const currentThread = `${g.THREADID || g.threadID || ''}`;
    const threadID = boardID === g.BOARD.ID ? (currentThread || postID) : postID;
    const hash = g.SITE.software === 'yotsuba' ? `#p${postID}` : `#${postID}`;
    const href = boardID === g.BOARD.ID && postID === currentThread
      ? hash
      : `${Get.url('thread', {siteID: g.BOARD.siteID, boardID, threadID}) || `/${boardID}/thread/${threadID}`}${hash}`;
    return `<a class="quotelink" href="${E(href)}">${text}</a>`;
  },

  renderComPreviewLink(text: string): string {
    const trail = text.match(/[.,!?;:)]+$/)?.[0] || '';
    const body = trail ? text.slice(0, -trail.length) : text;
    const href = /^https?:\/\//i.test(body) ? body : `https://${body}`;
    return `<a class="linkify" href="${E(href)}" target="_blank" rel="nofollow noopener">${body}</a>${trail}`;
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
    // Sync the model on the current draft post so canActuallyShowThreadPreview sees the right target thread.
    // (programmatic .value = does not fire 'change', so explicit save is needed; used e.g. on catalog -> thread navigation)
    if (QR.selected && list) {
      QR.selected.save(list, true);
    }
    // Re-eval preview style (thread vs floating) now that thread context may have changed.
    QR.refreshCommentPreview();
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
    setNode('previewToggle',  '#qr-preview-toggle');
    setNode('draftsButton',   '#qr-drafts-button');
    setNode('draftsBadge',    '#qr-drafts-badge');
    setNode('draftsPanel',    '#qr-drafts-panel');
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
    Icon.set(nodes.previewToggle, 'eye');
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
    QR.disablePersonaFieldAutofill();

    $.on(nodes.autohide,       'change',    QR.toggleHide);
    $.on(nodes.close,          'click',     QR.close);
    $.on(nodes.status,         'click',     QR.submit);
    $.on(nodes.form,           'submit',    QR.submit);
    $.on(nodes.previewToggle,  'click',     QR.toggleCommentPreview);
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
    const save = function() { QR.selected.save(this); QR.drafts.save(); };
    while ((name = items[i++])) {
      var node;
      if (!(node = nodes[name])) { continue; }
      event = node.nodeName === 'SELECT' ? 'change' : 'input';
      $.on(nodes[name], event, save);
    }

    $.on(nodes.draftsButton, 'click', QR.drafts.togglePanel);
    QR.drafts.updateButton();
    // React when the draft feature is toggled (same tab via the settings event,
    // other tabs via storage sync): turning it off wipes saved drafts + files.
    $.on(d, 'QRStateChanged', QR.drafts.onSettingChanged);
    $.sync('QR Drafts', QR.drafts.onSettingChanged);

    if (Conf['Remember QR Size']) {
      $.get('QR Size', '', item => nodes.com.style.cssText = item['QR Size']);
      $.on(nodes.com, 'mouseup', function(e) {
        if (e.button !== 0) { return; }
        $.set('QR Size', this.style.cssText);
      });
    }

    // Auto-close supported board tags (e.g. [code] → [/code]) as they're typed.
    $.on(nodes.com, 'input', QR.onAutoCloseTag);

    QR.generatePostableThreadsList();
    QR.persona.load();
    new QR.post(true);
    QR.drafts.restore();
    QR.status();
    QR.cooldown.setup();
    QR.captcha.init();

    $.add(d.body, dialog);
    QR.captcha.setup();
    QR.oekaki.setup();

    // Observe QR size changes (textarea resize, dump list growth, etc.) so a non-dragged
    // floating comment preview stays precisely under the QR bottom edge.
    if (typeof ResizeObserver === 'function' && !QR._qrResizeObs) {
      QR._qrResizeObs = new ResizeObserver(() => QR.repositionFloatingPreview());
      QR._qrResizeObs.observe(dialog);
    }

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

    // The menu is appended to document.body so it escapes the QR form's
    // overflow, but that means it can't inherit the QR's theme. We mirror
    // colors from the QR onto the menu (and re-pin them on the toggle) so
    // the dropdown matches whatever theme — StyleChan or otherwise — is
    // styling the QR.
    //
    // For the text color we sample from the QR form (a non-button parent),
    // because host themes like StyleChan apply their own `button { color }`
    // rule and reading from the toggle itself would inherit that. For the
    // background we walk up from the toggle until we hit the first opaque
    // ancestor. For borders we copy the computed border from a sibling input,
    // which has already been styled by the host theme. `setProperty(..., '',
    // 'important')` is used so the inline styles beat any !important rules
    // a host stylesheet may use against `button`.
    const syncTheme = () => {
      const formEl = (QR.nodes?.form || picker.parentElement) as HTMLElement | undefined;
      const fg = formEl ? window.getComputedStyle(formEl).color : '';

      let bg = '';
      let el: HTMLElement | null = toggle;
      while (el) {
        const cs = window.getComputedStyle(el);
        const m = cs.backgroundColor.match(/[\d.]+/g);
        if (m && (m.length < 4 || parseFloat(m[3]) > 0.01)) { bg = cs.backgroundColor; break; }
        el = el.parentElement;
      }

      if (bg) {
        menu.style.setProperty('background-color', bg, 'important');
      }
      if (fg) {
        menu.style.setProperty('color', fg, 'important');
        toggle.style.setProperty('color', fg, 'important');
      }

      const sibling = QR.nodes?.name as HTMLElement | undefined;
      if (sibling) {
        const cs = window.getComputedStyle(sibling);
        if (cs.borderTopColor) {
          toggle.style.setProperty('border-color', cs.borderTopColor, 'important');
          menu.style.setProperty('border-color', cs.borderTopColor, 'important');
        }
      }
    };

    const openMenu = () => {
      if (open) return;
      open = true;
      picker.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      menu.hidden = false;
      syncTheme();
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
    // Defer to next frame so QR.nodes.form / nodes.name are populated by
    // flagsInput()'s caller before we sample computed styles off them.
    setTimeout(syncTheme, 0);
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

  disablePersonaFieldAutofill() {
    if (!QR.nodes) { return; }

    // Opt-in: when the user prefers browser/password-manager autofill, undo the
    // suppression baked into the QuickReply template so the Name, Options and
    // Subject fields can be autofilled and remembered.
    if (Conf['Allow Browser Autofill']) {
      QR.nodes.form.removeAttribute('autocomplete');

      // Restore the original 4chan field names so the browser/password manager
      // actually recognises them — `qr-*` tokens are unfamiliar and won't match
      // saved values.
      const enabledNames = {
        name: 'name',
        email: 'email',
        sub: 'sub',
      };

      for (const key of ['name', 'email', 'sub'] as const) {
        const input = QR.nodes[key];
        if (!input) { continue; }

        input.name = enabledNames[key];
        input.readOnly = false;
        input.removeAttribute('data-no-autofill');
        input.setAttribute('autocomplete', 'on');
        input.removeAttribute('aria-autocomplete');
        // Strip the rest of the suppression baked into the template so the
        // fields behave like plain default inputs.
        input.removeAttribute('autocapitalize');
        input.removeAttribute('autocorrect');
        input.removeAttribute('spellcheck');
        for (const attr of [
          'data-lpignore', 'data-1p-ignore', 'data-bwignore',
          'data-protonpass-ignore', 'data-form-type',
        ]) {
          input.removeAttribute(attr);
        }
      }
      return;
    }

    QR.nodes.form.setAttribute('autocomplete', 'off');

    const names = {
      name: 'qr-no-autofill-name',
      email: 'qr-no-autofill-options',
      sub: 'qr-no-autofill-subject',
    };

    for (const key of ['name', 'email', 'sub'] as const) {
      const input = QR.nodes[key];
      if (!input) { continue; }

      input.name = names[key];
      input.removeAttribute('list');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('aria-autocomplete', 'none');
      input.setAttribute('data-lpignore', 'true');
      input.setAttribute('data-1p-ignore', 'true');
      input.setAttribute('data-bwignore', 'true');
      input.setAttribute('data-protonpass-ignore', 'true');
      input.setAttribute('data-form-type', 'other');
      // No readonly lock: renaming + autocomplete=off + the password-manager
      // ignore attrs already suppress autofill, and locking the field broke
      // normal typing/selection.
      input.readOnly = false;
    }
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

    // Re-persist the remaining drafts (the posted one was removed above; if
    // nothing's left this clears the board's saved draft).
    QR.drafts.flush();

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

    return newFile;
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
      post: null as any,

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

      preparePost(post): any {
        QR.openPost();
        if (!QR.postCanTakeFile(QR.selected, false)) {
          new QR.post(true);
          $.addClass(QR.nodes.el, 'dump');
        }
        QR.quote.call(post.nodes.post);
        return QR.selected;
      },

      editSelectedPost(post) {
        post.select();
        const { el } = post.nodes;
        const open = function(e?) {
          if (e) { el.removeEventListener('QRMetadata', open, false); }
          if (!el.dataset.type || !/^(image|video)\//.test(el.dataset.type)) { return; }
          if (el.dataset.height === 'loading') {
            el.addEventListener('QRMetadata', open, false);
            return;
          }
          if (!el.dataset.height || !el.dataset.width) { return; }
          post.select();
          QR.oekaki.edit();
        };
        open();
      },

      editFile(e?: Event) {
        e?.preventDefault();
        const { post } = QR.oekaki.menu;
        const target = QR.oekaki.menu.preparePost(post);
        if (!target) { return; }
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
                canvas.toBlob(async function (snapshot) {
                  if (!snapshot) { return QR.error('Could not snapshot video for the editor.'); }
                  const file = new File([snapshot], post.file.name.replace(/\.\w+$/, '') + '.png', { type: 'image/png' });
                  await target.setFile(file);
                  QR.oekaki.menu.editSelectedPost(target);
                });
              });
              video.currentTime = currentTime;
            });
            $.on(video, 'error', () => QR.openError());
            video.src = URL.createObjectURL(blob);
          } else {
            const file = new File([blob], post.file.name, { type: blob.type });
            target.setFile(file).then(() => QR.oekaki.menu.editSelectedPost(target));
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

  // Auto-saved per-thread draft of what's typed in the QR, so it survives a
  // refresh/close/crash. Comment text + per-post state (spoiler, flag, thread)
  // are stored under `QR.drafts` as { '<siteID>/<boardID>/<threadID>': { posts } }.
  // The thread you're viewing keys the bucket ('index' off a thread page), so
  // reopening a thread restores only that thread's draft — not whatever you last
  // typed elsewhere on the board. Name/options/subject are deliberately not
  // persisted or restored. Attachments (images/videos) are stored separately in
  // IndexedDB via QRFileStore (the JSON layer can't hold blobs) and referenced
  // by id; the total kept per thread is capped at FILE_CAP.
  drafts: {
    timeout: undefined as ReturnType<typeof setTimeout> | undefined,
    // Cap on total attachment bytes persisted per thread. Files past the cap
    // (largest first) are not saved; the user is warned once.
    FILE_CAP: 100 * 1024 * 1024,
    _warnedCap: false,
    // Set while discard() tears the QR down, so the post/file removals it
    // triggers don't re-persist a draft we're deleting.
    _suspended: false,
    // Discarded drafts kept past thread death are stored under this key as an
    // array of bin entries; pruned after BIN_TTL unless the user pinned them.
    BIN_KEY: 'QR.drafts.bin',
    BIN_TTL: 24 * 60 * 60 * 1000,

    // Drafts key off the thread you're looking at. Off a thread page (index,
    // catalog, archive) there's no single thread, so replies share one 'index'
    // bucket per board.
    key() {
      const tid = (g.VIEW === 'thread' && g.threadID) ? g.threadID : 'index';
      return `${g.SITE.ID}/${g.BOARD.ID}/${tid}`;
    },

    // File-store ids start with the board key + a space so they can be
    // enumerated/cleaned per board (site/board ids contain no spaces).
    filePrefix() {
      return `${QR.drafts.key()} `;
    },

    genId() {
      return `${QR.drafts.filePrefix()}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    },

    threadValid(thread) {
      if (thread == null || thread === 'new') { return true; }
      return $$('option', QR.nodes.thread).some(o => (o as HTMLOptionElement).value === `${thread}`);
    },

    // Debounced text/state auto-save while typing.
    save() {
      if (!Conf['QR Drafts'] || QR.drafts._suspended) { return; }
      clearTimeout(QR.drafts.timeout);
      QR.drafts.timeout = setTimeout(QR.drafts.flush, 500);
    },

    // Serialize the current posts' text + state for this board. Posts with
    // nothing worth keeping (no text and no file) are dropped; if nothing's
    // left, the board's saved draft is removed.
    flush() {
      clearTimeout(QR.drafts.timeout);
      if (!Conf['QR Drafts'] || !QR.nodes || QR.drafts._suspended) { return; }
      QR.selected?.forceSave();
      const posts = QR.posts
        .map(post => ({
          thread: post.thread,
          com: post.com || null,
          spoiler: post.spoiler ? true : undefined,
          flag: post.flag || undefined,
          file: (post.file && post._draftFileId)
            ? { id: post._draftFileId, filename: post.filename || null, originalName: post.originalName || null }
            : undefined,
        }))
        .filter(post => post.com || post.sub || post.file);
      $.get('QR.drafts', dict(), ({ 'QR.drafts': all }) => {
        const key = QR.drafts.key();
        if (posts.length) { all[key] = { posts }; } else { delete all[key]; }
        $.set('QR.drafts', all, QR.drafts.updateButton);
        // Drop any stored attachments no longer referenced (removed/posted
        // posts, cleared files). Fails soft.
        QR.drafts.cleanupOrphanFiles(posts.map(p => p.file?.id).filter(Boolean) as string[]);
      });
    },

    // Persist current attachments to IndexedDB (only newly added ones are
    // written), enforce the per-thread size cap, then flush the JSON refs.
    // Called when a file is added/removed; safe to call any time.
    async persistFiles() {
      if (!Conf['QR Drafts'] || !QR.nodes || QR.drafts._suspended) { return; }
      try {
        const withFiles = QR.posts.filter(p => p.file);
        // Keep smallest-first up to the cap, i.e. skip the largest over it.
        const keep = new Set<typeof withFiles[number]>();
        let total = 0;
        let skipped = 0;
        for (const p of withFiles.slice().sort((a, b) => a.file.size - b.file.size)) {
          if (total + p.file.size <= QR.drafts.FILE_CAP) { total += p.file.size; keep.add(p); }
          else { skipped++; }
        }
        for (const p of withFiles) {
          if (keep.has(p)) {
            if (!p._draftFileId) {
              const id = QR.drafts.genId();
              if (await QRFileStore.put(id, p.file)) { p._draftFileId = id; }
            }
          } else if (p._draftFileId) {
            // Over the cap now — drop any previously stored copy.
            await QRFileStore.delete(p._draftFileId);
            delete p._draftFileId;
          }
        }
        if (skipped && !QR.drafts._warnedCap) {
          QR.drafts._warnedCap = true;
          new Notice('warning', `Draft attachments over ~${Math.round(QR.drafts.FILE_CAP / 1048576)} MB total aren't saved for this thread; ${skipped} file(s) skipped.`, 6);
        }
      } catch (err) {
        console.error('QR draft persistFiles failed', err);
      }
      QR.drafts.flush();
    },

    // Delete stored attachments for this board whose ids aren't in `keep`.
    async cleanupOrphanFiles(keep: string[]) {
      try {
        const prefix = QR.drafts.filePrefix();
        const referenced = new Set(keep);
        const orphans = (await QRFileStore.keys()).filter(k => k.startsWith(prefix) && !referenced.has(k));
        if (orphans.length) { await QRFileStore.delete(orphans); }
      } catch (err) {
        console.error('QR draft cleanupOrphanFiles failed', err);
      }
    },

    // Restore this thread's saved draft into an empty Quick Reply.
    restore() {
      if (!Conf['QR Drafts'] || !QR.nodes) { return; }
      QR.drafts.migrateLegacy();
      QR.drafts.pruneBin();
      $.get('QR.drafts', dict(), ({ 'QR.drafts': all }) => {
        QR.drafts.updateButton();
        const data = all?.[QR.drafts.key()];
        if (!data?.posts?.length || !QR.nodes) { return; }
        // Never clobber something the user has already started typing/attached.
        if (QR.posts.some(post => post.com || post.sub || post.file)) { return; }
        for (let i = 0; i < data.posts.length; i++) {
          const draft = data.posts[i];
          const post = i === 0 ? QR.posts[0] : new QR.post();
          if (!post) { continue; }
          if (QR.drafts.threadValid(draft.thread)) { post.thread = draft.thread; }
          post.setComment(draft.com || '');
          if (draft.spoiler) {
            post.spoiler = true;
            if (post.nodes?.spoiler) { post.nodes.spoiler.checked = true; }
          }
          if (draft.flag) { post.flag = draft.flag; }
          if (draft.file?.id) { QR.drafts.restoreFile(post, draft.file); }
        }
        // Expand the dump list when there are attachments or multiple queued
        // posts, so it's obvious the restored files/posts are there.
        if (data.posts.length > 1 || data.posts.some(p => p.file?.id)) {
          $.addClass(QR.nodes.el, 'dump');
        }
        QR.selected?.load();
      });
    },

    // Pull a stored attachment back out of IndexedDB and re-attach it to `post`
    // via the normal file pipeline (regenerating its thumbnail). Fails soft.
    async restoreFile(post: any, ref: { id: string; filename?: string; originalName?: string }) {
      try {
        const blob = await QRFileStore.get(ref.id);
        if (!blob || !QR.posts.includes(post)) { return; }
        const name = ref.originalName || ref.filename || (blob as File).name || 'file';
        const file = new File([blob], name, { type: blob.type, lastModified: (blob as File).lastModified || Date.now() });
        await post.setFile(file, { restore: true, id: ref.id, filename: ref.filename, originalName: ref.originalName });
      } catch (err) {
        console.error('QR draft restoreFile failed', err);
      }
    },

    // Discard the current text/attachments and the saved draft for this board.
    discard() {
      clearTimeout(QR.drafts.timeout);
      for (const p of QR.posts) { delete p._draftFileId; }

      // Reset every open post (and its attached image) back to a single blank
      // post, mirroring QR.close()'s reset, so the trash icon clears posts and
      // images from the window, not just the saved draft.
      if (QR.nodes) {
        new QR.post(true);
        for (const post of QR.posts.splice(0, QR.posts.length - 1)) {
          post.delete();
        }
        $.rmClass(QR.nodes.el, 'dump');
        if (QR.selected) {
          QR.selected.setComment('');
          QR.selected.sub = null;
          if (QR.nodes.sub) { QR.nodes.sub.value = ''; }
        }
      }

      QR.drafts.clearBoardFiles();
      $.get('QR.drafts', dict(), ({ 'QR.drafts': all }) => {
        delete all[QR.drafts.key()];
        $.set('QR.drafts', all, QR.drafts.updateButton);
      });
    },

    // Remove every stored attachment for this board. Fails soft.
    async clearBoardFiles() {
      try {
        const prefix = QR.drafts.filePrefix();
        const mine = (await QRFileStore.keys()).filter(k => k.startsWith(prefix));
        if (mine.length) { await QRFileStore.delete(mine); }
      } catch (err) {
        console.error('QR draft clearBoardFiles failed', err);
      }
    },

    // Called when the setting is toggled. Turning it off wipes every saved
    // draft and stored attachment so nothing lingers in storage.
    // Cross-tab sync passes the new boolean value (Conf isn't updated for us);
    // the same-tab change event passes an Event, which we ignore since Conf is
    // already fresh from $.cb.checked.
    onSettingChanged(value?: any) {
      if (typeof value === 'boolean') { Conf['QR Drafts'] = value; }
      if (!Conf['QR Drafts']) {
        for (const p of (QR.posts || [])) { delete p._draftFileId; }
        QR.drafts.clearAll();
      }
      QR.drafts.updateButton();
    },

    // Remove all saved drafts (every thread), the discard bin, and all stored
    // attachments.
    async clearAll() {
      try {
        const keys = await QRFileStore.keys();
        if (keys.length) { await QRFileStore.delete(keys); }
      } catch (err) {
        console.error('QR draft clearAll failed', err);
      }
      $.delete('QR.drafts');
      $.delete(QR.drafts.BIN_KEY);
    },

    // ---- Discard bin -------------------------------------------------------
    // When a thread dies (or you discard manually) the unsent draft isn't
    // deleted outright — its TEXT/state (comment, spoiler, flag, target thread)
    // is moved here so a 404 or a misclick stays recoverable. Entries auto-purge
    // after BIN_TTL unless pinned. Attachments are deliberately NOT kept in the
    // bin: recovering a file to a dead thread is moot, and keeping blobs alive
    // across per-thread file cleanup is a lifecycle hazard — only the
    // hard-to-recreate text is preserved.

    getBin(cb: (bin: any[]) => void) {
      $.get(QR.drafts.BIN_KEY, [], (o) => cb(o[QR.drafts.BIN_KEY] || []));
    },

    // A short human label for a bin entry. Whether it reads as a new thread or
    // a reply comes from the post's target thread ('new' vs a number), not the
    // storage key — the key only records where it was composed.
    //   new thread:  "New thread /pol/ — first words…"
    //   reply:       "/g/ →12345 — first words…"
    binLabel(key: string, posts: any[]) {
      const board = key.split('/')[1];
      const primary = posts.find(p => p.com) || posts[0] || {};
      const target = primary.thread;
      const where = (target == null || target === 'new')
        ? `New thread /${board}/`
        : `/${board}/ →${target}`;
      const raw = (primary.com || '').replace(/\s+/g, ' ').trim();
      const snippet = raw ? ` — ${raw.slice(0, 36)}${raw.length > 36 ? '…' : ''}` : '';
      return `${where}${snippet}`;
    },

    // Reduce live/stored posts to the text-only shape the bin keeps (drop files
    // and empty posts).
    toBinPosts(posts: any[]) {
      return posts
        .map(p => ({ thread: p.thread, com: p.com || null, spoiler: p.spoiler ? true : undefined, flag: p.flag || undefined }))
        .filter(p => p.com);
    },

    // Append a bin entry for `key` from raw draft posts. No-op when there's no
    // text worth keeping.
    binPush(key: string, posts: any[], opts: { notify?: boolean } = {}) {
      const kept = QR.drafts.toBinPosts(posts);
      if (!kept.length) { return; }
      QR.drafts.getBin((bin) => {
        const entry = {
          id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          key, label: QR.drafts.binLabel(key, kept), posts: kept, ts: Date.now(), pinned: false,
        };
        bin.push(entry);
        $.set(QR.drafts.BIN_KEY, bin, () => {
          QR.drafts.updateButton();
          QR.drafts.renderPanel();
          if (opts.notify) { QR.drafts.notifyBinned(entry); }
        });
      });
    },

    // Move the stored draft for `key` (e.g. a dead thread's) into the bin, then
    // drop it and its now-unreferenced attachment blobs from storage.
    moveToBin(key: string, opts: { notify?: boolean } = {}) {
      if (!Conf['QR Drafts']) { return; }
      $.get('QR.drafts', dict(), ({ 'QR.drafts': all }) => {
        const data = all?.[key];
        if (!data?.posts?.length) { return; }
        delete all[key];
        $.set('QR.drafts', all, QR.drafts.updateButton);
        QR.drafts.deleteKeyFiles(key);
        QR.drafts.binPush(key, data.posts, opts);
      });
    },

    // Move what's currently typed in the QR to the bin, then clear the QR.
    binCurrent() {
      QR.selected?.forceSave();
      QR.drafts.binPush(QR.drafts.key(), QR.posts);
      QR.drafts.discard();
    },

    // Delete every stored attachment under `key`'s file prefix. Fails soft.
    async deleteKeyFiles(key: string) {
      try {
        const prefix = `${key} `;
        const mine = (await QRFileStore.keys()).filter(k => k.startsWith(prefix));
        if (mine.length) { await QRFileStore.delete(mine); }
      } catch (err) {
        console.error('QR draft deleteKeyFiles failed', err);
      }
    },

    // Toast shown when a dead thread's draft is binned, with a one-click Keep
    // that pins it past the auto-purge window.
    notifyBinned(entry: any) {
      const el = $.el('div');
      $.add(el, $.tn(`Thread died — your unsent draft (${entry.label}) was moved to the QR drafts bin. `));
      const keep = $.el('a', { href: 'javascript:;', textContent: 'Keep it' }) as HTMLAnchorElement;
      $.add(el, keep);
      $.add(el, $.tn(' so it won\'t auto-clear.'));
      const notice = new Notice('info', el, 30);
      $.on(keep, 'click', () => {
        QR.drafts.pinBinEntry(entry.id, true);
        keep.textContent = 'Kept ✓';
        keep.removeAttribute('href');
        setTimeout(() => notice.close(), 1200);
      });
    },

    pinBinEntry(id: string, pinned: boolean) {
      QR.drafts.getBin((bin) => {
        const entry = bin.find(e => e.id === id);
        if (!entry) { return; }
        entry.pinned = pinned;
        $.set(QR.drafts.BIN_KEY, bin, () => QR.drafts.renderPanel());
      });
    },

    // Drop expired (older than BIN_TTL, unpinned) entries. Runs on QR init.
    pruneBin() {
      QR.drafts.getBin((bin) => {
        const now = Date.now();
        const fresh = bin.filter(e => e.pinned || (now - e.ts) <= QR.drafts.BIN_TTL);
        if (fresh.length === bin.length) { return; }
        $.set(QR.drafts.BIN_KEY, fresh, QR.drafts.updateButton);
      });
    },

    deleteBinEntry(id: string) {
      QR.drafts.getBin((bin) => {
        const fresh = bin.filter(e => e.id !== id);
        if (fresh.length === bin.length) { return; }
        $.set(QR.drafts.BIN_KEY, fresh, () => { QR.drafts.updateButton(); QR.drafts.renderPanel(); });
      });
    },

    // Restore a bin entry's text into the (empty) Quick Reply, then drop it.
    restoreFromBin(id: string) {
      if (!QR.nodes) { return; }
      if (QR.posts.some(post => post.com || post.sub || post.file)) {
        new Notice('warning', 'Clear the Quick Reply first, then recover the draft.', 5);
        return;
      }
      QR.drafts.getBin((bin) => {
        const entry = bin.find(e => e.id === id);
        if (!entry?.posts?.length) { return; }
        for (let i = 0; i < entry.posts.length; i++) {
          const draft = entry.posts[i];
          const post = i === 0 ? QR.posts[0] : new QR.post();
          if (!post) { continue; }
          if (QR.drafts.threadValid(draft.thread)) { post.thread = draft.thread; }
          post.setComment(draft.com || '');
          if (draft.spoiler) {
            post.spoiler = true;
            if (post.nodes?.spoiler) { post.nodes.spoiler.checked = true; }
          }
          if (draft.flag) { post.flag = draft.flag; }
        }
        if (entry.posts.length > 1) { $.addClass(QR.nodes.el, 'dump'); }
        QR.selected?.load();
        QR.drafts.deleteBinEntry(id);
        QR.drafts.closePanel();
      });
    },

    // ThreadUpdate fires for the open thread; when it 404s/archives, bin its
    // draft (with a toast). The dead thread is the one we're viewing, so key()
    // already points at it.
    onThreadUpdate(e: any) {
      if (!Conf['QR Drafts'] || !e?.detail?.[404]) { return; }
      if (g.VIEW !== 'thread' || !g.threadID) { return; }
      QR.drafts.moveToBin(QR.drafts.key(), { notify: true });
    },

    // One-time move of pre-rename per-board drafts ({site/board}) into the bin
    // so nothing typed before the per-thread switch is silently lost. Legacy
    // attachment blobs (under the old 2-segment prefix) are dropped.
    migrateLegacy() {
      if (!Conf['QR Drafts']) { return; }
      $.get('QR.drafts', dict(), ({ 'QR.drafts': all }) => {
        const legacy = Object.keys(all || {}).filter(k => k.split('/').length === 2);
        if (!legacy.length) { return; }
        QR.drafts.getBin((bin) => {
          for (const key of legacy) {
            const posts = QR.drafts.toBinPosts(all[key]?.posts || []);
            if (posts.length) {
              bin.push({
                id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${key}`,
                key: `${key}/index`,
                label: QR.drafts.binLabel(`${key}/index`, posts),
                posts, ts: Date.now(), pinned: false,
              });
            }
            delete all[key];
            QR.drafts.deleteKeyFiles(key);
          }
          $.set('QR.drafts', all);
          $.set(QR.drafts.BIN_KEY, bin, QR.drafts.updateButton);
        });
      });
    },

    // ---- Drafts button + bin panel ----------------------------------------

    // The header drafts button (next to close): visible when the feature is on
    // and the 'Show QR Drafts Icon' setting is enabled, with a count badge when
    // the bin holds recoverable drafts.
    updateButton() {
      const btn = QR.nodes?.draftsButton;
      if (!btn) { return; }
      btn.hidden = !Conf['QR Drafts'] || Conf['Show QR Drafts Icon'] === false;
      if (!Conf['QR Drafts']) { return; }
      QR.drafts.getBin((bin) => {
        const badge = QR.nodes?.draftsBadge;
        if (badge) {
          badge.textContent = bin.length ? `${bin.length}` : '';
          badge.hidden = !bin.length;
        }
      });
    },

    togglePanel() {
      const panel = QR.nodes?.draftsPanel;
      if (!panel) { return; }
      if (panel.hidden) {
        panel.hidden = false;
        QR.drafts.renderPanel();
        // Close on the next click outside the panel or its button.
        setTimeout(() => $.on(d, 'mousedown', QR.drafts.onOutsideClick));
      } else {
        QR.drafts.closePanel();
      }
    },

    onOutsideClick(e: MouseEvent) {
      const panel = QR.nodes?.draftsPanel;
      const btn = QR.nodes?.draftsButton;
      const t = e.target as Node;
      if (panel && !panel.contains(t) && btn && !btn.contains(t)) { QR.drafts.closePanel(); }
    },

    closePanel() {
      if (QR.nodes?.draftsPanel) { QR.nodes.draftsPanel.hidden = true; }
      $.off(d, 'mousedown', QR.drafts.onOutsideClick);
    },

    // (Re)build the bin panel: a "discard current draft" action plus a list of
    // recoverable drafts, each with restore / pin / delete.
    renderPanel() {
      const panel = QR.nodes?.draftsPanel;
      if (!panel || panel.hidden) { return; }
      panel.textContent = '';

      const discard = $.el('a', {
        href: 'javascript:;', className: 'qr-drafts-discard',
        textContent: '🗑︎ Discard current draft',
        title: 'Move what\'s in the Quick Reply now to the bin',
      });
      $.on(discard, 'click', () => QR.drafts.binCurrent());
      $.add(panel, discard);

      QR.drafts.getBin((bin) => {
        if (QR.nodes?.draftsPanel !== panel || panel.hidden) { return; }
        const list = $.el('div', { className: 'qr-drafts-list' });
        if (!bin.length) {
          $.add(list, $.el('div', { className: 'qr-drafts-empty', textContent: 'No discarded drafts.' }));
        }
        // Most relevant first: this thread, then this board, then elsewhere —
        // newest-first within each tier. Nothing is hidden; the bin is a
        // recovery tool, so cross-context drafts must stay reachable.
        const curKey = QR.drafts.key();
        const curBoard = curKey.split('/').slice(0, 2).join('/');
        const rank = (e: any) => e.key === curKey ? 0 : (e.key.startsWith(`${curBoard}/`) ? 1 : 2);
        const ordered = bin.slice().sort((a, b) => rank(a) - rank(b) || b.ts - a.ts);
        for (const entry of ordered) {
          const row = $.el('div', { className: 'qr-drafts-row' });
          // The label is the recover affordance — clicking it loads the draft
          // back into the QR. Pin and delete stay as their own controls.
          const label = $.el('a', { href: 'javascript:;', className: 'qr-drafts-label', textContent: entry.label, title: 'Recover into Quick Reply' });
          const pin = $.el('a', { href: 'javascript:;', className: `qr-drafts-act${entry.pinned ? ' pinned' : ''}`, textContent: '📌', title: entry.pinned ? 'Pinned (won\'t auto-clear). Click to unpin.' : 'Keep past auto-clear' });
          const del = $.el('a', { href: 'javascript:;', className: 'qr-drafts-act', textContent: '✕', title: 'Delete permanently' });
          $.on(label, 'click', () => QR.drafts.restoreFromBin(entry.id));
          $.on(pin, 'click', () => QR.drafts.pinBinEntry(entry.id, !entry.pinned));
          $.on(del, 'click', () => QR.drafts.deleteBinEntry(entry.id));
          $.add(row, label);
          $.add(row, pin);
          $.add(row, del);
          $.add(list, row);
        }
        $.add(panel, list);
      });
    },
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
      if (!QR.nodes) { return; }

      // Build a dedicated persona chooser next to each field that has saved
      // personas for this board. We can't use a native <datalist> here: its
      // suggestions are filtered by the field's current text, so once the
      // `always` persona pre-fills a field the datalist only ever offers the
      // matching (always) value and hides the rest. A <select> always lists
      // every persona regardless of the field value, on every browser.
      for (const type of ['name', 'email', 'sub'] as const) {
        const input = QR.nodes[type] as HTMLInputElement;
        if (!input) { continue; }

        // Idempotent across re-loads (e.g. board changes): drop a stale picker.
        const stale = input.nextElementSibling as HTMLElement | null;
        if (stale && stale.classList.contains('qr-persona-picker')) { $.rm(stale); }

        const values = (QR.persona.types[type] || []).filter(Boolean);
        if (!values.length) { continue; }

        const picker = $.el('select', {
          className: 'qr-persona-picker',
          title: 'Choose a saved persona'
        }) as HTMLSelectElement;
        // Empty placeholder so the collapsed select just shows the arrow.
        $.add(picker, $.el('option', { value: '', textContent: '' }));
        for (const val of values) {
          $.add(picker, $.el('option', { value: val, textContent: val }));
        }
        $.on(picker, 'change', function (this: HTMLSelectElement) {
          if (!this.value) { return; }
          input.value = this.value;
          this.selectedIndex = 0;          // reset back to the placeholder arrow
          $.event('input', null, input);   // run the normal save / preview path
        });
        $.after(input, picker);
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
          name: post.name ?? '',
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
  // id of this post's attached file in QRFileStore (IndexedDB), when the draft
  // feature has persisted it. See QR.drafts.
  declare _draftFileId?: string;

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
      if (Conf['Dump List Remove File First'] && this.file) {
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
      // Priority: a user-configured "always" persona (QR.personas setting) wins; otherwise
      // carry the previous post's identity forward so name/trip stick across a session, the
      // same way vanilla 4chan's static form keeps the fields filled. If this is the first
      // queued post, fall back to the last manually used name from QR.persona.
      this.name  = 'name'  in QR.persona.always ? QR.persona.always.name  : (prev?.name ?? persona.name ?? '');
      // Carry the options field, but drop a bare "sage" so replies aren't accidentally saged.
      this.email = 'email' in QR.persona.always ? QR.persona.always.email : (/^sage$/i.test(prev?.email) ? '' : (prev?.email ?? ''));
      // Subject intentionally still clears after each post.
      this.sub   = 'sub'   in QR.persona.always ? QR.persona.always.sub   : '';

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
    QR.drafts.save();
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
    QR.refreshCommentPreview();
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
      QR.refreshCommentPreview();
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

  async setFile(file: File, opts: { restore?: boolean; id?: string; filename?: string; originalName?: string } = {}) {
    this.pendingFile = true;
    // A fresh user-supplied file invalidates any previously persisted copy so
    // it gets re-saved; a restored file keeps its existing store id (set below).
    if (!opts.restore) { delete this._draftFileId; }
    try {
      // On restore the file was already audio-stripped/renamed when first added,
      // so skip that reprocessing (and its notices).
      if (
        !opts.restore &&
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

      // Needs to be set before the validation for some error messages.
      this.file = file;
      this.filename = file.name;
      this.originalName = file.name;

      this.file = await this.validateFile(file);
      this.originalName = opts.restore ? (opts.originalName || file.name) : file.name;
      if (opts.restore) {
        this.filename = opts.filename || this.file.name;
      } else if (Conf['Randomize Filename'] && (g.BOARD.ID !== 'f') && (!this.file.name.toLowerCase().includes('[sound='))) {
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
      if (opts.restore) {
        // Reuse the existing store entry; nothing new to write.
        this._draftFileId = opts.id;
      } else {
        // New attachment: persist it (and the draft) if the feature is on.
        QR.drafts.persistFiles();
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
    delete this._draftFileId;
    QR.drafts.persistFiles();
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
