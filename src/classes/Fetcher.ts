import Redirect from "../Archive/Redirect";
import Board from "./Board";
import Post from "./Post";
import Thread from "./Thread";
import $ from "../platform/$";
import Main from "../main/Main";
import Index from "../General/Index";
import { E, g, Conf, d } from "../globals/globals";
import CrossOrigin from "../platform/CrossOrigin";
import Get from "../General/Get";
import RestoreDeletedFromArchive from "../Archive/RestoreDeletedFromArchive";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
export default class Fetcher {
  static archiveTags = {
    '\n':         {innerHTML: "<br>"},
    '[b]':        {innerHTML: "<b>"},
    '[/b]':       {innerHTML: "</b>"},
    '[spoiler]':  {innerHTML: "<s>"},
    '[/spoiler]': {innerHTML: "</s>"},
    '[code]':     {innerHTML: "<pre class=\"prettyprint\">"},
    '[/code]':    {innerHTML: "</pre>"},
    '[moot]':     {innerHTML: "<div style=\"padding:5px;margin-left:.5em;border-color:#faa;border:2px dashed rgba(255,0,0,.1);border-radius:2px\">"},
    '[/moot]':    {innerHTML: "</div>"},
    '[banned]':   {innerHTML: "<strong style=\"color: red;\">"},
    '[/banned]':  {innerHTML: "</strong>"},
    '[fortune]'(text) { return {innerHTML: "<span class=\"fortune\" style=\"color:" + E(text.match(/#\w+|$/)[0]) + "\"><b>"}; },
    '[/fortune]': {innerHTML: "</b></span>"},
    '[i]':        {innerHTML: "<span class=\"mu-i\">"},
    '[/i]':       {innerHTML: "</span>"},
    '[red]':      {innerHTML: "<span class=\"mu-r\">"},
    '[/red]':     {innerHTML: "</span>"},
    '[green]':    {innerHTML: "<span class=\"mu-g\">"},
    '[/green]':   {innerHTML: "</span>"},
    '[blue]':     {innerHTML: "<span class=\"mu-b\">"},
    '[/blue]':    {innerHTML: "</span>"}
  };

  static flagCSS: any; // loose: late-assigned static prop

  declare boardID: string;
  declare threadID: number;
  declare postID: string;
  declare root: HTMLElement;
  declare quoter: Post;

  constructor(boardID: string, threadID: number, postID: string, root: HTMLElement, quoter: Post) {
    let post: Post, thread: Thread;
    this.boardID = boardID;
    this.threadID = threadID;
    this.postID = postID;
    this.root = root;
    this.quoter = quoter;
    if (post = g.posts!.get(`${this.boardID}.${this.postID}`)) {
      this.insert(post);
      return;
    }

    // 4chan X catalog data
    if ((post = Index.replyData?.[`${this.boardID}.${this.postID}`]) && (thread = g.threads!.get(`${this.boardID}.${this.threadID}`))) {
      const board  = g.boards[this.boardID];
      post = new Post(g.SITE!.Build.postFromObject(post, this.boardID), thread, board, {isFetchedQuote: true});
      Main.callbackNodes('Post', [post]);
      this.insert(post);
      return;
    }

    this.root.textContent = `Loading post No.${this.postID}...`;
    if (this.threadID) {
      const that = this;
      $.cache(g.SITE!.urls.threadJSON({boardID: this.boardID, threadID: this.threadID}), function({isCached}) {
        return that.fetchedPost(this, isCached);
      });
    } else {
      this.archivedPost();
    }
  }

  insert(post) {
    // Stop here if the container has been removed while loading.
    if (!this.root.parentNode) { return; }
    if (!this.quoter) { this.quoter = post; }
    const clone = post.addClone(this.quoter.context, ($.hasClass(this.root, 'dialog')));
    Main.callbackNodes('Post', [clone]);

    // Get rid of the side arrows/stubs.
    const {nodes} = clone;
    $.rmAll(nodes.root);
    $.add(nodes.root, nodes.post);

    // Indicate links to the containing post.
    const quotes = [...clone.nodes.quotelinks, ...clone.nodes.backlinks];
    for (var quote of quotes) {
      var {boardID, postID} = Get.postDataFromLink(quote);
      if ((postID === this.quoter.ID) && (boardID === this.quoter.board.ID)) {
        $.addClass(quote, 'forwardlink');
      }
    }

    // Set up flag CSS for cross-board links to boards with flags
    if (clone.nodes.flag && !(Fetcher.flagCSS || (Fetcher.flagCSS = $('link[href^="//s.4cdn.org/css/flags."]')))) {
      const cssVersion = $('link[href^="//s.4cdn.org/css/"]')?.href.match(/\d+(?=\.css$)|$/)[0] || Date.now();
      Fetcher.flagCSS = $.el('link', {
        rel: 'stylesheet',
        href: `//s.4cdn.org/css/flags.${cssVersion}.css`
      }
      );
      $.add(d.head, Fetcher.flagCSS);
    }

    $.rmAll(this.root);
    $.add(this.root, nodes.root);
    return $.event('PostsInserted', null, this.root);
  }

  fetchedPost(req, isCached) {
    // In case of multiple callbacks for the same request,
    // don't parse the same original post more than once.
    let post;
    if (post = g.posts!.get(`${this.boardID}.${this.postID}`)) {
      this.insert(post);
      return;
    }

    const {status} = req;
    if (status !== 200) {
      // The thread can die by the time we check a quote.
      if (status && this.archivedPost()) { return; }

      $.addClass(this.root, 'warning');
      this.root.textContent =
        status === 404 ?
          `Thread No.${this.threadID} 404'd.`
        : !status ?
          'Connection Error'
        :
          `Error ${req.statusText} (${req.status}).`;
      return;
    }

    const {posts} = req.response;
    g.SITE!.Build.spoilerRange[this.boardID] = posts[0].custom_spoiler;
    for (post of posts) {
      if (post.no === this.postID) { break; }
    } // we found it!

    if (post.no !== this.postID) {
      // Cached requests can be stale and must be rechecked.
      if (isCached) {
        const api = g.SITE!.urls.threadJSON({boardID: this.boardID, threadID: this.threadID});
        $.cleanCache(url => url === api);
        const that = this;
        $.cache(api, function() {
          return that.fetchedPost(this, false);
        });
        return;
      }

      // The post can be deleted by the time we check a quote.
      if (this.archivedPost()) { return; }

      $.addClass(this.root, 'warning');
      this.root.textContent = `Post No.${this.postID} was not found.`;
      return;
    }

    const board = g.boards[this.boardID] ||
      new Board(this.boardID);
    const thread = g.threads!.get(`${this.boardID}.${this.threadID}`) ||
      new Thread(String(this.threadID), board);
    post = new Post(g.SITE!.Build.postFromObject(post, this.boardID), thread, board, {isFetchedQuote: true});
    Main.callbackNodes('Post', [post]);
    return this.insert(post);
  }

  archivedPost() {
    let url: string;
    if (!Conf['Resurrect Quotes']) { return false; }
    if (!(url = Redirect.to('post', {boardID: this.boardID, postID: this.postID}))) { return false; }
    const archive = Redirect.data.post[this.boardID];
    const encryptionOK = /^https:\/\//.test(url) || (location.protocol === 'http:');
    if (encryptionOK || Conf['Exempt Archives from Encryption']) {
      const that = this;
      CrossOrigin.cache(url, function() {
        if (!encryptionOK && this.response?.media) {
          const {media} = this.response;
          for (var key in media) {
            // Image/thumbnail URLs loaded over HTTP can be modified in transit.
            // Require them to be from an HTTP host so that no referrer is sent to them from an HTTPS page.
            if (/_link$/.test(key)) {
              if (!$.getOwn(media, key)?.match(/^http:\/\//)) { delete media[key]; }
            }
          }
        }
        return that.parseArchivedPost(this.response, url, archive);
      });
      return true;
    }
    return false;
  }

  parseArchivedPost(data, url, archive) {
    // In case of multiple callbacks for the same request,
    // don't parse the same original post more than once.
    let post: Post;
    if (post = g.posts!.get(`${this.boardID}.${this.postID}`)) {
      this.insert(post);
      return;
    }

    if (data == null) {
      $.addClass(this.root, 'warning');
      this.root.textContent = `Error fetching Post No.${this.postID} from ${archive.name}.`;
      return;
    }

    if (data.error) {
      $.addClass(this.root, 'warning');
      this.root.textContent = data.error;
      return;
    }

    return this.insert(RestoreDeletedFromArchive.insert(data)[0]);
  }
}
