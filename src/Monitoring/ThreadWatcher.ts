import ThreadWatcherPage from './ThreadWatcher/ThreadWatcher.html';
import $ from "../platform/$";
import QR from '../Posting/QR';
import Board from '../classes/Board';
import Callbacks from '../classes/Callbacks';
import DataBoard from '../classes/DataBoard';
import Thread from '../classes/Thread';
import type Post from '../classes/Post';
import Filter from '../Filtering/Filter';
import Main from '../main/Main';
import $$ from '../platform/$$';
import Config from '../config/Config';
import CrossOrigin from '../platform/CrossOrigin';
import PostRedirect from '../Posting/PostRedirect';
import QuoteYou from '../Quotelinks/QuoteYou';
import Unread from './Unread';
import UnreadIndex from './UnreadIndex';
import Header from '../General/Header';
import Index from '../General/Index';
import { Conf, d, doc, g } from '../globals/globals';
import Menu from '../Menu/Menu';
import UI from '../General/UI';
import Get from '../General/Get';
import { dict, HOUR, MINUTE } from '../platform/helpers';
import Icon from '../Icons/icon';

// After "Mark all read", the header icon becomes an Undo button for this long.
// A circular countdown ring depletes across the span, then it reverts to the
// check icon and the undo snapshot is dropped.
const MARK_READ_UNDO_MS = 5000;

// Local structural type for the ThreadWatcher.menu sub-object's `this`. Declared
// outside the singleton so the methods' `this:` annotations don't reference
// `typeof ThreadWatcher.menu`, which would make the singleton's type circular
// (TS7022 under noImplicitAny). Type-only; erases at compile time.
interface TWMenu {
  menu: any;
  updateAttachLocationChecks: () => void;
  init: (this: TWMenu) => unknown;
  addHeaderMenuEntry: () => unknown;
  addMenuEntries: (this: TWMenu) => unknown;
  makeCheckbox: (name: string, desc: string) => any;
  addSortEntry: (this: TWMenu) => unknown;
  addAttachLocationEntry: (this: TWMenu) => unknown;
  addThumbnailControls: (this: TWMenu) => unknown;
}

