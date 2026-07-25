import { Conf, d, doc } from "../globals/globals";
import Main from "../main/Main";
import $ from "../platform/$";
import $$ from "../platform/$$";
import Header from "./Header";
import Icon from "../Icons/icon";
import nextSettingsDiff from "../config/nextSettingsDiff.json";

// neXT-added/changed setting keys (same source the settings page uses). Lets the
// "Highlight neXT" toggle mark neXT features that live in dropdown menus, not just
// rows in the settings dialog. See Menu.tagNextEntries and style.css.
const NEXT_ADDED = new Set<string>((nextSettingsDiff as any).added);
const NEXT_CHANGED = new Set<string>((nextSettingsDiff as any).changed);

const dialog = function(id: string, properties: Record<string, any>) {
  const el = $.el('div', {
    className: 'dialog',
    id
  }
  );
  $.extend(el, properties);
  el.style.cssText = Conf[`${id}.position`];

  const move = $('.move', el);
  $.on(move, 'touchstart mousedown', dragstart);
  for (var child of move.children) {
    if (!child.tagName) { continue; }
    $.on(child, 'touchstart mousedown', e => e.stopPropagation());
  }

  return el;
};

const threadWatcherAttached = () =>
  Conf['Thread Watcher Attach Controls'] !== false && Conf['Thread Watcher Attached'];

