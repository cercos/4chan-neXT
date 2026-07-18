import Get from "../General/Get";
import Header from "../General/Header";
import { g, Conf, d, doc } from "../globals/globals";
import $ from "../platform/$";
import $$ from "../platform/$$";
import Icon from "../Icons/icon";
import { detectMobileDevice, resolveMobileLayout } from "./MobileLayout";

var Nav = {
  haveExtra: false, // loose:

  init() {
    const mobile = resolveMobileLayout(Conf['Mobile Layout'], detectMobileDevice());
    switch (g.VIEW) {
      case 'index':
        if (!Conf['Index Navigation'] && !mobile) { return; }
        break;
      case 'thread':
        if (!Conf['Reply Navigation'] && !mobile) { return; }
        break;
      default:
        return;
    }

    const span = $.el('span',
      {id: 'navlinks'});
    const prev = $.el('a', {
      textContent: '▲',
      className: 'navlinks-navlink navlink-prev',
      href: 'javascript:;'
    }
    );
    const next = $.el('a', {
      textContent: '▼',
      className: 'navlinks-navlink navlink-next',
      href: 'javascript:;'
    }
    );

    Icon.set(prev, 'arrowUpLong');
    Icon.set(next, 'arrowDownLong');

    $.on(prev, 'click', this.prev);
    $.on(next, 'click', this.next);

    $.add(span, [prev, $.tn(' '), next]);
    Nav.initDock(span);
    var append = function() {
      $.off(d, '4chanXInitFinished', append);
      return $.add(d.body, span);
    };
    return $.on(d, '4chanXInitFinished', append);
  },

  initDock(span: HTMLElement) {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let suppressClick = false;
    let idleTimer = 0;

    const restartIdle = function() {
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => $.addClass(span, 'navlinks-docked'), 2000);
    };
    if (g.VIEW === 'thread') {
      $.addClass(span, 'navlinks-docked');
    } else {
      restartIdle();
    }

    $.on(span, 'pointerdown', function(e: PointerEvent) {
      startX = e.clientX;
      startY = e.clientY;
      tracking = true;
      suppressClick = false;
      if (!$.hasClass(span, 'navlinks-docked')) { restartIdle(); }
    });
    $.on(span, 'pointermove', function(e: PointerEvent) {
      if (!tracking || !doc.classList.contains('xt-mobile') || $.hasClass(span, 'navlinks-docked')) { return; }
      if (((e.clientX - startX) > 30) && (Math.abs(e.clientY - startY) < 40)) {
        tracking = false;
        suppressClick = true;
        clearTimeout(idleTimer);
        $.addClass(span, 'navlinks-docked');
      }
    });
    $.on(span, 'pointerup', () => tracking = false);
    span.addEventListener('click', function(e) {
      if (suppressClick) {
        suppressClick = false;
      } else if ($.hasClass(span, 'navlinks-docked')) {
        $.rmClass(span, 'navlinks-docked');
        restartIdle();
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    }, true);
  },

  prev() {
    if (g.VIEW === 'thread') {
      return window.scrollTo(0, 0);
    } else {
      return Nav.scroll(-1);
    }
  },

  next() {
    if (g.VIEW === 'thread') {
      return window.scrollTo(0, d.body.scrollHeight);
    } else {
      return Nav.scroll(+1);
    }
  },

  getThread() {
    if (g.VIEW === 'thread') { return g.threads!.get(`${g.BOARD}.${g.THREADID}`).nodes.root; }
    if ($.hasClass(doc, 'catalog-mode')) { return; }
    for (var threadRoot of $$(g.SITE!.selectors.thread)) {
      var thread = Get.threadFromRoot(threadRoot);
      if (!thread) { continue; }
      if (thread.isHidden && !thread.stub) { continue; }
      if (Header.getTopOf(threadRoot) >= -threadRoot.getBoundingClientRect().height) { // not scrolled past
        return threadRoot;
      }
    }
  },

  scroll(delta: number) {
    let next;
    (d.activeElement as any)?.blur();
    let thread = Nav.getThread();
    if (!thread) { return; }
    const axis = delta === +1 ?
      'following'
    :
      'preceding';
    if (next = $.x(`${axis}-sibling::${g.SITE!.xpath.thread}[not(@hidden)][1]`, thread)) {
      // Unless we're not at the beginning of the current thread,
      // and thus wanting to move to beginning,
      // or we're above the first thread and don't want to skip it.
      const top = Header.getTopOf(thread);
      if (((delta === +1) && (top < 5)) || ((delta === -1) && (top > -5))) { thread = next; }
    }
    // Add extra space to the end of the page if necessary so that all threads can be selected by keybinds.
    const extra = (Header.getTopOf(thread) + doc.clientHeight) - d.body.getBoundingClientRect().bottom;
    if (extra > 0) { d.body.style.marginBottom = `${extra}px`; }

    Header.scrollTo(thread);

    if ((extra > 0) && !Nav.haveExtra) {
      Nav.haveExtra = true;
      return $.on(d, 'scroll', Nav.removeExtra);
    }
  },

  removeExtra() {
    const extra = doc.clientHeight - d.body.getBoundingClientRect().bottom;
    if (extra > 0) {
      return d.body.style.marginBottom = `${extra}px`;
    } else {
      d.body.style.marginBottom = '';
      delete (Nav as any).haveExtra;
      return $.off(d, 'scroll', Nav.removeExtra);
    }
  }
};
export default Nav;
