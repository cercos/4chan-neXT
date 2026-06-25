import Callbacks from '../classes/Callbacks';
import CatalogThread from '../classes/CatalogThread';
import DataBoard from '../classes/DataBoard';
import Notice from '../classes/Notice';
import Post from '../classes/Post';
import Thread from '../classes/Thread';
import Config from '../config/Config';
import Filter from '../Filtering/Filter';
import Linkify from '../Linkification/Linkify';
import PostHiding from '../Filtering/PostHiding';
import ThreadHiding from '../Filtering/ThreadHiding';
import Main from '../main/Main';
import CatalogLinks from '../Miscellaneous/CatalogLinks';
import RelativeDates from '../Miscellaneous/RelativeDates';
import ThreadWatcher from '../Monitoring/ThreadWatcher';
import $$ from '../platform/$$';
import $ from '../platform/$';
import QuotePreview from '../Quotelinks/QuotePreview';
import QuoteYou from '../Quotelinks/QuoteYou';
import { c, Conf, d, doc, g } from '../globals/globals';
import Header from './Header';
import UI from './UI';
import Menu from '../Menu/Menu';

import NavLinksPage from './Index/NavLinks.html';
import PageList from './Index/PageList.html';
import BoardConfig from './BoardConfig';
import Get from './Get';
import SearchHighlight from './SearchHighlight';
import { dict, SECOND } from '../platform/helpers';
import Icon from '../Icons/icon';

// Name of the CSS Custom Highlight that paints index/catalog search matches.
const INDEX_SEARCH_HL = 'fourchanx-index-search';

// Class glowed onto an element when a regex search hits a field that has no
// paintable visible text in the tile (an icon, the thumbnail, or a body that
// catalog mode hides). Styled by a `.search-hit` rule in style.css.
const SEARCH_HIT_CLASS = 'search-hit';

// Class tagged onto every post/tile that contains a search match. The ::highlight
// text paint has no DOM presence, so this is the hook userstyles/Custom CSS need
// to style the *whole* matching post (not just the matched characters). Lands on
// the enclosing `.postContainer` in list modes and on the `.catalog-thread` tile
// in catalog mode. Styled by an `.index-search-matched` rule in style.css.
const SEARCH_MATCH_CLASS = 'index-search-matched';

// How each searchable field surfaces a regex hit inside a rendered tile.
//   kind 'text':    paint the matched characters inside the matched element(s).
//   kind 'element': glow the element(s), since the value isn't shown as text.
// `sel` is queried within a thread tile. When a 'text' field's element is hidden
// (e.g. the post body in catalog mode) or an 'element' field's icon is absent,
// the tile falls back to glowing its thumbnail so the hit is still visible.
const SEARCH_FIELD_TARGETS: Record<string, { kind: 'text' | 'element'; sel: string }> = {
  comment:    { kind: 'text',    sel: '.postMessage' },
  subject:    { kind: 'text',    sel: '.subject' },
  name:       { kind: 'text',    sel: '.nameBlock .name' },
  tripcode:   { kind: 'text',    sel: '.postertrip' },
  capcode:    { kind: 'text',    sel: '.capcode' },
  uniqueID:   { kind: 'text',    sel: '.posteruid' },
  postID:     { kind: 'text',    sel: '.postNum' },
  filename:   { kind: 'text',    sel: '.fileText a' },
  dimensions: { kind: 'text',    sel: '.fileText' },
  filesize:   { kind: 'text',    sel: '.fileText' },
  email:      { kind: 'element', sel: '.useremail' },
  flag:       { kind: 'element', sel: '.flag, .bfl' },
  pass:       { kind: 'element', sel: '.n-pu' },
  MD5:        { kind: 'element', sel: '.fileThumb, a.catalog-link' },
};

// Visible thumbnail (or tile) to glow when nothing field-specific can be shown.
const SEARCH_FALLBACK_SEL = 'a.catalog-link, .fileThumb';

