import Callbacks from "../classes/Callbacks";
import { g, Conf } from "../globals/globals";
import type { default as Post, PostClone } from "../classes/Post";
import type CatalogThread from "../classes/CatalogThread";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
var ThreadLinks = {
  init() {
    if ((g.VIEW !== 'index') || !Conf['Open Threads in New Tab']) { return; }

    Callbacks.Post.push({
      name: 'Thread Links',
      cb:   this.node
    });
    return Callbacks.CatalogThread.push({
      name: 'Thread Links',
      cb:   this.catalogNode
    });
  },

  node(this: Post | PostClone) {
    if (this.isReply || this.isClone) { return; }
    return ThreadLinks.process(this.nodes.reply);
  },

  catalogNode(this: CatalogThread) {
    return ThreadLinks.process(this.nodes.thumb.parentNode);
  },

  process(link) {
    return link.target = '_blank';
  }
};
export default ThreadLinks;
