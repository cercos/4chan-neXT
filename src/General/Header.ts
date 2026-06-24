import Redirect from "../Archive/Redirect";
import Notice from "../classes/Notice";
import { Conf, d, doc, E, g } from "../globals/globals";
import Main from "../main/Main";
import CatalogLinks from "../Miscellaneous/CatalogLinks";
import $ from "../platform/$";
import $$ from "../platform/$$";
import BoardConfig from "./BoardConfig";
import Get from "./Get";
import Settings from "./Settings";
import UI from "./UI";
import meta from '../../package.json';
import Icon from "../Icons/icon";

var Header = {
  // Assigned later; declared so the singleton's type includes them. Loosely typed
  // where a precise type would cascade new errors; tighten during the strict pass.
  menu: null as any,
  boardList: null as any,
  bottomBoardList: null as any,
  barFixedToggler: null as any,
  scrollHeaderToggler: null as any,
  barPositionToggler: null as any,
  linkJustifyToggler: null as any,
  headerToggler: null as any,
  footerToggler: null as any,
  bannerToggler: null as any,
  shortcutToggler: null as any,
  customNavToggler: null as any,
  previousOffset: 0,

  init() {
    $.onExists(doc, 'body', () => {
      if (!Main.isThisPageLegit()) { return; }
      $.add(this.bar, [this.noticesRoot, this.toggle]);
      $.prepend(d.body, this.bar);
      $.add(d.body, Header.hover);
      return this.setBarPosition(Conf['Bottom Header']);
  });

    this.menu = new UI.Menu('header');

    const menuButton = $.el('span',
      {className: 'menu-button'}
    );
    Icon.set(menuButton, 'caretDown', 'Menu');

    const box = UI.checkbox;

    const barFixedToggler     = box('Fixed Header',               'Fixed Header');
    const headerToggler       = box('Header auto-hide',           'Auto-hide header');
    const scrollHeaderToggler = box('Header auto-hide on scroll', 'Auto-hide header on scroll');
    const barPositionToggler  = box('Bottom Header',              'Bottom header');
    const linkJustifyToggler  = box('Centered links',             'Centered links');
    const customNavToggler    = box('Custom Board Navigation',    'Custom board navigation');
    const footerToggler       = box('Bottom Board List',          'Hide bottom board list');
    const bannerToggler       = box('Hide Board Banner',          'Hide board banner');
    const shortcutToggler     = box('Shortcut Icons',             'Shortcut Icons');
    const editCustomNav = $.el('a', {
      textContent: 'Edit custom board navigation',
      href: 'javascript:;'
    }
    );

    this.barFixedToggler     = barFixedToggler.firstElementChild;
    this.scrollHeaderToggler = scrollHeaderToggler.firstElementChild;
    this.barPositionToggler  = barPositionToggler.firstElementChild;
    this.linkJustifyToggler  = linkJustifyToggler.firstElementChild;
    this.headerToggler       = headerToggler.firstElementChild;
    this.footerToggler       = footerToggler.firstElementChild;
    this.bannerToggler       = bannerToggler.firstElementChild;
    this.shortcutToggler     = shortcutToggler.firstElementChild;
    this.customNavToggler    = customNavToggler.firstElementChild;

    $.on(menuButton,           'click',  this.menuToggle);
    $.on(this.headerToggler,       'change', this.toggleBarVisibility);
    $.on(this.barFixedToggler,     'change', this.toggleBarFixed);
    $.on(this.barPositionToggler,  'change', this.toggleBarPosition);
    $.on(this.scrollHeaderToggler, 'change', this.toggleHideBarOnScroll);
    $.on(this.linkJustifyToggler,  'change', this.toggleLinkJustify);
    $.on(this.footerToggler,       'change', this.toggleFooterVisibility);
    $.on(this.bannerToggler,       'change', this.toggleBannerVisibility);
    $.on(this.shortcutToggler,     'change', this.toggleShortcutIcons);
    $.on(this.customNavToggler,    'change', this.toggleCustomNav);
    $.on(editCustomNav,        'click',  this.editCustomNav);

    this.setBarFixed(Conf['Fixed Header']);
    this.setHideBarOnScroll(Conf['Header auto-hide on scroll']);
    this.setBarVisibility(Conf['Header auto-hide']);
    this.setLinkJustify(Conf['Centered links']);
    this.setShortcutIcons(Conf['Shortcut Icons']);
    this.setFooterVisibility(Conf['Bottom Board List']);
    this.setBannerVisibility(Conf['Hide Board Banner']);

    $.sync('Fixed Header',               this.setBarFixed);
    $.sync('Header auto-hide on scroll', this.setHideBarOnScroll);
    $.sync('Bottom Header',              this.setBarPosition);
    $.sync('Shortcut Icons',             this.setShortcutIcons);
    $.sync('Header auto-hide',           this.setBarVisibility);
    $.sync('Centered links',             this.setLinkJustify);
    $.sync('Bottom Board List',          this.setFooterVisibility);
    $.sync('Hide Board Banner',          this.setBannerVisibility);

    this.addShortcut('menu', menuButton, 900);

    this.menu.addEntry({
      el: $.el('span',
        {textContent: 'Header'}),
      order: 107,
      subEntries: [
          {el: barFixedToggler}
        ,
          {el: headerToggler}
        ,
          {el: scrollHeaderToggler}
        ,
          {el: barPositionToggler}
        ,
          {el: linkJustifyToggler}
        ,
          {el: footerToggler}
        ,
          {el: bannerToggler}
        ,
          {el: shortcutToggler}
        ,
          {el: customNavToggler}
        ,
          {el: editCustomNav}
      ]});

    // Quick access to the "Highlight neXT" toggle (also in the settings footer) so
    // the neXT dots in menus can be dismissed without opening settings. Shares the
    // one state via Settings.setHighlightNext; stopPropagation keeps the menu open
    // so the dots update live as it is toggled.
    const highlightNextToggle = $.el('label', {
      title: 'Mark settings and menu items neXT added or changed compared to 4chan-X.',
      innerHTML: '<input type="checkbox"> Highlight neXT'
    }) as HTMLLabelElement;
    const highlightNextInput = $('input', highlightNextToggle) as HTMLInputElement;
    $.on(highlightNextToggle, 'click', (e: Event) => e.stopPropagation());
    $.on(highlightNextInput, 'change', () => Settings.setHighlightNext(highlightNextInput.checked));
    this.menu.addEntry({
      el: highlightNextToggle,
      order: 800,
      open() {
        highlightNextInput.checked = Settings.highlightNext;
        return true;
      }
    });

    $.on(d, 'CreateNotification', this.createNotification);

    this.setBoardList();

    $.onExists(doc, `${g.SITE!.selectors.boardList} + *`, Header.generateFullBoardList);

    Main.ready(function() {
      let footer;
      if ((g.SITE!.software === 'yotsuba') && !(footer = $.id('boardNavDesktopFoot'))) {
        let absbot;
        if (!(absbot = $.id('absbot'))) { return; }
        footer = $.id('boardNavDesktop').cloneNode(true) as HTMLElement;
        footer.id = 'boardNavDesktopFoot';
        $('#navtopright',        footer).id = 'navbotright';
        $('#settingsWindowLink', footer).id = 'settingsWindowLinkBot';
        $.before(absbot, footer);
        $.global('stubCloneTopNav');
      }
      if (Header.bottomBoardList = $(g.SITE!.selectors.boardListBottom)) {
        for (var a of $$('a', Header.bottomBoardList)) {
          if ((a.hostname === location.hostname) && (a.pathname.split('/')[1] === g.BOARD!.ID)) { a.className = 'current'; }
        }
        return CatalogLinks.setLinks(Header.bottomBoardList);
      }
    });

    if ((g.SITE!.software === 'yotsuba') && ((g.VIEW === 'catalog') || !Conf['Disable Native Extension'])) {
      const cs = $.el('a', {href: 'javascript:;'});
      if (g.VIEW === 'catalog') {
        cs.title = (cs.textContent = 'Catalog Settings');
        Icon.set(cs, 'bookOpen', 'Catalog Settings');
        this.addShortcut('native', cs, 810);
      } else {
        cs.title = (cs.textContent = '4chan Settings');
        cs.className = 'native-settings';
        this.addShortcut('native', cs, 810);
      }
      $.on(cs, 'click', () => $.id('settingsWindowLink').click());
    }

    return this.enableDesktopNotifications();
  },

  bar: $.el('div',
    {id: 'header-bar'}),

  noticesRoot: $.el('div',
    {id: 'notifications'}),

  shortcuts: $.el('span',
    {id: 'shortcuts'}),

  hover: $.el('div',
    {id: 'hoverUI'}),

  toggle: $.el('div',
    {id: 'scroll-marker'}),

  setBoardList() {
    let boardList;
    Header.boardList = (boardList = $.el('span',
      {id: 'board-list'}));
    $.extend(boardList, {innerHTML: "<span id=\"custom-board-list\"></span><span id=\"full-board-list\" hidden><span class=\"hide-board-list-container brackets-wrap\"><a href=\"javascript:;\" class=\"hide-board-list-button\">&nbsp;-&nbsp;</a></span> <span class=\"boardList\"></span></span>"});

    const btn = $('.hide-board-list-button', boardList);
    $.on(btn, 'click', Header.toggleBoardList);

    $.prepend(Header.bar, [Header.boardList, Header.shortcuts]);

    Header.setCustomNav(Conf['Custom Board Navigation']);
    Header.generateBoardList(Conf['boardnav']);

    $.sync('Custom Board Navigation', Header.setCustomNav);
    return $.sync('boardnav', Header.generateBoardList);
  },

  generateFullBoardList() {
    let nodes;
    const transformBoardList = (g.SITE as any).transformBoardList;
    if (transformBoardList) {
      nodes = transformBoardList();
    } else {
      nodes = [...$(g.SITE!.selectors.boardList).cloneNode(true).childNodes];
    }
    const fullBoardList = $('.boardList', Header.boardList);
    $.add(fullBoardList, nodes);
    for (var a of $$('a', fullBoardList)) {
      if ((a.hostname === location.hostname) && (a.pathname.split('/')[1] === g.BOARD!.ID)) { a.className = 'current'; }
    }
    return CatalogLinks.setLinks(fullBoardList);
  },

  generateBoardList(boardnav: string) {
    const list = $('#custom-board-list', Header.boardList);
    $.rmAll(list);
    if (!boardnav) return;
    boardnav = boardnav.replace(/(\r\n|\n|\r)/g, ' ');
    const segments = boardnav.split(/(\{\{(?:"[^"]+")?|\}\})/);
    const spanStack: HTMLElement[] = [];
    let currentContainer = list;
    segments.forEach(segment => {
      if (segment.startsWith('{{')) {
        const span = $.el('span');
        $.add(currentContainer, span);
        spanStack.push(span);
        currentContainer = span;
        if (segment.length > 2) span.className = segment.slice(3, -1);
      } else if (segment === '}}') {
        spanStack.pop();
        currentContainer = spanStack.length > 0 ? spanStack[spanStack.length - 1] : list;
      } else {
        const re = /[\w@]+(-(all|title|replace|full|index|catalog|archive|expired|nt|(mode|sort|text):"[^"]+"(,"[^"]+")?))*|[^\w@]+/g;
        const segmentNodes = (segment.match(re) || []).map((t) => Header.mapCustomNavigation(t));
        segmentNodes.forEach(node => currentContainer.appendChild(node));
      }
    });
    return CatalogLinks.setLinks(list);
  },

  mapCustomNavigation(t: string) {
    let a, href, m;
    let url: string | null;
    if (/^[^\w@]/.test(t)) {
      return $.tn(t);
    }

    let text: string | null;
    text = (url = null);
    t = t.replace(/-text:"([^"]+)"(?:,"([^"]+)")?/g, function(m0: string, m1: string, m2: string) {
      text = m1;
      url  = m2;
      return '';
    });

    let indexOptions: any = [];
    t = t.replace(/-(?:mode|sort):"([^"]+)"/g, function(m0: string, m1: string) {
      indexOptions.push(m1.toLowerCase().replace(/\ /g, '-'));
      return '';
    });
    indexOptions = indexOptions.join('/');

    if (/^toggle-all/.test(t)) {
      a = $.el('a', {
        className: 'show-board-list-button',
        textContent: text || '+',
        href: 'javascript:;'
      }
      );
      $.on(a, 'click', Header.toggleBoardList);
      return a;
    }

    if (/^external/.test(t)) {
      a = $.el('a', {
        href: url || 'javascript:;',
        textContent: text || '+',
        className: 'external'
      }
      );
      if (/-nt/.test(t)) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      return a;
    }

    let boardID = t.split('-')[0];
    if (boardID === 'current') {
      if (['boards.4chan.org', 'boards.4channel.org'].includes(location.hostname)) {
        boardID = g.BOARD!.ID;
      } else {
        a = $.el('a', {
          href: `/${g.BOARD!.ID}/`,
          textContent: text || decodeURIComponent(g.BOARD!.ID),
          className: 'current'
        }
        );
        if (/-nt/.test(t)) {
          a.target = '_blank';
          a.rel = 'noopener';
        }
        if (/-index/.test(t)) {
          a.dataset.only = 'index';
        } else if (/-catalog/.test(t)) {
          a.dataset.only = 'catalog';
          a.href += 'catalog.html';
        } else if (/-(archive|expired)/.test(t)) {
          a = a.firstChild; // Its text node.
        }
        return a;
      }
    }

    a = (function() {
      let urlV;
      if (boardID === '@') {
        return $.el('a', {
          href: 'https://twitter.com/4chan',
          title: '4chan Twitter',
          className: 'navSmall',
          textContent: '@'
        }
        );
      }

      a = $.el('a', {
        href: `//${BoardConfig.domain(boardID)}/${boardID}/`,
        textContent: boardID,
        title: BoardConfig.title(boardID)
      }
      );
      if ((g.VIEW === 'catalog' || g.VIEW === 'archive') && (urlV = Get.url(g.VIEW, {siteID: '4chan.org', boardID}))) {
        a.href = urlV;
      }
      if ((a.hostname === location.hostname) && (boardID === g.BOARD!.ID)) { a.className = 'current'; }
      return a;
    })();

    a.textContent = /-title/.test(t) || (/-replace/.test(t) && (a.hostname === location.hostname) && (boardID === g.BOARD!.ID)) ?
      a.title || a.textContent
    : /-full/.test(t) ?
      (`/${boardID}/`) + (a.title ? ` - ${a.title}` : '')
    :
      text || boardID;

    if (m = t.match(/-(index|catalog)/)) {
      const urlIC = CatalogLinks[m[1] as 'index' | 'catalog']({siteID: '4chan.org', boardID} as any); // loose: CatalogLinks.index/catalog declare a Board param but accept this URL-id literal (matches their internal `as any` usage)
      if (urlIC) {
        a.dataset.only = m[1];
        a.href = urlIC;
        if (m[1] === 'catalog') { $.addClass(a, 'catalog'); }
      } else {
        return a.firstChild; // Its text node.
      }
    }

    if (Conf['JSON Index'] && indexOptions) {
      a.dataset.indexOptions = indexOptions;
      if (['boards.4chan.org', 'boards.4channel.org'].includes(a.hostname) && (a.pathname.split('/')[2] === '')) {
        a.href += (a.hash ? '/' : '#') + indexOptions;
      }
    }

    if (/-archive/.test(t)) {
      if (href = Redirect.to('board', {boardID})) {
        a.href = href;
      } else {
        return a.firstChild; // Its text node.
      }
    }

    if (/-expired/.test(t)) {
      if (BoardConfig.isArchived(boardID)) {
        a.href = `//${BoardConfig.domain(boardID)}/${boardID}/archive`;
      } else {
        return a.firstChild; // Its text node.
      }
    }

    if (/-nt/.test(t)) {
      a.target = '_blank';
      a.rel = 'noopener';
    }

    return a;
  },

  toggleBoardList() {
    const {bar}  = Header;
    const custom = $('#custom-board-list', bar);
    const full   = $('#full-board-list',   bar);
    const showBoardList = !full.hidden;
    custom.hidden = !showBoardList;
    return full.hidden   =  showBoardList;
  },

  setLinkJustify(centered: boolean | undefined) {
    Header.linkJustifyToggler.checked = centered;
    if (centered) {
      return $.addClass(doc, 'centered-links');
    } else {
      return $.rmClass(doc, 'centered-links');
    }
  },

  toggleLinkJustify(this: HTMLInputElement) {
    $.event('CloseMenu');
    const centered = this.nodeName === 'INPUT' ?
      this.checked : undefined;
    Header.setLinkJustify(centered);
    return $.set('Centered links', centered);
  },

  setBarFixed(fixed: boolean) {
    Header.barFixedToggler.checked = fixed;
    if (fixed) {
      $.addClass(doc, 'fixed');
      return $.addClass(Header.bar, 'dialog');
    } else {
      $.rmClass(doc, 'fixed');
      return $.rmClass(Header.bar, 'dialog');
    }
  },

  toggleBarFixed(this: HTMLInputElement) {
    $.event('CloseMenu');

    Header.setBarFixed(this.checked);

    Conf['Fixed Header'] = this.checked;
    return $.set('Fixed Header',  this.checked);
  },

  setShortcutIcons(show: boolean) {
    Header.shortcutToggler.checked = show;
    if (show) {
      return $.addClass(doc, 'shortcut-icons');
    } else {
      return $.rmClass(doc, 'shortcut-icons');
    }
  },

  toggleShortcutIcons(this: HTMLInputElement) {
    $.event('CloseMenu');

    Header.setShortcutIcons(this.checked);

    Conf['Shortcut Icons'] = this.checked;
    return $.set('Shortcut Icons',  this.checked);
  },

  setBarVisibility(hide: boolean) {
    Header.headerToggler.checked = hide;
    $.event('CloseMenu');
    (hide ? $.addClass : $.rmClass)(Header.bar, 'autohide');
    return (hide ? $.addClass : $.rmClass)(doc, 'autohide');
  },

  toggleBarVisibility(this: HTMLInputElement | Record<string, any>) {
    const hide = this.nodeName === 'INPUT' ?
      this.checked
    :
      !$.hasClass(Header.bar, 'autohide');

    Conf['Header auto-hide'] = hide;
    $.set('Header auto-hide', hide);
    Header.setBarVisibility(hide);
    const message = `The header bar will ${hide ?
      'automatically hide itself.'
    :
      'remain visible.'}`;
    return new Notice('info', message, 2);
  },

  setHideBarOnScroll(hide: boolean) {
    Header.scrollHeaderToggler.checked = hide;
    if (hide) {
      $.on(window, 'scroll', Header.hideBarOnScroll);
      return;
    }
    $.off(window, 'scroll', Header.hideBarOnScroll);
    $.rmClass(Header.bar, 'scroll');
    return Header.bar.classList.toggle('autohide', Conf['Header auto-hide']);
  },

  toggleHideBarOnScroll(this: HTMLInputElement) {
    const hide = this.checked;
    $.cb.checked.call(this);
    return Header.setHideBarOnScroll(hide);
  },

  hideBarOnScroll() {
    const offsetY = window.pageYOffset;
    if (offsetY > (Header.previousOffset || 0)) {
      $.addClass(Header.bar, 'autohide', 'scroll');
    } else {
      $.rmClass(Header.bar,  'autohide', 'scroll');
    }
    return Header.previousOffset = offsetY;
  },

  setBarPosition(bottom: boolean) {
    if (Header.barPositionToggler) Header.barPositionToggler.checked = bottom;
    $.event('CloseMenu');
    const args = bottom ? [
      'bottom-header',
      'top-header',
      'after'
    ] : [
      'top-header',
      'bottom-header',
      'add'
    ];

    $.addClass(doc, args[0]);
    $.rmClass(doc, args[1]);
    return $[args[2] as 'after' | 'add'](Header.bar, Header.noticesRoot);
  },

  toggleBarPosition(this: HTMLInputElement) {
    $.cb.checked.call(this);
    return Header.setBarPosition(this.checked);
  },

  setFooterVisibility(hide: boolean) {
    Header.footerToggler.checked = hide;
    return doc.classList.toggle('hide-bottom-board-list', hide);
  },

  setBannerVisibility(hide: boolean) {
    Header.bannerToggler.checked = hide;
    return doc.classList.toggle('hide-board-banner', hide);
  },

  toggleBannerVisibility(this: HTMLInputElement) {
    Header.setBannerVisibility(this.checked);
    return $.set('Hide Board Banner', this.checked);
  },

  toggleFooterVisibility(this: HTMLInputElement) {
    $.event('CloseMenu');
    const hide = this.nodeName === 'INPUT' ?
      this.checked
    :
      $.hasClass(doc, 'hide-bottom-board-list');
    Header.setFooterVisibility(hide);
    $.set('Bottom Board List', hide);
    const message = hide ?
      'The bottom navigation will now be hidden.'
    :
      'The bottom navigation will remain visible.';
    return new Notice('info', message, 2);
  },

  setCustomNav(show: boolean) {
    Header.customNavToggler.checked = show;
    const cust = $('#custom-board-list', Header.bar);
    const full = $('#full-board-list',   Header.bar);
    const btn = $('.hide-board-list-container', full);
    return [cust.hidden, full.hidden, btn.hidden] = show ? [false, true, false] : [true, false, true];
  },

  toggleCustomNav(this: HTMLInputElement) {
    $.cb.checked.call(this);
    return Header.setCustomNav(this.checked);
  },

  editCustomNav() {
    Settings.open('Interface');
    const settings = $.id('fourchanx-settings');
    return $('[name=boardnav]', settings).focus();
  },

  scrollTo(root: HTMLElement, down = false, needed = false) {
    let height, x;
    if (!root.offsetParent) { return; } // hidden or fixed
    if (down) {
      x = Header.getBottomOf(root);
      if (Conf['Fixed Header'] && Conf['Header auto-hide on scroll'] && Conf['Bottom header']) {
        ({height} = Header.bar.getBoundingClientRect());
        if (x <= 0) {
          if (!Header.isHidden()) { x += height; }
        } else {
          if  (Header.isHidden()) { x -= height; }
        }
      }
      if (!needed || (x < 0)) { return window.scrollBy(0, -x); }
    } else {
      x = Header.getTopOf(root);
      if (Conf['Fixed Header'] && Conf['Header auto-hide on scroll'] && !Conf['Bottom header']) {
        ({height} = Header.bar.getBoundingClientRect());
        if (x >= 0) {
          if (!Header.isHidden()) { x += height; }
        } else {
          if  (Header.isHidden()) { x -= height; }
        }
      }
      if (!needed || (x < 0)) { return window.scrollBy(0,  x); }
    }
  },

  scrollToIfNeeded(root: HTMLElement, down?: boolean) {
    return Header.scrollTo(root, down, true);
  },

  getTopOf(root: HTMLElement) {
    let {top} = root.getBoundingClientRect();
    if (Conf['Fixed Header'] && !Conf['Bottom Header']) {
      const headRect = Header.toggle.getBoundingClientRect();
      top     -= headRect.top + headRect.height;
    }
    return top;
  },

  getBottomOf(root: HTMLElement) {
    const {clientHeight} = doc;
    let bottom = clientHeight - root.getBoundingClientRect().bottom;
    if (Conf['Fixed Header'] && Conf['Bottom Header']) {
      const headRect = Header.toggle.getBoundingClientRect();
      bottom  -= (clientHeight - headRect.bottom) + headRect.height;
    }
    return bottom;
  },

  isNodeVisible(node: HTMLElement) {
    if (d.hidden || !doc.contains(node)) { return false; }
    const {height} = node.getBoundingClientRect();
    return ((Header.getTopOf(node) + height) >= 0) && ((Header.getBottomOf(node) + height) >= 0);
  },

  isHidden() {
    const {top} = Header.bar.getBoundingClientRect();
    if (Conf['Bottom header']) {
      return top === doc.clientHeight;
    } else {
      return top < 0;
    }
  },

  addShortcut(id: string, el: HTMLElement, index: number) {
    const shortcut = $.el('span', {
      id: `shortcut-${id}`,
      className: 'shortcut brackets-wrap'
    });
    $.add(shortcut, el);
    shortcut.dataset.index = index.toString();
    for (var item of $$('[data-index]', Header.shortcuts)) {
      if (+item.dataset.index > +index) {
        $.before(item, shortcut);
        return;
      }
    }
    return $.add(Header.shortcuts, shortcut);
  },

  rmShortcut(el: HTMLElement) {
    return $.rm(el.parentElement);
  },

  menuToggle(this: HTMLElement, e: MouseEvent) {
    return Header.menu.toggle(e, this, g);
  },

  createNotification(e: CustomEvent) {
    let notice;
    const {type, content, lifetime} = e.detail;
    return notice = new Notice(type, content, lifetime);
  },

  areNotificationsEnabled: false,
  enableDesktopNotifications() {
    let notice: Notice;
    if (!window.Notification || !Conf['Desktop Notifications']) { return; }
    switch (Notification.permission) {
      case 'granted':
        Header.areNotificationsEnabled = true;
        return;
        break;
      case 'denied':
        // requestPermission doesn't work if status is 'denied',
        // but it'll still work if status is 'default'.
        return;
        break;
    }

    const el = $.el('span',
      {innerHTML:
        `${meta.name} needs your permission to show desktop notifications. ` +
        `[<a href=\"${E(meta.upstreamFaq)}#why-is-4chan-x-asking-for-permission-to-show-desktop-notifications\" target=\"_blank\">FAQ</a>]` +
        `<br><button>Authorize</button> or <button>Disable</button>`
    });
    const [authorize, disable] = $$('button', el);
    $.on(authorize, 'click', () => Notification.requestPermission(function(status) {
      Header.areNotificationsEnabled = status === 'granted';
      if (status === 'default') { return; }
      return notice.close();
    }));
    $.on(disable, 'click', function() {
      $.set('Desktop Notifications', false);
      return notice.close();
    });
    return notice = new Notice('info', el);
  }
};
export default Header;