// loose: self-referential class-expression IIFE (Menu reassigns its own binding);
// a construct signature breaks the inference cycle while keeping `new UI.Menu(type)` valid.
type MenuCtor = { new (type: string): any; initClass(): void };
var Menu: MenuCtor = (function(): MenuCtor {
  let currentMenu: any = undefined;
  let lastToggledButton: any = undefined;
  // Set instead of lastToggledButton when the menu is opened at a point (mobile
  // long-press) rather than from a button. Stored in page coordinates so the
  // menu follows the pressed post when the document scrolls.
  let anchorPoint: {x: number, y: number} | null = null;
  // A single #menu node, created once and kept in the DOM. Opening repopulates
  // it and toggles visibility instead of building/removing a node each time, so
  // the enter and exit transitions can finish (see makeMenu/open/close).
  let menuNode: HTMLElement | null = null;
  let menuBackdrop: HTMLElement | null = null;
  Menu = class Menu {
    // Assigned later; declared so the singleton's type includes them. Loosely typed
    // where a precise type would cascade new errors; tighten during the strict pass.
    type: any = null;
    entries: any[] = [];
    menu: any = null;

    static initClass() {
      currentMenu       = null;
      lastToggledButton = null;
    }

    constructor(type: string) {
      // XXX AddMenuEntry event is deprecated
      this.setPosition = this.setPosition.bind(this);
      this.close = this.close.bind(this);
      this.keybinds = this.keybinds.bind(this);
      this.onFocus = this.onFocus.bind(this);
      this.addEntry = this.addEntry.bind(this);
      this.type = type;
      $.on(d, 'AddMenuEntry', ({detail}: any) => {
        if (detail.type !== this.type) { return; }
        delete detail.open;
        return this.addEntry(detail);
      });
      this.entries = [];
    }

    makeMenu() {
      if (!menuNode) {
        menuNode = $.el('div', {
          className: 'dialog menu-hidden',
          id:        'menu',
          tabIndex:  0
        }
        );
        $.on(menuNode, 'click', e => e.stopPropagation());
        // The node is shared across Menu instances, so route keyboard handling
        // to whichever menu is currently open.
        $.on(menuNode, 'keydown', e => currentMenu?.keybinds(e));
        // Append to body so the menu escapes any ancestor stacking context
        // (e.g. #thread-watcher's position:fixed/z-index:5).
        menuBackdrop = $.el('div', {
          id: 'menu-backdrop',
          className: 'menu-hidden'
        });
        $.add(d.body, [menuBackdrop, menuNode]);
      }
      menuNode.dataset.type = this.type;
      return menuNode;
    }

    toggle(e: Event, button: HTMLElement, data?: any) {
      e.preventDefault();
      e.stopPropagation();

      if (currentMenu) {
        // Close if it's already opened.
        // Reopen if we clicked on another button.
        const previousButton = lastToggledButton;
        currentMenu.close();
        if (previousButton === button) { return; }
      }

      if (!this.entries.length) { return; }
      return this.open(button, data);
    }

    toggleAtPoint(e: Event, point: {x: number, y: number}, data?: any) {
      e.preventDefault();
      e.stopPropagation();

      if (currentMenu) { currentMenu.close(); }
      if (!this.entries.length) { return; }
      anchorPoint = {x: point.x + window.scrollX, y: point.y + window.scrollY};
      return this.open(null, data);
    }

    open(button: HTMLElement | null, data?: any) {
      let entry;
      const menu = (this.menu = this.makeMenu());
      currentMenu       = this;
      lastToggledButton = button;

      this.entries.sort((first, second) => first.order - second.order);

      // Clear any entries left over from a previous open before repopulating.
      $.rmAll(menu);
      for (entry of this.entries) {
        this.insertEntry(entry, menu, data);
      }

      // Entry nodes persist across opens; collapse any submenu left expanded
      // from a previous mobile tap.
      for (const openEl of $$('.submenu-open', menu)) { $.rmClass(openEl, 'submenu-open'); }

      this.tagNextEntries(menu);

      if (lastToggledButton) { $.addClass(lastToggledButton, 'active'); }

      $.on(d, 'click CloseMenu', this.close);
      $.on(d, 'scroll', this.setPosition);
      $.on(window, 'resize', this.setPosition);
      const anchorHeader = doc.classList.contains('xt-mobile') && !!button?.closest('#header-bar');
      menu.classList.toggle('menu-anchor-header', anchorHeader);
      menuBackdrop?.classList.toggle('menu-anchor-header', anchorHeader);
      const anchorPopover = doc.classList.contains('xt-mobile') && !!anchorPoint;
      menu.classList.toggle('menu-anchor-point', anchorPopover);
      menuBackdrop?.classList.toggle('menu-anchor-point', anchorPopover);
      // Reveal the menu (display:none -> shown) so the @starting-style enter
      // animation runs; the node itself stays in the DOM across opens.
      $.rmClass(menu, 'menu-hidden');
      $.rmClass(menuBackdrop, 'menu-hidden');

      this.setPosition();

      entry = $('.entry', menu);
      // We've removed flexbox, so we don't use order anymore.
      // while prevEntry = @findNextEntry entry, -1
      //   entry = prevEntry
      this.focus(entry);

      return menu.focus();
    }

    setPosition() {
      if (doc.classList.contains('xt-mobile')) {
        if (!anchorPoint) {
          $.extend(this.menu.style, {top: '', right: '', bottom: '', left: ''});
          return;
        }
        const mWidth  = this.menu.offsetWidth;
        const mHeight = this.menu.offsetHeight;
        const vv     = window.visualViewport;
        const vw     = vv?.width ?? doc.clientWidth;
        const vh     = vv?.height ?? doc.clientHeight;
        const ox     = vv?.offsetLeft ?? 0;
        const oy     = vv?.offsetTop ?? 0;
        const margin = 8;
        const x = anchorPoint.x - window.scrollX;
        const y = anchorPoint.y - window.scrollY;
        let left = (x + mWidth  + margin > ox + vw) ? x - mWidth  : x;
        let top  = (y + mHeight + margin > oy + vh) ? y - mHeight : y;
        left = Math.max(ox + margin, Math.min(left, ox + vw - mWidth  - margin));
        top  = Math.max(oy + margin, Math.min(top,  oy + vh - mHeight - margin));
        $.extend(this.menu.style, {top: `${top}px`, left: `${left}px`, right: '', bottom: ''});
        return;
      }
      const mRect   = this.menu.getBoundingClientRect();
      let bRect;
      if (anchorPoint) {
        const x = anchorPoint.x - window.scrollX;
        const y = anchorPoint.y - window.scrollY;
        bRect = {top: y, bottom: y, left: x, right: x, height: 0};
      } else {
        bRect = lastToggledButton.getBoundingClientRect();
      }
      const cHeight = doc.clientHeight;
      const cWidth  = doc.clientWidth;
      const [top, bottom] = (bRect.top + bRect.height + mRect.height) < cHeight ?
        [`${bRect.bottom}px`, '']
      :
        ['', `${cHeight - bRect.top}px`];
      const [left, right] = (bRect.left + mRect.width) < cWidth ?
        [`${bRect.left}px`, '']
      :
        ['', `${cWidth - bRect.right}px`];
      $.extend(this.menu.style, {top, right, bottom, left});
      return this.menu.classList.toggle('left', right);
    }

    insertEntry(entry: any, parent: HTMLElement, data?: any) {
      let submenu;
      if (typeof entry.open === 'function') {
        try {
          if (!entry.open(data)) { return; }
        } catch (err) {
          Main.handleErrors({
            message: `Error in building the ${this.type} menu.`,
            error: err
          });
          return;
        }
      }
      $.add(parent, entry.el);

      if (!entry.subEntries) { return; }
      if (submenu = $('.submenu', entry.el)) {
        // Reset sub menu, remove irrelevant entries.
        $.rm(submenu);
      }
      submenu = $.el('div',
        {className: 'dialog submenu'});
      for (var subEntry of entry.subEntries) {
        this.insertEntry(subEntry, submenu, data);
      }
      $.add(entry.el, submenu);
    }

    // Mark menu items that map to a neXT-added/changed setting. Two ways to match:
    //   - a checkbox whose `name` is the Conf key (UI.checkbox items), or
    //   - an entry that declares its Conf key via `data-next-key` (for links,
    //     sliders, and number fields that carry no `name`, e.g. the Thread Watcher
    //     Sort / Thumbnails / Max H-W controls).
    // Colors carry meaning (see the menu dot rules in style.css):
    //   - GREEN ('added'): an entry that is itself a neXT feature — a directly
    //     matched item, or a wholly-neXT menu keyed on its parent (Download Media,
    //     Sort, ...). Mark the parent's data-next-key and leave its children bare.
    //   - AMBER ('changed'): a pre-existing (upstream) menu that merely GAINED a
    //     neXT item (Header -> Hide board banner, Display -> Show Undo Button). The
    //     parent is flagged amber while the new item stays green inside it.
    // Visibility is gated by html.highlight-next-global (set from the "Highlight
    // neXT" toggle, see Settings.applyNextHighlight), so attributes are set here
    // unconditionally.
    tagNextEntries(menu: HTMLElement) {
      for (const el of $$('[data-next-status]', menu) as HTMLElement[]) delete el.dataset.nextStatus;
      const statusOf = (key: string) =>
        NEXT_ADDED.has(key) ? 'added' : NEXT_CHANGED.has(key) ? 'changed' : '';
      // Pass 1: entries that are themselves neXT (own name / data-next-key). Track
      // them so pass 2 doesn't recolor a wholly-neXT feature as a mere container.
      const own = new Set<HTMLElement>();
      const markOwn = (start: HTMLElement, status: string) => {
        const entry = start.closest('.entry') as HTMLElement | null;
        if (!entry || !menu.contains(entry)) return;
        own.add(entry);
        if (entry.dataset.nextStatus !== 'added') entry.dataset.nextStatus = status;
      };
      for (const input of $$('input[name], select[name], textarea[name]', menu) as HTMLElement[]) {
        const status = statusOf(input.getAttribute('name') || '');
        if (status) markOwn(input, status);
      }
      for (const el of $$('[data-next-key]', menu) as HTMLElement[]) {
        const status = statusOf(el.dataset.nextKey || '');
        if (status) markOwn(el, status);
      }
      // Pass 2: an ancestor submenu that holds a neXT item but isn't itself a neXT
      // feature is an existing menu that gained one -> amber container badge.
      for (const entry of own) {
        let node: HTMLElement | null =
          entry.parentElement ? (entry.parentElement.closest('.entry') as HTMLElement | null) : null;
        while (node && menu.contains(node)) {
          if (!own.has(node) && !node.dataset.nextStatus) node.dataset.nextStatus = 'changed';
          node = node.parentElement ? (node.parentElement.closest('.entry') as HTMLElement | null) : null;
        }
      }
      // Pass 3: a wholly-neXT submenu (its parent is itself a neXT feature, green)
      // collapses to that single header dot — drop any dots on its descendants so
      // it reads as one green dot, not a wall of them.
      for (const entry of own) {
        if (entry.dataset.nextStatus !== 'added' || !entry.classList.contains('has-submenu')) continue;
        for (const child of $$('[data-next-status]', entry) as HTMLElement[]) delete child.dataset.nextStatus;
      }
    }

    close() {
      if (!menuNode || !(lastToggledButton || anchorPoint)) { return; }
      // Hide instead of removing: the node stays in the DOM so its exit
      // animation can finish. transition-behavior: allow-discrete defers the
      // display:none flip until the opacity/transform transition ends.
      $.addClass(menuNode, 'menu-hidden');
      $.addClass(menuBackdrop, 'menu-hidden');
      delete this.menu;
      if (lastToggledButton) { $.rmClass(lastToggledButton, 'active'); }
      currentMenu       = null;
      lastToggledButton = null;
      anchorPoint       = null;
      $.off(d, 'click scroll CloseMenu', this.close);
      $.off(d, 'scroll', this.setPosition);
      $.off(window, 'resize', this.setPosition);
      return $.event('MenuClosed');
    }

    findNextEntry(entry: any, direction: number) {
      const entries = [...entry.parentNode.children];
      entries.sort((first, second) => first.style.order - second.style.order);
      return entries[entries.indexOf(entry) + direction];
    }

    keybinds(e: KeyboardEvent) {
      let subEntry;
      let next, submenu;
      let entry = $('.focused', this.menu);
      while ((subEntry = $('.focused', entry))) {
        entry = subEntry;
      }

      switch (e.keyCode) {
        case 27: // Esc
          lastToggledButton?.focus();
          this.close();
          break;
        case 13: case 32: // Enter, Space
          entry.click();
          break;
        case 38: // Up
          if (next = this.findNextEntry(entry, -1)) {
            this.focus(next);
          }
          break;
        case 40: // Down
          if (next = this.findNextEntry(entry, +1)) {
            this.focus(next);
          }
          break;
        case 39: // Right
          if ((submenu = $('.submenu', entry)) && (next = submenu.firstElementChild)) {
            let nextPrev;
            while ((nextPrev = this.findNextEntry(next, -1))) {
              next = nextPrev;
            }
            this.focus(next);
          }
          break;
        case 37: // Left
          if (next = $.x('parent::*[contains(@class,"submenu")]/parent::*', entry)) {
            this.focus(next);
          }
          break;
        default:
          return;
      }

      e.preventDefault();
      return e.stopPropagation();
    }

    onFocus(e: Event) {
      e.stopPropagation();
      return this.focus(e.target);
    }

    focus(entry: any) {
      let focused, submenu;
      while ((focused = $.x('parent::*/child::*[contains(@class,"focused")]', entry))) {
        $.rmClass(focused, 'focused');
      }
      for (focused of $$('.focused', entry)) {
        $.rmClass(focused, 'focused');
      }
      $.addClass(entry, 'focused');

      // Submenu positioning.
      if (!(submenu = $('.submenu', entry))) { return; }
      const sRect   = submenu.getBoundingClientRect();
      const eRect   = entry.getBoundingClientRect();
      const cHeight = doc.clientHeight;
      const cWidth  = doc.clientWidth;
      const [top, bottom] = (eRect.top + sRect.height) < cHeight ?
        ['0px', 'auto']
      :
        ['auto', '0px'];
      // Cascade submenus in the same direction their parent opened, so a chain
      // of nested submenus keeps flowing outward instead of folding back over
      // the parent menu. The root menu's direction is its `left` class; each
      // nested submenu records its own direction in `submenu-left` for its
      // children to follow.
      const container = entry.parentNode;
      const preferLeft = container && container.classList.contains('submenu') ?
        container.classList.contains('submenu-left')
      :
        this.menu.classList.contains('left');
      const fitsRight = (eRect.right + sRect.width) < (cWidth - 150);
      const fitsLeft  = (eRect.left - sRect.width) > 4;
      const openLeft  = preferLeft ? (fitsLeft || !fitsRight) : !fitsRight;
      submenu.classList.toggle('submenu-left', openLeft);
      const [left, right] = openLeft ? ['auto', '100%'] : ['100%', 'auto'];
      const {style} = submenu;
      style.top    = top;
      style.bottom = bottom;
      style.left   = left;
      return style.right  = right;
    }

    addEntry(entry: any) {
      this.parseEntry(entry);
      return this.entries.push(entry);
    }

    parseEntry(entry: any) {
      const {el, subEntries} = entry;
      $.addClass(el, 'entry');
      $.on(el, 'focus mouseover', this.onFocus);
      el.style.order = entry.order || 100;
      if (!subEntries) { return; }
      $.addClass(el, 'has-submenu');
      // On mobile, submenus expand inline on tap; hover-driven opening via
      // .focused is unreliable on touch (mouseover isn't guaranteed on tap).
      $.on(el, 'click', (e: Event) => {
        if (!doc.classList.contains('xt-mobile')) { return; }
        const submenu = $('.submenu', el);
        if (submenu && submenu.contains(e.target as Node)) { return; }
        const open = !el.classList.contains('submenu-open');
        if (open && el.parentNode) {
          for (const sibling of el.parentNode.children) {
            if (sibling !== el) { $.rmClass(sibling, 'submenu-open'); }
          }
        }
        el.classList.toggle('submenu-open', open);
      });
      for (var subEntry of subEntries) {
        this.parseEntry(subEntry);
      }
      const span = $.el('span',
        {className: 'menu-indicator'}
      );
      Icon.set(span, 'caretRight');
      $.add(el, span);
    }
  };
  Menu.initClass();
  return Menu;
})();

