import { Conf, d, g } from "../globals/globals";
import $ from "../platform/$";
import QR from "./QR";
import { stepHorizontal, stepVertical } from "./CaptchaKeyNav";
import { applyCaptchaStyleClass, captchaNarration, normalizeCaptchaStyle, type CaptchaStyle } from "./CaptchaStyles";
import { svgPathData as circleSvg, width as circleW, height as circleH } from "@fas/faCircle";
import { svgPathData as circleCheckSvg, width as circleCheckW, height as circleCheckH } from "@fas/faCircleCheck";
import { svgPathData as circleExclamationSvg, width as circleExclamationW, height as circleExclamationH } from "@fas/faCircleExclamation";
import { svgPathData as circleNotchSvg, width as circleNotchW, height as circleNotchH } from "@fas/faCircleNotch";
import { svgPathData as circleXmarkSvg, width as circleXmarkW, height as circleXmarkH } from "@fas/faCircleXmark";

type CaptchaState = 'idle' | 'loading' | 'ready' | 'complete' | 'failed' | 'expired';

const getTCaptcha = () => window.TCaptcha || (window as any).wrappedJSObject?.TCaptcha || (typeof unsafeWindow !== 'undefined' ? unsafeWindow.TCaptcha : undefined); // loose: vendor global wrappedJSObject

const captchaStatusIcon = (svgPathData: string, width: string | number, height: string | number) => (
  `<svg xmlns="http://www.w3.org/2000/svg" class="fourchanx-captcha-status-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true">` +
    `<path d="${svgPathData}" fill="currentColor" />` +
  `</svg>`
);

const captchaStatusIcons = {
  idle: captchaStatusIcon(circleSvg, circleW, circleH),
  loading: captchaStatusIcon(circleNotchSvg, circleNotchW, circleNotchH),
  complete: captchaStatusIcon(circleCheckSvg, circleCheckW, circleCheckH),
  failed: captchaStatusIcon(circleXmarkSvg, circleXmarkW, circleXmarkH),
  expired: captchaStatusIcon(circleExclamationSvg, circleExclamationW, circleExclamationH),
};

