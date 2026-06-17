import { Conf, g } from "../globals/globals";
import $ from "../platform/$";

var Get = {
  url(type: string, IDs: any, ...args: any[]) { // loose: any — Get is widely imported; tightening IDs/args ripples across call sites
    let f, site;
    if ((site = g.sites[IDs.siteID]) && (f = $.getOwn(site.urls, type))) {
      return f(IDs, ...args);
    } else {
      return undefined;
    }
  },
  threadExcerpt(thread: any) { // loose: any — Thread shape accessed loosely (OP.info etc.); precise type ripples
    const {OP} = thread;
    const excerpt = (`/${decodeURIComponent(thread.board.ID)}/ - `) + (
      OP.info.subject?.trim() ||
      OP.commentDisplay().replace(/\n+/g, ' // ') ||
      OP.file?.name ||
      `No.${OP}`);
    if (excerpt.length > 73) { return `${excerpt.slice(0, 70)}...`; }
    return excerpt;
  },
  threadFromRoot(root: any) { // loose: any — DOM node with .dataset/.id accessed loosely
    if (root == null) { return null; }
    const {board} = root.dataset;
    return g.threads!.get(`${board ? encodeURIComponent(board) : g.BOARD!.ID}.${root.id.match(/\d*$/)[0]}`);
  },
  threadFromNode(node: any) { // loose: any — DOM node passed to $.x xpath helper
    return Get.threadFromRoot($.x(`ancestor-or-self::${g.SITE!.xpath.thread}`, node));
  },
  postFromRoot(root: any) { // loose: any — DOM node with .dataset accessed loosely
    if (root == null) { return null; }
    const post  = g.posts!.get(root.dataset.fullID);
    const index = root.dataset.clone;
    if (index) { return post.clones[+index]; } else { return post; }
  },
  postFromNode(root: any) { // loose: any — DOM node passed to $.x xpath helper
    return Get.postFromRoot($.x(`ancestor-or-self::${g.SITE!.xpath.postContainer}[1]`, root));
  },
  postDataFromLink(link: any) { // loose: any — anchor-like with .dataset/.href accessed loosely
    let boardID, postID, threadID;
    if (link.dataset.postID) { // resurrected quote
      ({boardID, threadID, postID} = link.dataset);
      if (!threadID) { threadID = 0; }
    } else {
      const match = link.href.match(g.SITE!.regexp.quotelink);
      [boardID, threadID, postID] = match.slice(1);
      if (!postID) { postID = threadID; }
    }
    return {
      boardID,
      threadID: +threadID,
      postID:   +postID
    };
  },
  allQuotelinksLinkingTo(post: any) { // loose: any — Post shape (fullID/quotes/board) accessed loosely
    // Get quotelinks & backlinks linking to the given post.
    const quotelinks: HTMLAnchorElement[] = [];
    const posts = g.posts!;
    const {fullID} = post;
    const handleQuotes = function(qPost: any, type: string) { // loose: any — qPost.nodes/clones accessed loosely
      quotelinks.push(...(qPost.nodes[type] || []));
      for (var clone of qPost.clones) { quotelinks.push(...(clone.nodes[type] || [])); }
    };
    // First:
    //   In every posts,
    //   if it did quote this post,
    //   get all their backlinks.
    posts.forEach(function(qPost) {
      if (qPost.quotes.includes(fullID)) {
        return handleQuotes(qPost, 'quotelinks');
      }
    });

    // Second:
    //   If we have quote backlinks:
    //   in all posts this post quoted
    //   and their clones,
    //   get all of their backlinks.
    if (Conf['Quote Backlinks']) {
      for (var quote of post.quotes) { var qPost;
      if ((qPost = posts.get(quote))) { handleQuotes(qPost, 'backlinks'); } }
    }

    // Third:
    //   Filter out irrelevant quotelinks.
    return quotelinks.filter(function(quotelink) {
      const {boardID, postID} = Get.postDataFromLink(quotelink);
      return (boardID === post.board.ID) && (postID === post.ID);
    });
  }
};
export default Get;
