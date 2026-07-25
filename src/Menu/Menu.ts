import Callbacks from "../classes/Callbacks";
import type Post from "../classes/Post";
import Get from "../General/Get";
import UI from "../General/UI";
import { g, Conf, d, doc } from "../globals/globals";
import $ from "../platform/$";
import Icon from "../Icons/icon";

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_LIMIT = 10;

var Menu = {
  button: null as any,  // loose: late-assigned element, read by other modules
  menu: null as any,    // loose: late-assigned UI.Menu instance, read by other modules

  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread') || !Conf['Menu']) { return; }

    this.button = $.el('a', {
      className: 'menu-button',
      href:      'javascript:;'
    }
    );

    Icon.set(this.button, 'caretDown');

    this.menu = new UI.Menu('post');
    this.initLongPress();
    Callbacks.Post.push({
      name: 'Menu',
      cb:   this.node
    });

    return Callbacks.CatalogThread.push({
      name: 'Menu',
      cb:   this.catalogNode
    });
  },

  node(this: Post) {
    if (this.isClone) {
      const button = $('.menu-button', this.nodes.info);
      $.rmClass(button, 'active');
      $.rm($('.dialog', this.nodes.info));
      Menu.makeButton(this, button);
      return;
    }
    return $.add(this.nodes.info, Menu.makeButton(this));
  },

  catalogNode(this: Post) {
    return $.after((this.nodes as any).icons, Menu.makeButton(this.thread.OP));
  },

  makeButton(post: Post, button?: HTMLElement) {
    if (!button) { button = Menu.button.cloneNode(true); }
    $.on(button, 'click', function(this: HTMLElement, e) {
      return Menu.menu.toggle(e, this, post);
    });
    return button;
  },

  initLongPress() {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pressRoot: HTMLElement | null = null;
    let pressedEl: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let fired = false;
    let firing = false;
    let suppressClick = false;

    const setPressed = (el: HTMLElement | null) => {
      if (pressedEl) { $.rmClass(pressedEl, 'xt-press', 'xt-menu-target'); }
      pressedEl = el;
      if (el) { $.addClass(el, 'xt-press'); }
    };

    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      pressRoot = null;
      if (!fired) { setPressed(null); }
    };

    const fire = (e: PointerEvent) => {
      timer = null;
      const root = pressRoot;
      pressRoot = null;
      if (!root) return;
      const post = Get.postFromNode(root);
      if (!post) return;
      fired = true;
      suppressClick = true;
      if (pressedEl) { $.addClass(pressedEl, 'xt-menu-target'); }
      firing = true;
      Menu.menu.toggleAtPoint(e, {x: startX, y: startY}, post);
      firing = false;
    };

    $.on(doc, 'pointerdown', (e: PointerEvent) => {
      fired = false;
      suppressClick = false;
      if (e.pointerType !== 'touch' || !doc.classList.contains('xt-mobile')) return;
      let target = e.target as HTMLElement;
      if (target?.id === 'menu-backdrop') {
        target = (document.elementsFromPoint(e.clientX, e.clientY)
          .find(el => el.id !== 'menu-backdrop' && !el.closest('#menu')) as HTMLElement) || target;
      }
      if (!target?.closest) return;
      const blocked = target.closest('.catalog-thread')
        ? 'input, textarea, select, button, .menu-button, #menu, #qr'
        : 'a, input, textarea, select, button, img, video, audio, iframe, .menu-button, #menu, #qr';
      if (target.closest(blocked)) return;
      const root = target.closest(g.SITE!.selectors.postContainer) as HTMLElement | null;
      if (!root) return;
      pressRoot = root;
      setPressed(root);
      startX = e.clientX;
      startY = e.clientY;
      timer = setTimeout(() => fire(e), LONG_PRESS_MS);
    });

    $.on(doc, 'pointermove', (e: PointerEvent) => {
      if (!pressRoot || e.pointerType !== 'touch') return;
      if (Math.abs(e.clientX - startX) > LONG_PRESS_MOVE_LIMIT || Math.abs(e.clientY - startY) > LONG_PRESS_MOVE_LIMIT) {
        cancel();
      }
    });

    $.on(doc, 'pointerup pointercancel', (e: PointerEvent) => {
      if (e.pointerType === 'touch') cancel();
    });
    $.on(window, 'scroll', cancel);

    doc.addEventListener('contextmenu', (e) => {
      if (fired || pressRoot || (e.target as HTMLElement)?.id === 'menu-backdrop') {
        e.preventDefault();
        fired = false;
      }
    });

    doc.addEventListener('click', (e) => {
      if (suppressClick) {
        suppressClick = false;
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    $.on(d, 'MenuClosed', () => {
      if (!firing && !timer && !pressRoot) { setPressed(null); }
    });
  }
};
export default Menu;
