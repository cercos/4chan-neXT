import Callbacks from "../classes/Callbacks";
import { g } from "../globals/globals";
import $ from "../platform/$";
import type { default as Post, PostClone } from "../classes/Post";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
var IDHighlight = {
  init() {
    if (g.VIEW !== 'index' && g.VIEW !== 'thread') { return; }

    return Callbacks.Post.push({
      name: 'Highlight by User ID',
      cb:   this.node
    });
  },

  uniqueID: null,

  node(this: Post | PostClone) {
    if (this.nodes.uniqueIDRoot) { $.on(this.nodes.uniqueIDRoot, 'click', IDHighlight.click(this)); }
    if (this.nodes.capcode) { $.on(this.nodes.capcode,      'click', IDHighlight.click(this)); }
    if (!this.isClone) { return IDHighlight.set(this); }
  },

  set(post) {
    const match = (post.info.uniqueID || post.info.capcode) === IDHighlight.uniqueID;
    return $[match ? 'addClass' : 'rmClass'](post.nodes.post, 'highlight');
  },

  click(post) { return function() {
    const uniqueID = post.info.uniqueID || post.info.capcode;
    IDHighlight.uniqueID = IDHighlight.uniqueID === uniqueID ? null : uniqueID;
    return g.posts!.forEach(IDHighlight.set);
  }; }
};
export default IDHighlight;