export var dragstart = function (this: any, e: any) {
  let isTouching;
  if ((e.type === 'mousedown') && (e.button !== 0)) { return; } // not LMB
  // prevent text selection
  e.preventDefault();
  if (isTouching = e.type === 'touchstart') {
    e = e.changedTouches[e.changedTouches.length - 1];
  }
  // distance from pointer to el edge is constant; calculate it here.
  let el: any = $.x('ancestor::div[contains(@class,"dialog")][1]', this);
  if (el.id === 'thread-watcher' && threadWatcherAttached()) {
    const qr = $.id('qr');
    if (qr && !qr.hidden) {
      // Dragging an attached watcher moves the QR/watcher pair. Detaching is
      // handled only by the watcher's attach button.
      el = qr;
    }
  }
  const rect = el.getBoundingClientRect();
  const screenHeight = doc.clientHeight;
  const screenWidth  = doc.clientWidth;
  const o: any = {
    id:     el.id,
    style:  el.style,
    dx:     e.clientX - rect.left,
    dy:     e.clientY - rect.top,
    height: screenHeight - rect.height,
    width:  screenWidth  - rect.width,
    screenHeight,
    screenWidth,
    isTouching,
    // Assigned later; declared so the singleton's type includes them. Loosely typed
    // where a precise type would cascade new errors; tighten during the strict pass.
    topBorder: 0,
    bottomBorder: 0,
    identifier: null as any,
    move: null as any,
    up: null as any
  };

  [o.topBorder, o.bottomBorder] = Conf['Header auto-hide'] || !Conf['Fixed Header'] ?
    [0, 0]
  : Conf['Bottom Header'] ?
    [0, Header.bar.getBoundingClientRect().height]
  :
    [Header.bar.getBoundingClientRect().height, 0];

  if (isTouching) {
    o.identifier = e.identifier;
    o.move = touchmove.bind(o);
    o.up   = touchend.bind(o);
    $.on(d, 'touchmove', o.move);
    return $.on(d, 'touchend touchcancel', o.up);
  } else { // mousedown
    o.move = drag.bind(o);
    o.up   = dragend.bind(o);
    $.on(d, 'mousemove', o.move);
    return $.on(d, 'mouseup',   o.up);
  }
};

