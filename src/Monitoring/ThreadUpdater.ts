import Beep from './ThreadUpdater/beep.wav';
import $ from "../platform/$";
import Callbacks from '../classes/Callbacks';
import Notice from '../classes/Notice';
import Post from '../classes/Post';
import Main from '../main/Main';
import Config from '../config/Config';
import Settings from '../General/Settings';
import QuoteThreading from '../Quotelinks/QuoteThreading';
import Unread from './Unread';
import Header from '../General/Header';
import { g, Conf, d, doc } from '../globals/globals';
import UI from '../General/UI';
import { MINUTE, SECOND } from '../platform/helpers';
import type Thread from '../classes/Thread';
import SoundManager from './SoundManager';
import QuoteYou from '../Quotelinks/QuoteYou';
import Get from '../General/Get';

var ThreadUpdater: any = { // loose: self-referencing singleton (TS7022) with late-assigned/cross-module-read props
  init(this: typeof ThreadUpdater) {
    let sc: HTMLElement;

    // Chromium won't play audio created in an inactive tab until the tab has been focused, so set it up now.
    // XXX Sometimes the loading stalls in Firefox, esp. when opening in private browsing window followed by normal window.
    // Don't let it keep the loading icon on indefinitely.
    SoundManager.init();
    ThreadUpdater.initBeepChannel();
    this.audio = $.el('audio');
    this.audio.preload = 'auto';
    // Preload on all engines so background-tab playback works after the tab was once active.
    this.audio.src = this.beep;
    $.on(this.audio, 'error', () => {
      new Notice('error', this.audio.error.message || 'Error when trying to play thread updater beep.', 15);
    });

    // Return after the audio player is initiated, so it works in the settings preview.
    if ((g.VIEW !== 'thread') || !Conf['Thread Updater']) return;
    this.enabled = true;

    if (Conf['Updater and Stats in Header']) {
      this.dialog = (sc = $.el('span',
        {id:        'updater'}));
      $.extend(sc, {innerHTML: '<span id="update-status" class="empty"></span><span id="update-timer" class="empty" title="Update now"></span>'});
      Header.addShortcut('updater', sc, 100);
    } else {
      this.dialog = (sc = UI.dialog('updater',
        {innerHTML: '<div class="move"></div><span id="update-status" class="empty"></span><span id="update-timer" class="empty" title="Update now"></span>'}));
      $.addClass(doc, 'float');
      $.ready(() => $.add(d.body, sc));
    }

    this.checkPostCount = 0;

    this.timer  = $('#update-timer', sc);
    this.status = $('#update-status', sc);

    $.on(this.timer,  'click', this.update);
    $.on(this.status, 'click', this.update);

    const updateLink = $.el('span',
      {className: 'brackets-wrap updatelink'});
    $.extend(updateLink, {innerHTML: '<a href="javascript:;">Update</a>'});
    Main.ready(function() {
      let navLinksBot;
      if (navLinksBot = $('.navLinksBot')) { return $.add(navLinksBot, [$.tn(' '), updateLink]); }
    });
    $.on(updateLink.firstElementChild, 'click', this.update);

    const subEntries: any[] = [];
    for (const name in Config.updater.checkbox) {
      var conf = Config.updater.checkbox[name as keyof typeof Config.updater.checkbox];
      const el = UI.checkbox(name, name);
      el.title = conf[1] as string;
      var input = el.firstElementChild as any;
      $.on(input, 'change', $.cb.checked);
      if (input.name === 'Scroll BG') {
        $.on(input, 'change', this.cb.scrollBG);
        this.cb.scrollBG();
      } else if (input.name === 'Auto Update') {
        $.on(input, 'change', this.setInterval);
      }
      subEntries.push({el});
    }

    this.settings = $.el('span',
      {innerHTML: '<a href="javascript:;">Interval</a>'});

    $.on(this.settings, 'click', this.intervalShortcut);

    subEntries.push({el: this.settings});

    Header.menu.addEntry(this.entry = {
      el: $.el('span',
        {textContent: 'Updater'}),
      order: 110,
      subEntries
    }
    );

    return Callbacks.Thread.push({
      name: 'Thread Updater',
      cb:   this.node
    });
  },

  node(this: any) {
    ThreadUpdater.thread       = this;
    ThreadUpdater.root         = this.nodes.root;
    ThreadUpdater.outdateCount = 0;

    // We must keep track of our own list of live posts/files
    // to provide an accurate deletedPosts/deletedFiles on update
    // as posts may be `kill`ed elsewhere.
    ThreadUpdater.postIDs = [];
    ThreadUpdater.fileIDs = [];
    this.posts.forEach(function(post: Post) {
      ThreadUpdater.postIDs.push(post.ID);
      if (post.file) { return ThreadUpdater.fileIDs.push(post.ID); }
    });

    ThreadUpdater.cb.interval.call($.el('input', {value: Conf['Interval']}));

    $.on(d,      'QRPostSuccessful', ThreadUpdater.cb.checkpost);
    $.on(d,      'visibilitychange', ThreadUpdater.cb.visibility);

    return ThreadUpdater.setInterval();
  },

  /*
  http://freesound.org/people/pierrecartoons1979/sounds/90112/
  cc-by-nc-3.0
  */
  beep: `data:audio/wav;base64,${Beep}`,

  playBeep(repeatIfPlaying = true) {
    const lib = SoundManager.getEntry(SoundManager.getDefaultSoundId());
    ThreadUpdater.requestPlaySound(lib?.data || ThreadUpdater.beep, repeatIfPlaying);
  },

  initBeepChannel() {
    if (ThreadUpdater.beepChannel || !window.BroadcastChannel) return;
    ThreadUpdater.beepChannel = new BroadcastChannel(`${g.NAMESPACE} updater-beep`);
    $.on(ThreadUpdater.beepChannel, 'message', ThreadUpdater.onBeepMessage);
    $.on(d, 'PlayUpdaterSound', ThreadUpdater.onPlayUpdaterSound);
  },

  onBeepMessage(e: MessageEvent) {
    const source = e.data?.source;
    if (!source || d.hidden || !d.hasFocus()) return;
    ThreadUpdater.playSound(source, false);
  },

  onPlayUpdaterSound(e: CustomEvent) {
    const { post, predicate } = e.detail || {};
    if (!post?.board || !post?.thread) return;
    const context = { boardID: post.board.ID, threadID: post.thread.ID };
    const isQuotingYou = predicate === ' replied to you';
    if (isQuotingYou && Conf['Beep Quoting You']) {
      let quotedYou: { boardID: string; threadID: string | number; postID: string | number } | undefined;
      for (const ql of post.nodes?.quotelinks || []) {
        const data = Get.postDataFromLink(ql);
        if (QuoteYou.db?.get(data)) {
          quotedYou = { boardID: data.boardID, threadID: data.threadID, postID: data.postID };
          break;
        }
      }
      ThreadUpdater.requestPlaySound(SoundManager.resolveSource({ quotedYouPost: quotedYou, context }));
    } else if (!isQuotingYou && Conf['Beep']) {
      ThreadUpdater.requestPlaySound(SoundManager.resolveSource({ context }));
    }
  },

  /**
   * Play updater sound in this tab, or relay to a focused tab when backgrounded.
   * Browsers block autoplay in inactive tabs; desktop notifications do not.
   */
  requestPlaySound(source: string, repeatIfPlaying = true) {
    if (!source) return;
    const now = Date.now();
    if (ThreadUpdater.lastBeepSource === source && (now - (ThreadUpdater.lastBeepAt || 0)) < 300) return;
    ThreadUpdater.lastBeepSource = source;
    ThreadUpdater.lastBeepAt = now;

    const away = d.hidden || !d.hasFocus();
    if (!away) {
      ThreadUpdater.playSound(source, repeatIfPlaying);
      return;
    }
    ThreadUpdater.broadcastBeep(source);
    ThreadUpdater.playSound(source, repeatIfPlaying);
  },

  broadcastBeep(source: string) {
    ThreadUpdater.beepChannel?.postMessage({ source });
  },

  playSound(source: string, repeatIfPlaying = true) {
    const { audio } = ThreadUpdater as { audio: HTMLAudioElement };
    if (!source) source = ThreadUpdater.beep;
    if (audio.src !== source) {
      audio.src = source;
      audio.load();
    }
    const configuredVolume = Number(Conf.beepVolume);
    audio.volume = Number.isFinite(configuredVolume) ?
      Math.max(.01, Math.min(configuredVolume, 1))
    :
      1;
    audio.currentTime = 0;
    if (audio.paused) {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err: any) => {
          if (err?.name === 'NotAllowedError') {
            ThreadUpdater.broadcastBeep(source);
            ThreadUpdater.armAudioUnlock(source);
          }
        });
      }
    } else if (repeatIfPlaying) {
      $.one(audio, 'ended', () => ThreadUpdater.playSound(source, false));
    }
  },

  armAudioUnlock(source: string) {
    ThreadUpdater.pendingAudioSource = source;
    if (ThreadUpdater.audioUnlockArmed) { return; }
    ThreadUpdater.audioUnlockArmed = true;

    const unlock = () => {
      $.off(d, 'pointerdown keydown', unlock);
      ThreadUpdater.audioUnlockArmed = false;
      const pendingSource = ThreadUpdater.pendingAudioSource || source;
      delete ThreadUpdater.pendingAudioSource;
      ThreadUpdater.playSound(pendingSource, false);
    };

    $.on(d, 'pointerdown keydown', unlock);

    const now = Date.now();
    if (!ThreadUpdater.lastAudioBlockNoticeAt || (now - ThreadUpdater.lastAudioBlockNoticeAt > 10000)) {
      ThreadUpdater.lastAudioBlockNoticeAt = now;
      new Notice('warning', 'Sound was blocked by browser autoplay in this tab. Click or press a key in this tab to enable it.', 8);
    }
  },

  /** Find the first new post that quotes a You-post; returns {boardID, threadID, postID} of the quoted You-post. */
  findFirstQuotedYouPost(posts: Post[]): { boardID: string; threadID: string | number; postID: string | number } | null {
    if (!QuoteYou.db) return null;
    for (const post of posts) {
      if (!post.nodes?.quotelinks) continue;
      for (const ql of post.nodes.quotelinks) {
        const data = Get.postDataFromLink(ql);
        if (QuoteYou.db.get(data)) {
          return { boardID: data.boardID, threadID: data.threadID, postID: data.postID };
        }
      }
    }
    return null;
  },

  postsQuoteYou(posts: Post[]) {
    if (!QuoteYou.db) return false;
    for (const post of posts) {
      if (!post.nodes?.quotelinks) continue;
      for (const ql of post.nodes.quotelinks) {
        if (QuoteYou.db.get(Get.postDataFromLink(ql))) return true;
      }
    }
    return false;
  },

  cb: {
    checkpost(e: CustomEvent) {
      if (e.detail.threadID !== ThreadUpdater.thread.ID) { return; }
      ThreadUpdater.postID = e.detail.postID;
      ThreadUpdater.checkPostCount = 0;
      ThreadUpdater.outdateCount = 0;
      return ThreadUpdater.setInterval();
    },

    visibility() {
      if (d.hidden) { return; }
      // Reset the counter when we focus this tab.
      ThreadUpdater.outdateCount = 0;
      if (ThreadUpdater.pendingAudioSource) {
        const pendingSource = ThreadUpdater.pendingAudioSource;
        delete ThreadUpdater.pendingAudioSource;
        ThreadUpdater.audioUnlockArmed = false;
        ThreadUpdater.playSound(pendingSource, false);
      }
      if (ThreadUpdater.seconds > ThreadUpdater.interval) {
        return ThreadUpdater.setInterval();
      }
    },

    scrollBG() {
      return ThreadUpdater.scrollBG = Conf['Scroll BG'] ?
        () => true
      :
        () => !d.hidden;
    },

    interval(this: HTMLInputElement, e?: Event) {
      let val = parseInt(this.value, 10);
      if (val < 1) { val = 1; }
      ThreadUpdater.interval = ((this as any).value = val);
      if (e) { return $.cb.value.call(this); }
    },

    load(this: XMLHttpRequest) {
      if (this !== ThreadUpdater.req) { return; } // aborted
      switch (this.status) {
        case 200:
          ThreadUpdater.parse(this);
          if (ThreadUpdater.thread.isArchived) {
            return ThreadUpdater.kill();
          } else {
            return ThreadUpdater.setInterval();
          }
        case 404:
          // XXX workaround for 4chan sending false 404s
          return $.ajax(g.SITE!.urls.catalogJSON({boardID: ThreadUpdater.thread.board.ID}), { onloadend() {
            let confirmed;
            if (this.status === 200) {
              confirmed = true;
              for (var page of this.response) {
                for (var thread of page.threads) {
                  if (thread.no === ThreadUpdater.thread.ID) {
                    confirmed = false;
                    break;
                  }
                }
              }
            } else {
              confirmed = false;
            }
            if (confirmed) {
              ThreadUpdater.kill();
            } else {
              ThreadUpdater.error(this);
            }
          }
          });
        default:
          return ThreadUpdater.error(this);
      }
    }
  },

  kill() {
    ThreadUpdater.thread.kill();
    ThreadUpdater.setInterval();
    return $.event('ThreadUpdate', {
      404: true,
      threadID: ThreadUpdater.thread.fullID
    }
    );
  },

  error(req: XMLHttpRequest) {
    if (req.status === 304) {
      ThreadUpdater.set('status', '');
    }
    ThreadUpdater.setInterval();
    if (!req.status) {
      return ThreadUpdater.set('status', 'Connection Error', 'warning');
    } else if (req.status !== 304) {
      return ThreadUpdater.set('status', `${req.statusText} (${req.status})`, 'warning');
    }
  },

  setInterval() {
    clearTimeout(ThreadUpdater.timeoutID);

    if (ThreadUpdater.thread.isDead) {
      ThreadUpdater.set('status', (ThreadUpdater.thread.isArchived ? 'Archived' : '404'), 'warning');
      ThreadUpdater.set('timer', '');
      return;
    }

    // Fetching your own posts after posting
    if (ThreadUpdater.postID && (ThreadUpdater.checkPostCount < 5)) {
      ThreadUpdater.set('timer', '...', 'loading');
      ThreadUpdater.timeoutID = setTimeout(ThreadUpdater.update, ++ThreadUpdater.checkPostCount * SECOND);
      return;
    }

    if (!Conf['Auto Update']) {
      ThreadUpdater.set('timer', 'Update');
      return;
    }

    const {interval} = ThreadUpdater;
    if (Conf['Optional Increase']) {
      // Lower the max refresh rate limit on visible tabs.
      const limit = d.hidden ? 10 : 5;
      const j     = Math.min(ThreadUpdater.outdateCount, limit);

      // 1 second to 100, 30 to 300.
      const cur = (Math.floor(interval * 0.1) || 1) * j * j;
      ThreadUpdater.seconds = $.minmax(cur, interval, 300);
    } else {
      ThreadUpdater.seconds = interval;
    }

    return ThreadUpdater.timeout();
  },

  intervalShortcut() {
    const focusInterval = (section?: HTMLElement) => {
      if (!section?.classList?.contains('section-threads-posts')) return;
      const fs = $.id('xt-updater-settings');
      if (fs instanceof HTMLDetailsElement) fs.open = true;
      const input = $('input[name=Interval]', section) as HTMLInputElement | null;
      input?.focus();
    };
    if (Settings.dialog) {
      const threadsSection = Settings.sections.find((s: any) => s.title === 'Threads & Posts');
      if (threadsSection) Settings.openSection.call(threadsSection);
      focusInterval($('section', Settings.dialog) as HTMLElement);
      return;
    }
    Settings.open('Threads & Posts');
    const onOpen = (e: CustomEvent) => {
      $.off(d, 'OpenSettings', onOpen);
      focusInterval(e.detail as HTMLElement);
    };
    $.on(d, 'OpenSettings', onOpen);
  },

  set(name: string, text: string | number, klass?: string) {
    let node;
    const el = ThreadUpdater[name];
    if ((node = el.firstChild)) {
      // Prevent the creation of a new DOM Node
      // by setting the text node's data.
      node.data = text;
    } else {
      el.textContent = text;
    }
    return el.className = klass ?? (text === '' ? 'empty' : '');
  },

  timeout() {
    if (ThreadUpdater.seconds) {
      ThreadUpdater.set('timer', ThreadUpdater.seconds);
      ThreadUpdater.timeoutID = setTimeout(ThreadUpdater.timeout, 1000);
    } else {
      ThreadUpdater.outdateCount++;
      ThreadUpdater.update();
    }
    return ThreadUpdater.seconds--;
  },

  update() {
    let oldReq;
    clearTimeout(ThreadUpdater.timeoutID);
    ThreadUpdater.set('timer', '...', 'loading');
    if (oldReq = ThreadUpdater.req) {
      delete ThreadUpdater.req;
      oldReq.abort();
    }
    return ThreadUpdater.req = $.whenModified(
      g.SITE!.urls.threadJSON({boardID: ThreadUpdater.thread.board.ID, threadID: ThreadUpdater.thread.ID}),
      'ThreadUpdater',
      ThreadUpdater.cb.load,
      { timeout: MINUTE }
    );
  },

  updateThreadStatus(type: string, status: boolean) {
    let hasChanged;
    if (!(hasChanged = ThreadUpdater.thread[`is${type}`] !== status)) { return; }
    ThreadUpdater.thread.setStatus(type, status);
    if ((type === 'Closed') && ThreadUpdater.thread.isArchived) { return; }
    const change = type === 'Sticky' ?
      status ?
        'now a sticky'
      :
        'not a sticky anymore'
    :
      status ?
        'now closed'
      :
        'not closed anymore';
    return new Notice('info', `The thread is ${change}.`, 30);
  },

  parse(req: XMLHttpRequest) {
    let ID, ipCountEl, post;
    const postObjects = req.response.posts;
    const OP = postObjects[0];
    const thread: Thread = ThreadUpdater.thread;
    const {board} = thread;
    const lastPost = ThreadUpdater.postIDs[ThreadUpdater.postIDs.length - 1];

    // XXX Reject updates that falsely delete the last post.
    if ((postObjects[postObjects.length-1].no < lastPost) &&
      (((+new Date(req.getResponseHeader('Last-Modified') || '')) - (thread.posts.get(lastPost).info.date as any)) < (30 * SECOND))) { return; }

    g.SITE!.Build.spoilerRange[board as any] = OP.custom_spoiler;
    thread.setStatus('Archived', !!OP.archived);
    ThreadUpdater.updateThreadStatus('Sticky', !!OP.sticky);
    ThreadUpdater.updateThreadStatus('Closed', !!OP.closed);
    thread.postLimit = !!OP.bumplimit;
    thread.fileLimit = !!OP.imagelimit;
    if (OP.unique_ips) thread.ipCount = OP.unique_ips;

    const posts: Post[] = []; // new post objects
    const index: number[] = []; // existing posts
    const files: number[] = []; // existing files
    const newPosts: string[] = []; // new post fullID list for API

    // Build the index, create posts.
    for (var postObject of postObjects) {
      ID = postObject.no;
      index.push(ID);
      if (postObject.fsize) { files.push(ID); }

      // Insert new posts, not older ones.
      if (ID <= lastPost) { continue; }

      // XXX Resurrect wrongly deleted posts.
      if ((post = thread.posts.get(ID)) && !post.isFetchedQuote) {
        post.resurrect();
        continue;
      }

      newPosts.push(`${board}.${ID}`);
      var node = g.SITE!.Build.postFromObject(postObject, board.ID);
      posts.push(new Post(node, thread, board));
      // Fetching your own posts after posting
      if (ThreadUpdater.postID === ID) { delete ThreadUpdater.postID; }
    }

    // Check for deleted posts.
    const deletedPosts: string[] = [];
    for (ID of ThreadUpdater.postIDs) {
      if (!index.includes(ID)) {
        thread.posts.get(ID).kill();
        deletedPosts.push(`${board}.${ID}`);
      }
    }
    ThreadUpdater.postIDs = index;

    // Check for deleted files.
    const deletedFiles: string[] = [];
    for (ID of ThreadUpdater.fileIDs) {
      if (!(files.includes(ID) || deletedPosts.includes(`${board}.${ID}`))) {
        thread.posts.get(ID).kill(true);
        deletedFiles.push(`${board}.${ID}`);
      }
    }
    ThreadUpdater.fileIDs = files;

    if (!posts.length) {
      ThreadUpdater.set('status', '');
    } else {
      ThreadUpdater.set('status', `+${posts.length}`, 'new');
      ThreadUpdater.outdateCount = 0;

      const unreadCount   = Unread.posts?.size ?? 0;
      const unreadQYCount = Unread.postsQuotingYou?.size ?? 0;

      Main.callbackNodes('Post', posts);

      if (d.hidden || !d.hasFocus()) {
        const newUnread = (Unread.posts?.size ?? 0) > unreadCount;
        const quotingYouInBatch = ThreadUpdater.postsQuoteYou(posts);
        const context = { boardID: thread.board.ID as string, threadID: thread.ID as string | number };
        // QY sounds also fire from PlayUpdaterSound (same path as desktop notifications).
        if (Conf['Beep Quoting You'] && quotingYouInBatch && !Conf['Desktop Notifications']) {
          const quotedYou = ThreadUpdater.findFirstQuotedYouPost(posts);
          ThreadUpdater.requestPlaySound(SoundManager.resolveSource({ quotedYouPost: quotedYou ?? undefined, context }));
        } else if (Conf['Beep'] && posts.length > 0 && (newUnread || unreadCount === 0)) {
          ThreadUpdater.requestPlaySound(SoundManager.resolveSource({ context }));
        }
      }

      const scroll = Conf['Auto Scroll'] && ThreadUpdater.scrollBG() &&
        ((ThreadUpdater.root.getBoundingClientRect().bottom - doc.clientHeight) < 25);

      let firstPost = null;
      for (post of posts) {
        if (!QuoteThreading.insert(post)) {
          if (!firstPost) { firstPost = post.nodes.root; }
          $.add(ThreadUpdater.root, post.nodes.root);
        }
      }
      $.event('PostsInserted', null, ThreadUpdater.root);

      if (scroll) {
        if (Conf['Bottom Scroll']) {
          window.scrollTo(0, d.body.clientHeight);
        } else {
          if (firstPost) { Header.scrollTo(firstPost); }
        }
      }
    }

    // Update IP count in original post form.
    if (OP.unique_ips && (ipCountEl = $.id('unique-ips'))) {
      ipCountEl.textContent = OP.unique_ips;
      ipCountEl.previousSibling!.textContent = ipCountEl.previousSibling!.textContent!.replace(/\b(?:is|are)\b/, OP.unique_ips === 1 ? 'is' : 'are');
      ipCountEl.nextSibling!.textContent = ipCountEl.nextSibling!.textContent!.replace(/\bposters?\b/, OP.unique_ips === 1 ? 'poster' : 'posters');
    }

    return $.event('ThreadUpdate', {
      404: false,
      threadID: thread.fullID,
      newPosts,
      deletedPosts,
      deletedFiles,
      postCount: OP.replies + 1,
      fileCount: OP.images + !!OP.fsize,
      ipCount: OP.unique_ips
    }
    );
  }
};
export default ThreadUpdater;
