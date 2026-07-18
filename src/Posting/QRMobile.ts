import $ from '../platform/$';
import Icon from '../Icons/icon';
import { QR_OVERFLOW_ACTION_IDS, actionLabel, keyboardInset, shouldAutoExpand } from './QRMobileLogic';

type MobileQRNodes = {
  el: HTMLDivElement,
  fileButton: HTMLInputElement,
  fileSubmit: HTMLDivElement,
};

const QRMobile = {
  enabled: false,
  expanded: false,
  nodes: null as MobileQRNodes | null,
  handle: null as HTMLAnchorElement | null,
  moreButton: null as HTMLAnchorElement | null,
  overflow: null as HTMLDivElement | null,

  setup(nodes: MobileQRNodes) {
    this.enabled = true;
    this.expanded = false;
    this.nodes = nodes;
    const { el } = nodes;
    $.addClass(el, 'qr-mobile');

    const handle = $.el('a', { href: 'javascript:;', className: 'qr-mobile-handle', title: 'Expand' });
    Icon.set(handle, 'caretDown');
    this.handle = handle;
    $.prepend(el, handle);
    $.on(handle, 'click', () => this.toggle());

    this.buildOverflow();

    const mirrored = ['has-file', 'has-image', 'has-video', 'custom-cooldown'];
    const syncFileState = () => {
      el.classList.toggle('qr-has-file', $.hasClass(nodes.fileSubmit, 'has-file'));
      for (const cls of mirrored) {
        this.overflow!.classList.toggle(cls, $.hasClass(nodes.fileSubmit, cls));
      }
    };
    new MutationObserver(syncFileState).observe(nodes.fileSubmit, { attributes: true, attributeFilter: ['class'] });
    syncFileState();

    new MutationObserver(() => {
      if ($.hasClass(el, 'dump') && shouldAutoExpand('dump-on', this.expanded)) { this.toggle(true); }
    }).observe(el, { attributes: true, attributeFilter: ['class'] });

    $.on(el, 'click', (e: MouseEvent) => {
      if (!$.hasClass(el, 'qr-overflow-open')) { return; }
      const target = e.target as HTMLElement;
      if (this.overflow!.contains(target) || this.moreButton!.contains(target)) { return; }
      this.toggleOverflow(false);
    });

    this.trackKeyboard(el);
  },

  trackKeyboard(el: HTMLDivElement) {
    const vv = window.visualViewport;
    if (!vv) { return; }
    const update = () => {
      const inset = keyboardInset(window.innerHeight, vv.height, vv.offsetTop);
      if (inset) {
        el.style.setProperty('--qr-kb-inset', `${inset}px`);
      } else {
        el.style.removeProperty('--qr-kb-inset');
      }
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
  },

  buildOverflow() {
    const { el } = this.nodes!;
    const container = $('#qr-filename-container', el);

    const more = $.el('a', { href: 'javascript:;', className: 'qr-action-button qr-mobile-more', title: 'More actions', textContent: '⋯' });
    this.moreButton = more;
    $.add(container, more);

    const sheet = $.el('div', { className: 'qr-mobile-overflow' });
    this.overflow = sheet;
    for (const id of QR_OVERFLOW_ACTION_IDS) {
      const action = $(`#${id}`, el) as HTMLAnchorElement | null;
      if (!action) { continue; }
      const row = $.el('div', { className: 'qr-overflow-row' });
      const label = $.el('span', { className: 'qr-overflow-label', textContent: actionLabel(action.title) });
      $.add(row, action);
      $.add(row, label);
      $.add(sheet, row);
      $.on(label, 'click', () => action.click());
    }
    $.add(this.nodes!.fileSubmit, sheet);

    $.on(more, 'click', () => this.toggleOverflow());
    $.on(sheet, 'click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('a, .qr-overflow-label')) { this.toggleOverflow(false); }
    });
  },

  toggle(force?: boolean) {
    const next = force ?? !this.expanded;
    this.expanded = next;
    const el = this.nodes!.el;
    el.classList.toggle('qr-mobile-expanded', next);
    if (this.handle) { this.handle.title = next ? 'Collapse' : 'Expand'; }
    if (!next) { this.toggleOverflow(false); }
  },

  toggleOverflow(force?: boolean) {
    const el = this.nodes!.el;
    const open = force ?? !$.hasClass(el, 'qr-overflow-open');
    el.classList.toggle('qr-overflow-open', open);
  },
};

export default QRMobile;
