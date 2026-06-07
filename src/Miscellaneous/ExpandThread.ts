import Callbacks from "../classes/Callbacks";
import Post from "../classes/Post";
import Get from "../General/Get";
import Index from "../General/Index";
import { g, Conf, d } from "../globals/globals";
import Main from "../main/Main";
import $ from "../platform/$";
import $$ from "../platform/$$";
import { dict } from "../platform/helpers";

var ExpandThread = {
  statuses: dict(),
  init() {
    if (!((g.VIEW === 'index') && Conf['Thread Expansion'])) { return; }
    if (Conf['JSON Index']) {
      $.on(d, 'IndexRefreshInternal', this.onIndexRefresh);
    } else {
      Callbacks.Thread.push({
        name: 'Expand Thread',
        cb() { ExpandThread.setButton(this); }
      });
    }
  },

  setButton(thread) {
    if (!thread.nodes.root) return;
    const a = $('a.summary', thread.nodes.root);
    if (!a) return;
    a.textContent = g.SITE.Build.summaryText('+', ...a.textContent.match(/\d+/g));
    a.style.cursor = 'pointer';
    $.on(a, 'click', ExpandThread.cbToggle);
  },

  disconnect(refresh) {
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

    if (!refresh) $.off(d, 'IndexRefreshInternal', this.onIndexRefresh);
  },

  onIndexRefresh() {
    ExpandThread.disconnect(true);
    g.BOARD.threads.forEach(thread => ExpandThread.setButton(thread));
  },

  cbToggle(e) {
    if ($.modifiedClick(e)) { return; }
    e.preventDefault();
    ExpandThread.toggle(Get.threadFromNode(this));
  },

  cbToggleBottom(e) {
    if ($.modifiedClick(e)) { return; }
    e.preventDefault();
    const thread = Get.threadFromNode(this);
    $.rm(this); // remove before fixing bottom of thread position
    const {bottom} = thread.nodes.root.getBoundingClientRect();
    ExpandThread.toggle(thread);
    return window.scrollBy(0, (thread.nodes.root.getBoundingClientRect().bottom - bottom));
  },

  toggle(thread) {
    if (!thread.nodes.root) return;
    const a = $('a.summary', thread.nodes.root);
    if (!a) return;
    if (thread.ID in ExpandThread.statuses) {
      ExpandThread.contract(thread, a, thread.nodes.root);
    } else {
      ExpandThread.expand(thread, a);
    }
  },

  expand(thread, a) {
    let status;
    ExpandThread.statuses[thread] = (status = {});
    a.textContent = g.SITE.Build.summaryText('...', ...a.textContent.match(/\d+/g));
    status.req = $.cache(g.SITE.urls.threadJSON({boardID: thread.board.ID, threadID: thread.ID}), function() {
      if (this !== status.req) { return; } // aborted
      delete status.req;
      ExpandThread.parse(this, thread, a);
    });
    status.numReplies = $$(g.SITE.selectors.replyOriginal, thread.nodes.root).length;
  },

  contract(thread, a, threadRoot) {
    let oldReq;
    const status = ExpandThread.statuses[thread];
    delete ExpandThread.statuses[thread];
    if (oldReq = status.req) {
      delete status.req;
      oldReq.abort();
      if (a) { a.textContent = g.SITE.Build.summaryText('+', ...a.textContent.match(/\d+/g)); }
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
      if ('file' in Get.postFromRoot(reply)) { filesCount++; }
      $.rm(reply);
    }
    if (Index.enabled) { // otherwise handled by Main.addPosts
      $.event('PostsRemoved', null, a.parentNode);
    }
    a.textContent = g.SITE.Build.summaryText('+', postsCount, filesCount);
    $.rm($('.summary-bottom', threadRoot));
  },

  parse(req, thread, a) {
    let root;
    if (![200, 304].includes(req.status)) {
      a.textContent = req.status ? `Error ${req.statusText} (${req.status})` : 'Connection Error';
      return;
    }

    g.SITE.Build.spoilerRange[thread.board] = req.response.posts[0].custom_spoiler;

    const posts      = [];
    const postsRoot  = [];
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
      root = g.SITE.Build.postFromObject(postData, thread.board.ID);
      post = new Post(root, thread, thread.board);
      if ('file' in post) { filesCount++; }
      posts.push(post);
      postsRoot.push(root);
    }
    Main.callbackNodes('Post', posts);
    $.after(a, postsRoot);
    $.event('PostsInserted', null, a.parentNode);

    const postsCount    = postsRoot.length;
    a.textContent = g.SITE.Build.summaryText('-', postsCount, filesCount);

    if (root) {
      const a2 = a.cloneNode(true);
      a2.classList.add('summary-bottom');
      $.on(a2, 'click', ExpandThread.cbToggleBottom);
      $.after(root, a2);
    }
  }
};
export default ExpandThread;
