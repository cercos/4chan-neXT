/**
 * Because of increased security in manifest v3, scripts can no longer just inject a script tag into the main page.
 * Functions to be called in the main context must be predefined. Those functions should be in this file, and they will
 * be loaded in the worker context in the extension version.
 *
 * These are the functions for `$.global`. They will be called by name.
 *
 * They are stringified, so don't use the short `fnName() {` notation.
 */
const PageContextFunctions = {
  stubCloneTopNav: () => { (window as any).cloneTopNav = function () { }; },

  disableNativeExtension: () => {
    try {
      const settings = JSON.parse(localStorage.getItem('4chan-settings')) || {};
      if (settings.disableAll) return;
      settings.disableAll = true;
      localStorage.setItem('4chan-settings', JSON.stringify(settings));
    } catch (error) {
      Object.defineProperty(window, 'Config', { value: { disableAll: true } });
    }
  },

  disableNativeExtensionNoStorage: () => { Object.defineProperty(window, 'Config', { value: { disableAll: true } }) },

  prettyPrint: ({ id }) => {
    // @ts-ignore
    window.prettyPrint?.((function () { }), document.getElementById(id).parentNode);
  },

  exposeVersion: ({ buildDate, version }) => {
      const date = +buildDate;
      Object.defineProperty(window, 'fourchanXT', {
        value: Object.freeze({
          version,
          // Getter to prevent mutations.
          get buildDate() { return new Date(date) },
        }),
        writable: false,
      });
  },

  initMain: () => {
    document.documentElement.classList.add('js-enabled');
    (window as any).FCX = {};
  },

  initFlash: () => {
     if (JSON.parse(localStorage['4chan-settings'] || '{}').disableAll) (window as any).SWFEmbed.init();
  },
  initFlashNoStorage: () => { (window as any).SWFEmbed.init() },

  setThreadId: () => { (window as any).Main.tid = location.pathname.split(/\/+/)[3] },

  fourChanPrettyPrintListener: () => {
    window.addEventListener('prettyprint', (e: any) => window.dispatchEvent(new CustomEvent('prettyprint:cb', {
      detail: { ID: e.detail.ID, i: e.detail.i, html: (window as any).prettyPrintOne(e.detail.html) }
    })), false);
  },

  fourChanMathjaxListener: () => {
    window.addEventListener('mathjax', function (e) {
      if ((window as any).MathJax) {
        (window as any).MathJax.Hub.Queue(['Typeset', (window as any).MathJax.Hub, e.target]);
      } else {
        if (!document.querySelector('script[src^="//cdn.mathjax.org/"]')) { // don't load MathJax if already loading
          (window as any).loadMathJax();
          (window as any).loadMathJax = function () { };
        }
        // 4chan only handles post comments on MathJax load; anything else (e.g. the QR preview) must be queued explicitly.
        if (!(e.target as HTMLElement).classList.contains('postMessage')) {
          document.querySelector('script[src^="//cdn.mathjax.org/"]').addEventListener(
            'load',
            () => (window as any).MathJax.Hub.Queue(['Typeset', (window as any).MathJax.Hub, e.target]),
            false,
          );
        }
      }
    }, false);
  },

  disable4chanIdHl: () => {
    (window as any).clickable_ids = false;
    for (var node of document.querySelectorAll('.posteruid, .capcode')) {
      node.removeEventListener('click', (window as any).idClick, false);
    }
  },

  initTinyBoard: ({ boardID, threadID }) => {
    threadID = +threadID;
    const form = document.querySelector<HTMLFormElement>('form[name="post"]');
    (window as any).$(document).ajaxComplete(function (event, request, settings) {
      let postID;
      if (settings.url !== form.action) return;
      if (!(postID = +request.responseJSON?.id)) return;
      const detail = { boardID, threadID, postID };
      try {
        const { redirect, noko } = request.responseJSON;
        if (redirect && (originalNoko != null) && !originalNoko && !noko) {
          detail.redirect = redirect;
        }
      } catch (error) { }
      event = new CustomEvent('QRPostSuccessful', { bubbles: true, detail });
      document.dispatchEvent(event);
    });
    var originalNoko = (window as any).tb_settings?.ajax?.always_noko_replies;
    let base;
    (((base = (window as any).tb_settings || ((window as any).tb_settings = {}))).ajax || (base.ajax = {})).always_noko_replies = true;
  },

  setupCaptcha: ({ recaptchaKey }) => {
    const render = function () {
      const { classList } = document.documentElement;
      const container = document.querySelector('#qr .captcha-container');
      container.dataset.widgetID = (window as any).grecaptcha.render(container, {
        sitekey: recaptchaKey,
        theme: classList.contains('tomorrow') || classList.contains('spooky') || classList.contains('dark-captcha') ? 'dark' : 'light',
        callback(response) {
          window.dispatchEvent(new CustomEvent('captcha:success', { detail: response }));
        }
      });
    };
    if ((window as any).grecaptcha) {
      render();
    } else {
      const cbNative = (window as any).onRecaptchaLoaded;
      (window as any).onRecaptchaLoaded = function () {
        render();
        cbNative();
      };
      if (!document.head.querySelector('script[src^="https://www.google.com/recaptcha/api.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoaded&render=explicit';
        document.head.appendChild(script);
      }
    }
  },
  resetCaptcha: () => {
    (window as any).grecaptcha.reset(document.querySelector<HTMLElement>('#qr .captcha-container').dataset.widgetID);
  },

  setupTCaptcha: ({ boardID, threadID, autoLoad }) => {
    const { TCaptcha } = (window as any);
    if (!TCaptcha?.init) {
      window.dispatchEvent(new CustomEvent('CreateNotification', {
        detail: { type: 'warning', content: 'Captcha unavailable. Reload the page and try again.' }
      }));
      return;
    }
    TCaptcha.init(document.querySelector('#qr .captcha-container'), boardID, +threadID);
    TCaptcha.setErrorCb(err => window.dispatchEvent(new CustomEvent('CreateNotification', {
      detail: { type: 'warning', content: '' + err }
    })));
    if (autoLoad === '1') TCaptcha.load(boardID, threadID);
  },
  destroyTCaptcha: () => { (window as any).TCaptcha.destroy(); },
  TCaptchaClearChallenge: () => { (window as any).TCaptcha.clearChallenge() },

  setupQR: () => {
    (window as any).FCX.oekakiCB = () => (window as any).Tegaki.flatten().toBlob(function (file) {
      const source = `oekaki-${Date.now()}`;
      (window as any).FCX.oekakiLatest = source;
      document.dispatchEvent(new CustomEvent('QRSetFile', {
        bubbles: true,
        detail: { file, name: (window as any).FCX.oekakiName, source }
      }));
    });
    if ((window as any).Tegaki) {
      document.querySelector<HTMLElement>('#qr .oekaki').hidden = false;
    }
  },

  qrTegakiDraw: () => {
    const { Tegaki, FCX } = (window as any);
    if (Tegaki.bg) { Tegaki.destroy(); }
    FCX.oekakiName = 'tegaki.png';
    Tegaki.open({
      onDone: FCX.oekakiCB,
      onCancel() { Tegaki.bgColor = '#ffffff'; },
      width: +document.querySelector<HTMLInputElement>('#qr [name=oekaki-width]').value,
      height: +document.querySelector<HTMLInputElement>('#qr [name=oekaki-height]').value,
      bgColor:
        document.querySelector<HTMLInputElement>('#qr [name=oekaki-bg]').checked ?
          document.querySelector<HTMLInputElement>('#qr [name=oekaki-bgcolor]').value :
          'transparent'
    });
  },

  qrTegakiLoad: () => {
    const { Tegaki, FCX } = (window as any);
    const name = document.getElementById<HTMLInputElement>('qr-filename').value.replace(/\.\w+$/, '') + '.png';
    const { source } = document.getElementById('file-n-submit').dataset;
    const error = content => document.dispatchEvent(new CustomEvent('CreateNotification', {
      bubbles: true,
      detail: { type: 'warning', content, lifetime: 20 }
    }));
    var cb = function (e?: any) {
      if (e) { this.removeEventListener('QRMetadata', cb, false); }
      const selected = document.getElementById('selected');
      if (!selected?.dataset.type) return error('No file to edit.');
      if (!/^(image|video)\//.test(selected.dataset.type)) { return error('Not an image.'); }
      if (!selected.dataset.height) return error('Metadata not available.');
      if (selected.dataset.height === 'loading') {
        selected.addEventListener('QRMetadata', cb, false);
        return;
      }
      if (Tegaki.bg) { Tegaki.destroy(); }
      FCX.oekakiName = name;
      Tegaki.open({
        onDone: FCX.oekakiCB,
        onCancel() { Tegaki.bgColor = '#ffffff'; },
        width: +selected.dataset.width,
        height: +selected.dataset.height,
        bgColor: 'transparent'
      });
      const canvas = document.createElement('canvas');
      canvas.width = (canvas.naturalWidth = +selected.dataset.width);
      canvas.height = (canvas.naturalHeight = +selected.dataset.height);
      canvas.hidden = true;
      document.body.appendChild(canvas);
      canvas.addEventListener('QRImageDrawn', function () {
        this.remove();
        Tegaki.onOpenImageLoaded.call(this);
      }, false);
      canvas.dispatchEvent(new CustomEvent('QRDrawFile', { bubbles: true }));
    };
    if (Tegaki.bg && (Tegaki.onDoneCb === FCX.oekakiCB) && (source === FCX.oekakiLatest)) {
      FCX.oekakiName = name;
      Tegaki.resume();
    } else {
      cb();
    }
  },

  testNativeExtension: (output: any = {}) => {
    if ((window as any).Parser?.postMenuIcon) output.enabled = 'true';
    return output;
  },
} as const;
export default PageContextFunctions;
