import Callbacks from "../classes/Callbacks";
import Post from "../classes/Post";
import Get from "../General/Get";
import Index from "../General/Index";
import { g, Conf, d } from "../globals/globals";
import Main from "../main/Main";
import $ from "../platform/$";
import $$ from "../platform/$$";
import { dict } from "../platform/helpers";
import type Thread from "../classes/Thread";

type ExpandStatus = { req?: XMLHttpRequest; numReplies?: number };

var ExpandThread = {
  statuses: dict(),
  // Thread IDs the user has expanded inline and not collapsed. Persists across
  // index rebuilds (search/sort/refresh) so we can re-expand them afterwards,
  // keeping them open — and therefore searchable and highlightable — instead of
  // silently collapsing back to the preview on every search keystroke.
  expanded: dict(),
  init() {
    if (!((g.VIEW === 'index') && Conf['Thread Expansion'])) { return; }
    if (Conf['JSON Index']) {
      $.on(d, 'IndexRefreshInternal', this.onIndexRefresh);
    } else {
      Callbacks.Thread.push({
        name: 'Expand Thread',
        cb(this: Thread) { ExpandThread.setButton(this); }
      });
    }
  },

  setButton(thread: Thread) {
    if (!thread.nodes.root) return;
    const a = $('a.summary', thread.nodes.root);
    if (!a) return;
    a.textContent = (g.SITE!.Build.summaryText as any)('+', ...a.textContent.match(/\d+/g));
    a.style.cursor = 'pointer';
    $.on(a, 'click', ExpandThread.cbToggle);
  },

  disconnect(refresh?: boolean) {
    if ((g.VIEW === 'thread') || !Conf['Thread Expansion']) { return; }
    for (var threadID in ExpandThread.statuses) {
      var oldReq;
      var status = ExpandThread.statuses[threadID];
      if (oldReq = status.req) {
        delete status.req;
        oldReq.abort();
      }
      delete ExpandThread.statuses[threadID];
    }

    if (!refresh) {
      ExpandThread.expanded = dict();
      $.off(d, 'IndexRefreshInternal', this.onIndexRefresh);
    }
  },

  onIndexRefresh(e: CustomEvent<{ threadIDs?: Array<string | number> }>) {
    ExpandThread.disconnect(true);
    g.BOARD!.threads.forEach(thread => ExpandThread.setButton(thread));

    // Re-expand threads the user had open so they survive this rebuild (a search
    // or sort just replaced the index DOM). Only the threads actually rendered
    // this pass are worth re-expanding; the fetch is cached so it's cheap, and
    // its parse re-populates the search corpus and repaints the highlight.
    const threadIDs = e?.detail?.threadIDs;
    if (!threadIDs) { return; }
    for (var fullID of threadIDs) {
      var thread = g.BOARD!.threads.get(+(`${fullID}`.split('.').pop() || 0));
      if (!thread || !thread.nodes.root || !ExpandThread.expanded[thread.ID]) { continue; }
      if (thread.ID in ExpandThread.statuses) { continue; } // already (re)expanding
      var a = $('a.summary', thread.nodes.root);
      if (a) { ExpandThread.expand(thread, a); }
    }
  },

  cbToggle(this: HTMLElement, e: MouseEvent) {
    if ($.modifiedClick(e)) { return; }
    e.preventDefault();
    ExpandThread.toggle(Get.threadFromNode(this));
  },

  cbToggleBottom(this: HTMLElement, e: MouseEvent) {
    if ($.modifiedClick(e)) { return; }
    e.preventDefault();
    const thread = Get.threadFromNode(this);
    if (!thread) { return; }
    $.rm(this); // remove before fixing bottom of thread position
    const {bottom} = thread.nodes.root.getBoundingClientRect();
    ExpandThread.toggle(thread);
    return window.scrollBy(0, (thread.nodes.root.getBoundingClientRect().bottom - bottom));
  },

  toggle(thread: Thread | null | undefined) {
    if (!thread?.nodes.root) return;
    const a = $('a.summary', thread.nodes.root);
    if (!a) return;
    if (thread.ID in ExpandThread.statuses) {
      ExpandThread.contract(thread, a, thread.nodes.root);
    } else {
      ExpandThread.expand(thread, a);
    }
  },

  expand(thread: Thread, a: any) { // loose: `a` is a `$()` result (typed `any` codebase-wide); used with textContent spread + DOM mutation
    let status: ExpandStatus;
    ExpandThread.expanded[thread.ID] = true;
    ExpandThread.statuses[thread as any] = (status = {}); // loose: keyed by Thread, coerced via toString()→ID at runtime
    a.textContent = (g.SITE!.Build.summaryText as any)('...', ...a.textContent.match(/\d+/g));
    status.req = $.cache(g.SITE!.urls.threadJSON({boardID: thread.board.ID, threadID: thread.ID}), function(this: XMLHttpRequest) {
      if (this !== status.req) { return; } // aborted
      delete status.req;
      ExpandThread.parse(this, thread, a);
    });
    status.numReplies = $$(g.SITE!.selectors.replyOriginal, thread.nodes.root).length;
  },

  contract(thread: Thread, a: any, threadRoot: any) { // loose: `a`/`threadRoot` are `$()`/node results (typed `any` codebase-wide)
    let oldReq;
    const status: ExpandStatus = ExpandThread.statuses[thread as any]; // loose: keyed by Thread, coerced via toString()→ID at runtime
    delete ExpandThread.statuses[thread as any];
    // User-initiated collapse: stop keeping it expanded, and drop its text from
    // the search corpus so it's no longer matched on now-hidden content.
    delete ExpandThread.expanded[thread.ID];
    if (Index.enabled) { Index.clearExpandedThreadText(thread.ID); }
    if (oldReq = status.req) {
      delete status.req;
      oldReq.abort();
      if (a) { a.textContent = (g.SITE!.Build.summaryText as any)('+', ...a.textContent.match(/\d+/g)); }
      return;
    }

    let replies = $$('.thread > .replyContainer', threadRoot);
    if (status.numReplies) { replies = replies.slice(0, (-status.numReplies)); }
    let postsCount = 0;
    let filesCount = 0;
    for (var reply of replies) {
      // rm clones
      if (Conf['Quote Inlining']) { var inlined;
      while ((inlined = $('.inlined', reply))) { inlined.click(); } }
      postsCount++;
      const post = Get.postFromRoot(reply);
      if (post && 'file' in post) { filesCount++; }
      $.rm(reply);
    }
    if (Index.enabled) { // otherwise handled by Main.addPosts
      $.event('PostsRemoved', null, a.parentNode);
    }
    a.textContent = g.SITE!.Build.summaryText('+', postsCount, filesCount);
    $.rm($('.summary-bottom', threadRoot));
  },

  parse(req: XMLHttpRequest, thread: Thread, a: any) { // loose: `a` is a `$()` result (typed `any` codebase-wide); used with DOM mutation/clone
    let root;
    if (![200, 304].includes(req.status)) {
      a.textContent = req.status ? `Error ${req.statusText} (${req.status})` : 'Connection Error';
      return;
    }

    g.SITE!.Build.spoilerRange[thread.board as any] = req.response.posts[0].custom_spoiler; // loose: keyed by Board, coerced via toString()→ID at runtime

    const posts: Post[] = [];
    const postsRoot: any[] = [];
    let filesCount = 0;
    for (var postData of req.response.posts) {
      var post;
      if (postData.no === thread.ID) { continue; }
      if ((post = thread.posts.get(postData.no)) && !post.isFetchedQuote) {
        if ('file' in post) { filesCount++; }
        ({root} = post.nodes);
        postsRoot.push(root);
        continue;
      }
      root = g.SITE!.Build.postFromObject(postData, thread.board.ID);
      post = new Post(root, thread, thread.board);
      if ('file' in post) { filesCount++; }
      posts.push(post);
      postsRoot.push(root);
    }
    Main.callbackNodes('Post', posts);
    $.after(a, postsRoot);
    $.event('PostsInserted', null, a.parentNode);

    if (Index.enabled) {
      // The thread's full text is now visible, so add it to the index search
      // corpus — a search will match (and keep) this thread on content past the
      // preview replies for as long as it stays expanded.
      Index.setExpandedThreadText(thread.ID, req.response.posts);

      // The newly inserted replies are fresh DOM the index's search highlighter
      // never walked, so repaint to cover them while a search is active. We paint
      // once now and again after the task queue drains: post-insert processing
      // (PostsInserted/IndexRefresh handlers, quotelink/embed rewrites) can replace
      // the comment's text nodes after the first paint, which would silently drop
      // the highlight ranges built over them. The deferred repaint re-walks the
      // settled DOM.
      if (Index.search) {
        Index.highlightSearch();
        $.queueTask(() => { if (Index.enabled && Index.search) { Index.highlightSearch(); } });
      }
    }

    const postsCount    = postsRoot.length;
    a.textContent = g.SITE!.Build.summaryText('-', postsCount, filesCount);

    if (root) {
      const a2 = a.cloneNode(true);
      a2.classList.add('summary-bottom');
      $.on(a2, 'click', ExpandThread.cbToggleBottom);
      $.after(root, a2);
    }
  }
};
export default ExpandThread;