export var touchmove = function (this: any, e: TouchEvent) {
  for (var touch of e.changedTouches) {
    if (touch.identifier === this.identifier) {
      drag.call(this, touch);
      return;
    }
  }
};

export var drag = function (this: any, e: any) {
  const {clientX, clientY} = e;

  let left: any = clientX - this.dx;
  left = left < 10 ?
    0
  : (this.width - left) < 10 ?
    ''
  :
    ((left / this.screenWidth) * 100) + '%';

  let top: any = clientY - this.dy;
  top = top < (10 + this.topBorder) ?
    this.topBorder + 'px'
  : (this.height - top) < (10 + this.bottomBorder) ?
    ''
  :
    ((top / this.screenHeight) * 100) + '%';

  const right = left === '' ?
    0
  :
    '';

  const bottom = top === '' ?
    this.bottomBorder + 'px'
  :
    '';

  const {style} = this;
  style.left   = left;
  style.right  = right;
  style.top    = top;
  style.bottom = bottom;

  if (this.id === 'qr') {
    $.event('4chanXQRMove', { dragging: true });  // attached watcher listens directly for tight following (no rAF lag)
  }
};

export var touchend = function (this: any, e: TouchEvent) {
  for (var touch of e.changedTouches) {
    if (touch.identifier === this.identifier) {
      dragend.call(this);
      return;
    }
  }
};