const CaptchaT = {
  init() {
    if (d.cookie.indexOf('pass_enabled=1') >= 0) { return; }
    if (!(this.isEnabled = !!$('#t-root') || !$.id('postForm'))) { return; }

    const root = $.el('div', {className: 'captcha-root'});
    root.tabIndex = -1;
    this.nodes = {root};

    $.addClass(QR.nodes.el, 'has-captcha', 'captcha-t');
    $.after(QR.nodes.com.parentNode, root);
  },

  moreNeeded() {},

  getThread() {
    return {
      boardID: g.BOARD!.ID,
      threadID: QR.posts[0].thread === 'new' ? '0' : ('' + QR.posts[0].thread),
    };
  },

  setup(focus?: boolean, force?: boolean) { // loose: force unused here, kept for union-compat with Captcha.v2.setup
    if (!this.isEnabled) { return; }
    const TCaptcha = getTCaptcha();
    if (!TCaptcha?.init) {
      QR.error('Captcha unavailable. Reload the page and try again.');
      return;
    }
    this.patchFormatter(TCaptcha);
    this.setStacked(!!Conf['Stacked TCaptcha'], TCaptcha);

    if (!this.nodes.container) {
      this.nodes.container = $.el('div', {className: 'captcha-container'});
      $.prepend(this.nodes.root, this.nodes.container);
      this.currentThread = this.getThread();
      TCaptcha.init(this.nodes.container, this.currentThread.boardID, +this.currentThread.threadID);
      this.setStacked(!!Conf['Stacked TCaptcha'], TCaptcha);
      TCaptcha.setErrorCb?.(() => {});
      if (Conf['Auto-load captcha']) {
        TCaptcha.load(this.currentThread.boardID, this.currentThread.threadID);
        this.setState('loading');
      }
    } else if (Conf['Auto-load captcha'] && Conf['Stacked TCaptcha']) {
      $('#t-load', this.nodes.container)?.click();
      this.setState('loading');
    }

    this.ensureLoadButtonHook();
    this.ensureQrFocusHook();
    this.ensureStatusNode();
    this.ensureProgressNode();
    this.ensureCrumbsNode();
    this.ensureStyleChangeHook();
    if (!this.cachedButtons?.length) {
      this.setState('idle');
      this.updateProgress();
    }
    this.startThemeObservers();
    this.applyAdaptiveTextColors();

    if (focus) { $('#t-resp')?.focus(); }
  },

  destroy() {
    if (!this.isEnabled || !this.nodes.container) { return; }
    getTCaptcha()?.destroy?.();
    $.rm(this.nodes.container);
    delete this.nodes.container;
    this.cachedButtons = [];
    this.currentHighlightIndex = -1;
    this.crumbHighlightIndex = -1;
    this.answerHistory = [];
    this.editingIndex = null;
    this.pendingSubmitIntent = false;
    this.stopThemeObservers();
    this.setState('idle');
  },

  updateThread() {
    if (!this.isEnabled) { return; }
    const {boardID, threadID} = (this.currentThread || {});
    const next = this.getThread();
    if ((next.boardID !== boardID) || (next.threadID !== threadID)) {
      this.destroy();
      this.setup();
    }
  },

  parseCssColor(value: string | null | undefined) {
    const match = /rgba?\(([^)]+)\)/i.exec(value || '');
    if (!match) { return null; }
    const parts = match[1].split(',').map(part => part.trim());
    if (parts.length < 3) { return null; }
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const a = parts[3] == null ? 1 : Number(parts[3]);
    if ([r, g, b, a].some(Number.isNaN)) { return null; }
    return { r, g, b, a };
  },

  getBackgroundColor(node: Element | null) {
    for (let el: Element | null = node; el; el = el.parentElement) {
      const color = this.parseCssColor(getComputedStyle(el).backgroundColor);
      if (color && color.a > 0) { return color; }
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  },

  luminance({ r, g, b }: { r: number; g: number; b: number }) {
    const toLinear = (channel: number) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  },

  contrast(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
    const la = this.luminance(a);
    const lb = this.luminance(b);
    const [max, min] = la > lb ? [la, lb] : [lb, la];
    return (max + 0.05) / (min + 0.05);
  },

  pickReadableTextColor(node: Element | null) {
    const bg = this.getBackgroundColor(node);
    const light = { r: 245, g: 245, b: 245 };
    const dark = { r: 17, g: 17, b: 17 };
    return this.contrast(light, bg) >= this.contrast(dark, bg) ? 'rgb(245, 245, 245)' : 'rgb(17, 17, 17)';
  },

  applyAdaptiveTextColors() {
    const container = this.nodes?.container;
    if (!container) { return; }

    for (const el of container.querySelectorAll('#t-load, #t-next')) {
      const color = this.pickReadableTextColor(el);
      el.style.setProperty('color', color, 'important');
      el.style.setProperty('-webkit-text-fill-color', color, 'important');
    }

    for (const el of container.querySelectorAll('#t-msg, #t-desc, #t-task, .fourchanx-captcha-load-hint, .fourchanx-captcha-status-text, .fourchanx-captcha-progress, .fourchanx-captcha-crumb')) {
      const color = this.pickReadableTextColor(el);
      el.style.setProperty('color', color, 'important');
      el.style.setProperty('-webkit-text-fill-color', color, 'important');
    }
  },

  scheduleAdaptiveTextColors() {
    if (this.adaptiveColorRaf) { return; }
    this.adaptiveColorRaf = requestAnimationFrame(() => {
      this.adaptiveColorRaf = 0;
      this.applyAdaptiveTextColors();
    });
    // Theme scripts often update classes first, then apply final CSS a tick later.
    // Run a short settle burst so contrast is correct on the first click.
    this.themeSettleTimers ||= [];
    for (const delay of [0, 40, 120]) {
      this.themeSettleTimers.push(setTimeout(() => this.applyAdaptiveTextColors(), delay));
    }
  },

  startThemeObservers() {
    if (this.themeObserver) { return; }
    const onChange = () => this.scheduleAdaptiveTextColors();

    this.themeObserver = new MutationObserver(onChange);
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    if (document.body) {
      this.themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }

    this.headObserver = new MutationObserver(onChange);
    this.headObserver.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true
    });

    this.prefersDarkQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (this.prefersDarkQuery?.addEventListener) {
      this.prefersDarkListener = onChange;
      this.prefersDarkQuery.addEventListener('change', this.prefersDarkListener);
    }
  },

  stopThemeObservers() {
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    this.headObserver?.disconnect();
    this.headObserver = null;
    if (this.prefersDarkQuery?.removeEventListener && this.prefersDarkListener) {
      this.prefersDarkQuery.removeEventListener('change', this.prefersDarkListener);
    }
    this.prefersDarkListener = null;
    this.prefersDarkQuery = null;
    if (this.adaptiveColorRaf) {
      cancelAnimationFrame(this.adaptiveColorRaf);
      this.adaptiveColorRaf = 0;
    }
    if (this.themeSettleTimers?.length) {
      for (const timer of this.themeSettleTimers) {
        clearTimeout(timer);
      }
      this.themeSettleTimers = [];
    }
  },

  getOne() {
    if (!this.nodes.container) { return null; }

    const response = $(`[name='t-response']`, this.nodes.container)?.value?.trim();
    const challenge = $(`[name='t-challenge']`, this.nodes.container)?.value?.trim();

    if (response) {
      if (!challenge) { return null; }
      return {
        't-response': response,
        't-challenge': challenge,
      };
    }

    let isVerificationNotRequired = false;
    for (const el of this.nodes.container.querySelectorAll('#t-msg, #t-task, #t-desc, .fourchanx-captcha-load-hint, .fourchanx-captcha-status-text')) {
      if (/Verification not required/i.test(el.textContent || '')) {
        isVerificationNotRequired = true;
        break;
      }
    }
    if (!isVerificationNotRequired || !challenge) { return null; }

    // Keep the challenge token for "verification not required" submissions.
    return {
      't-response': '',
      't-challenge': challenge,
    };

  },

  setUsed() {
    if (this.isEnabled && this.nodes.container) {
      getTCaptcha()?.clearChallenge?.();
      this.setState('idle');
      this.updateProgress();
    }
  },

  forceLoad() {
    if (!this.isEnabled || !this.nodes.container) { return; }
    const TCaptcha = getTCaptcha();
    if (!TCaptcha?.load) { return; }
    this.currentThread = this.getThread();
    TCaptcha.saveTicket?.(false);
    TCaptcha.clearChallenge?.();
    TCaptcha.load(this.currentThread.boardID, this.currentThread.threadID);
    this.setState('loading');
  },

  occupied() {
    return !!this.nodes.container;
  },

  setState(state: CaptchaState) {
    const root = $('#qr');
    if (!root) { return; }
    for (const name of ['idle', 'loading', 'ready', 'complete', 'failed', 'expired']) {
      root.classList.remove(`captcha-t-state-${name}`);
    }
    root.classList.add(`captcha-t-state-${state}`);
    const container = this.nodes?.container;
    if (!container) { return; }
    const borderColors = {
      idle: '#8ca0b5',
      loading: '#6f93b8',
      ready: '#8ca0b5',
      complete: '#2c9c47',
      failed: '#cf4a4a',
      expired: '#d0a64d',
    };
    const showBorder = state === 'failed' || state === 'expired' ||
      (state === 'complete' && this.currentStyle() === 'classic');
    const borderColor = borderColors[state] || borderColors.idle;
    const loadButton = $('#t-load', container);
    container.style.border = '2px solid transparent';
    container.style.borderRadius = '4px';
    container.style.transition = 'border-color .2s ease';
    if (loadButton) {
      loadButton.style.border = showBorder ? `2px solid ${borderColor}` : '';
      loadButton.style.borderRadius = '4px';
      loadButton.style.transition = 'border-color .2s ease';
      loadButton.style.opacity = showBorder ? '1' : '';
    }
    this.setStatusMessage({
      idle: '',
      loading: '',
      ready: '',
      complete: captchaNarration(this.currentStyle(), 'complete'),
      failed: 'Failed.',
      expired: 'Expired.',
    }[state] || '', state);
    this.applyAdaptiveTextColors();
  },

  ensureLoadButtonHook() {
    const container = this.nodes?.container;
    if (!container) { return; }
    const loadButton = $('#t-load', container);
    if (!loadButton || loadButton.dataset.fourchanxHooked) { return; }
    loadButton.addEventListener('click', () => this.setState('loading'));
    loadButton.dataset.fourchanxHooked = '1';
  },

  ensureQrFocusHook() {
    const qr = $('#qr');
    if (!qr || qr.dataset.fourchanxCaptchaFocusHook) { return; }
    qr.dataset.fourchanxCaptchaFocusHook = '1';
    qr.addEventListener('click', (e: MouseEvent) => {
      if (!(e.target instanceof Element)) { return; }
      if (!this.nodes?.root || !this.nodes.container) { return; }
      if (this.nodes.root.contains(e.target)) {
        if (e.target.closest('input, textarea, select, [contenteditable]')) { return; }
        this.nodes.root.focus({preventScroll: true});
        return;
      }
      if (e.target.closest('input, textarea, select, button, a, label, [contenteditable]')) { return; }
      if (!this.cachedButtons?.length && !this.reviewCrumbs().length) { return; }
      this.nodes.root.focus({preventScroll: true});
    });
  },

  ensureStyleChangeHook() {
    if (this.styleChangeHooked) { return; }
    this.styleChangeHooked = true;
    $.on(d, 'StackedCaptchaStyleChanged', () => {
      const TCaptcha = getTCaptcha();
      if (!this.isEnabled || !TCaptcha || !this.nodes?.container) { return; }
      this.setStacked(!!Conf['Stacked TCaptcha'], TCaptcha);
      if (!Conf['Stacked TCaptcha']) { return; }
      if (TCaptcha.tasks?.length && TCaptcha.taskId >= TCaptcha.tasks.length) {
        this.showReview(TCaptcha);
      } else {
        this.renderCrumbs(TCaptcha);
      }
    });
  },

  qrHasFocus() {
    const qr = $('#qr');
    const ae = document.activeElement;
    return !!(qr && ae && ae !== document.body && qr.contains(ae));
  },

  restoreFocus() {
    if (this.qrHasFocus()) { return; }
    this.nodes?.root?.focus?.({preventScroll: true});
  },

  ensureStatusNode() {
    const container = this.nodes?.container;
    if (!container) { return; }
    const ctrl = $('#t-ctrl', container);
    const loadButton = $('#t-load', container);
    if (!ctrl || !loadButton || $('.fourchanx-captcha-load-hint', ctrl)) { return; }
    const hint = $.el('span', {
      className: 'fourchanx-captcha-load-hint'
    });
    loadButton.after(hint);
  },

  setStatusMessage(text: string, state: CaptchaState = 'idle') {
    const container = this.nodes?.container;
    if (!container) { return; }
    const statusNode = $('.fourchanx-captcha-load-hint', container);
    if (!statusNode) { return; }
    for (const name of ['idle', 'loading', 'ready', 'complete', 'failed', 'expired']) {
      statusNode.classList.remove(`state-${name}`);
    }

    if (!text) {
      statusNode.replaceChildren();
      return;
    }

    statusNode.classList.add(`state-${state}`);
    statusNode.replaceChildren();

    const icon = captchaStatusIcons[state as keyof typeof captchaStatusIcons];
    if (icon) {
      const iconNode = $.el('span', {
        className: `fourchanx-captcha-status-icon state-${state}`,
        title: this.plainStatusMessage(text)
      });
      iconNode.innerHTML = icon;
      statusNode.appendChild(iconNode);
    }

    const message = $.el('span', {
      className: 'fourchanx-captcha-status-text'
    });
    this.appendStatusMessage(message, text);
    statusNode.appendChild(message);
    this.applyAdaptiveTextColors();
  },

  decodeStatusMessage(text: string) {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = `${text || ''}`;
    return decoder.value;
  },

  plainStatusMessage(text: string) {
    const html = document.createElement('div');
    html.innerHTML = this.decodeStatusMessage(text);
    return html.textContent || '';
  },

  appendStatusMessage(parent: Node, text: string) {
    const html = document.createElement('div');
    html.innerHTML = this.decodeStatusMessage(text);

    const appendSafe = (node: ChildNode) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.appendChild(document.createTextNode(node.textContent || ''));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) { return; }
      const elNode = node as Element;

      if (elNode.localName === 'a') {
        const href = elNode.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href)) {
          const link = document.createElement('a');
          link.href = href;
          link.target = '_blank';
          link.rel = 'noopener';
          link.textContent = node.textContent || href;
          parent.appendChild(link);
          return;
        }
      }

      parent.appendChild(document.createTextNode(node.textContent || ''));
    };

    for (const node of Array.from(html.childNodes)) {
      appendSafe(node);
    }
  },

  messageStateFromText(text: string): CaptchaState {
    const plain = this.plainStatusMessage(text).toLowerCase();
    if (/expired/.test(plain)) { return 'expired'; }
    if (/done|verification not required/.test(plain)) { return 'complete'; }
    if (/error|failed|couldn\'t|mistyped|malfunctioned/.test(plain)) { return 'failed'; }
    if (/loading/.test(plain)) { return 'loading'; }
    return 'idle';
  },

  formatTaskMessage(text: string, state: CaptchaState) {
    const icon = captchaStatusIcons[state as keyof typeof captchaStatusIcons] || captchaStatusIcons.idle;
    return `<div id="t-desc" class="tcaptcha-message state-${state}">` +
      `<span class="tcaptcha-message-icon" aria-hidden="true">${icon}</span>` +
      `<span class="tcaptcha-message-text">${text || ''}</span>` +
    `</div>`;
  },

  ensureProgressNode() {
    const container = this.nodes?.container;
    if (!container) { return; }
    const ctrl = $('#t-ctrl', container);
    if (!ctrl || $('.fourchanx-captcha-progress', ctrl)) { return; }
    const progress = $.el('span', {
      className: 'fourchanx-captcha-progress'
    });
    $.add(ctrl, progress);
  },

  updateProgress(TCaptcha?: any) { // loose: vendor TCaptcha global is typed any
    const container = this.nodes?.container;
    if (!container) { return; }
    const progress = $('.fourchanx-captcha-progress', container);
    if (!progress) { return; }
    const tasks = TCaptcha?.tasks;
    if (!tasks?.length || !isFinite(TCaptcha?.taskId)) {
      progress.textContent = '';
      return;
    }
    const current = Math.min(TCaptcha.taskId + 1, tasks.length);
    progress.textContent = `${current}/${tasks.length}`;
  },

  formatDescription(str: string) {
    if (!str) { return ''; }
    return str
      .replace(/Use the scroll bar below to\s*|,\s*then click next\.?/gi, '')
      .replace(/(?:^|>)\s*([a-z])/i, (m: string) => m.toUpperCase()) + '.';
  },

  updateHighlight() {
    this.cachedButtons ||= [];
    this.cachedButtons.forEach((btn: HTMLElement, index: number) => {
      const isActive = index === this.currentHighlightIndex;
      btn.classList.toggle('active', isActive);
      if (isActive) {
        btn.scrollIntoView({block: 'nearest'});
      }
    });
  },

  reviewCrumbs(): HTMLElement[] {
    const container = this.nodes?.container;
    if (!container) { return []; }
    return Array.from(container.querySelectorAll('.fourchanx-captcha-crumb'));
  },

  updateCrumbHighlight() {
    this.reviewCrumbs().forEach((chip: HTMLElement, index: number) => {
      const isActive = index === this.crumbHighlightIndex;
      chip.classList.toggle('active', isActive);
      if (isActive) {
        chip.scrollIntoView({block: 'nearest'});
      }
    });
  },

  initializeEventHandler(container: HTMLElement | null, TCaptcha: any) { // loose: vendor TCaptcha global is typed any
    if (!container || container.dataset.hasFourChanXStackedClick) { return; }
    container.addEventListener('click', (e: MouseEvent) => {
      if (!(e.target instanceof Element)) { return; }
      const button = e.target.closest('.tcaptcha-image');
      if (!button || !this.cachedButtons?.length) { return; }
      const index = this.cachedButtons.indexOf(button);
      if (index !== -1) {
        this.submitCaptchaAnswer(index, TCaptcha);
      }
    });
    container.dataset.hasFourChanXStackedClick = '1';
  },

  createImageGrid(TCaptcha: any) { // loose: vendor TCaptcha global is typed any
    const container = $('#t-task', this.nodes.container);
    const task = TCaptcha.getCurrentTask?.();
    if (!TCaptcha.node || !container || !task) { return; }
    const hadFocus = this.qrHasFocus();
    this.setState('ready');
    this.updateProgress(TCaptcha);

    TCaptcha.node.style.height = 'auto';
    TCaptcha.node.style.overflow = 'visible';

    let descriptionHTML = '';
    if (task.img) {
      descriptionHTML = `<div id="t-desc"><img src="data:image/png;base64,${task.img}" alt=""></div>`;
    } else if (task.str) {
      descriptionHTML = `<div id="t-desc">${this.formatDescription(task.str)}</div>`;
    } else {
      descriptionHTML = '<div id="t-desc"></div>';
    }

    const imageHTMLs = (task.items || []).map((bitmap: string) =>
      `<button type="button" class="tcaptcha-image">
        <img src="data:image/png;base64,${bitmap}" alt="">
      </button>`
    ).join('');

    container.innerHTML = descriptionHTML + imageHTMLs;

    this.cachedButtons = Array.from(container.querySelectorAll('.tcaptcha-image'));
    this.currentHighlightIndex = -1;
    this.crumbHighlightIndex = -1;
    this.initializeEventHandler(container, TCaptcha);
    TCaptcha.taskNode = container;
    this.ensureCrumbsNode();
    this.renderCrumbs(TCaptcha);
    this.applyAdaptiveTextColors();
    if (hadFocus) { this.restoreFocus(); }
  },

  // True once we've fired an auto-submit for the current captcha state, so the
  // solved-challenge path and the "verification not required" path can't both
  // submit the same post. Cleared whenever the captcha leaves the complete state.
  _autoSubmitted: false,
  pendingSubmitIntent: false,
  // loose: late-assigned singleton state
  isEnabled: false,
  nodes: null as any,
  answerHistory: null as any,
  editingIndex: null as any,
  cachedButtons: null as any,
  currentHighlightIndex: -1 as number,
  crumbHighlightIndex: -1 as number,
  currentThread: null as any,
  adaptiveColorRaf: 0 as any,
  themeSettleTimers: null as any,
  themeObserver: null as any,
  headObserver: null as any,
  prefersDarkQuery: null as any,
  prefersDarkListener: null as any,
  keyHandlerInstalled: false,
  formatterPatched: false,
  styleChangeHooked: false,

  // Auto-submit the post when "Post on Captcha Completion" is on and the captcha
  // is satisfied -- whether that's a solved challenge or 4chan reporting that no
  // verification is required. Only fires when the QR actually has something to
  // post (a real comment or a file), so an auto-loaded "not required" on an
  // empty QR -- or one holding only an inserted quote -- doesn't submit.
  maybeAutoSubmit() {
    if (this._autoSubmitted) { return false; }
    if (QR.cooldown.auto) { return false; }
    if (!this.pendingSubmitIntent) {
      if (!Conf['Post on Captcha Completion']) { return false; }
      // Only auto-submit a "no captcha required" when the user loaded the captcha
      // themselves. With Auto-load on, the captcha loads on QR open, so a "not
      // required" there would fire a restored draft nobody asked to send -- skip it.
      // (Auto-load off => the captcha only loads on a manual "get captcha" click,
      // which is the user signalling intent to post.) Solving an actual challenge
      // submits via submitCaptchaAnswer regardless of this. A pending submit intent
      // (Submit pressed with no captcha loaded) bypasses both checks -- the user
      // already asked to post.
      if (Conf['Auto-load captcha']) { return false; }
    }
    const post = QR.posts?.[0];
    const com = (QR.nodes?.com?.value || '').trim();
    const quoted = (post?.quotedText || '').trim();
    // Don't fire on an empty/quote-only QR (e.g. an accidental get-captcha click).
    const hasContent = (com.length > 0 && com !== quoted) || !!post?.file;
    if (!hasContent) { return false; }
    this._autoSubmitted = true;
    this.pendingSubmitIntent = false;
    QR.submit();
    return true;
  },

  submitCaptchaAnswer(imageNumber: number, TCaptcha: any) { // loose: vendor TCaptcha global is typed any
    if (!TCaptcha?.respNode || !TCaptcha.tasks || imageNumber < 0) { return; }
    const lastIndex = TCaptcha.tasks.length - 1;
    if (lastIndex < 0) { return; }

    // Store the pick per-task (not by blind concatenation) so any one answer
    // can be re-edited later, then rebuild the response string from truth.
    (this.answerHistory ||= [])[TCaptcha.taskId] = imageNumber;
    TCaptcha.respNode.value = this.answerHistory.join('');

    // Re-editing a single step: apply it, then go to review only if every task
    // is now answered, otherwise resume at the next unanswered task.
    if (this.editingIndex != null) {
      this.closeEdit(TCaptcha);
      return;
    }

    const nextId = TCaptcha.taskId + 1;
    if (nextId <= lastIndex) {
      TCaptcha.setTaskId(nextId);
      this.createImageGrid(TCaptcha);
    } else if ((Conf['Post on Captcha Completion'] || this.pendingSubmitIntent) && !QR.cooldown.auto) {
      // Claim the one-shot before the 'Done.' message below: that text also maps
      // to the 'complete' state and would otherwise trigger maybeAutoSubmit too.
      this._autoSubmitted = true;
      this.pendingSubmitIntent = false;
      TCaptcha.taskId = TCaptcha.tasks.length;
      TCaptcha.setTaskNodeContent('Done.');
      this.setState('complete');
      this.updateProgress(TCaptcha);
      this.cachedButtons = [];
      this.currentHighlightIndex = -1;
      QR.submit();
    } else {
      // Land on an editable review screen instead of a dead-end "Done."
      this.showReview(TCaptcha);
    }
  },

  answeredCount() {
    const h = this.answerHistory || [];
    let n = 0;
    while (n < h.length && h[n] != null) { n++; }
    return n;
  },

  currentStyle(): CaptchaStyle {
    return normalizeCaptchaStyle(Conf['Stacked TCaptcha Style']);
  },

  // Pick the best image to represent a task as a chip: the challenge image,
  // else the reference image embedded in the prompt, else the picked tile.
  taskChipImage(task: any, selectedIndex: number | null) { // loose: vendor TCaptcha task object is typed any
    if (!task) { return null; }
    if (task.img) { return `data:image/png;base64,${task.img}`; }
    if (typeof task.str === 'string' && /<img/i.test(task.str)) {
      const re = /<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
      let match, last = null;
      while ((match = re.exec(task.str))) { last = match[1]; }
      if (last) { return last; }
    }
    const bitmap = selectedIndex != null ? task.items?.[selectedIndex] : null;
    return bitmap ? `data:image/png;base64,${bitmap}` : null;
  },

  editAnswer(index: number, TCaptcha: any) { // loose: vendor TCaptcha global is typed any
    if (!TCaptcha?.tasks || this.answerHistory?.[index] == null) { return; }
    // Toggle: clicking the chip you're already editing closes it again.
    if (this.editingIndex === index) {
      this.closeEdit(TCaptcha);
      return;
    }
    this.editingIndex = index;
    TCaptcha.setTaskId(index);
    this.createImageGrid(TCaptcha);
    // Highlight the tile previously chosen for this task.
    this.currentHighlightIndex = this.answerHistory[index];
    this.updateHighlight();
    this.renderCrumbs(TCaptcha);
  },

  // Leave edit mode: show review if every task is answered, else resume solving.
  closeEdit(TCaptcha: any) { // loose: vendor TCaptcha global is typed any
    const edited = this.editingIndex;
    this.editingIndex = null;
    const answered = this.answeredCount();
    if (answered > TCaptcha.tasks.length - 1) {
      this.showReview(TCaptcha);
      if (edited != null) {
        this.crumbHighlightIndex = edited;
        this.updateCrumbHighlight();
      }
    } else {
      TCaptcha.setTaskId(answered);
      this.createImageGrid(TCaptcha);
    }
  },

  showReview(TCaptcha: any) { // loose: vendor TCaptcha global is typed any
    if (!TCaptcha?.tasks?.length) { return; }
    const hadFocus = this.qrHasFocus();
    TCaptcha.taskId = TCaptcha.tasks.length;
    this.editingIndex = null;
    this.cachedButtons = [];
    this.currentHighlightIndex = -1;
    this.crumbHighlightIndex = -1;
    this.setState('complete');
    const taskNode = $('#t-task', this.nodes.container);
    if (taskNode) { taskNode.replaceChildren(); }
    this.setStatusMessage(captchaNarration(this.currentStyle(), 'review'), 'complete');
    this.updateProgress(TCaptcha);
    this.ensureCrumbsNode();
    this.renderCrumbs(TCaptcha);
    this.applyAdaptiveTextColors();
    if (hadFocus) { this.restoreFocus(); }
  },

  ensureCrumbsNode() {
    const container = this.nodes?.container;
    if (!container) { return; }
    const ctrl = $('#t-ctrl', container);
    if (!ctrl || $('.fourchanx-captcha-crumbs', ctrl)) { return; }
    $.add(ctrl, $.el('span', {className: 'fourchanx-captcha-crumbs'}));
  },

  renderCrumbs(TCaptcha: any) { // loose: vendor TCaptcha global is typed any
    const container = this.nodes?.container;
    if (!container) { return; }
    const crumbs = $('.fourchanx-captcha-crumbs', container);
    if (!crumbs) { return; }
    const hadFocus = this.qrHasFocus();
    crumbs.replaceChildren();

    const style = this.currentStyle();
    const history = this.answerHistory || [];
    const answeredCount = this.answeredCount();
    const tasksLen = TCaptcha?.tasks?.length || 0;
    if (!answeredCount || !tasksLen) {
      if (hadFocus) { this.restoreFocus(); }
      return;
    }

    // Show a chip per answered task, plus the one currently being solved.
    const upTo = Math.min(Math.max(answeredCount - 1, TCaptcha.taskId), tasksLen - 1);
    for (let i = 0; i <= upTo; i++) {
      const answered = history[i] != null;
      const chip = $.el('button', {
        type: 'button',
        className: 'fourchanx-captcha-crumb',
      });
      // Represent the task with its challenge/reference image; fall back to the
      // step number (e.g. the step still being solved, or if no image exists).
      const src = this.taskChipImage(TCaptcha.tasks?.[i], answered ? history[i] : null);
      if (style === 'dots') {
        chip.classList.add('fourchanx-captcha-crumb--dot');
        if (answered) { chip.classList.add('answered'); }
        if (src) {
          const pop = $.el('span', {className: 'fourchanx-captcha-dot-pop'});
          pop.appendChild($.el('img', {src, alt: ''}));
          chip.appendChild(pop);
        }
      } else if (src) {
        chip.appendChild($.el('img', {src, alt: ''}));
      } else {
        chip.textContent = `${i + 1}`;
        chip.classList.add('numbered');
      }
      if (i === this.editingIndex) {
        chip.classList.add('editing');
        chip.title = `Click to stop editing answer ${i + 1}`;
        chip.addEventListener('click', () => this.editAnswer(i, TCaptcha));
      } else if (this.editingIndex == null && i === TCaptcha.taskId && !answered) {
        chip.classList.add('current');
        chip.title = `Solving step ${i + 1}`;
      } else if (answered) {
        chip.title = `Click to change answer ${i + 1}`;
        chip.addEventListener('click', () => this.editAnswer(i, TCaptcha));
      }
      if (i === this.crumbHighlightIndex) {
        chip.classList.add('active');
      }
      crumbs.appendChild(chip);
    }
    if (hadFocus) { this.restoreFocus(); }
  },

  installStackedKeyHandler(TCaptcha: any) { // loose: vendor TCaptcha global is typed any
    if (this.keyHandlerInstalled) { return; }
    this.keyHandlerInstalled = true;
    window.addEventListener('keydown', e => {
      if (!TCaptcha.__fourchanXStackedEnabled) { return; }
      if (!this.nodes?.container || !document.body.contains(this.nodes.container)) { return; }

      const qr = $('#qr');
      const ae = document.activeElement as HTMLElement | null;
      const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
      if (typing || !qr || !ae || !qr.contains(ae)) { return; }

      const swallow = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      const tiles: HTMLElement[] = this.cachedButtons || [];
      if (tiles.length) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          swallow();
          this.currentHighlightIndex = stepHorizontal(this.currentHighlightIndex, e.key === 'ArrowRight' ? 1 : -1, tiles.length);
          this.updateHighlight();
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          swallow();
          const positions = tiles.map(btn => ({top: btn.offsetTop, left: btn.offsetLeft}));
          this.currentHighlightIndex = stepVertical(positions, this.currentHighlightIndex, e.key === 'ArrowDown' ? 1 : -1);
          this.updateHighlight();
          return;
        }
        if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
          const index = +e.key - 1;
          if (index < tiles.length) {
            swallow();
            this.submitCaptchaAnswer(index, TCaptcha);
          }
          return;
        }
        if (e.key === 'Enter' && this.currentHighlightIndex >= 0) {
          swallow();
          this.submitCaptchaAnswer(this.currentHighlightIndex, TCaptcha);
          return;
        }
        if (e.key === 'Escape' && this.editingIndex != null) {
          swallow();
          this.closeEdit(TCaptcha);
          return;
        }
      } else {
        const crumbs = this.reviewCrumbs();
        if (crumbs.length) {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            swallow();
            this.crumbHighlightIndex = stepHorizontal(this.crumbHighlightIndex, e.key === 'ArrowRight' ? 1 : -1, crumbs.length);
            this.updateCrumbHighlight();
            return;
          }
          if (e.key === 'Enter' && this.crumbHighlightIndex >= 0) {
            swallow();
            this.editAnswer(this.crumbHighlightIndex, TCaptcha);
            return;
          }
        }
      }

      if (e.key === 'Backspace' && this.answerHistory?.length) {
        const ref = this.editingIndex != null ? this.editingIndex : TCaptcha.taskId;
        const target = ref - 1;
        if (target >= 0 && this.answerHistory[target] != null) {
          swallow();
          this.editAnswer(target, TCaptcha);
        }
      }
    }, true);
  },

  patchFormatter(TCaptcha: any) { // loose: vendor TCaptcha global is typed any
    if (this.formatterPatched) { return; }
    this.formatterPatched = true;

    const styleID = 'fourchanx-tcaptcha-formatter-style';
    if (!document.getElementById(styleID)) {
      const style = document.createElement('style');
      style.id = styleID;
      style.textContent = `
        #qr.fourchanx-stacked-captcha .captcha-container { width: 100% !important; height: auto !important; min-height: 145px; overflow: visible !important; }
        #qr.fourchanx-stacked-captcha #t-ctrl { flex-wrap: wrap; gap: 4px; align-items: center; }
        #qr.fourchanx-stacked-captcha .fourchanx-captcha-load-hint.state-complete { flex: 0 0 auto; white-space: nowrap; overflow-wrap: normal; }
        #qr.fourchanx-stacked-captcha .fourchanx-captcha-load-hint.state-complete .fourchanx-captcha-status-text { white-space: nowrap; overflow-wrap: normal; }
        #qr.fourchanx-stacked-captcha .tcaptcha-image { padding: 0; margin: 3px; border: none; background: none; cursor: pointer !important; }
        #qr.fourchanx-stacked-captcha .tcaptcha-image img { height: 100%; width: 100%; display: block; }
        #qr.fourchanx-stacked-captcha .tcaptcha-image.active { outline: 4px solid var(--xt-variant-accent, #00c06f); outline-offset: -3px; box-shadow: 0 0 10px 2px color-mix(in srgb, var(--xt-variant-accent, #00c06f) 70%, transparent); border-radius: 2px; }
        #qr.fourchanx-stacked-captcha #t-desc { white-space: pre-line; text-align: center; font-size: 14px; user-select: none; width: 100%; }
        #qr.fourchanx-stacked-captcha #t-desc.tcaptcha-message { padding-bottom: 15px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
        #qr.fourchanx-stacked-captcha #t-desc.tcaptcha-message .tcaptcha-message-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 1.15em; height: 1.15em; line-height: 0; transform: translateY(-.5px); box-sizing: border-box; }
        #qr.fourchanx-stacked-captcha #t-desc.tcaptcha-message .tcaptcha-message-icon > .fourchanx-captcha-status-svg { display: block; width: 100%; height: 100%; }
        #qr.fourchanx-stacked-captcha #t-desc.tcaptcha-message.state-complete .tcaptcha-message-icon { color: #2c9c47; }
        #qr.fourchanx-stacked-captcha #t-desc.tcaptcha-message.state-failed .tcaptcha-message-icon { color: #cf4a4a; }
        #qr.fourchanx-stacked-captcha #t-desc.tcaptcha-message.state-expired .tcaptcha-message-icon { color: #c38c2f; }
        #qr.fourchanx-stacked-captcha #t-desc.tcaptcha-message.state-loading .tcaptcha-message-icon { color: #4f7eaa; }
        #qr.fourchanx-stacked-captcha #t-desc.tcaptcha-message.state-idle .tcaptcha-message-icon { color: #6f7c8f; }
        #qr.fourchanx-stacked-captcha #t-desc img { margin: 3px !important; max-width: 100%; height: auto; }
        #qr.fourchanx-stacked-captcha #t-task { display: flex; flex-wrap: wrap; gap: 3px; width: 100%; justify-content: center; margin: 0 auto; overflow: auto; max-height: 70vh; padding: 0 !important; height: auto !important; white-space: normal !important; align-items: normal !important; scrollbar-gutter: stable; overflow-x: hidden; box-sizing: border-box; }
        #qr.fourchanx-stacked-captcha #t-load { cursor: pointer !important; min-height: 24px; padding: 0 8px; }
        #qr.fourchanx-stacked-captcha #t-next { display: none !important; }
        #qr.fourchanx-stacked-captcha .fourchanx-captcha-progress { margin-left: auto; font-weight: bold; min-width: 3em; text-align: right; }
        #qr.fourchanx-stacked-captcha #t-slider { display: none !important; }
        #qr.fourchanx-stacked-captcha .fourchanx-captcha-crumbs { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; align-items: center; flex: 1 0 100%; margin: 5px 0 0; }
        #qr.fourchanx-stacked-captcha .fourchanx-captcha-crumb { width: 40px; height: 40px; padding: 0; border: 1px solid currentColor; border-radius: 3px; background: none; cursor: pointer; font-size: 13px; line-height: 1; font-weight: bold; opacity: .7; box-sizing: border-box; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; }
        #qr.fourchanx-stacked-captcha .fourchanx-captcha-crumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        #qr.fourchanx-stacked-captcha .fourchanx-captcha-crumb:hover { opacity: 1; }
        #qr.fourchanx-stacked-captcha .fourchanx-captcha-crumb.current { opacity: 1; outline: 2px solid var(--xt-variant-accent, #00c06f); cursor: default; }
        #qr.fourchanx-stacked-captcha .fourchanx-captcha-crumb.editing { opacity: 1; outline: 3px solid var(--xt-variant-accent, #00c06f); outline-offset: -1px; box-shadow: 0 0 6px color-mix(in srgb, var(--xt-variant-accent, #00c06f) 70%, transparent); }
        #qr.fourchanx-stacked-captcha .fourchanx-captcha-crumb.active { opacity: 1; outline: 3px solid var(--xt-variant-accent, #00c06f); outline-offset: -1px; box-shadow: 0 0 6px color-mix(in srgb, var(--xt-variant-accent, #00c06f) 70%, transparent); }
        #qr.fourchanx-stacked-captcha .captcha-root:focus, #qr.fourchanx-stacked-captcha .captcha-root:focus-visible { outline: none; }
        #qr.fourchanx-stacked-captcha #t-desc img { zoom: 1.5; }
        #qr.fourchanx-captcha-style-inline #t-ctrl > *, #qr.fourchanx-captcha-style-dots #t-ctrl > * { order: 4; }
        #qr.fourchanx-captcha-style-inline #t-ctrl > #t-load, #qr.fourchanx-captcha-style-dots #t-ctrl > #t-load { order: 0; }
        #qr.fourchanx-captcha-style-inline #t-ctrl > .fourchanx-captcha-load-hint, #qr.fourchanx-captcha-style-dots #t-ctrl > .fourchanx-captcha-load-hint { order: 1; }
        #qr.fourchanx-captcha-style-inline #t-ctrl > .fourchanx-captcha-crumbs, #qr.fourchanx-captcha-style-dots #t-ctrl > .fourchanx-captcha-crumbs { order: 2; }
        #qr.fourchanx-captcha-style-inline #t-ctrl > .fourchanx-captcha-progress, #qr.fourchanx-captcha-style-dots #t-ctrl > .fourchanx-captcha-progress { order: 3; }
        #qr.fourchanx-captcha-style-inline .fourchanx-captcha-load-hint:empty, #qr.fourchanx-captcha-style-dots .fourchanx-captcha-load-hint:empty { flex: 0 0 auto; margin-left: 0; min-height: 0; }
        #qr.fourchanx-captcha-style-inline .fourchanx-captcha-crumbs { flex: 0 1 auto; margin: 0; justify-content: flex-start; }
        #qr.fourchanx-captcha-style-inline .fourchanx-captcha-crumb { width: 24px; height: 24px; font-size: 11px; }
        #qr.fourchanx-captcha-style-dots .fourchanx-captcha-crumbs { flex: 0 1 auto; margin: 0 4px 0 auto; gap: 6px; }
        #qr.fourchanx-captcha-style-dots .fourchanx-captcha-progress { margin-left: 0; }
        #qr.fourchanx-captcha-style-dots .fourchanx-captcha-crumb--dot { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid currentColor; overflow: visible; position: relative; }
        #qr.fourchanx-captcha-style-dots .fourchanx-captcha-crumb--dot.answered { background: var(--xt-variant-accent, #00c06f) !important; border-color: var(--xt-variant-accent, #00c06f); }
        #qr.fourchanx-captcha-style-dots .fourchanx-captcha-crumb--dot.current { outline: none; border-color: var(--xt-variant-accent, #00c06f); box-shadow: 0 0 0 2px color-mix(in srgb, var(--xt-variant-accent, #00c06f) 40%, transparent); }
        #qr.fourchanx-captcha-style-dots .fourchanx-captcha-dot-pop { display: none; position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); width: 48px; height: 48px; border: 1px solid currentColor; border-radius: 3px; overflow: hidden; background: #fff; z-index: 5; }
        #qr.fourchanx-captcha-style-dots .fourchanx-captcha-dot-pop img { width: 100%; height: 100%; display: block; }
        #qr.fourchanx-captcha-style-dots .fourchanx-captcha-crumb--dot:hover .fourchanx-captcha-dot-pop { display: block; }
      `;
      document.head.appendChild(style);
    }

    if (!TCaptcha.__fourchanXOriginal) {
      TCaptcha.__fourchanXOriginal = {
        setChallenge: TCaptcha.setChallenge,
        setTaskId: TCaptcha.setTaskId,
        setTaskNodeContent: TCaptcha.setTaskNodeContent,
        buildSliderNode: TCaptcha.buildSliderNode,
        buildNextNode: TCaptcha.buildNextNode,
        onSliderKeyUp: TCaptcha.onSliderKeyUp,
      };
    }

    const o = TCaptcha.__fourchanXOriginal;
    TCaptcha.onSliderKeyUp = function(e: KeyboardEvent) {
      if (e?.shiftKey && ((e.code === 'Space') || (e.keyCode === 32))) { return; }
      return o.onSliderKeyUp.call(this, e);
    };
  },

  setStacked(enabled: boolean, TCaptcha: any) { // loose: vendor TCaptcha global is typed any
    const root = $('#qr');
    if (!root) { return; }
    root.classList.toggle('fourchanx-stacked-captcha', enabled);
    applyCaptchaStyleClass(root, enabled ? this.currentStyle() : null);
    if (TCaptcha.node) {
      if (enabled) {
        TCaptcha.node.style.height = 'auto';
        TCaptcha.node.style.overflow = 'visible';
      } else {
        TCaptcha.node.style.height = '145px';
        TCaptcha.node.style.overflow = 'hidden';
      }
    }
    if (TCaptcha.taskNode) {
      if (enabled) {
        TCaptcha.taskNode.style.height = 'auto';
        TCaptcha.taskNode.style.alignItems = 'flex-start';
      } else {
        TCaptcha.taskNode.style.height = '80px';
        TCaptcha.taskNode.style.alignItems = 'center';
      }
    }
      if (!enabled) {
      if (TCaptcha.__fourchanXOriginal) {
        const o = TCaptcha.__fourchanXOriginal;
        TCaptcha.setChallenge = o.setChallenge;
        TCaptcha.setTaskId = o.setTaskId;
        TCaptcha.setTaskNodeContent = o.setTaskNodeContent;
        TCaptcha.buildSliderNode = o.buildSliderNode;
        TCaptcha.buildNextNode = o.buildNextNode;
        TCaptcha.onSliderKeyUp = function(e: KeyboardEvent) {
          if (e?.shiftKey && ((e.code === 'Space') || (e.keyCode === 32))) { return; }
          return o.onSliderKeyUp.call(this, e);
        };
      }
      TCaptcha.__fourchanXStackedEnabled = false;
      this.cachedButtons = [];
      this.currentHighlightIndex = -1;
      this.crumbHighlightIndex = -1;
      this.updateProgress();
      return;
    }
    if (TCaptcha.__fourchanXStackedEnabled) { return; }
    TCaptcha.__fourchanXStackedEnabled = true;
    this.installStackedKeyHandler(TCaptcha);

    const o = TCaptcha.__fourchanXOriginal;
    TCaptcha.setChallenge = function(challenge: any) { // loose: vendor TCaptcha challenge object is typed any
      // A fresh challenge (or a fresh "not required" reply, handled natively
      // below) is a new completion cycle -- allow auto-submit to fire again.
      CaptchaT._autoSubmitted = false;
      if (!challenge?.tasks) { return o.setChallenge.call(this, challenge); }
      this.challengeIdNode.value = challenge.challenge;
      this.respNode.value = '';
      CaptchaT.answerHistory = [];
      CaptchaT.editingIndex = null;
      this.tasks = challenge.tasks;
      this.setTaskId(0);
      CaptchaT.createImageGrid(this);
    };
    TCaptcha.setTaskId = function(index: number) {
      this.taskId = index;
      CaptchaT.setState('ready');
      CaptchaT.updateProgress(this);
    };
    TCaptcha.setTaskNodeContent = function(text: string) {
      const container = $('#t-task', CaptchaT.nodes.container);
      const state = CaptchaT.messageStateFromText(text);
      CaptchaT.setState(state);
      if (container) { container.innerHTML = ''; }
      CaptchaT.setStatusMessage(text, state);
      CaptchaT.cachedButtons = [];
      CaptchaT.currentHighlightIndex = -1;
      CaptchaT.crumbHighlightIndex = -1;
      CaptchaT.answerHistory = [];
      CaptchaT.editingIndex = null;
      CaptchaT.renderCrumbs(this);
      CaptchaT.updateProgress();
      // 4chan reporting "verification not required" (or "done") arrives here as a
      // 'complete' state with no challenge to solve -- treat it as a completion
      // event so "Post on Captcha Completion" submits even when no captcha was
      // needed. Any other state means we're not done, so clear the one-shot.
      if (state === 'complete') {
        CaptchaT.maybeAutoSubmit();
      } else {
        CaptchaT._autoSubmitted = false;
      }
    };
    TCaptcha.buildSliderNode = function() {
      const slider = document.createElement('span');
      slider.id = 't-slider';
      slider.hidden = true;
      return slider;
    };
    TCaptcha.buildNextNode = function() {
      const next = document.createElement('span');
      next.id = 't-next';
      return next;
    };

    if (TCaptcha.tasks?.length) {
      this.createImageGrid(TCaptcha);
    } else {
      this.setState('idle');
      this.updateProgress();
      this.applyAdaptiveTextColors();
    }
  },
};
export default CaptchaT;