var ThreadWatcher = {
  // Assigned later; declared so the singleton's type includes them. Loosely typed
  // where a precise type would cascade new errors; tighten during the strict pass.
  enabled: false,
  shortcut: null as unknown as HTMLElement,
  db: null as any,
  dbLM: null as any,
  dialog: null as unknown as HTMLElement,
  status: null as any,
  list: null as any,
  refreshButton: null as any,
  markReadButton: null as any,
  markReadUndo: null as any,
  undoTimeout: null as any,
  menuButton: null as any,
  closeButton: null as any,
  attachButton: null as any,
  scrollMore: null as any,
  unreaddb: null as any,
  unreadEnabled: false,
  draggingLine: null as any,
  hoveredThumbnail: null as any,
  thumbnailHover: null as any,
  syncing: false,
  timeout: 0 as any,
  prefixes: null as any,
  _lastAttachedW: null as any,
  _qrObs: null as any,

  drag: {
    start(this: HTMLElement, e: DragEvent) {
      if (ThreadWatcher.sortMode() !== 'manual') {
        e.preventDefault();
        return;
      }
      ThreadWatcher.draggingLine = this;
      this.classList.add('drag');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', ThreadWatcher.keyFromLine(this));
      }
    },
    end() {
      ThreadWatcher.clearDragState();
    },
    enter(this: HTMLElement) {
      if (ThreadWatcher.draggingLine && ThreadWatcher.draggingLine !== this) {
        this.classList.add('over');
      }
    },
    leave(this: HTMLElement) {
      this.classList.remove('over');
    },
    over(this: HTMLElement, e: DragEvent) {
      if (ThreadWatcher.draggingLine && ThreadWatcher.draggingLine !== this) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
      }
    },
    drop(this: HTMLElement, e: DragEvent) {
      if (!ThreadWatcher.draggingLine || ThreadWatcher.draggingLine === this) { return; }
      e.preventDefault();
      this.classList.remove('over');
      const { before } = ThreadWatcher.dropPosition(this, e);
      ThreadWatcher.reorderInDOM(ThreadWatcher.draggingLine, this, before);
      ThreadWatcher.clearDragState();
    }
  },

  init() {
    let sc;
    if (!(this.enabled = Conf['Thread Watcher'])) { return; }

    this.shortcut = (sc = $.el('a', {
      id:    'watcher-link',
      title: 'Thread Watcher',
      href:  'javascript:;',
    }));
    Icon.set(this.shortcut, 'eye', 'Watcher');

    this.db     = new DataBoard('watchedThreads', this.refresh, true);
    this.dbLM   = new DataBoard('watcherLastModified', undefined, true);
    this.dialog = UI.dialog('thread-watcher', { innerHTML: ThreadWatcherPage });
    this.status = $('#watcher-status', this.dialog);
    this.list   = $('#watched-threads', this.dialog);
    this.scrollMore = $('.watcher-scroll-more', this.dialog);
    this.refreshButton = $('.refresh', this.dialog);
    this.markReadButton = $('.mark-read', this.dialog);
    this.menuButton = $('.menu-button', this.dialog);
    this.closeButton = $('.move > .close', this.dialog);
    this.attachButton = $('.attach', this.dialog);
    this.unreaddb = Unread.db || UnreadIndex.db || new DataBoard('lastReadPosts');
    this.unreadEnabled = Conf['Remember Last Read Post'];

    Icon.set(this.refreshButton, 'refresh');
    Icon.set(this.markReadButton, 'check');
    Icon.set(this.menuButton, 'caretDown');
    Icon.set(this.closeButton, 'xmark');
    if (this.attachButton) {
      Icon.set(this.attachButton, 'link');
    }
    if (this.scrollMore) {
      Icon.set(this.scrollMore, 'caretDown');
    }
    ThreadWatcher.applyAttachControlsSetting(Conf['Thread Watcher Attach Controls']);

    $.on(d, 'QRPostSuccessful',   this.cb.post);
    $.on(sc, 'click', this.toggleWatcher);
    $.on(this.refreshButton, 'click', this.buttonFetchAll);
    $.on(this.markReadButton, 'click', this.cb.markAllRead);
    $.on(this.closeButton, 'click', this.toggleWatcher);
    if (this.attachButton) {
      $.on(this.attachButton, 'click', this.toggleAttach);
    }
    $.on(window, 'resize scroll', () => ThreadWatcher.positionThumbnailHover(ThreadWatcher.hoveredThumbnail));
    $.on(this.list, 'scroll', () => {
      ThreadWatcher.positionThumbnailHover(ThreadWatcher.hoveredThumbnail);
      ThreadWatcher.updateScrollMore();
    });
    $.on(this.list, 'mouseenter mouseleave', () => ThreadWatcher.updateScrollMore());
    $.on(window, 'resize', () => ThreadWatcher.updateScrollMore());
    if (this.scrollMore) {
      $.on(this.scrollMore, 'click', ThreadWatcher.cb.scrollMore);
    }

    this.menu.addHeaderMenuEntry();
    $.on(d, 'QRDialogCreation', ThreadWatcher.onQRDialogCreation);
    $.on(d, '4chanXQRMove', (e: CustomEvent) => {
      if (ThreadWatcher.attached()) {
        // Direct for tight sync during QR drag (mousemove rate); rAF would add visible lag/glitch to follower.
        ThreadWatcher._doPositionAttached(!!e.detail?.dragging);
      }
    });
    $.on(window, 'resize', () => { if (ThreadWatcher.attached()) ThreadWatcher.positionIfAttached(); });
    $.on(d, '4chanXDragend', (e) => {
      if (e.detail?.id === 'thread-watcher') {
        ThreadWatcher.updateAttachButton();
      }
    });
    $.onExists(doc, 'body', this.addDialog);

    switch (g.VIEW) {
      case 'index':
        $.on(d, 'IndexUpdate', this.cb.onIndexUpdate);
        break;
      case 'thread':
        $.on(d, 'ThreadUpdate', this.cb.onThreadRefresh);
        break;
    }

    if (Conf['Fixed Thread Watcher']) {
      $.addClass(doc, 'fixed-watcher');
    }
    if (!Conf['Persistent Thread Watcher']) {
      $.addClass(ThreadWatcher.shortcut, 'disabled');
      this.dialog.hidden = true;
    }

    Header.addShortcut('watcher', sc, 510,);

    ThreadWatcher.initLastModified();
    ThreadWatcher.fetchAuto();
    $.on(window, 'visibilitychange focus', () => $.queueTask(ThreadWatcher.fetchAuto));

    $.sync('Thread Watcher Attached', (val) => {
      const attached = ThreadWatcher.attachControlsEnabled() && !!val;
      Conf['Thread Watcher Attached'] = attached;
      if (val && !attached) {
        $.set('Thread Watcher Attached', false);
      }
      ThreadWatcher.updateAttachButton();
      if (attached) {
        ThreadWatcher.positionIfAttached(true);
      } else if (ThreadWatcher.dialog) {
        ThreadWatcher.restorePosition();
      }
    });
    $.sync('Thread Watcher Attach Controls', (val) => {
      ThreadWatcher.applyAttachControlsSetting(val);
      ThreadWatcher.menu?.updateAttachLocationChecks?.();
    });
    $.sync('Thread Watcher Attach Location', (val) => {
      Conf['Thread Watcher Attach Location'] = val;
      ThreadWatcher.menu?.updateAttachLocationChecks?.();
      if (ThreadWatcher.attached()) {
        // Force re-compute size targets (sides no longer match height).
        ThreadWatcher._lastAttachedW = null;
        ThreadWatcher._doPositionAttached();
      }
    });

    if (Conf['Menu'] && (Index as any).enabled) {
      (Menu as any).menu.addEntry({
        el: $.el('a', {
          href:      'javascript:;',
          className: 'has-shortcut-text'
        }
        , {innerHTML: '<span></span><span class="shortcut-text"></span>'}),
        order: 6,
        open({thread}: { thread: Thread }) {
          if (Conf['Index Mode'] !== 'catalog') { return false; }
          this.el.firstElementChild.textContent = ThreadWatcher.isWatched(thread) ?
            'Unwatch'
          :
            'Watch';
          const mods = Conf['Watch (catalog click)'];
          this.el.lastElementChild.textContent = mods ? `${mods}+click` : '';
          if (this.cb) { $.off(this.el, 'click', this.cb); }
          this.cb = function() {
            $.event('CloseMenu');
            return ThreadWatcher.toggle(thread, true);
          };
          $.on(this.el, 'click', this.cb);
          return true;
        }
      });
    }

    if (g.VIEW !== 'index' && g.VIEW !== 'thread') { return; }

    Callbacks.Post.push({
      name: 'Thread Watcher',
      cb:   this.node
    });
    return Callbacks.CatalogThread.push({
      name: 'Thread Watcher',
      cb:   this.catalogNode
    });
  },

  isWatched(thread: Thread) {
    return !!ThreadWatcher.db?.get({boardID: thread.board.ID, threadID: thread.ID});
  },

  isWatchedRaw(boardID: string, threadID: number | string) {
    return !!ThreadWatcher.db?.get({boardID, threadID});
  },

  setToggler(toggler: HTMLElement, isWatched: boolean) {
    toggler.classList.toggle('watched', isWatched);
    return toggler.title = `${isWatched ? 'Unwatch' : 'Watch'} Thread`;
  },

  node(this: Post) {
    let toggler;
    if (this.isReply) { return; }
    if (this.isClone) {
      toggler = $('.watch-thread-link', this.nodes.info);
    } else {
      toggler = $.el('button', {
        type: 'button',
        className: 'watch-thread-link'
      });
      Icon.set(toggler, 'heart');
      $.before($('input', this.nodes.info), toggler);
    }
    const siteID = g.SITE!.ID;
    const boardID = this.board.ID;
    const threadID = this.thread.ID;
    const data = ThreadWatcher.db.get({siteID, boardID, threadID});
    ThreadWatcher.setToggler(toggler, !!data);
    $.on(toggler, 'click', ThreadWatcher.cb.toggle);
    // Add missing excerpt for threads added by Auto Watch
    if (data && (data.excerpt == null)) {
      return $.queueTask(() => {
        return ThreadWatcher.update(siteID, boardID, threadID, {excerpt: Get.threadExcerpt(this.thread)});
    });
    }
  },

  catalogNode(this: Post) {
    if (ThreadWatcher.isWatched(this.thread)) { $.addClass(this.nodes.root, 'watched'); }
    return $.on(this.nodes.root, 'mousedown click', e => {
      if (e.button !== 0) return;
      const wanted = Conf['Watch (catalog click)'];
      if (!wanted) return;
      const got: string[] = [];
      if (e.altKey)   { got.push('Alt'); }
      if (e.ctrlKey)  { got.push('Ctrl'); }
      if (e.metaKey)  { got.push('Meta'); }
      if (e.shiftKey) { got.push('Shift'); }
      if (got.join('+') !== wanted) return;
      if (e.type === 'click') ThreadWatcher.toggle(this.thread, true);
      return e.preventDefault();
    });
  }, // Also on mousedown to prevent highlighting thumbnail in Firefox.

  addDialog() {
    if (!Main.isThisPageLegit()) { return; }
    ThreadWatcher.applyLayout();
    ThreadWatcher.build();
    ThreadWatcher.updateAttachButton();
    ThreadWatcher._lastAttachedW = null;
    if (ThreadWatcher.attached()) {
      ThreadWatcher.positionIfAttached(true);
      // On refresh the QR's position can settle a frame or two after creation. The QR
      // ResizeObserver catches size changes but not position settling, which otherwise
      // leaves a one-time gap until the user moves the QR. Re-run once layout settles.
      requestAnimationFrame(() => ThreadWatcher.positionIfAttached(true));
      setTimeout(() => ThreadWatcher.positionIfAttached(true), 100);
    }
    if (QR.nodes?.el) {
      ThreadWatcher.onQRDialogCreation();
    }
    $.prepend(d.body, ThreadWatcher.dialog);
    // build() measured the list while the dialog was still detached (zero-size),
    // so the scroll hint couldn't be sized. Re-measure now that it's in the DOM.
    return requestAnimationFrame(() => ThreadWatcher.updateScrollMore());
  },

  toggleWatcher() {
    $.toggleClass(ThreadWatcher.shortcut, 'disabled');
    const hidden = (ThreadWatcher.dialog.hidden = !ThreadWatcher.dialog.hidden);
    if (hidden) {
      ThreadWatcher.hideThumbnailHover();
    } else {
      // The list was measured while hidden during build(), so the hint couldn't
      // be sized yet; re-evaluate now that the dialog is laid out and visible.
      ThreadWatcher.updateScrollMore();
    }
    return hidden;
  },

  cb: {
    openAll() {
      if ($.hasClass(this, 'disabled')) return;
      for (var a of $$('a.watcher-link', ThreadWatcher.list)) {
        $.open(a.href);
      }
      $.event('CloseMenu');
    },
    openUnread() {
      if ($.hasClass(this, 'disabled')) return;
      for (var a of $$('.replies-unread > a.watcher-link', ThreadWatcher.list)) {
        $.open(a.href);
      }
      $.event('CloseMenu');
    },
    openDeads() {
      if ($.hasClass(this, 'disabled')) return;
      for (var a of $$('.dead-thread.replies-unread > a.watcher-link', ThreadWatcher.list)) {
        $.open(a.href);
      }
      $.event('CloseMenu');
    },
    clear() {
      if (!confirm("Delete ALL threads from watcher?")) return;
      const ref = ThreadWatcher.getAll();
      for (let i = 0, len = ref.length; i < len; i++) {
        const { siteID, boardID, threadID } = ref[i];
        ThreadWatcher.db.delete({ siteID, boardID, threadID });
      }
      ThreadWatcher.refresh(true);
      $.event('CloseMenu');
    },
    pruneDeads() {
      if ($.hasClass(this, 'disabled')) return;
      for (var {siteID, boardID, threadID, data} of ThreadWatcher.getAll()) {
        if (data.isDead) {
          ThreadWatcher.db.delete({siteID, boardID, threadID});
        }
      }
      ThreadWatcher.refresh(true);
      $.event('CloseMenu');
    },
    pruneReadDeads() {
      if ($.hasClass(this, 'disabled')) return;
      for (var { siteID, boardID, threadID, data } of ThreadWatcher.getAll()) {
        if (data.isDead && !data.unread) {
          ThreadWatcher.db.delete({ siteID, boardID, threadID });
        }
      }
      ThreadWatcher.refresh(true);
      $.event('CloseMenu');
    },
    dismiss() {
      for (var {siteID, boardID, threadID, data} of ThreadWatcher.getAll()) {
        if (data.quotingYou) {
          ThreadWatcher.update(siteID, boardID, threadID, {dismiss: data.quotingYou || 0, yousCount: 0});
        }
      }
      $.event('CloseMenu');
    },
    markAllRead() {
      // While the undo window is open the same icon is the Undo button, so a
      // click restores the prior state instead of marking read again.
      if (ThreadWatcher.markReadUndo) { ThreadWatcher.undoMarkAllRead(); return; }
      if ($.hasClass(this, 'disabled') || !ThreadWatcher.unreadEnabled) { return; }
      const snapshot: any[] = [];
      for (var {siteID, boardID, threadID, data} of ThreadWatcher.getAll()) {
        // Only remember threads that actually had something unread, so the undo
        // restores the prior state (and reports an accurate count).
        if (data.unread || data.quotingYou || data.yousCount) {
          snapshot.push({
            siteID, boardID, threadID,
            prevRead: ThreadWatcher.unreaddb.get({siteID, boardID, threadID}),
            unread: data.unread,
            quotingYou: data.quotingYou,
            yousCount: data.yousCount,
            dismiss: data.dismiss
          });
        }
        if (data.last != null) {
          ThreadWatcher.unreaddb.set({siteID, boardID, threadID, val: data.last});
        }
        ThreadWatcher.update(siteID, boardID, threadID, {
          unread: 0,
          quotingYou: 0,
          yousCount: 0,
          dismiss: data.quotingYou || 0
        });
      }
      if (snapshot.length) { ThreadWatcher.showMarkReadUndo(snapshot); }
    },
    undoMarkAllRead() {
      ThreadWatcher.undoMarkAllRead();
    },
    expireMarkReadUndo() {
      ThreadWatcher.expireMarkReadUndo();
    },
    markRead(this: HTMLElement) {
      if ($.hasClass(this, 'disabled') || !ThreadWatcher.unreadEnabled) { return; }
      const line = this.parentNode as HTMLElement | null;
      if (!line) { return; }
      const {siteID} = line.dataset;
      const [boardID, threadID] = line.dataset.fullID!.split('.');
      const data = ThreadWatcher.db?.get({siteID, boardID, threadID: +threadID});
      if (!data) { return; }
      if (data.last != null) {
        ThreadWatcher.unreaddb.set({siteID, boardID, threadID: +threadID, val: data.last});
      }
      ThreadWatcher.update(siteID!, boardID, +threadID, {
        unread: 0,
        quotingYou: 0,
        yousCount: 0,
        dismiss: data.quotingYou || 0
      });
    },
    scrollMore() {
      const {list} = ThreadWatcher;
      if (!list) { return; }
      list.scrollBy({ top: Math.max(40, list.clientHeight - 30), behavior: 'smooth' });
    },
    thumbnailHoverIn(this: HTMLImageElement) {
      ThreadWatcher.showThumbnailHover(this);
    },
    thumbnailHoverMove(this: HTMLImageElement) {
      if (ThreadWatcher.hoveredThumbnail === this) {
        ThreadWatcher.positionThumbnailHover(this);
      }
    },
    thumbnailHoverOut(this: HTMLImageElement) {
      if (ThreadWatcher.hoveredThumbnail === this) {
        ThreadWatcher.hideThumbnailHover();
      }
    },
    toggle() {
      const post = Get.postFromNode(this);
      if (!post) { return; }
      const {thread} = post;
      ThreadWatcher.toggle(thread, true);
    },
    rm(this: HTMLElement) {
      const {siteID} = (this.parentNode as HTMLElement).dataset;
      const [boardID, threadID] = (this.parentNode as HTMLElement).dataset.fullID!.split('.');
      ThreadWatcher.rm(siteID!, boardID, +threadID, undefined, true);
    },
    post(e: CustomEvent) {
      const {boardID, threadID, postID} = e.detail;
      const cb = PostRedirect.delay();
      if (postID === threadID) {
        if (Conf['Auto Watch']) {
          ThreadWatcher.addRaw(boardID, threadID, {}, cb, true);
        }
      } else if (Conf['Auto Watch Reply']) {
        ThreadWatcher.add(
          (g.threads!.get(boardID + '.' + threadID) || new Thread(threadID, (g.boards[boardID] || new Board(boardID)) as any)),
          cb, true);
      }
    },
    onIndexUpdate(e: CustomEvent) {
      const {db}    = ThreadWatcher;
      const siteID  = g.SITE!.ID;
      const boardID = g.BOARD!.ID;
      let nKilled = 0;
      for (var threadID in db.data[siteID].boards[boardID]) {
        // Don't prune threads that have yet to appear in index.
        var data = db.data[siteID].boards[boardID][threadID];
        if (!data?.isDead && !e.detail.threads.includes(`${boardID}.${threadID}`)) {
          if (!e.detail.threads.some((fullID: string) => +fullID.split('.')[1] > (threadID as any))) { continue; }
          if (Conf['Auto Prune'] || !(data && (typeof data === 'object'))) { // corrupt data
            db.delete({boardID, threadID});
            nKilled++;
          } else {
            ThreadWatcher.fetchStatus({siteID, boardID, threadID, data});
          }
        }
      }
      if (nKilled) { return ThreadWatcher.refresh(); }
    },
    onThreadRefresh(e: CustomEvent) {
      const thread = g.threads!.get(e.detail.threadID);
      if (!e.detail[404] || !ThreadWatcher.isWatched(thread)) { return; }
      // Update dead status.
      return ThreadWatcher.add(thread);
    }
  },

  requests: [] as any[],
  fetched:  0,

  fetch(url: string, {siteID, force}: { siteID: string; force?: boolean }, args: any[], cb: (this: XMLHttpRequest, ...args: any[]) => void) { // loose: args/cb are forwarded into parse* handlers with dynamic watcher record shapes
    if (ThreadWatcher.requests.length === 0) {
      ThreadWatcher.status.textContent = '...';
      $.addClass(ThreadWatcher.refreshButton, 'spin');
    }
    const onloadend = function(this: XMLHttpRequest) {
      if ((this as any).finished) { return; }
      (this as any).finished = true;
      ThreadWatcher.fetched++;
      if (ThreadWatcher.fetched === ThreadWatcher.requests.length) {
        ThreadWatcher.clearRequests();
      } else {
        ThreadWatcher.status.textContent = `${Math.round((ThreadWatcher.fetched / ThreadWatcher.requests.length) * 100)}%`;
      }
      return cb.apply(this, args);
    };
    const ajax = siteID === g.SITE!.ID ? $.ajax : CrossOrigin.ajax;
    if (force) {
      delete $.lastModified.ThreadWatcher?.[url];
    }
    const req = $.whenModified(
      url,
      'ThreadWatcher',
      onloadend,
      { timeout: MINUTE, ajax }
    );
    return ThreadWatcher.requests.push(req);
  },

  clearRequests() {
    ThreadWatcher.requests = [];
    ThreadWatcher.fetched = 0;
    ThreadWatcher.status.textContent = '';
    return $.rmClass(ThreadWatcher.refreshButton, 'spin');
  },

  abort() {
    delete (ThreadWatcher as any).syncing;
    for (var req of ThreadWatcher.requests) {
      if (!req.finished) {
        req.finished = true;
        req.abort();
      }
    }
    return ThreadWatcher.clearRequests();
  },

  initLastModified() {
    const lm = ($.lastModified['ThreadWatcher'] || ($.lastModified['ThreadWatcher'] = dict()));
    for (var siteID in ThreadWatcher.dbLM.data) {
      var boards = ThreadWatcher.dbLM.data[siteID];
      for (var boardID in boards.boards) {
        var data = boards.boards[boardID];
        if (ThreadWatcher.db.get({siteID, boardID})) {
          for (var url in data) {
            var date = data[url];
            lm[url] = date;
          }
        } else {
          ThreadWatcher.dbLM.delete({siteID, boardID});
        }
      }
    }
  },

  fetchAuto() {
    let middle;
    clearTimeout(ThreadWatcher.timeout);
    if (!Conf['Auto Update Thread Watcher']) { return; }
    const {db} = ThreadWatcher;
    const interval = Conf['Show Page'] || (ThreadWatcher.unreadEnabled && Conf['Show Unread Count']) ? 5 * MINUTE : 2 * HOUR;
    const now = Date.now();
    if ((now - interval >= ((middle = db.data.lastChecked || 0)) || middle > now) && !d.hidden && !!d.hasFocus()) {
      ThreadWatcher.fetchAllStatus(interval);
    }
    return ThreadWatcher.timeout = setTimeout(ThreadWatcher.fetchAuto, interval);
  },

  buttonFetchAll() {
    if (ThreadWatcher.syncing || ThreadWatcher.requests.length) {
      return ThreadWatcher.abort();
    } else {
      return ThreadWatcher.fetchAllStatus();
    }
  },

  fetchAllStatus(interval=0) {
    ThreadWatcher.status.textContent = '...';
    $.addClass(ThreadWatcher.refreshButton, 'spin');
    ThreadWatcher.syncing = true;
    const dbs = [ThreadWatcher.db, ThreadWatcher.unreaddb, QuoteYou.db].filter(x => x);
    let n = 0;
    return dbs.map((dbi) =>
      dbi.forceSync(function() {
        if ((++n) === dbs.length) {
          let middle;
          if (!ThreadWatcher.syncing) { return; } // aborted
          delete (ThreadWatcher as any).syncing;
          if (0 > (middle = Date.now() - (ThreadWatcher.db.data.lastChecked || 0)) || middle >= interval) { // not checked in another tab
            // XXX On vichan boards, last_modified field of threads.json does not account for sage posts.
            // Occasionally check replies field of catalog.json to find these posts.
            let middle1;
            const {db} = ThreadWatcher;
            const now = Date.now();
            const deep = !(now - (2 * HOUR) < ((middle1 = db.data.lastChecked2 || 0)) && middle1 <= now);
            const boards = ThreadWatcher.getAll(true);
            for (var board of boards) {
              ThreadWatcher.fetchBoard(board, deep);
            }
            db.setLastChecked();
            if (deep) { db.setLastChecked('lastChecked2'); }
          }
          if (ThreadWatcher.fetched === ThreadWatcher.requests.length) {
            return ThreadWatcher.clearRequests();
          }
        }
      }));
  },

  fetchBoard(board: any, deep?: boolean) { // loose: board is an array of dynamic watcher thread records ({siteID, boardID, threadID, data, ...})
    if (!board.some((thread: any) => !thread.data.isDead)) { return; }
    let force = false;
    for (var thread of board) {
      var {data} = thread;
      if (!data.isDead && (data.last !== -1)) {
        if (Conf['Show Page'] && (data.page == null)) { force = true; }
        if ((data.modified == null)) { force = (thread.force = true); }
        if (ThreadWatcher.showThumbnails() && !data.thumbURL) { force = (thread.force = true); }
      }
    }
    const {siteID, boardID} = board[0];
    const site = g.sites[siteID];
    if (!site) { return; }
    const urlF = deep && site.threadModTimeIgnoresSage ? 'catalogJSON' : 'threadsListJSON';
    const url = site.urls[urlF]?.({siteID, boardID});
    if (!url) { return; }
    return ThreadWatcher.fetch(url, {siteID, force}, [board, url], ThreadWatcher.parseBoard);
  },

  parseBoard(this: XMLHttpRequest, board: any, url: string) { // loose: board is an array of dynamic watcher thread records
    let page, thread;
    if (this.status !== 200) { return; }
    const {siteID, boardID} = board[0];
    const lmDate = this.getResponseHeader('Last-Modified');
    ThreadWatcher.dbLM.extend({siteID, boardID, val: $.item(url, lmDate)});
    const threads = dict();
    let pageLength = 0;
    let nThreads = 0;
    let oldest = null;
    try {
      pageLength = this.response[0]?.threads.length || 0;
      for (let i = 0; i < this.response.length; i++) {
        page = this.response[i];
        for (var item of page.threads) {
          threads[item.no] = {
            page: i + 1,
            index: nThreads,
            modified: item.last_modified,
            replies: item.replies
          };
          nThreads++;
          if ((oldest == null) || (item.no < oldest)) {
            oldest = item.no;
          }
        }
      }
    } catch (error) {
      for (thread of board) {
        ThreadWatcher.fetchStatus(thread);
      }
    }
    for (thread of board) {
      var {threadID, data} = thread;
      if (threads[threadID]) {
        var index, modified, replies;
        ({page, index, modified, replies} = threads[threadID]);
        if (Conf['Show Page']) {
          var lastPage = g.sites[siteID].isPrunedByAge?.({siteID, boardID} as any) ?
            threadID === oldest
          :
            index >= (nThreads - pageLength);
          ThreadWatcher.update(siteID, boardID, threadID, {page, lastPage});
        }
        if (ThreadWatcher.unreadEnabled && Conf['Show Unread Count']) {
          if ((modified !== data.modified) || ((replies != null) && (replies !== data.replies))) {
            (thread.newData || (thread.newData = {})).modified = modified;
            ThreadWatcher.fetchStatus(thread);
          }
        }
        if (ThreadWatcher.showThumbnails() && !data.thumbURL) {
          ThreadWatcher.fetchStatus(thread);
        }
      } else {
        ThreadWatcher.fetchStatus(thread);
      }
    }
  },

  fetchStatus(thread: any) { // loose: thread is a dynamic watcher record ({siteID, boardID, threadID, data, force, ...})
    const {siteID, boardID, threadID, data, force} = thread;
    const url = g.sites[siteID]?.urls.threadJSON?.({siteID, boardID, threadID} as any);
    if (!url) { return; }
    if (data.isDead && !force) { return; }
    if (data.last === -1) { return; } // 404 or no JSON API
    return ThreadWatcher.fetch(url, {siteID, force}, [thread], ThreadWatcher.parseStatus);
  },

  parseStatus(this: XMLHttpRequest, thread: any, isArchiveURL?: boolean) { // loose: thread is a dynamic watcher record
    let isDead, last;
    let {siteID, boardID, threadID, data, newData, force} = thread;
    const site = g.sites[siteID];
    if ((this.status === 200) && this.response) {
      let isArchived;
      last = this.response.posts[this.response.posts.length-1].no;
      const replies = this.response.posts.length-1;
      isDead = (isArchived = !!(this.response.posts[0].archived || isArchiveURL));
      const thumbURL = ThreadWatcher.getOPThumbURL({siteID, boardID, postObj: this.response.posts[0]});
      if (isDead && Conf['Auto Prune']) {
        ThreadWatcher.rm(siteID, boardID, threadID);
        return;
      }

      if ((last === data.last) && (isDead === data.isDead) && (isArchived === data.isArchived) && (!thumbURL || thumbURL === data.thumbURL)) { return; }

      const lastReadPost = ThreadWatcher.unreaddb.get({siteID, boardID, threadID, defaultValue: 0});
      let unread = data.unread || 0;
      let quotingYou = data.quotingYou || 0;
      let yousCount = data.yousCount || 0;
      const youOP = !!QuoteYou.db?.get({siteID, boardID, threadID, postID: threadID});

      for (var postObj of this.response.posts) {
        if ((postObj.no <= (data.last || 0)) || (postObj.no <= lastReadPost)) { continue; }
        if (QuoteYou.db?.get({siteID, boardID, threadID, postID: postObj.no})) { continue; }

        var quotesYou = false;
        if (!Conf['Require OP Quote Link'] && youOP) {
          quotesYou = true;
        } else if (QuoteYou.db && postObj.com) {
          var match;
          var regexp = site.regexp.quotelinkHTML;
          regexp.lastIndex = 0;
          while (match = regexp.exec(postObj.com)) {
            if (QuoteYou.db.get({
              siteID,
              boardID:  match[1] ? encodeURIComponent(match[1]) : boardID,
              threadID: match[2] || threadID,
              postID:   match[3] || match[2] || threadID
            })) {
              quotesYou = true;
              break;
            }
          }
        }

        if (!unread || (!quotingYou && quotesYou)) {
          if (Filter.isHidden(site.Build.parseJSON(postObj, {siteID, boardID}))) { continue; }
        }

        unread++;
        if (quotesYou) { quotingYou = postObj.no; yousCount++; }
      }

      if (!newData) { newData = {}; }
      if ((thumbURL != null) && (thumbURL !== data.thumbURL)) {
        newData.thumbURL = thumbURL;
      }
      $.extend(newData, {last, replies, isDead, isArchived, unread, quotingYou, yousCount});
      return ThreadWatcher.update(siteID, boardID, threadID, newData);

    } else if (this.status === 404) {
      const archiveURL = g.sites[siteID]?.urls.archivedThreadJSON?.({siteID, boardID, threadID});
      if (!isArchiveURL && archiveURL) {
        return ThreadWatcher.fetch(archiveURL, {siteID, force}, [thread, true], ThreadWatcher.parseStatus);
      } else if (site.mayLackJSON && (data.last == null)) {
        return ThreadWatcher.update(siteID, boardID, threadID, {last: -1});
      } else {
        return ThreadWatcher.update(siteID, boardID, threadID, {isDead: true});
      }
    }
  },

  getOPThumbURL({siteID, boardID, thread, postObj}: { siteID?: string; boardID?: string; thread?: any; postObj?: any }) { // loose: thread/postObj are dynamic JSON/Thread-ish shapes
    if (thread?.OP?.file?.thumbURL) { return thread.OP.file.thumbURL; }
    if (!postObj) { return; }
    const site = g.sites[siteID as any];
    if (site?.Build?.parseJSON) {
      try {
        const post = site.Build.parseJSON(postObj, {siteID: siteID!, boardID: boardID!}) as any;
        if (post?.file?.thumbURL) { return post.file.thumbURL; }
      } catch (err) {}
    }
    if ((postObj.tim != null) && site?.urls?.thumb) {
      return site.urls.thumb({siteID, boardID}, `${postObj.tim}s.jpg`);
    }
  },

  // Pure single-dimension comparators: each compares ONE field so they can be
  // composed (primary, then secondary, then a stable tiebreak). Tiebreaks that
  // used to live inside `yous`/`board` now come from sortComparator() instead.
  sortComparators: {
    // loose: a/b are dynamic watcher records ({siteID, boardID, threadID, data, ...})
    manual(a: any, b: any) {
      const ao = a.data.order;
      const bo = b.data.order;
      if ((ao == null) && (bo == null)) { return 0; }
      if (ao == null) { return 1; }
      if (bo == null) { return -1; }
      return ao - bo;
    },
    'date-added': (a: any, b: any) => (b.data.addedAt || 0) - (a.data.addedAt || 0),
    'thread-date': (a: any, b: any) => Number(b.threadID) - Number(a.threadID),
    replies: (a: any, b: any) => (b.data.replies || 0) - (a.data.replies || 0),
    unread: (a: any, b: any) => (b.data.unread || 0) - (a.data.unread || 0),
    activity: (a: any, b: any) => (b.data.modified || 0) - (a.data.modified || 0),
    yous: (a: any, b: any) => ThreadWatcher.activeYous(b.data) - ThreadWatcher.activeYous(a.data),
    board(a: any, b: any) {
      const sa = `${a.siteID}/${a.boardID}`;
      const sb = `${b.siteID}/${b.boardID}`;
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    }
  },

  // Primaries whose values cluster into ties, where a secondary sort is useful.
  // The near-unique modes (manual, date-added, thread-date) are deliberately
  // excluded — a secondary would never get a chance to run.
  secondarySortablePrimaries: ['yous', 'unread', 'replies', 'board', 'activity'],

  sortMode(): string {
    const mode = Conf['Thread Watcher Sort'] || 'manual';
    return ThreadWatcher.sortComparators[mode as keyof typeof ThreadWatcher.sortComparators] ? mode : 'manual';
  },

  // The effective secondary mode, or '' when there is none. Only honored when
  // the primary produces ties, and never the same as (or weaker than) primary.
  sortMode2(): string {
    const primary = ThreadWatcher.sortMode();
    if (!ThreadWatcher.secondarySortablePrimaries.includes(primary)) { return ''; }
    const mode = Conf['Thread Watcher Sort 2'];
    if (!mode || mode === 'manual' || mode === primary) { return ''; }
    return ThreadWatcher.sortComparators[mode as keyof typeof ThreadWatcher.sortComparators] ? mode : '';
  },

  // Composed comparator: primary, then the optional secondary, then a stable
  // date-added tiebreak so the order is always deterministic.
  sortComparator() {
    const cmp = ThreadWatcher.sortComparators;
    const primary = cmp[ThreadWatcher.sortMode() as keyof typeof cmp];
    const sec = ThreadWatcher.sortMode2();
    const secondary = sec ? cmp[sec as keyof typeof cmp] : null;
    const tiebreak = cmp['date-added'];
    return (a: any, b: any) => primary(a, b) || (secondary ? secondary(a, b) : 0) || tiebreak(a, b);
  },

  activeYous(data: any): number { // loose: data is a dynamic watcher record value
    if (!data) { return 0; }
    if ((data.quotingYou || 0) <= (data.dismiss || 0)) { return 0; }
    return data.yousCount || 1;
  },

  getAll(groupByBoard?: boolean, _unused?: boolean) {
    const all: any[] = [];
    for (var siteID in ThreadWatcher.db.data) {
      var boards = ThreadWatcher.db.data[siteID];
      for (var boardID in boards.boards) {
        var cont: any[] = [];
        var threads = boards.boards[boardID];
        if (Conf['Current Board'] && ((siteID !== g.SITE!.ID) || (boardID !== g.BOARD!.ID))) {
          continue;
        }
        if (groupByBoard) {
          all.push((cont = [] as any[]));
        }
        for (var threadID in threads) {
          var data = threads[threadID];
          if (data && (typeof data === 'object')) {
            (groupByBoard ? cont : all).push({siteID, boardID, threadID, data});
          }
        }
      }
    }
    if (!groupByBoard) {
      all.sort(ThreadWatcher.sortComparator());
    }
    return all;
  },

  makeLine(siteID: string, boardID: string, threadID: number | string, data: any) { // loose: data is a dynamic watcher record value
    let page;
    const x = $.el('a', {
      textContent: '✕',
      href: 'javascript:;',
      draggable: false
    });
    Icon.set(x, 'xmark');
    $.on(x, 'click', ThreadWatcher.cb.rm);

    let {excerpt, isArchived} = data;
    if (!excerpt) { excerpt = `/${boardID}/ - No.${threadID}`; }
    if (Conf['Show Site Prefix']) { excerpt = ThreadWatcher.prefixes[siteID] + excerpt; }

    const link = $.el('a', {
      href: g.sites[siteID as any]?.urls.thread({siteID, boardID, threadID}, isArchived) || '',
      title: excerpt,
      className: 'watcher-link',
      draggable: false
    });

    if (ThreadWatcher.showThumbnails()) {
      const thumb = data.thumbURL ?
        $.el('img', {
          src: data.thumbURL,
          alt: '',
          className: 'watcher-thumb'
        })
      :
        $.el('span', {
          className: 'watcher-thumb watcher-thumb-missing'
        });
      if (Conf['Thread Watcher Thumbnail Hover'] && thumb.nodeName === 'IMG') {
        $.on(thumb, 'mouseover', ThreadWatcher.cb.thumbnailHoverIn);
        $.on(thumb, 'mousemove', ThreadWatcher.cb.thumbnailHoverMove);
        $.on(thumb, 'mouseout', ThreadWatcher.cb.thumbnailHoverOut);
      }
      $.add(link, thumb);
    }

    if (Conf['Show Page'] && (data.page != null)) {
      page = $.el('span', {
        textContent: `[${data.page}]`,
        className: 'watcher-page'
      });
      $.add(link, page);
    }

    if (ThreadWatcher.unreadEnabled && Conf['Show Unread Count'] && (data.unread != null)) {
      const count = $.el('span', {
        textContent: `(${data.unread})`,
        className: 'watcher-unread'
      });
      $.add(link, count);
    }

    const title = $.el('span', {
      textContent: excerpt,
      className: 'watcher-title'
    });
    $.add(link, title);

    const div = $.el('div', { draggable: ThreadWatcher.sortMode() === 'manual' });
    const fullID = `${boardID}.${threadID}`;
    div.dataset.fullID = fullID;
    div.dataset.siteID = siteID;
    if ((g.VIEW === 'thread') && (fullID === `${g.BOARD}.${g.THREADID}`)) { $.addClass(div, 'current'); }
    if (data.isDead) { $.addClass(div, 'dead-thread'); }
    if (Conf['Show Page']) {
      if (data.lastPage) { $.addClass(div, 'last-page'); }
      if (data.page != null) { div.dataset.page = data.page; }
    }
    if (ThreadWatcher.unreadEnabled && Conf['Show Unread Count']) {
      if (data.unread === 0) { $.addClass(div, 'replies-read'); }
      if (data.unread) { $.addClass(div, 'replies-unread'); }
      if ((data.quotingYou || 0) > (data.dismiss || 0)) { $.addClass(div, 'replies-quoting-you'); }
    }
    for (var event of ['start', 'end', 'enter', 'leave', 'over']) {
      $.on(div, `drag${event}`, ThreadWatcher.drag[event as keyof typeof ThreadWatcher.drag]);
    }
    $.on(div, 'drop', ThreadWatcher.drag.drop);
    const nodes = [x, link];
    if (Conf['Show Mark Thread Read Icons']) {
      const markRead = $.el('a', {
        href: 'javascript:;',
        className: 'watcher-mark-read',
        draggable: false,
        title: ThreadWatcher.unreadEnabled ?
          'Mark this watched thread as read'
        :
          'Mark read is unavailable because Remember Last Read Post is disabled.'
      });
      Icon.set(markRead, 'check');
      if (!ThreadWatcher.unreadEnabled || (!data.unread && !((data.quotingYou || 0) > (data.dismiss || 0)))) {
        $.addClass(markRead, 'disabled');
      }
      $.on(markRead, 'mousedown pointerdown', e => e.stopPropagation());
      $.on(markRead, 'click', ThreadWatcher.cb.markRead);
      nodes.push(markRead);
    }
    $.add(div, nodes);
    return div;
  },

  keyFromLine(line: HTMLElement) {
    return `${line.dataset.siteID}/${line.dataset.fullID}`;
  },

  threadKey({siteID, boardID, threadID}: { siteID: string; boardID: string; threadID: number | string }) {
    return `${siteID}/${boardID}.${threadID}`;
  },

  dropPosition(line: HTMLElement, e: DragEvent) {
    const rect = line.getBoundingClientRect();
    return { before: e.clientY < rect.top + (rect.height / 2) };
  },

  clearDragState() {
    if (ThreadWatcher.draggingLine) {
      ThreadWatcher.draggingLine.classList.remove('drag');
    }
    ThreadWatcher.draggingLine = null;
    for (const line of $$('#watched-threads > div', ThreadWatcher.list)) {
      line.classList.remove('over');
      delete line.dataset.dropBefore;
    }
  },

  reorderInDOM(sourceLine: HTMLElement, targetLine: HTMLElement, before: boolean) {
    if (!sourceLine || !targetLine || sourceLine === targetLine) { return; }
    const list = ThreadWatcher.list;
    if (!list) { return; }
    if (before) {
      list.insertBefore(sourceLine, targetLine);
    } else {
      list.insertBefore(sourceLine, targetLine.nextSibling);
    }
    ThreadWatcher.persistOrderFromDOM();
    ThreadWatcher.refreshIcon();
  },

  persistOrder(threadsArg?: any[]) { // loose: array of dynamic watcher records
    const threads: any[] = threadsArg || ThreadWatcher.getAll(false, true);
    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const order = i + 1;
      if (thread.data.order === order) { continue; }
      thread.data.order = order;
      ThreadWatcher.db.extend({siteID: thread.siteID, boardID: thread.boardID, threadID: +thread.threadID, val: {order}});
    }
  },

  persistOrderFromDOM() {
    const lines = $$('#watched-threads > div', ThreadWatcher.list);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const siteID = line.dataset.siteID;
      const [boardID, threadID] = line.dataset.fullID.split('.');
      const order = i + 1;
      const data = ThreadWatcher.db.get({siteID, boardID, threadID});
      if (!data || data.order === order) { continue; }
      data.order = order;
      ThreadWatcher.db.extend({siteID, boardID, threadID: +threadID, val: {order}});
    }
  },

  setPrefixes(threads: { siteID: string }[]) {
    const prefixes = dict();
    for (var {siteID} of threads) {
      if (siteID in prefixes) { continue; }
      var len = 0;
      var prefix = '';
      var conflicts = Object.keys(prefixes);
      while (conflicts.length > 0) {
        len++;
        prefix = siteID.slice(0, len);
        var conflicts2: string[] = [];
        for (var siteID2 of conflicts) {
          if (siteID2.slice(0, len) === prefix) {
            conflicts2.push(siteID2);
          } else if (prefixes[siteID2].length < len) {
            prefixes[siteID2] = siteID2.slice(0, len);
          }
        }
        conflicts = conflicts2;
      }
      prefixes[siteID] = prefix;
    }
    return ThreadWatcher.prefixes = prefixes;
  },

  build() {
    ThreadWatcher.applyLayout();
    ThreadWatcher.hideThumbnailHover();
    const nodes: any[] = [];
    const threads = ThreadWatcher.getAll();
    ThreadWatcher.setPrefixes(threads);
    for (var {siteID, boardID, threadID, data} of threads) {
      // Add missing excerpt for threads added by Auto Watch
      var thread;
      if ((data.excerpt == null) && (siteID === g.SITE!.ID) && (thread = g.threads!.get(`${boardID}.${threadID}`)) && thread.OP) {
        ThreadWatcher.db.extend({boardID, threadID, val: {excerpt: Get.threadExcerpt(thread)}});
      }
      if ((data.thumbURL == null) && (siteID === g.SITE!.ID) && (thread = g.threads!.get(`${boardID}.${threadID}`)) && thread.OP?.file?.thumbURL) {
        ThreadWatcher.db.extend({boardID, threadID, val: {thumbURL: thread.OP.file.thumbURL}});
        data.thumbURL = thread.OP.file.thumbURL;
      }
      nodes.push(ThreadWatcher.makeLine(siteID, boardID, threadID, data));
    }
    const {list} = ThreadWatcher;
    $.rmAll(list);
    $.add(list, nodes);

    const ret = ThreadWatcher.refreshIcon();
    ThreadWatcher.updateScrollMore();
    if (ThreadWatcher.attached()) { ThreadWatcher.positionIfAttached(true); }
    return ret;
  },

  refresh(manual?: boolean) {
    ThreadWatcher.build();

    g.threads!.forEach(function(thread) {
      const isWatched = ThreadWatcher.isWatched(thread);
      if (thread.OP) {
        for (var post of [thread.OP, ...thread.OP.clones]) {
          var toggler;
          if (toggler = $('.watch-thread-link', post.nodes.info)) {
            ThreadWatcher.setToggler(toggler, isWatched);
          }
        }
      }
      if (thread.catalogView) { return thread.catalogView.nodes.root.classList.toggle('watched', isWatched); }
    });

    if (Conf['Pin Watched Threads']) {
      return $.event('SortIndex', {deferred: !(manual && Conf['Index Mode'] === 'catalog')});
    }
  },

  refreshIcon() {
    for (var className of ['replies-unread', 'replies-quoting-you']) {
      ThreadWatcher.shortcut.classList.toggle(className, !!$(`.${className}`, ThreadWatcher.dialog));
    }
    // Leave the button alone while it's showing the Undo affordance; marking
    // everything read flips hasUnread to false, which would otherwise disable
    // and reset the icon mid-countdown.
    if (ThreadWatcher.markReadButton && !ThreadWatcher.markReadUndo) {
      const hasUnread = !!$('.replies-unread, .replies-quoting-you', ThreadWatcher.list);
      ThreadWatcher.markReadButton.classList.toggle('disabled', !ThreadWatcher.unreadEnabled || !hasUnread);
      ThreadWatcher.markReadButton.title = !ThreadWatcher.unreadEnabled ?
        'Mark all read is unavailable because Remember Last Read Post is disabled.'
      : hasUnread ?
        'Mark all watched threads as read'
      :
        'No unread watched threads';
    }
  },

  showMarkReadUndo(snapshot: any[]) {
    // Opt-in affordance; off by default. When disabled the mark-all-read still
    // happens, there's just no undo prompt.
    if (!Conf['Show Undo Button']) { return; }
    const btn = ThreadWatcher.markReadButton;
    if (!btn) { return; }
    // Drop any pending undo without restoring it; the new mark-all-read wins.
    ThreadWatcher.hideMarkReadUndo();
    ThreadWatcher.markReadUndo = snapshot;
    // Morph the header check into an Undo arrow wrapped by a circular countdown
    // ring. The ring depletes over --undo-duration; the JS timer reverts it.
    btn.classList.remove('disabled');
    $.addClass(btn, 'watcher-undo-pending');
    btn.title = 'Undo mark all read';
    Icon.set(btn, 'undo');
    const ring = $.el('span', {className: 'watcher-undo-ring'});
    ring.style.setProperty('--undo-duration', `${MARK_READ_UNDO_MS}ms`);
    ring.innerHTML =
      '<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7.5"/></svg>';
    $.add(btn, ring);
    ThreadWatcher.undoTimeout = setTimeout(ThreadWatcher.cb.expireMarkReadUndo, MARK_READ_UNDO_MS);
  },

  // Countdown elapsed without an undo click: just tear the affordance down.
  expireMarkReadUndo() {
    ThreadWatcher.hideMarkReadUndo();
  },

  // Revert the icon to its resting state and forget the snapshot. Safe to call
  // when nothing is pending. Icon.set wipes the appended ring as a side effect.
  hideMarkReadUndo() {
    if (ThreadWatcher.undoTimeout) {
      clearTimeout(ThreadWatcher.undoTimeout);
      ThreadWatcher.undoTimeout = null;
    }
    const btn = ThreadWatcher.markReadButton;
    if (btn && $.hasClass(btn, 'watcher-undo-pending')) {
      $.rmClass(btn, 'watcher-undo-pending');
      btn.title = 'Mark all watched threads as read';
      Icon.set(btn, 'check');
    }
    ThreadWatcher.markReadUndo = null;
    // Restore the correct disabled state / title now that nothing is pending.
    ThreadWatcher.refreshIcon();
  },

  undoMarkAllRead() {
    const snapshot = ThreadWatcher.markReadUndo;
    if (!snapshot) { return; }
    for (const {siteID, boardID, threadID, prevRead, unread, quotingYou, yousCount, dismiss} of snapshot) {
      if (prevRead == null) {
        ThreadWatcher.unreaddb.delete({siteID, boardID, threadID});
      } else {
        ThreadWatcher.unreaddb.set({siteID, boardID, threadID, val: prevRead});
      }
      ThreadWatcher.update(siteID, boardID, threadID, {unread, quotingYou, yousCount, dismiss});
    }
    ThreadWatcher.hideMarkReadUndo();
  },

  updateScrollMore() {
    const {list, scrollMore} = ThreadWatcher;
    if (!list || !scrollMore) { return; }
    // scrollHeight/clientHeight stay valid even when overflow is clamped to
    // hidden (non-fixed, unhovered), so the hint also shows the list has more
    // than fits before the user hovers to expand it.
    const hasMore = (list.scrollHeight - list.clientHeight - list.scrollTop) > 2;
    scrollMore.hidden = !hasMore;
    // Tint the hint red when a thread quoting you is among the entries hidden
    // below the fold, so a (You) off-screen is noticeable without scrolling.
    let youBelow = false;
    if (hasMore) {
      const listBottom = list.getBoundingClientRect().bottom;
      for (const line of list.children) {
        if (line.classList.contains('replies-quoting-you') &&
            line.getBoundingClientRect().bottom > listBottom + 1) {
          youBelow = true;
          break;
        }
      }
    }
    scrollMore.classList.toggle('has-you', youBelow);
  },

  ensureThumbnailHover() {
    if (ThreadWatcher.thumbnailHover) { return ThreadWatcher.thumbnailHover; }
    const hover = $.el('img', {
      id: 'tw-ihover',
      alt: ''
    });
    hover.hidden = true;
    $.add(Header.hover, hover);
    return (ThreadWatcher.thumbnailHover = hover);
  },

  hideThumbnailHover() {
    const hover = ThreadWatcher.thumbnailHover;
    if (!hover) { return; }
    hover.hidden = true;
    hover.removeAttribute('src');
    hover.removeAttribute('style');
    delete ThreadWatcher.hoveredThumbnail;
  },

  showThumbnailHover(thumb: HTMLImageElement) {
    if (!Conf['Thread Watcher Thumbnail Hover'] || !thumb?.src) { return; }
    if (!doc.contains(thumb)) { return; }
    const hover = ThreadWatcher.ensureThumbnailHover();
    hover.hidden = false;
    hover.src = thumb.src;
    ThreadWatcher.hoveredThumbnail = thumb;
    ThreadWatcher.positionThumbnailHover(thumb);
    if (!hover.complete) {
      const onLoad = function() {
        $.off(hover, 'load', onLoad);
        if (ThreadWatcher.hoveredThumbnail === thumb) {
          ThreadWatcher.positionThumbnailHover(thumb);
        }
      };
      $.on(hover, 'load', onLoad);
    }
  },

  positionThumbnailHover(thumb: HTMLImageElement | null) {
    const hover = ThreadWatcher.thumbnailHover;
    if (!hover || hover.hidden || !thumb || !ThreadWatcher.dialog) { return; }
    if (!doc.contains(thumb)) {
      ThreadWatcher.hideThumbnailHover();
      return;
    }
    const dialogRect = ThreadWatcher.dialog.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 8;
    const availableWidth = dialogRect.left - gap - viewportPadding;
    if (availableWidth < 80) {
      ThreadWatcher.hideThumbnailHover();
      return;
    }
    const targetWidth = Math.max(80, Math.floor((availableWidth * ThreadWatcher.thumbnailPreviewSize()) / 100));
    hover.style.width = `${targetWidth}px`;
    hover.style.maxWidth = `${targetWidth}px`;
    hover.style.maxHeight = `${Math.max(120, doc.clientHeight - (viewportPadding * 2))}px`;
    const width = hover.offsetWidth;
    const height = hover.offsetHeight;
    let left = dialogRect.left - gap - width;
    if (left < viewportPadding) { left = viewportPadding; }
    let top = thumbRect.top + ((thumbRect.height - height) / 2);
    top = Math.max(viewportPadding, Math.min(doc.clientHeight - height - viewportPadding, top));
    hover.style.left = `${left}px`;
    hover.style.top = `${top}px`;
  },

  showThumbnails() {
    return Conf['Show OP Thumbnails'];
  },

  thumbnailSize() {
    let size = parseInt(Conf['Thread Watcher Thumbnail Size'], 10);
    if (isNaN(size)) { size = 40; }
    return Math.max(16, Math.min(160, size));
  },

  thumbnailPreviewSize() {
    let size = parseInt(Conf['Thread Watcher Thumbnail Preview Size'], 10);
    if (isNaN(size)) { size = 20; }
    return Math.max(10, Math.min(20, size));
  },

  thumbnailPreviewScale() {
    return (ThreadWatcher.thumbnailPreviewSize() / 10).toFixed(1);
  },

  maxHeight() {
    let height = parseInt(Conf['Thread Watcher Max Height'], 10);
    if (isNaN(height)) { height = 210; }
    return Math.max(120, Math.min(999, height));
  },

  maxWidth() {
    let width = parseInt(Conf['Thread Watcher Max Width'], 10);
    if (isNaN(width)) { width = 250; }
    return Math.max(120, Math.min(999, width));
  },

  applyLayout() {
    if (!ThreadWatcher.dialog) { return; }
    ThreadWatcher.dialog.style.setProperty('--watcher-thumb-size', `${ThreadWatcher.thumbnailSize()}px`);
    ThreadWatcher.dialog.style.setProperty('--watcher-max-height', `${ThreadWatcher.maxHeight()}px`);
    ThreadWatcher.dialog.style.setProperty('--watcher-max-width', `${ThreadWatcher.maxWidth()}px`);
    if (ThreadWatcher.markReadButton) {
      ThreadWatcher.markReadButton.hidden = !Conf['Show Mark All Read Icon'];
    }
  },

  attached() {
    return ThreadWatcher.attachControlsEnabled() && !!Conf['Thread Watcher Attached'];
  },

  attachControlsEnabled() {
    return Conf['Thread Watcher Attach Controls'] !== false;
  },

  applyAttachControlsSetting(val: unknown) {
    const enabled = val !== false;
    Conf['Thread Watcher Attach Controls'] = enabled;
    if (!enabled && Conf['Thread Watcher Attached']) {
      Conf['Thread Watcher Attached'] = false;
      $.set('Thread Watcher Attached', false);
      ThreadWatcher.restorePosition();
      $.event('CloseMenu', null);
    }
    ThreadWatcher.updateAttachButton();
  },

  attachLocation() {
    const loc = Conf['Thread Watcher Attach Location'];
    return (loc === 'top' || loc === 'left' || loc === 'right') ? loc : 'bottom';
  },

  updateAttachButton() {
    const btn = ThreadWatcher.attachButton;
    if (!btn) { return; }
    const controlsEnabled = ThreadWatcher.attachControlsEnabled();
    btn.hidden = false;
    btn.classList.toggle('attach-controls-hidden', !controlsEnabled);
    if (!controlsEnabled) {
      btn.classList.remove('attached');
      btn.title = '';
      btn.setAttribute('aria-hidden', 'true');
      btn.tabIndex = -1;
      return;
    }
    btn.removeAttribute('aria-hidden');
    btn.removeAttribute('tabindex');
    const isAttached = ThreadWatcher.attached();
    btn.classList.toggle('attached', isAttached);
    btn.title = isAttached ? 'Detach from Quick Reply' : 'Attach to Quick Reply';
  },

  toggleAttach() {
    if (!ThreadWatcher.attachControlsEnabled()) { return; }
    const val = !ThreadWatcher.attached();
    $.set('Thread Watcher Attached', val);
    Conf['Thread Watcher Attached'] = val;
    ThreadWatcher.updateAttachButton();
    if (val) {
      ThreadWatcher.positionIfAttached(true);
    } else {
      ThreadWatcher.restorePosition();
    }
  },

  _posRaf: null as number | null,

  positionIfAttached(immediate = false) {
    if (!ThreadWatcher.dialog || !ThreadWatcher.attached()) { return; }
    const qr = QR?.nodes?.el;
    if (!qr || qr.hidden) {
      ThreadWatcher.restorePosition();
      return;
    }
    if (immediate) {
      if (ThreadWatcher._posRaf) {
        cancelAnimationFrame(ThreadWatcher._posRaf);
        ThreadWatcher._posRaf = null;
      }
      ThreadWatcher._doPositionAttached();
      return;
    }
    if (ThreadWatcher._posRaf) { return; }
    ThreadWatcher._posRaf = requestAnimationFrame(() => {
      ThreadWatcher._posRaf = null;
      ThreadWatcher._doPositionAttached();
    });
  },

  _doPositionAttached(skipPreviewWidthSync = false) {
    const dialog = ThreadWatcher.dialog;
    if (!dialog) { return; }
    const qr = QR?.nodes?.el;
    if (!qr || qr.hidden) {
      ThreadWatcher.restorePosition();
      return;
    }
    if (!dialog.classList.contains('watcher-attached')) {
      dialog.classList.add('watcher-attached');
    }
    if (dialog.style.position !== 'fixed') {
      dialog.style.position = 'fixed';
    }
    const qrRect = qr.getBoundingClientRect();
    const loc = ThreadWatcher.attachLocation();
    let targetW = Math.round(qrRect.width);
    if (loc === 'left' || loc === 'right') {
      targetW = ThreadWatcher.maxWidth();
    }

    // Only rewrite size styles (and trigger inner layout + applyLayout) on actual change.
    // This avoids heavy reflow/jank on every frame during QR *position* drags (width unchanged).
    // Width changes (QR resize) will still update live but only do the expensive work when needed.
    let sizeChanged = false;
    if (ThreadWatcher._lastAttachedW !== targetW) {
      dialog.style.width = `${targetW}px`;
      ThreadWatcher._lastAttachedW = targetW;
      sizeChanged = true;
    }

    // Position updates are cheap (fixed element move); always apply for smooth following.
    if (loc === 'bottom') {
      dialog.style.left = `${qrRect.left}px`;
      dialog.style.top = `${qrRect.bottom}px`;
      dialog.style.right = '';
      dialog.style.bottom = '';
    } else if (loc === 'top') {
      // Use bottom positioning so we don't need to measure our own height (avoids sync layout after width set).
      // clientHeight (not innerHeight) excludes any horizontal scrollbar, matching getBoundingClientRect.
      dialog.style.left = `${qrRect.left}px`;
      dialog.style.bottom = `${d.documentElement.clientHeight - qrRect.top}px`;
      dialog.style.top = '';
      dialog.style.right = '';
    } else if (loc === 'left') {
      // Use right positioning + explicit width so watcher extends leftward; no own-size read needed.
      // clientWidth (not innerWidth) excludes the vertical scrollbar; innerWidth would leave a
      // persistent scrollbar-wide gap since CSS `right` is measured from the scrollbar-excluded edge.
      dialog.style.top = `${qrRect.top}px`;
      dialog.style.right = `${d.documentElement.clientWidth - qrRect.left}px`;
      dialog.style.left = '';
      dialog.style.bottom = '';
    } else if (loc === 'right') {
      dialog.style.top = `${qrRect.top}px`;
      dialog.style.left = `${qrRect.right + 2}px`;
      dialog.style.right = '';
      dialog.style.bottom = '';
    }

    if (sizeChanged) {
      if (loc === 'left' || loc === 'right') {
        ThreadWatcher.applyLayout();
        // Sides: width set to manual max W; height sizes to content (capped by manual --max-height via applyLayout).
      } else {
        ThreadWatcher.applyLayout();
        // When vertically attached (bottom/top), fill the list content to the followed QR width
        // (instead of being capped by the manual "max W" setting). The manual value from settings
        // is still the default for standalone (non-attached) watcher and "still works" if you
        // adjust it while attached (the settings sync will push the manual value to --max-width).
        dialog.style.setProperty('--watcher-max-width', `${Math.max(120, targetW - 12)}px`);
      }
    }
    QR?.repositionFloatingPreview?.(skipPreviewWidthSync);
  },

  restorePosition() {
    const dialog = ThreadWatcher.dialog;
    if (!dialog) { return; }
    dialog.classList.remove('watcher-attached');
    ThreadWatcher._lastAttachedW = null;
    const saved = Conf['thread-watcher.position'] || '';
    if (saved) {
      dialog.style.cssText = saved;
    } else {
      dialog.style.cssText = '';
    }
    dialog.style.width = '';
    dialog.style.height = '';
    dialog.style.position = Conf['Fixed Thread Watcher'] ? 'fixed' : 'absolute';
    ThreadWatcher.applyLayout();
    QR?.repositionFloatingPreview?.();
  },

  onQRDialogCreation() {
    const qr = QR?.nodes?.el;
    if (!qr) { return; }
    if (ThreadWatcher._qrObs) {
      try { ThreadWatcher._qrObs.disconnect(); } catch (e) {}
    }
    const schedule = () => {
      if (ThreadWatcher.attached()) {
        // Direct for resize following (avoids rAF frame of lag between QR size change and watcher width update).
        ThreadWatcher._doPositionAttached();
      }
    };
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(schedule);
      ro.observe(qr);
    }
    const mo = new MutationObserver(schedule);
    // Do NOT observe 'style' — drag updates fire too often and cause jank/lag when attached.
    // ResizeObserver covers size (e.g. QR textarea resize); we call _do direct from RO/MO and 4chanXQRMove.
    mo.observe(qr, { attributes: true, attributeFilter: ['hidden', 'class'] });
    ThreadWatcher._qrObs = {
      ro, mo,
      disconnect() { try { ro?.disconnect(); } catch(e){} try { mo.disconnect(); } catch(e){} }
    };
    schedule();
  },

  update(siteID: string, boardID: string, threadID: number | string, newData: any) { // loose: newData is a dynamic watcher record patch
    let data, key: any, line, val;
    if (!(data = ThreadWatcher.db?.get({siteID, boardID, threadID}))) { return; }
    if (newData.isDead && Conf['Auto Prune']) {
      ThreadWatcher.rm(siteID, boardID, threadID);
      return;
    }
    if (newData.isDead || (newData.last === -1)) {
      for (key of ['isArchived', 'page', 'lastPage', 'unread', 'quotingyou']) {
        if (!(key in newData)) {
          newData[key] = undefined;
        }
      }
    }
    if ((newData.last != null) && (newData.last < data.last)) {
      newData.modified = undefined;
    }
    let n = 0;
    for (key in newData) { val = newData[key]; if (data[key] !== val) { n++; } }
    if (!n) { return; }
    ThreadWatcher.db.extend({siteID, boardID, threadID, val: newData});
    if (ThreadWatcher.sortMode() !== 'manual') {
      return ThreadWatcher.refresh();
    }
    if (line = $(`#watched-threads > [data-site-i-d='${siteID}'][data-full-i-d='${boardID}.${threadID}']`, ThreadWatcher.dialog)) {
      const newLine = ThreadWatcher.makeLine(siteID, boardID, threadID, data);
      $.replace(line, newLine);
      return ThreadWatcher.refreshIcon();
    } else {
      return ThreadWatcher.refresh();
    }
  },

  set404(boardID: string, threadID: number | string | undefined, cb: () => void) {
    let data;
    if (!(data = ThreadWatcher.db?.get({boardID, threadID}))) { return cb(); }
    if (Conf['Auto Prune']) {
      ThreadWatcher.db.delete({boardID, threadID});
      return cb();
    }
    if (data.isDead && !((data.isArchived != null) || (data.page != null) || (data.lastPage != null) || (data.unread != null) || (data.quotingYou != null))) { return cb(); }
    return ThreadWatcher.db.extend({boardID, threadID, val: {isDead: true, isArchived: undefined, page: undefined, lastPage: undefined, unread: undefined, quotingYou: undefined}}, cb);
  },

  toggle(thread: Thread, manual?: boolean) {
    if (!thread) { return; }
    const siteID   = g.SITE!.ID;
    const boardID  = thread.board.ID;
    const threadID = thread.ID;
    if (ThreadWatcher.db.get({boardID, threadID})) {
      return ThreadWatcher.rm(siteID, boardID, threadID, undefined, manual);
    } else {
      return ThreadWatcher.add(thread, undefined, manual);
    }
  },

  add(thread: Thread, cb?: (() => any) | null, manual?: boolean) {
    const data: any = {};
    const siteID   = g.SITE!.ID;
    const boardID  = thread.board.ID;
    const threadID = thread.ID;
    if (thread.isDead) {
      if (Conf['Auto Prune'] && ThreadWatcher.db.get({boardID, threadID})) {
        ThreadWatcher.rm(siteID, boardID, threadID, cb);
        return;
      }
      data.isDead = true;
    }
    if (thread.OP) { data.excerpt = Get.threadExcerpt(thread); }
    if (thread.OP?.file?.thumbURL) { data.thumbURL = thread.OP.file.thumbURL; }
    return ThreadWatcher.addRaw(boardID, threadID, data, cb, manual);
  },

  addRaw(boardID: string, threadID: number | string, data: any, cb?: (() => any) | null, manual?: boolean) { // loose: data is a dynamic watcher record
    const oldData = ThreadWatcher.db.get({ boardID, threadID, defaultValue: dict() });
    if (oldData.order == null) {
      oldData.order = ThreadWatcher.getAll().length;
    }
    if (oldData.addedAt == null) {
      oldData.addedAt = Date.now();
    }
    delete oldData.last;
    delete oldData.modified;
    $.extend(oldData, data);
    ThreadWatcher.db.set({boardID, threadID, val: oldData}, cb);
    ThreadWatcher.refresh(manual);
    const thread = {siteID: g.SITE!.ID, boardID, threadID, data, force: true};
    if (Conf['Show Page'] && !data.isDead) {
      return ThreadWatcher.fetchBoard([thread]);
    } else if (ThreadWatcher.unreadEnabled && Conf['Show Unread Count']) {
      return ThreadWatcher.fetchStatus(thread);
    }
  },

  rm(siteID: string, boardID: string, threadID: number | string, cb?: (() => any) | null, manual?: boolean) {
    ThreadWatcher.db.delete({siteID, boardID, threadID}, cb);
    return ThreadWatcher.refresh(manual);
  },

  menu: {
    // Reassigned by addAttachLocationEntry() to refresh the location checkmarks;
    // declared here so the cross-tab sync handler can call it without type errors.
    updateAttachLocationChecks() {},
    init(this: TWMenu) {
      if (!Conf['Thread Watcher']) { return; }
      const menu = (this.menu = new UI.Menu('thread watcher'));
      $.on($('.menu-button', ThreadWatcher.dialog), 'click', function(this: HTMLElement, e) {
        return menu.toggle(e, this, ThreadWatcher);
      });
      return this.addMenuEntries();
    },

    addHeaderMenuEntry() {
      if (g.VIEW !== 'thread') { return; }
      const entryEl = $.el('a',
        {href: 'javascript:;'});
      Header.menu.addEntry({
        el: entryEl,
        order: 60,
        open() {
          const [addClass, rmClass, text] = !!ThreadWatcher.db.get({boardID: g.BOARD!.ID, threadID: g.THREADID}) ?
            ['unwatch-thread', 'watch-thread', 'Unwatch thread']
          :
            ['watch-thread', 'unwatch-thread', 'Watch thread'];
          $.addClass(entryEl, addClass);
          $.rmClass(entryEl, rmClass);
          entryEl.textContent = text;
          return true;
        }
      });
      return $.on(entryEl, 'click', () => ThreadWatcher.toggle(g.threads!.get(`${g.BOARD}.${g.THREADID}`), true));
    },

    addMenuEntries(this: TWMenu) {
      const toggleDisabledDead = function (this: { el: HTMLElement }) {
        this.el.classList.toggle('disabled', !$('.dead-thread', ThreadWatcher.list));
        return true;
      };

      const entries = [
        // `Open all` entry
        {
          text: 'Open all threads',
          cb: ThreadWatcher.cb.openAll,
          open(this: { el: HTMLElement }) {
            this.el.classList.toggle('disabled', !ThreadWatcher.list.firstElementChild);
            return true;
          }
        },
        {
          text: 'Clear all threads',
          cb: ThreadWatcher.cb.clear,
          open(this: { el: HTMLElement }) {
            this.el.classList.toggle('disabled', !ThreadWatcher.list.firstElementChild);
            return true;
          }
        },
        // `Open Unread` entry
        {
          text: 'Open unread threads',
          cb: ThreadWatcher.cb.openUnread,
          open(this: { el: HTMLElement }) {
            this.el.classList.toggle('disabled', !$('.replies-unread', ThreadWatcher.list));
            return true;
          }
        },
        // `Open unread dead threads` entry
        {
          text: 'Open unread dead threads',
          cb: ThreadWatcher.cb.openDeads,
          open: toggleDisabledDead,
        },
        // `Prune all dead threads` entry
        {
          text: 'Prune all dead threads',
          cb: ThreadWatcher.cb.pruneDeads,
          open: toggleDisabledDead,
        },
        // `Prune read dead threads` entry
        {
          text: 'Prune read dead threads',
          cb: ThreadWatcher.cb.pruneReadDeads,
          open: toggleDisabledDead,
        },
        // `Dismiss posts quoting you` entry
        {
          text: 'Dismiss posts quoting you',
          title: 'Unhighlight the thread watcher icon and threads until there are new replies quoting you.',
          cb: ThreadWatcher.cb.dismiss,
          open(this: { el: HTMLElement }) {
            this.el.classList.toggle('disabled', !$.hasClass(ThreadWatcher.shortcut, 'replies-quoting-you'));
            return true;
          }
        },
        {
          text: 'Max H/W',
          nextKey: 'Thread Watcher Max Height',
          open(this: { el: HTMLElement }) {
            this.el.innerHTML = `Max H <input type="number" value="${ThreadWatcher.maxHeight()}" min="120" max="999" class="field" style="width:4.2em"> W<input type="number" value="${ThreadWatcher.maxWidth()}" min="120" max="999" class="field" style="width:4.2em">`;
            const [heightInput, widthInput] = $$('input', this.el);
            for (const input of [heightInput, widthInput]) {
              $.on(input, 'click', e => e.stopPropagation());
              $.on(input, 'mousedown', e => e.stopPropagation());
              $.on(input, 'pointerdown', e => e.stopPropagation());
            }
            $.on(heightInput, 'change', function(this: HTMLInputElement) {
              let height = parseInt(this.value, 10);
              if (isNaN(height)) { height = 210; }
              height = Math.max(120, Math.min(999, height));
              this.value = `${height}`;
              $.set('Thread Watcher Max Height', height);
              Conf['Thread Watcher Max Height'] = height;
              ThreadWatcher.applyLayout();
            });
            $.on(widthInput, 'change', function(this: HTMLInputElement) {
              let width = parseInt(this.value, 10);
              if (isNaN(width)) { width = 250; }
              width = Math.max(120, Math.min(999, width));
              this.value = `${width}`;
              $.set('Thread Watcher Max Width', width);
              Conf['Thread Watcher Max Width'] = width;
              ThreadWatcher.applyLayout();
            });
            return true;
          }
        },
      ];

      for (var {text, title, cb, open, nextKey} of entries as any[]) {
        var entry: any = {
          el: $.el('a', {
            textContent: text,
            href: 'javascript:;'
          })
        };
        if (title) { entry.el.title = title; }
        if (nextKey) { entry.el.dataset.nextKey = nextKey; }
        if (cb) { $.on(entry.el, 'click', cb); }
        entry.open = open.bind(entry);
        this.menu.addEntry(entry);
      }

      this.addSortEntry();
      this.addAttachLocationEntry();

      // Settings checkbox entries, grouped into submenus to save vertical space:
      const automationNames = ['Auto Update Thread Watcher', 'Auto Watch', 'Auto Watch Reply', 'Auto Prune'];
      const displayNames = ['Show Page', 'Show Unread Count', 'Show Mark All Read Icon', 'Show Mark Thread Read Icons', 'Show Undo Button', 'Show Site Prefix'];
      // Names that live in a submenu or have their own dedicated control, so they
      // shouldn't also appear as a standalone top-level checkbox.
      const grouped = new Set([...automationNames, ...displayNames, 'Show OP Thumbnails', 'Thread Watcher Thumbnail Hover']);
      const makeCheckboxes = (names: string[]) => names
        .filter(name => Config.threadWatcher[name as keyof typeof Config.threadWatcher])
        .map(name => this.makeCheckbox(name, Config.threadWatcher[name as keyof typeof Config.threadWatcher][1] as string));

      // No href on these submenu parents: the checkboxes live inside the
      // submenu (a child of this anchor), so a click on a checkbox bubbles up
      // here and an `href="javascript:;"` would fire the anchor's navigation,
      // swallowing the toggle (same bug fixed for the Thumbnails entry).
      this.menu.addEntry({
        el: $.el('a', {textContent: 'Auto'}),
        subEntries: makeCheckboxes(automationNames)
      });
      this.menu.addEntry({
        el: $.el('a', {textContent: 'Display'}),
        subEntries: makeCheckboxes(displayNames)
      });

      // Remaining standalone checkboxes (e.g. Current Board, Require OP Quote Link):
      for (var name in Config.threadWatcher) {
        if (grouped.has(name)) { continue; }
        this.menu.addEntry(this.makeCheckbox(name, Config.threadWatcher[name as keyof typeof Config.threadWatcher][1] as string));
      }

      this.addThumbnailControls();

    },

    makeCheckbox(name: string, desc: string) {
      const labels: Record<string, string> = {
        'Show Mark All Read Icon': 'Mark All Read Icon',
        'Show Mark Thread Read Icons': 'Mark Thread Read Icons'
      };
      const label = labels[name] || name;
      const entry = {
        type: 'thread watcher',
        el: UI.checkbox(name, label.replace(' Thread Watcher', ''))
      };
      entry.el.title = desc;
      const input = entry.el.firstElementChild as any;
      if ((name === 'Show Unread Count') && !ThreadWatcher.unreadEnabled) {
        input.disabled = true;
        $.addClass(entry.el, 'disabled');
        entry.el.title += '\n[Remember Last Read Post is disabled.]';
      }
      // Keep the menu open while toggling so several settings can be changed at once.
      $.on(entry.el, 'mousedown', e => e.stopPropagation());
      $.on(entry.el, 'click', e => e.stopPropagation());
      $.on(input, 'change', $.cb.checked);
      if (['Current Board', 'Show Page', 'Show Unread Count', 'Show Mark All Read Icon', 'Show Site Prefix', 'Show Mark Thread Read Icons'].includes(name))
        $.on(input, 'change', () => ThreadWatcher.refresh());
      if (['Show Page', 'Show Unread Count', 'Auto Update Thread Watcher'].includes(name))
        $.on(input, 'change', ThreadWatcher.fetchAuto);
      return entry;
    },

    addSortEntry(this: TWMenu) {
      const sortOptions = [
        ['manual',      'Manual (drag)'],
        ['yous',        '(You)s'],
        ['date-added',  'Date added'],
        ['thread-date', 'Thread date'],
        ['replies',     'Reply count'],
        ['unread',      'Unread count'],
        ['activity',    'Last activity'],
        ['board',       'Board'],
      ];

      // Primary and secondary submenus share this list so a change in either
      // refreshes the checkmarks in both.
      const allOptions: any[] = [];
      // Resync both checkmarks and row visibility after any selection, so
      // changing the primary live-updates which rows the secondary list offers
      // (e.g. the new primary's own option drops out of "Then by").
      const refreshChecks = () => { for (const o of allOptions) { o.updateVisible(); o.updateCheck(); } };

      // Build one selectable option row. `isActive` decides the checkmark,
      // `onSelect` runs on click, and an optional `visibleFor` omits the row
      // from the menu when it returns false (the menu rebuilds on each open, so
      // omitted rows reappear once they're relevant again).
      const makeOption = (
        value: string,
        label: string,
        isActive: () => boolean,
        onSelect: () => void,
        visibleFor?: () => boolean
      ) => {
        const el = $.el('a', {
          href: 'javascript:;',
          innerHTML: '<span class="watcher-sort-check"></span><span class="watcher-sort-label"></span>'
        });
        const check = $('.watcher-sort-check', el);
        $('.watcher-sort-label', el).textContent = label;
        const updateCheck = () => { check.textContent = isActive() ? '✓' : ''; };
        // Hide via display (rather than omitting the row) so visibility can be
        // re-toggled live when the primary changes without closing the menu.
        const updateVisible = () => { el.style.display = (visibleFor && !visibleFor()) ? 'none' : ''; };
        $.on(el, 'mousedown', e => e.stopPropagation());
        $.on(el, 'click', function(e) {
          e.stopPropagation();
          onSelect();
          refreshChecks();
        });
        const entry: any = {
          el,
          updateCheck,
          updateVisible,
          open() {
            updateVisible();
            updateCheck();
            return true;
          }
        };
        allOptions.push(entry);
        return entry;
      };

      // Whether the current primary is one whose values cluster into ties, in
      // which case the "Then by" secondary submenu is selectable.
      const secondaryShown = () =>
        ThreadWatcher.secondarySortablePrimaries.includes(ThreadWatcher.sortMode());

      // Greys out / re-enables the "Then by" submenu live when the primary
      // changes (assigned once its element exists). pointer-events is disabled
      // via CSS while greyed so the submenu can't be opened.
      let updateThenBy = () => {};

      // Primary sort: every mode is selectable.
      const primaryEntries = sortOptions.map(([value, label], i) => {
        const entry = makeOption(value, label, () => ThreadWatcher.sortMode() === value, () => {
          $.set('Thread Watcher Sort', value);
          Conf['Thread Watcher Sort'] = value;
          ThreadWatcher.refresh();
          updateThenBy();
        });
        entry.order = i + 1;
        return entry;
      });

      // Secondary (tiebreak) sort: a None option plus every mode except Manual
      // and whichever mode is the current primary.
      const setSecondary = (value: string) => () => {
        $.set('Thread Watcher Sort 2', value);
        Conf['Thread Watcher Sort 2'] = value;
        ThreadWatcher.refresh();
      };
      const secondaryEntries = [
        makeOption('none', 'None', () => !ThreadWatcher.sortMode2(), setSecondary('')),
        ...sortOptions
          .filter(([value]) => value !== 'manual')
          .map(([value, label]) => makeOption(
            value, label,
            () => ThreadWatcher.sortMode2() === value,
            setSecondary(value),
            () => value !== ThreadWatcher.sortMode()
          ))
      ].map((entry, i) => { entry.order = i + 1; return entry; });

      // "Then by" nested submenu: always present, greyed out (and un-openable)
      // unless the primary produces ties.
      const thenByEl = $.el('a', { href: 'javascript:;', textContent: 'Then by' });
      updateThenBy = () => thenByEl.classList.toggle('disabled', !secondaryShown());
      const thenByEntry = {
        el: thenByEl,
        order: 50,
        subEntries: secondaryEntries,
        open() {
          updateThenBy();
          return true;
        }
      };
      $.addClass(thenByEl, 'watcher-sort-then-by');

      this.menu.addEntry({
        el: $.el('a', { href: 'javascript:;', textContent: 'Sort' }),
        order: 50,
        subEntries: [...primaryEntries, thenByEntry],
        open(this: { el: HTMLElement }) {
          this.el.dataset.nextKey = 'Thread Watcher Sort';
          this.el.classList.toggle('disabled', !ThreadWatcher.list.firstElementChild);
          return true;
        }
      });
    },

    addAttachLocationEntry(this: TWMenu) {
      const locationOptions = [
        ['bottom', 'Bottom'],
        ['top',    'Top'],
        ['left',   'Left'],
        ['right',  'Right'],
      ];
      const subEntries: any[] = [];
      // Exposed so the cross-tab sync handler can refresh the checkmarks live.
      this.updateAttachLocationChecks = () => {
        for (const entry of subEntries) { entry.updateCheck(); }
      };
      const enabledLabel = $.el('label', {
        className: 'watcher-attach-enabled-option',
        title: 'Show the attach button and allow attaching the watcher to the Quick Reply.',
        innerHTML: '<input type="checkbox" name="Thread Watcher Attach Controls"> Enable',
      });
      const enabledBox = $('input', enabledLabel) as HTMLInputElement;
      $.on(enabledLabel, 'mousedown', e => e.stopPropagation());
      $.on(enabledLabel, 'click', (e: Event) => e.stopPropagation());
      $.on(enabledBox, 'change', () => {
        const next = enabledBox.checked;
        $.set('Thread Watcher Attach Controls', next);
        ThreadWatcher.applyAttachControlsSetting(next);
        for (const entry of subEntries) { entry.updateCheck(); }
      });
      subEntries.push({
        el: enabledLabel,
        updateCheck() {
          enabledBox.checked = ThreadWatcher.attachControlsEnabled();
        },
        open() {
          this.updateCheck();
          return true;
        }
      });
      locationOptions.forEach(([value, label]) => {
        const el = $.el('a', {
          href: 'javascript:;',
          className: 'watcher-attach-location-option',
          innerHTML: '<span class="watcher-sort-check"></span><span class="watcher-sort-label"></span>'
        });
        const check = $('.watcher-sort-check', el);
        const labelEl = $('.watcher-sort-label', el);
        labelEl.textContent = label;
        const updateCheck = () => {
          check.textContent = ThreadWatcher.attachLocation() === value ? '✓' : '';
          el.classList.toggle('disabled', !ThreadWatcher.attachControlsEnabled());
        };
        $.on(el, 'mousedown', e => e.stopPropagation());
        $.on(el, 'click', function(e) {
          e.stopPropagation();
          if (!ThreadWatcher.attachControlsEnabled()) { return; }
          $.set('Thread Watcher Attach Location', value);
          Conf['Thread Watcher Attach Location'] = value;
          if (ThreadWatcher.attached()) {
            // Force re-compute size targets (sides no longer match height).
            ThreadWatcher._lastAttachedW = null;
            ThreadWatcher._doPositionAttached();
          }
          for (const entry of subEntries) { entry.updateCheck(); }
        });
        subEntries.push({
          el,
          updateCheck,
          open() {
            updateCheck();
            return true;
          }
        });
      });
      this.menu.addEntry({
        el: $.el('a', {
          textContent: 'Attach Location'
        }),
        order: 51,
        subEntries,
        open(this: { el: HTMLElement }) {
          this.el.dataset.nextKey = 'Thread Watcher Attach Location';
          this.el.title = 'Where to attach the watcher relative to the Quick Reply when attached.\nBottom/top: width follows the QR. Left/right: width uses the manual Max W; height sizes to content.';
          return true;
        }
      });
    },

    addThumbnailControls(this: TWMenu) {
      const entry = {
        type: 'thread watcher',
        el: $.el('a', {
          textContent: 'Thumbnails',
          className: 'watcher-thumbnail-controls'
        }),
        open(this: { el: HTMLElement }) {
          this.el.dataset.nextKey = 'Thread Watcher Thumbnail Size';
          this.el.innerHTML = `<span class="watcher-thumb-row"><label class="watcher-thumb-toggle"><input type="checkbox"${Conf['Show OP Thumbnails'] ? ' checked' : ''}>Thumbnails</label><span class="watcher-thumb-slider"><input type="range" value="${ThreadWatcher.thumbnailSize()}" min="16" max="160" step="1"><input type="number" value="${ThreadWatcher.thumbnailSize()}" min="16" max="160" step="1" class="watcher-thumb-number" aria-label="Thumbnail size"><span class="watcher-thumb-unit">px</span></span></span><span class="watcher-thumb-row"><label class="watcher-thumb-toggle"><input type="checkbox"${Conf['Thread Watcher Thumbnail Hover'] ? ' checked' : ''}>Hover Scale</label><span class="watcher-thumb-slider"><input type="range" value="${ThreadWatcher.thumbnailPreviewSize()}" min="10" max="20" step="1"><input type="number" value="${ThreadWatcher.thumbnailPreviewScale()}" min="1" max="2" step="0.1" class="watcher-thumb-number" aria-label="Hover preview scale"><span class="watcher-thumb-unit">x</span></span></span>`;
          const [thumbToggle, previewToggle] = $$('input[type="checkbox"]', this.el);
          const [sizeInput, previewSizeInput] = $$('input[type="range"]', this.el) as HTMLInputElement[];
          const [sizeNumber, previewScaleNumber] = $$('input[type="number"]', this.el) as HTMLInputElement[];
          for (const input of [thumbToggle, previewToggle, sizeInput, previewSizeInput, sizeNumber, previewScaleNumber]) {
            $.on(input, 'click', e => e.stopPropagation());
            $.on(input, 'mousedown', e => e.stopPropagation());
            $.on(input, 'pointerdown', e => e.stopPropagation());
          }
          $.on(thumbToggle, 'change', function(this: HTMLInputElement) {
            $.set('Show OP Thumbnails', this.checked);
            Conf['Show OP Thumbnails'] = this.checked;
            if (!this.checked) {
              ThreadWatcher.hideThumbnailHover();
            }
            if (this.checked) {
              ThreadWatcher.fetchAllStatus();
            }
            ThreadWatcher.refresh();
          });
          $.on(previewToggle, 'change', function(this: HTMLInputElement) {
            $.set('Thread Watcher Thumbnail Hover', this.checked);
            Conf['Thread Watcher Thumbnail Hover'] = this.checked;
            if (!this.checked) {
              ThreadWatcher.hideThumbnailHover();
            }
            ThreadWatcher.refresh();
          });
          const updateThumbnailSize = function(value: string) {
            let size = parseInt(value, 10);
            if (isNaN(size)) { size = 40; }
            size = Math.max(16, Math.min(160, size));
            sizeInput.value = `${size}`;
            sizeNumber.value = `${size}`;
            $.set('Thread Watcher Thumbnail Size', size);
            Conf['Thread Watcher Thumbnail Size'] = size;
            ThreadWatcher.applyLayout();
            ThreadWatcher.refresh();
          };
          $.on(sizeInput, 'input', function(this: HTMLInputElement) { updateThumbnailSize(this.value); });
          $.on(sizeNumber, 'change', function(this: HTMLInputElement) { updateThumbnailSize(this.value); });
          const updatePreviewSize = function(value: string, isScale = false) {
            let size = isScale ? Math.round(parseFloat(value) * 10) : parseInt(value, 10);
            if (isNaN(size)) { size = 20; }
            size = Math.max(10, Math.min(20, size));
            previewSizeInput.value = `${size}`;
            previewScaleNumber.value = (size / 10).toFixed(1);
            $.set('Thread Watcher Thumbnail Preview Size', size);
            Conf['Thread Watcher Thumbnail Preview Size'] = size;
            ThreadWatcher.positionThumbnailHover(ThreadWatcher.hoveredThumbnail);
          };
          $.on(previewSizeInput, 'input', function(this: HTMLInputElement) { updatePreviewSize(this.value); });
          $.on(previewScaleNumber, 'change', function(this: HTMLInputElement) { updatePreviewSize(this.value, true); });
          return true;
        }
      };
      entry.open = entry.open.bind(entry);
      return this.menu.addEntry(entry);
    }
  }
};
export default ThreadWatcher;