export var dragend = function (this: any) {
  if (this.isTouching) {
    $.off(d, 'touchmove', this.move);
    $.off(d, 'touchend touchcancel', this.up);
  } else { // mouseup
    $.off(d, 'mousemove', this.move);
    $.off(d, 'mouseup',   this.up);
  }
  if (this.id === 'thread-watcher' && threadWatcherAttached()) { return; }
  if (this.style.length === 2) { // assume only left or right and top or bottom
    $.set(`${this.id}.position`, this.style.cssText);
  } else { // only include position data.
    const { left, right, top, bottom } = this.style;
    let position = '';
    if (left) position += `left:${left};`;
    if (right) position += `right:${right};`;
    if (top) position += `top:${top};`;
    if (bottom) position += `bottom:${bottom};`;
    $.set(`${this.id}.position`, position);
  }
  if (this.id === 'thread-watcher') {
    $.event('4chanXDragend', {id: this.id});
  }
  if (this.id === 'qr') {
    $.event('4chanXQRMove', { dragging: false });
  }
};

const hoverstart = function ({ root, el, latestEvent, endEvents, height, width, cb, noRemove }: {
  root: HTMLElement;
  el: HTMLElement;
  latestEvent: any;
  endEvents: string;
  height?: number;
  width?: number;
  cb?: (() => void) | null;
  noRemove?: boolean;
}) {
  const rect = root.getBoundingClientRect();
  const o: any = {
    root,
    el,
    style: el.style,
    isImage: ['IMG', 'VIDEO'].includes(el.nodeName),
    cb,
    endEvents,
    latestEvent,
    clientHeight: doc.clientHeight,
    clientWidth:  doc.clientWidth,
    height,
    width,
    noRemove,
    clientX: (rect.left + rect.right) / 2,
    clientY: (rect.top + rect.bottom) / 2,
    // Assigned later; declared so the singleton's type includes them. Loosely typed
    // where a precise type would cascade new errors; tighten during the strict pass.
    hover: null as any,
    hoverend: null as any,
    workaround: null as any
  };
  o.hover    = hover.bind(o);
  o.hoverend = hoverend.bind(o);

  o.hover(o.latestEvent);
  new MutationObserver(function() {
    if (el.parentNode) { return o.hover(o.latestEvent); }
  }).observe(el, {childList: true});

  $.on(root, endEvents,   o.hoverend);
  if ($.x('ancestor::div[contains(@class,"inline")][1]', root)) {
    $.on(d,    'keydown',   o.hoverend);
  }
  $.on(root, 'mousemove', o.hover);

  // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=674955
  o.workaround = function(e: any) { if (!root.contains(e.target)) { return o.hoverend(e); } };
  return $.on(doc,  'mousemove', o.workaround);
};

