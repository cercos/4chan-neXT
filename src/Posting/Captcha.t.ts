import { Conf, d, g } from "../globals/globals";
import $ from "../platform/$";
import QR from "./QR";

const getTCaptcha = () => window.TCaptcha || window.wrappedJSObject?.TCaptcha || (typeof unsafeWindow !== 'undefined' ? unsafeWindow.TCaptcha : undefined);

const CaptchaT = {
  init() {
    if (d.cookie.indexOf('pass_enabled=1') >= 0) { return; }
    if (!(this.isEnabled = !!$('#t-root') || !$.id('postForm'))) { return; }

    const root = $.el('div', {className: 'captcha-root'});
    this.nodes = {root};

    $.addClass(QR.nodes.el, 'has-captcha', 'captcha-t');
    $.after(QR.nodes.com.parentNode, root);
  },

  moreNeeded() {},

  getThread() {
    return {
      boardID: g.BOARD.ID,
      threadID: QR.posts[0].thread === 'new' ? '0' : ('' + QR.posts[0].thread),
    };
  },

  setup(focus) {
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
    this.ensureStatusNode();
    this.ensureProgressNode();
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

  parseCssColor(value) {
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

  getBackgroundColor(node) {
    for (let el = node; el; el = el.parentElement) {
      const color = this.parseCssColor(getComputedStyle(el).backgroundColor);
      if (color && color.a > 0) { return color; }
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  },

  luminance({ r, g, b }) {
    const toLinear = channel => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  },

  contrast(a, b) {
    const la = this.luminance(a);
    const lb = this.luminance(b);
    const [max, min] = la > lb ? [la, lb] : [lb, la];
    return (max + 0.05) / (min + 0.05);
  },

  pickReadableTextColor(node) {
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

    for (const el of container.querySelectorAll('#t-msg, #t-desc, #t-task, .fourchanx-captcha-load-hint, .fourchanx-captcha-status-text, .fourchanx-captcha-progress')) {
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

  setState(state) {
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
    const borderColor = borderColors[state] || borderColors.idle;
    const showBorder = state === 'complete' || state === 'failed' || state === 'expired';
    container.style.border = showBorder ? `2px solid ${borderColor}` : '2px solid transparent';
    container.style.borderRadius = '4px';
    container.style.transition = 'border-color .2s ease';
    this.setStatusMessage({
      idle: '',
      loading: '',
      ready: '',
      complete: 'Done.',
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

  setStatusMessage(text, state = 'idle') {
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

    const iconByState = {
      complete: '✓',
      failed: '✕',
      expired: '!'
    };
    const icon = iconByState[state];
    if (icon) {
      statusNode.appendChild($.el('span', {
        className: `fourchanx-captcha-status-icon state-${state}`,
        textContent: icon,
        title: this.plainStatusMessage(text)
      }));
    }

    const message = $.el('span', {
      className: 'fourchanx-captcha-status-text'
    });
    this.appendStatusMessage(message, text);
    statusNode.appendChild(message);
    this.applyAdaptiveTextColors();
  },

  decodeStatusMessage(text) {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = `${text || ''}`;
    return decoder.value;
  },

  plainStatusMessage(text) {
    const html = document.createElement('div');
    html.innerHTML = this.decodeStatusMessage(text);
    return html.textContent || '';
  },

  appendStatusMessage(parent, text) {
    const html = document.createElement('div');
    html.innerHTML = this.decodeStatusMessage(text);

    const appendSafe = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.appendChild(document.createTextNode(node.textContent || ''));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) { return; }

      if (node.localName === 'a') {
        const href = node.getAttribute('href') || '';
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

  messageStateFromText(text) {
    const plain = this.plainStatusMessage(text).toLowerCase();
    if (/expired/.test(plain)) { return 'expired'; }
    if (/done|verification not required/.test(plain)) { return 'complete'; }
    if (/error|failed|couldn\'t|mistyped|malfunctioned/.test(plain)) { return 'failed'; }
    if (/loading/.test(plain)) { return 'loading'; }
    return 'idle';
  },

  formatTaskMessage(text, state) {
    const icon = {
      loading: '◔',
      complete: '✓',
      failed: '✕',
      expired: '⏱',
      idle: '○'
    }[state] || '○';
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

  updateProgress(TCaptcha) {
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

  formatDescription(str) {
    if (!str) { return ''; }
    return str
      .replace(/Use the scroll bar below to\s*|,\s*then click next\.?/gi, '')
      .replace(/(?:^|>)\s*([a-z])/i, m => m.toUpperCase()) + '.';
  },

  updateHighlight() {
    this.cachedButtons ||= [];
    this.cachedButtons.forEach((btn, index) => {
      const isActive = index === this.currentHighlightIndex;
      btn.classList.toggle('active', isActive);
      if (isActive) {
        btn.scrollIntoView({block: 'nearest'});
      }
    });
  },

  initializeEventHandler(container, TCaptcha) {
    if (!container || container.dataset.hasFourChanXStackedClick) { return; }
    container.addEventListener('click', e => {
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

  createImageGrid(TCaptcha) {
    const container = $('#t-task', this.nodes.container);
    const task = TCaptcha.getCurrentTask?.();
    if (!TCaptcha.node || !container || !task) { return; }
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

    const imageHTMLs = (task.items || []).map(bitmap =>
      `<button type="button" class="tcaptcha-image">
        <img src="data:image/png;base64,${bitmap}" alt="">
      </button>`
    ).join('');

    container.innerHTML = descriptionHTML + imageHTMLs;

    this.cachedButtons = Array.from(container.querySelectorAll('.tcaptcha-image'));
    this.currentHighlightIndex = -1;
    this.initializeEventHandler(container, TCaptcha);
    TCaptcha.taskNode = container;
    this.applyAdaptiveTextColors();
  },

  submitCaptchaAnswer(imageNumber, TCaptcha) {
    if (!TCaptcha?.respNode || !TCaptcha.tasks || imageNumber < 0) { return; }
    const totalTasks = TCaptcha.tasks.length - 1;
    if (totalTasks < 0) { return; }

    TCaptcha.respNode.value += imageNumber;
    const nextId = TCaptcha.taskId + 1;
    if (nextId <= totalTasks) {
      TCaptcha.setTaskId(nextId);
      this.createImageGrid(TCaptcha);
    } else {
      TCaptcha.taskId = TCaptcha.tasks.length;
      TCaptcha.setTaskNodeContent('Done.');
      this.setState('complete');
      this.updateProgress(TCaptcha);
      this.cachedButtons = [];
      this.currentHighlightIndex = -1;
      if (Conf['Post on Captcha Completion'] && !QR.cooldown.auto) { QR.submit(); }
    }
  },

  installStackedKeyHandler(TCaptcha) {
    if (this.keyHandlerInstalled) { return; }
    this.keyHandlerInstalled = true;
    window.addEventListener('keydown', e => {
      if (!TCaptcha.__fourchanXStackedEnabled) { return; }
      if (!this.nodes?.container || !document.body.contains(this.nodes.container)) { return; }

      if (e.key === 'Enter' && this.cachedButtons?.length > 0 && this.currentHighlightIndex >= 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.submitCaptchaAnswer(this.currentHighlightIndex, TCaptcha);
      }
    }, true);
  },

  patchFormatter(TCaptcha) {
    if (this.formatterPatched) { return; }
    this.formatterPatched = true;

    const styleID = 'fourchanx-tcaptcha-formatter-style';
    if (!document.getElementById(styleID)) {
      const style = document.createElement('style');
      style.id = styleID;
      style.textContent = `
        #qr.fourchanx-stacked-captcha .captcha-container { width: 100% !important; height: auto !important; min-height: 145px; overflow: visible !important; }
        #qr.fourchanx-stacked-captcha #t-ctrl { flex-wrap: wrap; gap: 4px; align-items: center; }
        #qr.fourchanx-stacked-captcha .tcaptcha-image { padding: 0; margin: 3px; border: none; background: none; cursor: pointer !important; }
        #qr.fourchanx-stacked-captcha .tcaptcha-image img { height: 100%; width: 100%; display: block; }
        #qr.fourchanx-stacked-captcha .tcaptcha-image.active { outline: 3px solid #00c06f; }
        #qr.fourchanx-stacked-captcha #t-desc { white-space: pre-line; text-align: center; font-size: 14px; user-select: none; width: 100%; }
        #qr.fourchanx-stacked-captcha #t-desc.tcaptcha-message { padding-bottom: 15px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
        #qr.fourchanx-stacked-captcha #t-desc.tcaptcha-message .tcaptcha-message-icon { display: inline-flex; align-items: center; justify-content: center; width: 1.2em; height: 1.2em; border: 2px solid currentColor; border-radius: 50%; font-weight: bold; font-size: 11px; line-height: 1; box-sizing: border-box; }
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
    TCaptcha.onSliderKeyUp = function(e) {
      if (e?.shiftKey && ((e.code === 'Space') || (e.keyCode === 32))) { return; }
      return o.onSliderKeyUp.call(this, e);
    };
  },

  setStacked(enabled, TCaptcha) {
    const root = $('#qr');
    if (!root) { return; }
    root.classList.toggle('fourchanx-stacked-captcha', enabled);
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
        TCaptcha.onSliderKeyUp = function(e) {
          if (e?.shiftKey && ((e.code === 'Space') || (e.keyCode === 32))) { return; }
          return o.onSliderKeyUp.call(this, e);
        };
      }
      TCaptcha.__fourchanXStackedEnabled = false;
      this.cachedButtons = [];
      this.currentHighlightIndex = -1;
      this.updateProgress();
      return;
    }
    if (TCaptcha.__fourchanXStackedEnabled) { return; }
    TCaptcha.__fourchanXStackedEnabled = true;
    this.installStackedKeyHandler(TCaptcha);

    const o = TCaptcha.__fourchanXOriginal;
    TCaptcha.setChallenge = function(challenge) {
      if (!challenge?.tasks) { return o.setChallenge.call(this, challenge); }
      this.challengeIdNode.value = challenge.challenge;
      this.respNode.value = '';
      this.tasks = challenge.tasks;
      this.setTaskId(0);
      CaptchaT.createImageGrid(this);
    };
    TCaptcha.setTaskId = function(index) {
      this.taskId = index;
      CaptchaT.setState('ready');
      CaptchaT.updateProgress(this);
    };
    TCaptcha.setTaskNodeContent = function(text) {
      const container = $('#t-task', CaptchaT.nodes.container);
      const state = CaptchaT.messageStateFromText(text);
      CaptchaT.setState(state);
      if (container) { container.innerHTML = ''; }
      CaptchaT.setStatusMessage(text, state);
      CaptchaT.cachedButtons = [];
      CaptchaT.currentHighlightIndex = -1;
      CaptchaT.updateProgress();
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