// loose: this singleton's methods reference `Index` (the binding) throughout
// their own bodies, so its type can't be inferred from the initializer without
// TS bailing to an implicit-any (TS7022 self-reference). Method bodies and
// parameters are still individually annotated/checked; only the binding's
// outward-facing type is widened. The sole external consumer (ThreadWatcher)
// already accesses it via `(Index as any)`, so this loses no real type safety.
var Index: any = {
  showHiddenThreads: false,
  // Dirty flags toggled by index controls; reset to {} after each pageLoad.
  changed: {} as {
    threads?: boolean; order?: boolean; search?: boolean; mode?: boolean;
    sort?: boolean; page?: boolean; hash?: boolean;
  },

  // Assigned later; declared so the singleton's type includes them. Loosely typed
  // where a precise type would cascade new errors; tighten during the strict pass.
  button: null as unknown as HTMLElement,
  // Set true in init() when the JSON index takes over; read by Keybinds/ExpandThread.
  enabled: false,
  currentPage: null as any,
  currentSort: null as any,
  hideLabel: null as unknown as HTMLElement,
  initFinishedFired: false,
  inputs: null as any,
  lastLongOptions: null as unknown as HTMLElement,
  lastLongThresholds: null as any,
  lastReadPostsDB: null as any,
  liveThreadData: null as any,
  liveThreadDict: null as any,
  liveThreadIDs: null as any,
  loaded: false,
  nTimeout: null as any,
  navLinks: null as unknown as HTMLElement,
  notice: null as any,
  pageNum: null as any,
  pagelist: null as unknown as HTMLElement,
  pagesNum: null as any,
  parsedThreads: null as any,
  replyData: null as any,
  req: null as any,
  root: null as unknown as HTMLElement,
  search: '',
  searchInput: null as any,
  selectMode: null as any,
  selectRev: null as any,
  selectSort: null as any,
  sortedThreadIDs: null as any,
  threadPosition: null as any,
  threadsNumPerPage: null as any,
  threadsWithYous: null as any,

  // Search text contributed by inline-expanded threads, keyed by thread ID. Kept
  // separate from the parsed-thread objects (which parseThreadList rebuilds) so
  // an expansion survives an index refresh. Populated only while a thread is
  // expanded (and thus visible), cleared when it is collapsed — so the search
  // never matches a thread on text you can't see. See ExpandThread.
  expandedSearchText: dict(),

  enabledOn({siteID, boardID}: {siteID: string; boardID: string}) {
    return Conf['JSON Index'] && (g.sites[siteID as any].software === 'yotsuba') && (boardID !== 'f');
  },

  init(this: typeof Index & { selectSize: any; lastLongInputs: any }) {
    let input, inputs, name;
    if (g.VIEW !== 'index') { return; }

    // For IndexRefresh events
    $.one(d, '4chanXInitFinished', this.cb.initFinished);
    $.on(d, 'PostsInserted', this.cb.postsInserted);

    if (!this.enabledOn(g.BOARD!)) { return; }

    this.enabled = true;

    Callbacks.Post.push({
      name: 'Index Page Numbers',
      cb:   this.node
    });
    Callbacks.CatalogThread.push({
      name: 'Catalog Features',
      cb:   this.catalogNode
    });

    this.search = history.state?.searched || '';
    if (history.state?.mode) {
      Conf['Index Mode'] = history.state?.mode;
    }
    this.currentSort = history.state?.sort;
    if (!this.currentSort) { this.currentSort = typeof Conf['Index Sort'] === 'object' ? (
        Conf['Index Sort'][g.BOARD!.ID] || 'bump'
      ) : (
        Conf['Index Sort']
      ); }
    this.currentPage = this.getCurrentPage();
    this.processHash();

    $.addClass(doc, 'index-loading', `${Conf['Index Mode'].replace(/\ /g, '-')}-mode`);
    $.on(window, 'popstate', this.cb.popstate);
    $.on(d, 'scroll', this.scroll);
    $.on(d, 'SortIndex', this.cb.resort);

    // Header refresh button
    this.button = $.el('a', {
      title: 'Refresh',
      href: 'javascript:;',
    });
    Icon.set(this.button, 'refresh', 'Refresh')
    $.on(this.button, 'click', (e) => {
      e.preventDefault();
      Index.update();
    });
    Header.addShortcut('index-refresh', this.button, 590);

    // Header "Index Navigation" submenu
    const entries: any[] = [];
    this.inputs = (inputs = dict());
    for (name in Config.Index) {
      var arr = Config.Index[name as keyof typeof Config.Index];
      if (arr instanceof Array) {
        var label = UI.checkbox(name, `${name[0]}${name.slice(1).toLowerCase()}`);
        label.title = arr[1] as string;
        entries.push({el: label});
        input = label.firstChild;
        $.on(input, 'change', $.cb.checked);
        inputs[name] = input;
      }
    }
    $.on(inputs['Show Replies'], 'change', this.cb.replies);
    $.on(inputs['Catalog Hover Expand'], 'change', this.cb.hover);
    $.on(inputs['Pin Watched Threads'], 'change', this.cb.resort);
    $.on(inputs['Anchor Hidden Threads'], 'change', this.cb.resort);

    const watchSettings = function(e: Event) {
      const target = e.target as HTMLInputElement;
      if (input = $.getOwn(inputs, target.name)) {
        input.checked = target.checked;
        return $.event('change', null, input);
      }
    };
    $.on(d, 'OpenSettings', () => $.on($.id('fourchanx-settings'), 'change', watchSettings));

    const sortEntry = UI.checkbox('Per-Board Sort Type', 'Per-board sort type', (typeof Conf['Index Sort'] === 'object'));
    sortEntry.title = 'Set the sorting order of each board independently.';
    $.on(sortEntry.firstChild, 'change', this.cb.perBoardSort);
    entries.splice(3, 0, {el: sortEntry});

    Header.menu.addEntry({
      el: $.el('span',
        {textContent: 'Index Navigation'}),
      order: 100,
      subEntries: entries
    });

    // Navigation links at top of index
    this.navLinks = $.el('div', {className: 'navLinks json-index'});
    $.extend(this.navLinks, {innerHTML: NavLinksPage});
    $('.cataloglink a', this.navLinks).href = CatalogLinks.catalog();
    if (!BoardConfig.isArchived(g.BOARD!.ID)) { $('.archlistlink', this.navLinks).hidden = true; }
    $.on($('#index-last-refresh a', this.navLinks), 'click', this.cb.refreshFront);

    // Search field
    this.searchInput = $('#index-search', this.navLinks);
    this.setupSearch();
    this.setupSearchHelp();
    $.on(this.searchInput, 'input', this.onSearchInput);
    $.on($('#index-search-clear', this.navLinks), 'click', this.clearSearch);
    Icon.set($('#index-search-clear', this.navLinks), 'xmark');

    // Hidden threads toggle
    this.hideLabel = $('#hidden-label', this.navLinks);
    $.on($('#hidden-toggle a', this.navLinks), 'click', this.cb.toggleHiddenThreads);

    // Drop-down menus and reverse sort toggle
    this.selectRev   = $('#index-rev',  this.navLinks);
    this.selectMode  = $('#index-mode', this.navLinks);
    this.selectSort  = $('#index-sort', this.navLinks);
    this.selectSize  = $('#index-size', this.navLinks);
    $.on(this.selectRev,  'change', this.cb.sort);
    $.on(this.selectMode, 'change', this.cb.mode);
    $.on(this.selectSort, 'change', this.cb.sort);
    $.on(this.selectSize, 'change', $.cb.value);
    $.on(this.selectSize, 'change', this.cb.size);
    for (var select of [this.selectMode, this.selectSize]) {
      select.value = Conf[select.name];
    }
    this.selectRev.checked = /-rev$/.test(Index.currentSort);
    this.selectSort.value  = Index.currentSort.replace(/-rev$/, '');

    // Last Long Reply options
    this.lastLongOptions = $('#lastlong-options', this.navLinks);
    this.lastLongInputs = $$('input', this.lastLongOptions);
    this.lastLongThresholds = [0, 0];
    this.lastLongOptions.hidden = (this.selectSort.value !== 'lastlong');
    for (let i = 0; i < this.lastLongInputs.length; i++) {
      input = this.lastLongInputs[i];
      $.on(input, 'change', this.cb.lastLongThresholds);
      var tRaw = Conf[`Last Long Reply Thresholds ${i}`];
      input.value = (this.lastLongThresholds[i] =
        typeof tRaw === 'object' ? (tRaw[g.BOARD!.ID] ?? 100) : tRaw);
    }

    // Thread container
    this.root = $.el('div', {className: 'board json-index'});
    $.on(this.root, 'click', this.cb.hoverToggle);
    this.cb.size();
    this.cb.hover();

    // Page list
    this.pagelist = $.el('div', {className: 'pagelist json-index'});
    $.extend(this.pagelist, {innerHTML: PageList});
    $('.cataloglink a', this.pagelist).href = CatalogLinks.catalog();
    $.on(this.pagelist, 'click', this.cb.pageNav);

    this.update(true);

    $.onExists(doc, 'title + *', () => d.title = d.title.replace(/\ -\ Page\ \d+/, ''));

    $.onExists(doc, '.board > .thread > .postContainer, .board + *', function() {
      let el;
      // loose: `hat` is a late-assigned field on the site's Build object, which is
      // typed in src/site (other directory); cast the receiver to set/read it.
      (g.SITE!.Build as any).hat = $('.board > .thread > img:first-child');
      if ((g.SITE!.Build as any).hat) {
        g.BOARD!.threads.forEach(function(thread) {
          if (thread.nodes.root) {
            return $.prepend(thread.nodes.root, (g.SITE!.Build as any).hat.cloneNode(false));
          }
        });
        $.addClass(doc, 'hats-enabled');
        $.addStyle(`.catalog-thread::after {background-image: url(${(g.SITE!.Build as any).hat.src});}`);
      }

      const board = $('.board');
      $.replace(board, Index.root);
      if (Index.loaded) {
        $.event('PostsInserted', null, Index.root);
      }
      // Hacks:
      // - When removing an element from the document during page load,
      //   its ancestors will still be correctly created inside of it.
      // - Creating loadable elements inside of an origin-less document
      //   will not download them.
      // - Combine the two and you get a download canceller!
      //   Does not work on Firefox unfortunately. bugzil.la/939713
      try {
        d.implementation.createDocument(null, null, null).appendChild(board);
      } catch (error) {}

      for (el of $$('.navLinks')) { $.rm(el); }
      $.rm($.id('ctrl-top'));
      const topNavPos = $.id('delform').previousElementSibling;
      $.before(topNavPos, $.el('hr'));
      $.before(topNavPos, Index.navLinks);
      const timeEl = $('#index-last-refresh time', Index.navLinks);
      if (timeEl.dataset.utc) { return RelativeDates.update(timeEl); }
    });

    return Main.ready(function() {
      let pagelist;
      if (pagelist = $('.pagelist')) {
        $.replace(pagelist, Index.pagelist);
      }
      return $.rmClass(doc, 'index-loading');
    });
  },

  scroll() {
    if (Index.req || !Index.liveThreadData || (Conf['Index Mode'] !== 'infinite') || (window.scrollY <= (doc.scrollHeight - (300 + window.innerHeight)))) { return; }
    if (Index.pageNum == null) { Index.pageNum = Index.currentPage; } // Avoid having to pushState to keep track of the current page

    const pageNum = ++Index.pageNum;
    if (pageNum > Index.pagesNum) { return Index.endNotice(); }

    const threadIDs = Index.threadsOnPage(pageNum);
    return Index.buildStructure(threadIDs);
  },

  endNotice: (function() {
    let notify = false;
    const reset = () => notify = false;
    return function() {
      if (notify) { return; }
      notify = true;
      new Notice('info', "Last page reached.", 2);
      return setTimeout(reset, 3 * SECOND);
    };
  })(),

  menu: {
    init() {
      if ((g.VIEW !== 'index') || !Conf['Menu'] || !Conf['Thread Hiding Link'] || !Index.enabledOn(g.BOARD!)) { return; }

      return Menu.menu.addEntry({
        el: $.el('a', {
          href:      'javascript:;',
          className: 'has-shortcut-text'
        }
        , {innerHTML: "<span></span><span class=\"shortcut-text\">Shift+click</span>"}),
        order: 20,
        open({thread}: {thread: Thread}) {
          if (Conf['Index Mode'] !== 'catalog') { return false; }
          this.el.firstElementChild.textContent = thread.isHidden ?
            'Unhide'
          :
            'Hide';
          if (this.cb) { $.off(this.el, 'click', this.cb); }
          this.cb = function() {
            $.event('CloseMenu');
            return Index.toggleHide(thread);
          };
          $.on(this.el, 'click', this.cb);
          return true;
        }
      });
    }
  },

  node(this: Post) {
    if (this.isReply || this.isClone || (Index.threadPosition[this.ID] == null)) { return; }
    return this.thread.setPage(Math.floor(Index.threadPosition[this.ID] / Index.threadsNumPerPage) + 1);
  },

  catalogNode(this: CatalogThread) {
    return $.on(this.nodes.root, 'click', (e: MouseEvent) => {
      if (e.button !== 0) return;
      // The modifier(s) that turn a catalog click into a hide are configurable
      // (Keybinds → "Hide thread (catalog click)", default Shift). Empty disables
      // it. Build a canonical modifier string ordered to match the value stored
      // by the Settings keybind UI (Keybinds.modifierString).
      const hideMods = Conf['Hide thread (catalog click)'];
      if (!hideMods) return;
      const mods = [
        e.altKey  && 'Alt',
        e.ctrlKey && 'Ctrl',
        e.metaKey && 'Meta',
        e.shiftKey && 'Shift',
      ].filter(Boolean).join('+');
      if (mods !== hideMods) return;

      e.preventDefault();
      getSelection()?.removeAllRanges();
      if ((e.target as HTMLElement).classList.contains('catalog-thumb') && Conf['MD5 Quick Filter in the Catalog']) {
        Filter.quickFilterMD5.call(this.thread.OP);
      } else {
        Index.toggleHide(this.thread);
      }
    });
  },

  toggleHide(thread: Thread) {
    if (Index.showHiddenThreads) {
      ThreadHiding.show(thread);
      if (!ThreadHiding.db.get({boardID: thread.board.ID, threadID: thread.ID})) { return; }
      // Don't save when un-hiding filtered threads.
    } else {
      ThreadHiding.hide(thread);
    }
    return ThreadHiding.saveHiddenState(thread);
  },

  cycleSortType() {
    let i;
    const types = Index.selectSort.options.filter((option: HTMLOptionElement) => !option.disabled);
    for (i = 0; i < types.length; i++) {
      var type = types[i];
      if (type.selected) { break; }
    }
    types[(i + 1) % types.length].selected = true;
    return $.event('change', null, Index.selectSort);
  },

  cb: {
    initFinished() {
      Index.initFinishedFired = true;
      return $.queueTask(() => Index.cb.postsInserted());
    },

    postsInserted() {
      if (!Index.initFinishedFired) { return; }
      let n = 0;
      g.posts!.forEach(function(post) {
        if (!post.isFetchedQuote && !post.indexRefreshSeen && doc.contains(post.nodes.root)) {
          post.indexRefreshSeen = true;
          return n++;
        }
      });
      if (n) { return $.event('IndexRefresh'); }
    },

    toggleHiddenThreads(e?: Event) {
      e?.preventDefault();
      $('#hidden-toggle a', Index.navLinks).textContent = (Index.showHiddenThreads = !Index.showHiddenThreads) ?
        'Hide'
      :
        'Show';
      Index.sort();
      return Index.buildIndex();
    },

    mode(this: HTMLSelectElement) {
      Index.pushState({mode: this.value});
      return Index.pageLoad(false);
    },

    sort() {
      const value = Index.selectRev.checked ? Index.selectSort.value + "-rev" : Index.selectSort.value;
      Index.pushState({sort: value});
      return Index.pageLoad(false);
    },

    resort(e?: CustomEvent) {
      Index.changed.order = true;
      if (!e?.detail?.deferred) { return Index.pageLoad(false); }
    },

    perBoardSort(this: HTMLInputElement) {
      Conf['Index Sort'] = this.checked ? dict() : '';
      Index.saveSort();
      for (let i = 0; i < 2; i++) {
        Conf[`Last Long Reply Thresholds ${i}`] = this.checked ? dict() : '';
        Index.saveLastLongThresholds(i);
      }
    },

    lastLongThresholds(this: HTMLInputElement) {
      const i = [...this.parentNode!.children].indexOf(this);
      const value = +this.value;
      if (!Number.isFinite(value)) {
        this.value = Index.lastLongThresholds[i];
        return;
      }
      Index.lastLongThresholds[i] = value;
      Index.saveLastLongThresholds(i);
      Index.changed.order = true;
      return Index.pageLoad(false);
    },

    size(e?: Event) {
      if (Conf['Index Mode'] !== 'catalog') {
        $.rmClass(Index.root, 'catalog-small');
        $.rmClass(Index.root, 'catalog-large');
      } else if (Conf['Index Size'] === 'small') {
        $.addClass(Index.root, 'catalog-small');
        $.rmClass(Index.root,  'catalog-large');
      } else {
        $.addClass(Index.root, 'catalog-large');
        $.rmClass(Index.root,  'catalog-small');
      }
      if (e) { return Index.buildIndex(); }
    },

    replies() {
      return Index.buildIndex();
    },

    hover() {
      return doc.classList.toggle('catalog-hover-expand', Conf['Catalog Hover Expand']);
    },

    hoverToggle(e: MouseEvent) {
      if (Conf['Catalog Hover Toggle'] && $.hasClass(doc, 'catalog-mode') && !$.modifiedClick(e) && !$.x('ancestor-or-self::a', e.target)) {
        let thread;
        const input = Index.inputs['Catalog Hover Expand'];
        input.checked = !input.checked;
        $.event('change', null, input);
        if (thread = Get.threadFromNode(e.target)) {
          Index.cb.catalogReplies.call(thread);
          return Index.cb.hoverAdjust.call(thread.OP.nodes);
        }
      }
    },

    popstate(e?: PopStateEvent) {
      if (e?.state) {
        const {searched, mode, sort} = e.state;
        const page = Index.getCurrentPage();
        Index.setState({search: searched, mode, sort, page});
        return Index.pageLoad(false);
      } else {
        // page load or hash change
        const nCommands = Index.processHash();
        if (Conf['Refreshed Navigation'] && nCommands) {
          return Index.update();
        } else {
          return Index.pageLoad();
        }
      }
    },

    pageNav(e: MouseEvent) {
      let a: any; // loose: holds either an <a> or its parent; only .textContent/.pathname read
      if ($.modifiedClick(e)) { return; }
      const target = e.target as HTMLElement;
      switch (target.nodeName) {
        case 'BUTTON':
          (target as HTMLButtonElement).blur();
          a = target.parentNode;
          break;
        case 'A':
          a = target;
          break;
        default:
          return;
      }
      if (a.textContent === 'Catalog') { return; }
      e.preventDefault();
      return Index.userPageNav(+a.pathname.split(/\/+/)[2] || 1);
    },

    refreshFront(e?: Event) {
      e?.preventDefault();
      Index.pushState({page: 1});
      return Index.update();
    },

    catalogReplies(this: Thread) {
      if (Conf['Show Replies'] && $.hasClass(doc, 'catalog-hover-expand') && !this.catalogView.nodes.replies) {
        return Index.buildCatalogReplies(this);
      }
    },

    hoverAdjust(this: Post['nodes']) {
      // Prevent hovered catalog threads from going offscreen.
      let x;
      if (!$.hasClass(doc, 'catalog-hover-expand')) { return; }
      const rect = this.post.getBoundingClientRect();
      if (x = $.minmax(0, -rect.left, doc.clientWidth - rect.right)) {
        const {style} = this.post;
        style.left = `${x}px`;
        style.right = `${-x}px`;
        return $.one(this.root, 'mouseleave', () => (style as any).left = ((style as any).right = null));
      }
    },

    searchHelp(e: Event) {
      e.preventDefault();
      e.stopPropagation();
      const {popover} = Index.searchHelpNodes();
      if (!popover) { return; }
      return Index.setSearchHelp(popover.hidden);
    },

    closeSearchHelpOutside(e: Event) {
      const {popover, wrap} = Index.searchHelpNodes();
      if (!popover || popover.hidden) { return; }
      if (wrap?.contains(e.target as Node)) { return; }
      return Index.setSearchHelp(false);
    },

    closeSearchHelpOnEscape(e: KeyboardEvent) {
      const {popover} = Index.searchHelpNodes();
      if (!popover || popover.hidden || (e.key !== 'Escape')) { return; }
      e.preventDefault();
      return Index.setSearchHelp(false);
    }
  },

  scrollToIndex() {
    // Scroll to navlinks, or top of board if navlinks are hidden.
    return Header.scrollToIfNeeded((Index.navLinks.getBoundingClientRect().height ? Index.navLinks : Index.root));
  },

  getCurrentPage() {
    return +window.location.pathname.split(/\/+/)[2] || 1;
  },

  userPageNav(page: number) {
    Index.pushState({page});
    if (Conf['Refreshed Navigation']) {
      return Index.update();
    } else {
      return Index.pageLoad();
    }
  },

  hashCommands: {
    mode: {
      'paged':         'paged',
      'infinite-scrolling': 'infinite',
      'infinite':      'infinite',
      'all-threads':   'all pages',
      'all-pages':     'all pages',
      'catalog':       'catalog'
    },
    sort: {
      'bump-order':        'bump',
      'last-reply':        'lastreply',
      'last-long-reply':   'lastlong',
      'creation-date':     'birth',
      'reply-count':       'replycount',
      'file-count':        'filecount',
      'posts-per-minute':  'activity'
    }
  },

  processHash() {
    // XXX https://bugzilla.mozilla.org/show_bug.cgi?id=483304
    let hash = location.href.match(/#.*/)?.[0] || '';
    const state: any =
      {replace: true};
    const commands = hash.slice(1).split('/');
    const leftover: string[] = [];
    for (var command of commands) {
      var mode, sort;
      if (mode = $.getOwn(Index.hashCommands.mode, command)) {
        state.mode = mode;
      } else if (command === 'index') {
        state.mode = Conf['Previous Index Mode'];
        state.page = 1;
      } else if (sort = $.getOwn(Index.hashCommands.sort, command.replace(/-rev$/, ''))) {
        state.sort = sort;
        if (/-rev$/.test(command)) { state.sort += '-rev'; }
      } else if (/^s=/.test(command)) {
        state.search = decodeURIComponent(command.slice(2)).replace(/\+/g, ' ').trim();
      } else {
        leftover.push(command);
      }
    }
    hash = leftover.join('/');
    if (hash) { state.hash = `#${hash}`; }
    Index.pushState(state);
    return commands.length - leftover.length;
  },

  pushState(state: {search?: string; hash?: string; replace?: boolean; page?: number; mode?: string; sort?: string}) {
    let {search, hash, replace} = state;
    let pageBeforeSearch = history.state?.oldpage;
    if ((search != null) && (search !== Index.search)) {
      state.page = search ? 1 : (pageBeforeSearch || 1);
      if (!search) {
        pageBeforeSearch = undefined;
      } else if (!Index.search) {
        pageBeforeSearch = Index.currentPage;
      }
    }
    Index.setState(state);
    const pathname = Index.currentPage === 1 ? `/${g.BOARD}/` : `/${g.BOARD}/${Index.currentPage}`;
    if (!hash) { hash = ''; }
    return history[replace ? 'replaceState' : 'pushState']({
      mode:     Conf['Index Mode'],
      sort:     Index.currentSort,
      searched: Index.search,
      oldpage:  pageBeforeSearch
    }
    , '', `${location.protocol}//${location.host}${pathname}${hash}`);
  },

  setState({search, mode, sort, page, hash}: any) {
    if ((search != null) && (search !== Index.search)) {
      Index.changed.search = true;
      Index.search = search;
    }
    if ((mode != null) && (mode !== Conf['Index Mode'])) {
      Index.changed.mode = true;
      Conf['Index Mode'] = mode;
      $.set('Index Mode', mode);
      if ((mode !== 'catalog') && (Conf['Previous Index Mode'] !== mode)) {
        Conf['Previous Index Mode'] = mode;
        $.set('Previous Index Mode', mode);
      }
    }
    if ((sort != null) && (sort !== Index.currentSort)) {
      Index.changed.sort = true;
      Index.currentSort = sort;
      Index.saveSort();
    }
    if (['all pages', 'catalog'].includes(Conf['Index Mode'])) { page = 1; }
    if ((page != null) && (page !== Index.currentPage)) {
      Index.changed.page = true;
      Index.currentPage = page;
    }
    if (hash != null) {
      return Index.changed.hash = true;
    }
  },

  savePerBoard(key: string, value: any) { // loose: value is a Conf entry of varied type
    if (typeof Conf[key] === 'object') {
      Conf[key][g.BOARD!.ID] = value;
    } else {
      Conf[key] = value;
    }
    return $.set(key, Conf[key]);
  },

  saveSort() {
    return Index.savePerBoard('Index Sort', Index.currentSort);
  },

  saveLastLongThresholds(i: number) {
    return Index.savePerBoard(`Last Long Reply Thresholds ${i}`, Index.lastLongThresholds[i]);
  },

  pageLoad(scroll=true) {
    if (!Index.liveThreadData) { return; }
    let {threads, order, search, mode, sort, page, hash} = Index.changed;
    if (!threads) { threads = search; }
    if (!order) { order = sort; }
    if (threads || order) { Index.sort(); }
    if (threads) { Index.buildPagelist(); }
    if (search) { Index.setupSearch(); }
    if (mode) { Index.setupMode(); }
    if (sort) { Index.setupSort(); }
    if (threads || mode || page || order) { Index.buildIndex(); }
    if (threads || page) { Index.setPage(); }
    if (scroll && !hash) { Index.scrollToIndex(); }
    return Index.changed = {};
  },

  setupMode() {
    for (var mode of ['paged', 'infinite', 'all pages', 'catalog']) {
      $[mode === Conf['Index Mode'] ? 'addClass' : 'rmClass'](doc, `${mode.replace(/\ /g, '-')}-mode`);
    }
    Index.selectMode.value = Conf['Index Mode'];
    Index.cb.size();
    Index.showHiddenThreads = false;
    return $('#hidden-toggle a', Index.navLinks).textContent = 'Show';
  },

  setupSort() {
    Index.selectRev.checked = /-rev$/.test(Index.currentSort);
    Index.selectSort.value  = Index.currentSort.replace(/-rev$/, '');
    return Index.lastLongOptions.hidden = (Index.selectSort.value !== 'lastlong');
  },

  getPagesNum() {
    if (Index.search) {
      return Math.ceil(Index.sortedThreadIDs.length / Index.threadsNumPerPage);
    } else {
      return Index.pagesNum;
    }
  },

  getMaxPageNum() {
    return Math.max(1, Index.getPagesNum());
  },

  buildPagelist() {
    const pagesRoot = $('.pages', Index.pagelist);
    const maxPageNum = Index.getMaxPageNum();
    if (pagesRoot.childElementCount !== maxPageNum) {
      const nodes: any[] = [];
      for (let i = 1, end = maxPageNum; i <= end; i++) {
        var a = $.el('a', {
          textContent: i,
          href: i === 1 ? './' : i
        }
        );
        nodes.push($.tn('['), a, $.tn('] '));
      }
      $.rmAll(pagesRoot);
      return $.add(pagesRoot, nodes);
    }
  },

  setPage() {
    let a, strong;
    const pageNum    = Index.currentPage;
    const maxPageNum = Index.getMaxPageNum();
    const pagesRoot  = $('.pages', Index.pagelist);

    // Previous/Next buttons
    const prev = pagesRoot.previousElementSibling?.firstElementChild;
    const next = pagesRoot.nextElementSibling?.firstElementChild;
    const setNav = function(link: Element | null | undefined, href: number, disabled: boolean) {
      if (!link) { return; }
      (link as HTMLAnchorElement).href = href === 1 ? './' : href as any;
      const button = link.firstElementChild as HTMLButtonElement | null;
      if (button) { button.disabled = disabled; }
      if (disabled) {
        link.setAttribute('aria-disabled', 'true');
      } else {
        link.removeAttribute('aria-disabled');
      }
    };
    let href = Math.max(pageNum - 1, 1);
    setNav(prev, href, href === pageNum);
    href = Math.min(pageNum + 1, maxPageNum);
    setNav(next, href, href === pageNum);

    // <strong> current page
    if (strong = $('strong', pagesRoot)) {
      if (+strong.textContent === pageNum) { return; }
      $.replace(strong, strong.firstChild);
    } else {
      strong = $.el('strong');
    }

    if (a = pagesRoot.children[pageNum - 1]) {
      $.before(a, strong);
      return $.add(strong, a);
    }
  },

  updateHideLabel() {
    if (!Index.hideLabel) { return; }
    let hiddenCount = 0;
    for (var threadID of Index.liveThreadIDs) {
      if (Index.isHidden(threadID)) {
        hiddenCount++;
      }
    }
    if (!hiddenCount) {
      Index.hideLabel.hidden = true;
      if (Index.showHiddenThreads) { Index.cb.toggleHiddenThreads(); }
      return;
    }
    Index.hideLabel.hidden = false;
    return $('#hidden-count', Index.navLinks).textContent = hiddenCount === 1 ?
      '1 hidden thread'
    :
      `${hiddenCount} hidden threads`;
  },

  update(firstTime?: boolean) {
    let oldReq;
    if (oldReq = Index.req) {
      delete Index.req;
      oldReq.abort();
    }

    if (Conf['Index Refresh Notifications']) {
      // Optional notification for manual refreshes.
      if (!Index.notice) { Index.notice = new Notice('info', 'Refreshing index...'); }
      if (!Index.nTimeout) { Index.nTimeout = setTimeout(() => {
        if (Index.notice) {
          Index.notice.el.lastElementChild.textContent += ' (disable JSON Index if this takes too long)';
        }
      }, 3 * SECOND); }
    }

    // Hard refresh in case of incomplete page load.
    if (!firstTime && (d.readyState !== 'loading') && !$('.board + *')) {
      location.reload();
      return;
    }

    Index.req = $.whenModified(
      g.SITE!.urls.catalogJSON({boardID: g.BOARD!.ID}),
      'Index',
      Index.load
    );
    return $.addClass(Index.button, 'spin');
  },

  load(this: XMLHttpRequest) {
    let err;
    if (this !== Index.req) { return; } // aborted

    $.rmClass(Index.button, 'spin');
    const {notice, nTimeout} = Index;
    if (nTimeout) { clearTimeout(nTimeout); }
    delete Index.nTimeout;
    delete Index.req;
    delete Index.notice;

    if (![200, 304].includes(this.status)) {
      err = `Index refresh failed. ${this.status ? `Error ${this.statusText} (${this.status})` : 'Connection Error'}`;
      if (notice) {
        notice.setType('warning');
        notice.el.lastElementChild.textContent = err;
        setTimeout(notice.close, SECOND);
      } else {
        new Notice('warning', err, 1);
      }
      return;
    }

    try {
      if (this.status === 200) {
        Index.parse(this.response);
      } else if (this.status === 304) {
        Index.pageLoad();
      }
    } catch (error) {
      err = error as Error;
      c.error(`Index failure: ${err.message}`, err.stack);
      if (notice) {
        notice.setType('error');
        notice.el.lastElementChild.textContent = 'Index refresh failed.';
        setTimeout(notice.close, SECOND);
      } else {
        new Notice('error', 'Index refresh failed.', 1);
      }
      return;
    }

    if (notice) {
      if (Conf['Index Refresh Notifications']) {
        notice.setType('success');
        notice.el.lastElementChild.textContent = 'Index refreshed!';
        setTimeout(notice.close, SECOND);
      } else {
        notice.close();
      }
    }

    const timeEl = $('#index-last-refresh time', Index.navLinks);
    timeEl.dataset.utc = Date.parse(this.getResponseHeader('Last-Modified')!);
    return RelativeDates.update(timeEl);
  },

  parse(pages: any) { // loose: raw catalog JSON page array
    $.cleanCache(url => /^https?:\/\/a\.4cdn\.org\//.test(url));
    Index.parseThreadList(pages);
    Index.changed.threads = true;
    return Index.pageLoad();
  },

  parseThreadList(pages: any) { // loose: raw catalog JSON page array
    Index.pagesNum          = pages.length;
    Index.threadsNumPerPage = pages[0]?.threads.length || 1;
    Index.liveThreadData    = pages.reduce(((arr: any[], next: any) => arr.concat(next.threads)), []);
    Index.liveThreadIDs     = Index.liveThreadData.map((data: any) => data.no);
    Index.liveThreadDict    = dict();
    Index.threadPosition    = dict();
    Index.parsedThreads     = dict();
    Index.replyData         = dict();
    Index.threadsWithYous   = dict();
    for (let i = 0; i < Index.liveThreadData.length; i++) {
      var obj, results;
      var data = Index.liveThreadData[i];
      Index.liveThreadDict[data.no] = data;
      Index.threadPosition[data.no] = i;
      Index.parsedThreads[data.no] = (obj = g.SITE!.Build.parseJSON(data, g.BOARD!));
      results = Filter.test(obj);
      obj.isOnTop  = results.top;
      obj.isHidden = results.hide || ThreadHiding.isHidden(obj.boardID, obj.threadID);
      if (obj.isHidden && Conf['Show Threads With Yous']) {
        Index.threadsWithYous[data.no] = Index.threadHasUnreadYous(data.no);
      }
      if (data.last_replies) {
        for (var reply of data.last_replies) {
          Index.replyData[`${g.BOARD}.${reply.no}`] = reply;
        }
      }
    }
    if (Index.liveThreadData[0]) {
      g.SITE!.Build.spoilerRange[g.BOARD!.ID] = Index.liveThreadData[0].custom_spoiler;
    }
    g.BOARD!.threads.forEach(function(thread) {
      if (!Index.liveThreadIDs.includes(thread.ID)) { return thread.collect(); }
    });
    $.event('IndexUpdate',
      {threads: ((Index.liveThreadIDs.map((ID: number) => `${g.BOARD}.${ID}`)))});
  },

  isHidden(threadID: number) {
    let thread;
    if ((thread = g.BOARD!.threads.get(threadID)) && thread.OP && !thread.OP.isFetchedQuote) {
      return thread.isHidden;
    } else {
      return Index.parsedThreads[threadID].isHidden;
    }
  },

  isHiddenReply(threadID: number, replyData: any) { // loose: raw reply JSON
    return PostHiding.isHidden(g.BOARD!.ID, threadID, replyData.no) || Filter.isHidden(g.SITE!.Build.parseJSON(replyData, g.BOARD!));
  },

  threadHasUnreadYous(threadID: number) {
    if (!Conf['Show Threads With Yous'] || !QuoteYou.db) { return false; }
    const cached = Index.threadsWithYous?.[threadID];
    if (cached != null) { return cached; }
    const threadData = Index.liveThreadDict?.[threadID];
    if (!threadData?.last_replies?.length) { return false; }

    if (!Index.lastReadPostsDB) {
      Index.lastReadPostsDB = new DataBoard('lastReadPosts');
    }

    const boardID = g.BOARD!.ID;
    const siteID = g.SITE!.ID;
    const lastReadPost = Index.lastReadPostsDB.get({
      siteID,
      boardID,
      threadID,
      defaultValue: 0
    });
    const youOP = !Conf['Require OP Quote Link'] && QuoteYou.db.get({
      siteID,
      boardID,
      threadID,
      postID: threadID
    });

    for (var reply of threadData.last_replies) {
      const postID = reply.no;
      if (postID <= lastReadPost) { continue; }
      if (QuoteYou.db.get({siteID, boardID, threadID, postID})) { continue; }
      if (youOP) { return Index.threadsWithYous[threadID] = true; }
      if (!reply.com) { continue; }

      const regexp = g.SITE!.regexp.quotelinkHTML;
      regexp.lastIndex = 0;
      let match;
      while (match = regexp.exec(reply.com)) {
        if (QuoteYou.db.get({
          siteID,
          boardID:  match[1] ? encodeURIComponent(match[1]) : boardID,
          threadID: match[2] || threadID,
          postID:   match[3] || match[2] || threadID
        })) {
          return Index.threadsWithYous[threadID] = true;
        }
      }
    }

    return Index.threadsWithYous[threadID] = false;
  },

  showThreadInCatalog(threadID: number) {
    const hidden = Index.isHidden(threadID);
    if (Index.showHiddenThreads) {
      return hidden;
    }
    return !hidden || Index.threadHasUnreadYous(threadID);
  },

  buildThreads(threadIDs: number[], isCatalog: boolean, withReplies?: boolean) {
    let errors;
    const threads: Thread[] = [];
    const newThreads: Thread[] = [];
    let newPosts: Post[] = [];
    for (var ID of threadIDs) {
      var opRoot, thread;
      try {
        var OP;
        var threadData = Index.liveThreadDict[ID];

        if (thread = g.BOARD!.threads.get(ID)) {
          var isStale = (thread.json !== threadData) && (JSON.stringify(thread.json) !== JSON.stringify(threadData));
          if (isStale) {
            thread.setCount('post', threadData.replies + 1,                threadData.bumplimit);
            thread.setCount('file', threadData.images  + !!threadData.ext, threadData.imagelimit);
            thread.setStatus('Sticky', !!threadData.sticky);
            thread.setStatus('Closed', !!threadData.closed);
          }
          if (thread.catalogView) {
            $.rm(thread.catalogView.nodes.replies);
            thread.catalogView.nodes.replies = null;
          }
        } else {
          // loose: globals.Board vs classes/Board nominal mismatch; same shape at runtime.
          thread = new Thread(ID as any, g.BOARD as any);
          newThreads.push(thread);
        }
        var lastPost = threadData.last_replies && threadData.last_replies.length ? threadData.last_replies[threadData.last_replies.length - 1].no : ID;
        if (lastPost > thread.lastPost) { thread.lastPost = lastPost; }
        thread.json = threadData;
        threads.push(thread);

        if ((OP = thread.OP) && !OP.isFetchedQuote) {
          OP.setCatalogOP(isCatalog);
          thread.setPage(Math.floor(Index.threadPosition[ID] / Index.threadsNumPerPage) + 1);
        } else {
          var obj = Index.parsedThreads[ID];
          opRoot = g.SITE!.Build.post(obj);
          // loose: globals.Board vs classes/Board nominal mismatch; same shape at runtime.
          OP = new Post(opRoot, thread, g.BOARD as any);
          OP.filterResults = obj.filterResults;
          newPosts.push(OP);
        }

        if (!isCatalog || !thread.nodes.root) {
          g.SITE!.Build.thread(thread, threadData, withReplies!);
        }
      } catch (err) {
        // Skip posts that we failed to parse.
        if (!errors) { errors = []; }
        errors.push({
          message: `Parsing of Thread No.${thread} failed. Thread will be skipped.`,
          error: err,
          html: opRoot?.outerHTML
        });
      }
    }
    if (errors) { Main.handleErrors(errors); }

    if (withReplies) {
      newPosts = newPosts.concat(Index.buildReplies(threads));
    }

    Main.callbackNodes('Thread', newThreads);
    Main.callbackNodes('Post',   newPosts);
    Index.updateHideLabel();
    $.event('IndexRefreshInternal', {threadIDs: (threads.map((t) => t.fullID)), isCatalog});

    return threads;
  },

  buildReplies(threads: Thread[]) {
    let errors;
    const posts: Post[] = [];
    for (var thread of threads) {
      var lastReplies;
      if (!(lastReplies = Index.liveThreadDict[thread.ID].last_replies)) { continue; }
        var nodes: any[] = [];
      for (var data of lastReplies) {
        var node, post;
        if ((post = thread.posts.get(data.no)) && !post.isFetchedQuote) {
          nodes.push(post.nodes.root);
          continue;
        }
        nodes.push(node = g.SITE!.Build.postFromObject(data, thread.board.ID));
        try {
          posts.push(new Post(node, thread, thread.board));
        } catch (err) {
          // Skip posts that we failed to parse.
          if (!errors) { errors = []; }
          errors.push({
            message: `Parsing of Post No.${data.no} failed. Post will be skipped.`,
            error: err,
            html: node?.outerHTML
          });
        }
      }
      $.add(thread.nodes.root, nodes);
    }

    if (errors) { Main.handleErrors(errors); }
    return posts;
  },

  buildCatalogViews(threads: Thread[]) {
    const catalogThreads: CatalogThread[] = [];
    for (var thread of threads) {
      if (!thread.catalogView) {
        var {ID} = thread;
        var page = Math.floor(Index.threadPosition[ID] / Index.threadsNumPerPage) + 1;
        var root = g.SITE!.Build.catalogThread(thread, Index.liveThreadDict[ID], page);
        catalogThreads.push(new CatalogThread(root, thread));
      }
    }
    Main.callbackNodes('CatalogThread', catalogThreads);
  },

  sizeCatalogViews(threads: Thread[]) {
    // XXX When browsers support CSS3 attr(), use it instead.
    const size = Conf['Index Size'] === 'small' ? 150 : 250;
    for (var thread of threads) {
      var {thumb} = thread.catalogView.nodes;
      var {width, height} = thumb.dataset;
      if (!width) { continue; }
      var ratio = size / Math.max(width, height);
      thumb.style.width  = (width  * ratio) + 'px';
      thumb.style.height = (height * ratio) + 'px';
    }
  },

  buildCatalogReplies(thread: Thread) {
    let lastReplies;
    const {nodes} = thread.catalogView;
    if (!(lastReplies = Index.liveThreadDict[thread.ID].last_replies)) { return; }

    const replies: any[] = [];
    for (var data of lastReplies) {
      if (Index.isHiddenReply(thread.ID, data)) { continue; }
      var reply = g.SITE!.Build.catalogReply(thread, data);
      RelativeDates.update($('time', reply));
      $.on($('.catalog-reply-preview', reply), 'mouseover', QuotePreview.mouseover);
      replies.push(reply);
    }

    nodes.replies = $.el('div', {className: 'catalog-replies'});
    $.add(nodes.replies, replies);
    $.add(thread.OP.nodes.post, nodes.replies);
  },

  sort() {
    let threadIDs;
    const {liveThreadIDs, liveThreadData} = Index;
    if (!liveThreadData) { return; }
    const tmp_time = new Date().getTime()/1000;
    const sortType = Index.currentSort.replace(/-rev$/, '');
    Index.sortedThreadIDs = (() => { switch (sortType) {
      case 'lastreply': case 'lastlong':
        var repliesAvailable = liveThreadData.some((thread: any) => thread.last_replies?.length);
        var lastlong = function(thread: any) { // loose: raw thread JSON
          if (!repliesAvailable) {
            return thread.last_modified;
          }
          const iterable = thread.last_replies || [];
          for (let i = iterable.length - 1; i >= 0; i--) {
            var r = iterable[i];
            if (Index.isHiddenReply(thread.no, r)) { continue; }
            if (sortType === 'lastreply') {
              return r;
            }
            var len = r.com ? g.SITE!.Build.parseComment(r.com).replace(/[^a-z]/ig, '').length : 0;
            if (len >= Index.lastLongThresholds[+!!r.ext]) {
              return r;
            }
          }
          if (thread.omitted_posts && thread.last_replies?.length) { return thread.last_replies[0]; } else { return thread; }
        };
        var lastlongD = dict();
        for (var thread of liveThreadData) {
          lastlongD[thread.no] = lastlong(thread).no;
        }
        return [...liveThreadData].sort((a, b) => lastlongD[b.no] - lastlongD[a.no]).map(post => post.no);
      case 'bump':       return liveThreadIDs;
      case 'birth':      return [...liveThreadIDs ].sort((a, b) => b - a);
      case 'replycount': return [...liveThreadData].sort((a, b) => b.replies - a.replies).map(post => post.no);
      case 'filecount':  return [...liveThreadData].sort((a, b) => b.images  - a.images).map(post => post.no);
      case 'activity':   return [...liveThreadData].sort((a, b) => ((tmp_time-a.time)/(a.replies+1)) - ((tmp_time-b.time)/(b.replies+1))).map(post => post.no);
      default: return liveThreadIDs;
    } })();
    if (/-rev$/.test(Index.currentSort)) {
      Index.sortedThreadIDs.reverse();
    }
    if (Index.search && (threadIDs = Index.querySearch(Index.search))) {
      Index.sortedThreadIDs = threadIDs;
    }
    // Sticky threads
    Index.sortOnTop((obj: any) => obj.isSticky);
    // Highlighted threads
    Index.sortOnTop((obj: any) => obj.isOnTop || (Conf['Pin Watched Threads'] && ThreadWatcher.isWatchedRaw(obj.boardID, obj.threadID)));
    // Non-hidden threads
    if (Conf['Anchor Hidden Threads']) { return Index.sortOnTop((obj: any) => !Index.isHidden(obj.threadID)); }
  },

  sortOnTop(match: (obj: any) => unknown) { // loose: predicate over raw parsed-thread JSON
    const topThreads: any[] = [];
    const bottomThreads: any[] = [];
    for (var ID of Index.sortedThreadIDs) {
      (match(Index.parsedThreads[ID]) ? topThreads : bottomThreads).push(ID);
    }
    return Index.sortedThreadIDs = topThreads.concat(bottomThreads);
  },

  buildIndex() {
    let threadIDs;
    if (!Index.liveThreadData) { return; }
    switch (Conf['Index Mode']) {
      case 'all pages':
        threadIDs = Index.sortedThreadIDs;
        break;
      case 'catalog':
        threadIDs = Index.sortedThreadIDs.filter((ID: number) => Index.showThreadInCatalog(ID));
        break;
      default:
        threadIDs = Index.threadsOnPage(Index.currentPage);
    }
    delete Index.pageNum;
    $.rmAll(Index.root);
    $.rmAll(Header.hover);
    if (Index.loaded && Index.root.parentNode) {
      $.event('PostsRemoved', null, Index.root);
    }
    if (Conf['Index Mode'] === 'catalog') {
      Index.buildCatalog(threadIDs);
    } else {
      Index.buildStructure(threadIDs);
    }
  },

  threadsOnPage(pageNum: number) {
    const nodesPerPage = Index.threadsNumPerPage;
    const offset = nodesPerPage * (pageNum - 1);
    return Index.sortedThreadIDs.slice(offset ,  offset + nodesPerPage);
  },

  buildStructure(threadIDs: number[]) {
    const threads = Index.buildThreads(threadIDs, false, Conf['Show Replies']);
    Index.showHiddenThreadsWithYousInIndex(threads);
    const nodes: any[] = [];
    for (var thread of threads) {
      nodes.push(thread.nodes.root, $.el('hr'));
    }
    $.add(Index.root, nodes);
    if (Index.root.parentNode) {
      $.event('PostsInserted', null, Index.root);
    }
    Index.highlightSearch();
    Index.loaded = true;
  },

  showHiddenThreadsWithYousInIndex(threads: Thread[]) {
    if (Conf['Index Mode'] === 'catalog' || !Conf['Show Threads With Yous']) { return; }
    for (var thread of threads) {
      if (!thread.isHidden || !Index.threadHasUnreadYous(thread.ID)) { continue; }
      if (thread.stub && thread.nodes.root.contains(thread.stub)) {
        $.rm(thread.stub);
      }
      thread.nodes.root.hidden = false;
    }
  },

  buildCatalog(threadIDs: number[]) {
    let i = 0;
    const n = threadIDs.length;
    let node0: any = null;
    var fn = function() {
      if (node0 && !node0.parentNode) { return; } // Index.root cleared
      const j = (i > 0) && Index.root.parentNode ? n : i + 30;
      node0 = Index.buildCatalogPart(threadIDs.slice(i, j))[0];
      i = j;
      if (i < n) {
        return $.queueTask(fn);
      } else {
        if (Index.root.parentNode) {
          $.event('PostsInserted', null, Index.root);
        }
        Index.groupHiddenCatalogThreads(threadIDs);
        Index.highlightSearch();
        return Index.loaded = true;
      }
    };
    fn();
  },

  groupHiddenCatalogThreads(threadIDs: number[]) {
    if (!Conf['Group Hidden Threads By Filter']) { return; }
    const hiddenThreadIDs = threadIDs.filter((ID: number) => Index.isHidden(ID));
    if (!hiddenThreadIDs.length) { return; }

    const groupedThreads = new Map();
    const manualHiddenThreads: HTMLElement[] = [];
    const hiddenNodes: HTMLElement[] = [];

    for (var threadID of hiddenThreadIDs) {
      const node = $.id(`t${threadID}`);
      if (!node || (node.parentNode !== Index.root)) { continue; }
      hiddenNodes.push(node);
      Index.clearHiddenFilterValueFromCatalogThread(node);

      if (ThreadHiding.db?.get({boardID: g.BOARD!.ID, threadID})) {
        manualHiddenThreads.push(node);
        continue;
      }

      const reason = (Index.parsedThreads[threadID]?.filterResults?.reasons?.[0] || 'Filtered').trim();
      const parsed = Index.parseHiddenFilterReason(reason);
      const key = parsed.key;
      let group = groupedThreads.get(key);
      if (!group) {
        group = { label: parsed.label, nodes: [] };
        groupedThreads.set(key, group);
      }
      if (parsed.value) {
        Index.applyHiddenFilterValueToCatalogThread(node, parsed.label, parsed.value);
      }
      group.nodes.push(node);
    }

    if (!hiddenNodes.length) { return; }
    for (var hiddenNode of hiddenNodes) {
      $.rm(hiddenNode);
    }

    const frag = d.createDocumentFragment();
    for (const [, group] of groupedThreads) {
      frag.appendChild($.el('div', {
        className: 'catalog-group-header',
        textContent: `${group.label} (${group.nodes.length})`
      }));
      frag.append(...group.nodes);
    }
    if (manualHiddenThreads.length) {
      frag.appendChild($.el('div', {
        className: 'catalog-group-header',
        textContent: `Manually hidden (${manualHiddenThreads.length})`
      }));
      frag.append(...manualHiddenThreads);
    }
    Index.root.appendChild(frag);
  },

  parseHiddenFilterReason(reason: string) {
    const match = reason.match(/^Filtered\s+([A-Za-z0-9_]+)\s+(.+)$/);
    if (!match) {
      return { key: reason, label: reason, value: null };
    }
    const type = match[1];
    const value = match[2];
    const highCardinalityTypes = new Set([
      'MD5',
      'postID',
      'uniqueID',
      'name',
      'tripcode',
      'email',
      'filename',
      'capcode',
      'flag',
      'dimensions',
      'filesize'
    ]);
    if (!highCardinalityTypes.has(type)) {
      return { key: reason, label: reason, value: null };
    }
    return { key: `Filtered ${type}`, label: `Filtered ${type}`, value };
  },

  applyHiddenFilterValueToCatalogThread(node: HTMLElement, label: string, value: string) {
    // keep one tooltip and one compact value row per card
    const valueLine = label === 'Filtered MD5' ? value : `${label}: ${value}`;
    const link = $('.catalog-link', node);
    if (link) {
      link.title = valueLine;
      link.dataset.hiddenFilterMatch = valueLine;
    }

    const old = $('.catalog-group-match', node);
    if (old) { $.rm(old); }
    const stats = $('.catalog-stats', node);
    if (!stats) { return; }
    $.add(stats, $.el('span', {
      className: 'catalog-group-match',
      textContent: valueLine
    }));
  },

  clearHiddenFilterValueFromCatalogThread(node: HTMLElement) {
    const old = $('.catalog-group-match', node);
    if (old) { $.rm(old); }
    const link = $('.catalog-link', node);
    if (link?.dataset.hiddenFilterMatch) {
      delete link.dataset.hiddenFilterMatch;
      link.removeAttribute('title');
    }
  },

  buildCatalogPart(threadIDs: number[]) {
    const threads = Index.buildThreads(threadIDs, true);
    Index.buildCatalogViews(threads);
    Index.sizeCatalogViews(threads);
    const nodes: any[] = [];
    for (var thread of threads) {
      Index.clearHiddenFilterValueFromCatalogThread(thread.catalogView.nodes.root);
      thread.OP.setCatalogOP(true);
      $.add(thread.catalogView.nodes.root, thread.OP.nodes.root);
      nodes.push(thread.catalogView.nodes.root);
      $.on(thread.catalogView.nodes.root, 'mouseenter', Index.cb.catalogReplies.bind(thread));
      $.on(thread.OP.nodes.root, 'mouseenter', Index.cb.hoverAdjust.bind(thread.OP.nodes));
    }
    $.add(Index.root, nodes);
    return nodes;
  },

  clearSearch(e?: Event) {
    e?.preventDefault();
    Index.searchInput.value = '';
    Index.onSearchInput();
    return Index.searchInput.focus();
  },

  searchHelpNodes() {
    const navLinks = (Index as any).navLinks;
    if (!navLinks) { return {help: null, popover: null, wrap: null}; }
    return {
      help: $('#index-search-help', navLinks),
      popover: $('#index-search-help-popover', navLinks),
      wrap: $('#index-search-help-wrap', navLinks)
    };
  },

  setupSearchHelp() {
    const {help} = Index.searchHelpNodes();
    if (!help) { return; }
    Icon.set(help, 'circleQuestion');
    $.on(help, 'click', Index.cb.searchHelp);
    $.on(d, 'click', Index.cb.closeSearchHelpOutside);
    return $.on(d, 'keydown', Index.cb.closeSearchHelpOnEscape);
  },

  setSearchHelp(open: boolean) {
    const {help, popover} = Index.searchHelpNodes();
    if (!help || !popover) { return; }
    popover.hidden = !open;
    return help.setAttribute('aria-expanded', open ? 'true' : 'false');
  },

  setupSearch() {
    Index.searchInput.value = Index.search;
    if (Index.search) {
      return Index.searchInput.dataset.searching = 1;
    } else {
      // XXX https://bugzilla.mozilla.org/show_bug.cgi?id=1021289
      return Index.searchInput.removeAttribute('data-searching');
    }
  },

  onSearchInput() {
    const search = Index.searchInput.value.trim();
    if (search === Index.search) { return; }
    Index.pushState({
      search,
      replace: !!search === !!Index.search
    });
    return Index.pageLoad(false);
  },

  // Parse a `field:/pattern/flags` regex query, e.g. `comment:/foo/i`. Only
  // treated as a regex search when every `+`-joined field is a recognised filter
  // field — otherwise a pasted URL like `https://…` (field `https`, empty
  // pattern) would be misread as a regex matching every thread while
  // highlighting nothing. Returns the RegExpMatchArray, or null for a plain
  // keyword search.
  parseRegexQuery(query: string) {
    const match = query.match(/^([\w+]+):\/(.*)\/(\w*)$/);
    if (!match) { return null; }
    if (!match[1].split('+').every((k: string) => $.hasOwn(Filter.valueF, k))) { return null; }
    return match;
  },

  // Split a keyword query into its terms and any flags. A leading `op:` prefix
  // restricts matching to OP text only, ignoring the preview replies that are
  // searched by default. It works glued or spaced (`op:catfish`, `op: catfish`)
  // since the colon makes a separating space feel unnatural. Only the leading
  // occurrence is the flag and the rest is taken verbatim, so `op:op:` searches
  // OP text for the literal `op:`.
  parseKeywordQuery(query: string) {
    let opOnly = false;
    const m = query.match(/^op:\s*/i);
    if (m) {
      opOnly = true;
      query = query.slice(m[0].length);
    }
    const keywords = Index.tokenizeKeywords(query.toLowerCase());
    return { opOnly, keywords };
  },

  // Break a query into terms, honoring double-quoted phrases. A quoted run
  // (`"do not ask"`) becomes a single term that must match as one contiguous
  // phrase, with the surrounding quotes stripped and inner whitespace collapsed;
  // bare text is split on whitespace into one term per word (AND-matched). A
  // trailing unclosed quote (`"do not`) is treated as an open phrase so matching
  // stays sensible while the closing quote is still being typed. The quote
  // characters themselves are never part of a term, so `"hello"` searches for
  // `hello`, not `"hello"`.
  tokenizeKeywords(query: string) {
    const keywords: string[] = [];
    const rx = /"([^"]*)"?|(\S+)/g;
    let m;
    while ((m = rx.exec(query))) {
      // Defensive: a zero-width match (e.g. a lone `"`) would loop forever.
      if (!m[0]) { rx.lastIndex++; continue; }
      const term = m[1] != null ? m[1].trim().replace(/\s+/g, ' ') : m[2];
      if (term) { keywords.push(term); }
    }
    return keywords;
  },

  querySearch(query: string) {
    let match: RegExpMatchArray | null;
    if (match = Index.parseRegexQuery(query)) {
      let regexp: RegExp;
      try {
        regexp = RegExp(match[2], match[3]);
      } catch (error) {
        return [];
      }
      return Index.sortedThreadIDs.filter((ID: number) => regexp.test(Filter.values(match![1] as any, Index.parsedThreads[ID]).join('\n')));
    }
    const { opOnly, keywords } = Index.parseKeywordQuery(query);
    if (!keywords.length) { return; }
    return Index.sortedThreadIDs.filter((ID: number) => Index.searchMatch(Index.parsedThreads[ID], keywords, opOnly));
  },

  // Keyword terms to highlight in the rendered results. Flag tokens like `op:`
  // are stripped so they aren't painted as literal text. Regex queries are
  // handled separately (highlightRegexSearch), so this only sees plain keywords.
  getSearchTerms() {
    const query = Index.search;
    if (!query || Index.parseRegexQuery(query)) { return []; }
    return Index.parseKeywordQuery(query).keywords;
  },

  // Paint the current search across the rendered threads. Re-run after every
  // (re)build, since buildIndex replaces Index.root's contents and the old
  // highlight ranges would point at detached nodes. An empty query clears it.
  // Regex queries get field-aware treatment; plain keywords use literal paint.
  highlightSearch() {
    // Drop any element glows / matched-post markers left by the previous query
    // before re-marking. (A rebuild already replaces the nodes, but clearing keeps
    // this self-contained for the case where highlightSearch runs without a rebuild.)
    for (const el of Index.root.querySelectorAll(`.${SEARCH_HIT_CLASS}, .${SEARCH_MATCH_CLASS}`)) {
      el.classList.remove(SEARCH_HIT_CLASS, SEARCH_MATCH_CLASS);
    }
    const query = Index.search;
    let match;
    if (query && (match = Index.parseRegexQuery(query))) {
      Index.highlightRegexSearch(match);
      return;
    }
    // Build the ranges here (rather than via SearchHighlight.apply) so the same
    // ranges drive both the text paint and the per-post marker class.
    const terms = Index.getSearchTerms();
    if (!terms.length) {
      SearchHighlight.setRanges(INDEX_SEARCH_HL, []);
      return;
    }
    const rx = RegExp(terms.map(SearchHighlight.escape).join('|'), 'gi');
    const ranges = SearchHighlight.rangesFor(Index.root, rx);
    SearchHighlight.setRanges(INDEX_SEARCH_HL, ranges);
    Index.markMatchedPosts(ranges);
  },

  // Tag each post that actually contains a painted match with SEARCH_MATCH_CLASS,
  // giving Custom CSS a hook to style the whole matching post. Driven off the same
  // ranges the highlight uses, so the marker tracks the visible matches — and works
  // even where the Custom Highlight API is unsupported and no text paint appears.
  markMatchedPosts(ranges: Range[]) {
    for (const range of ranges) {
      const node = range.startContainer;
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
      el?.closest(`.postContainer, .catalog-thread`)?.classList.add(SEARCH_MATCH_CLASS);
    }
  },

  // Surface a regex hit inside each rendered (and therefore matching) tile: paint
  // the matched text where the targeted field is visible, and glow the relevant
  // icon/thumbnail where the value isn't shown as text or the body is hidden
  // (catalog mode). `match` is the [, fields, pattern, flags] from parseRegexQuery.
  highlightRegexSearch(match: RegExpMatchArray) {
    let rx;
    try {
      // Force the global flag so rangesFor's exec loop advances; keep the user's
      // own flags (e.g. `i`) so painting matches the same casing the filter did.
      rx = RegExp(match[2], /g/.test(match[3]) ? match[3] : `${match[3] || ''}g`);
    } catch (error) {
      SearchHighlight.setRanges(INDEX_SEARCH_HL, []);
      return;
    }
    const fields = match[1].split('+').filter((f: string) => SEARCH_FIELD_TARGETS[f]);
    const ranges: Range[] = [];
    for (const tile of Index.root.children) {
      if (tile.tagName === 'HR') { continue; }
      // Scope to the OP: a regex query matches the OP only, but an index tile also
      // renders preview replies, whose flags/comments must NOT be marked.
      const opRoot = tile.querySelector('.opContainer') || tile.querySelector('.postContainer') || tile;
      // Every rendered tile is a confirmed match (querySearch already filtered the
      // list), so tag the post itself regardless of which field hit or whether the
      // hit is visible as text — this is the whole-post hook for Custom CSS.
      opRoot.classList.add(SEARCH_MATCH_CLASS);
      let shown = false;   // something for this tile is already visibly marked
      let missed = false;  // a field hit but had nothing visible to mark
      for (const field of fields) {
        const { kind, sel } = SEARCH_FIELD_TARGETS[field];
        const els = opRoot.querySelectorAll(sel);
        let visible = false;
        for (const el of els) {
          if (kind === 'text') {
            if ((el as HTMLElement).offsetParent === null) { continue; } // hidden body, fall back instead
            const r = SearchHighlight.rangesFor(el, rx);
            if (r.length) { ranges.push(...r); visible = true; }
          } else {
            el.classList.add(SEARCH_HIT_CLASS);
            if ((el as HTMLElement).offsetParent !== null) { visible = true; }
          }
        }
        if (visible) { shown = true; } else { missed = true; }
      }
      if (missed && !shown) {
        const fallback = opRoot.querySelector(SEARCH_FALLBACK_SEL) || tile;
        fallback.classList.add(SEARCH_HIT_CLASS);
      }
    }
    SearchHighlight.setRanges(INDEX_SEARCH_HL, ranges);
  },

  searchMatch(obj: any, keywords: string[], opOnly: boolean) { // loose: parsed-thread JSON
    const text = Index.searchText(obj, opOnly);
    for (var keyword of keywords) {
      if (-1 === text.indexOf(keyword)) { return false; }
    }
    return true;
  },

  // Lowercased haystack for an OP. By default it folds in the text of every
  // preview reply the index shows, so a term that appears only in a reply still
  // keeps the thread in the results (and gets painted by highlightSearch); the
  // `op:` flag asks for OP text alone. Both variants are cached on the
  // parsed-thread object, which parseThreadList rebuilds on every refresh.
  searchText(obj: any, opOnly: boolean) { // loose: parsed-thread JSON
    if (obj._searchTextOP == null) {
      const {info, file} = obj;
      if (info.comment == null) { info.comment = g.SITE!.Build.parseComment(info.commentHTML.innerHTML); }
      const parts: string[] = [];
      for (var key of ['comment', 'subject', 'name', 'tripcode']) {
        if (key in info) { parts.push(info[key]); }
      }
      if (file) { parts.push(file.name); }
      // Collapse whitespace so a quoted phrase still matches across the line
      // breaks parseComment leaves in place (`<br>` becomes `\n`). Rewrite hosts
      // (x.com -> xcancel, etc.) so search matches the converted text the user
      // sees, not the original URL in the raw comment.
      obj._searchTextOP = Linkify.rewriteDisplayText(parts.join(' ')).replace(/\s+/g, ' ').toLowerCase();
    }
    if (opOnly) { return obj._searchTextOP; }
    if (obj._searchText == null) {
      const parts = [obj._searchTextOP];
      const replies = Index.liveThreadDict[obj.threadID]?.last_replies;
      if (replies) {
        for (var reply of replies) {
          if (reply.sub) { parts.push(reply.sub); }
          if (reply.name) { parts.push(reply.name); }
          if (reply.trip) { parts.push(reply.trip); }
          if (reply.filename) { parts.push(reply.filename + (reply.ext || '')); }
          if (reply.com) { parts.push(g.SITE!.Build.parseComment(reply.com)); }
        }
      }
      obj._searchText = Linkify.rewriteDisplayText(parts.join(' ')).replace(/\s+/g, ' ').toLowerCase();
    }
    // Append the expanded thread's text (if any) at lookup time rather than
    // baking it into the cache, so collapsing/expanding takes effect without
    // having to invalidate _searchText, and so it survives parsedThreads rebuilds.
    const extra = Index.expandedSearchText[obj.threadID];
    return extra ? `${obj._searchText} ${extra}` : obj._searchText;
  },

  // Record an inline-expanded thread's full text into the search corpus so the
  // index search reaches content past the preview replies *while the thread is
  // expanded and visible*. `postsData` is the raw thread JSON (`response.posts`).
  setExpandedThreadText(threadID: number, postsData: any) { // loose: raw thread posts JSON
    if (!postsData) { return; }
    const parts: string[] = [];
    for (var data of postsData) {
      if (data.no === threadID) { continue; } // OP is already in the base corpus
      if (data.sub) { parts.push(data.sub); }
      if (data.name) { parts.push(data.name); }
      if (data.trip) { parts.push(data.trip); }
      if (data.filename) { parts.push(data.filename + (data.ext || '')); }
      if (data.com) { parts.push(g.SITE!.Build.parseComment(data.com)); }
    }
    Index.expandedSearchText[threadID] = parts.join(' ').replace(/\s+/g, ' ').toLowerCase();
  },

  // Drop a thread's expanded text from the search corpus when it is collapsed,
  // so a collapsed thread is never matched on text the user can no longer see.
  clearExpandedThreadText(threadID: number) {
    delete Index.expandedSearchText[threadID];
  }
};
export default Index;