hoverstart.padding = 25;

export var hover = function (this: any, e: any) {
  this.latestEvent = e;
  const height = (this.height || this.el.offsetHeight) + hoverstart.padding;
  const width  = (this.width  || this.el.offsetWidth);
  const {clientX, clientY} = Conf['Follow Cursor'] ? e : this;

  const top = this.isImage ?
    Math.max(0, (clientY * (this.clientHeight - height)) / this.clientHeight)
  :
    Math.max(0, Math.min(this.clientHeight - height, clientY - 120));

  let threshold = this.clientWidth / 2;
  if (!this.isImage) { threshold = Math.max(threshold, this.clientWidth - 400); }
  let marginX = (clientX <= threshold ? clientX : this.clientWidth - clientX) + 45;
  if (this.isImage) { marginX = Math.min(marginX, this.clientWidth - width); }
  marginX += 'px';
  const [left, right] = clientX <= threshold ? [marginX, ''] : ['', marginX];

  const {style} = this;
  style.top   = top + 'px';
  style.left  = left;
  return style.right = right;
};

export var hoverend = function (this: any, e: any) {
  if (((e.type === 'keydown') && (e.keyCode !== 13)) || (e.target.nodeName === "TEXTAREA")) { return; }
  if (!this.noRemove) { $.rm(this.el); }
  $.off(this.root, this.endEvents,  this.hoverend);
  $.off(d,     'keydown',   this.hoverend);
  $.off(this.root, 'mousemove', this.hover);
  // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=674955
  $.off(doc,   'mousemove', this.workaround);
  if (this.cb) { return this.cb.call(this); }
};

export const checkbox = function (name: string, text: string, checked?: any) {
  if (checked == null) { checked = Conf[name]; }
  const label = $.el('label');
  const input = $.el('input', {type: 'checkbox', name, checked});
  $.add(label, [input, $.tn(` ${text}`)]);
  return label;
};

const UI = {
  dialog,
  Menu,
  hover:    hoverstart,
  checkbox
};
export default UI;
