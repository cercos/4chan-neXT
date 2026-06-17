import Callbacks from "../classes/Callbacks";
import Fetcher from "../classes/Fetcher";
import Get from "../General/Get";
import Header from "../General/Header";
import UI from "../General/UI";
import { Conf, d, doc, g } from "../globals/globals";
import ExpandComment from "../Miscellaneous/ExpandComment";
import $ from "../platform/$";
import type Post from "../classes/Post";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
var QuotePreview = {
  init() {
    if (!Conf['Quote Previewing']) { return; }

    if (g.VIEW === 'archive') {
      $.on(d, 'mouseover', function(e) {
        if ((e.target.nodeName === 'A') && $.hasClass(e.target, 'quotelink')) {
          return QuotePreview.mouseover.call(e.target, e);
        }
      });
    }

    if (g.VIEW !== 'index' && g.VIEW !== 'thread') { return; }

    if (Conf['Comment Expansion']) {
      ExpandComment.callbacks.push(this.node);
    }

    return Callbacks.Post.push({
      name: 'Quote Previewing',
      cb:   this.node
    });
  },

  node(this: Post) {
    for (var link of this.nodes.quotelinks.concat([...this.nodes.backlinks], this.nodes.archivelinks)) {
      $.on(link, 'mouseover', QuotePreview.mouseover);
    }
  },

  mouseover(this: HTMLAnchorElement, e: MouseEvent) {
    let origin;
    if (($.hasClass(this, 'inlined') && !$.hasClass(doc, 'catalog-mode')) || !d.contains(this)) { return; }

    const {boardID, threadID, postID} = Get.postDataFromLink(this);

    const qp = $.el('div', {
      id: 'qp',
      className: 'dialog'
    }
    );

    $.add(Header.hover, qp);
    new Fetcher(boardID, threadID, postID as any, qp, Get.postFromNode(this) as any);

    UI.hover({
      root: this,
      el: qp,
      latestEvent: e,
      endEvents: 'mouseout click',
      cb: QuotePreview.mouseout
    } as any);

    if (Conf['Quote Highlighting'] && (origin = g.posts!.get(`${boardID}.${postID}`))) {
      const posts = [origin].concat(origin.clones);
      // Remove the clone that's in the qp from the array.
      posts.pop();
      for (var post of posts) {
        $.addClass(post.nodes.post, 'qphl');
      }
    }
  },

  mouseout(this: { el: HTMLElement }) {
    // Stop if it only contains text.
    let root;
    if (!(root = this.el.firstElementChild)) { return; }

    $.event('PostsRemoved', null, Header.hover);

    const clone = Get.postFromRoot(root);
    if (!clone) { return; }
    let post  = clone.origin;
    post.rmClone((root as HTMLElement).dataset.clone);

    if (!Conf['Quote Highlighting']) { return; }
    for (post of [post].concat(post.clones)) {
      $.rmClass(post.nodes.post, 'qphl');
    }
  }
};
export default QuotePreview;
