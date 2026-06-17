import Callbacks from "../classes/Callbacks";
import { g } from "../globals/globals";
import $ from "../platform/$";
import type { default as Post, PostClone } from "../classes/Post";

var IDHighlight = {
  init() {
    if (g.VIEW !== 'index' && g.VIEW !== 'thread') { return; }

    return Callbacks.Post.push({
      name: 'Highlight by User ID',
      cb:   this.node
    });
  },

  uniqueID: null as string | null | undefined,

  node(this: Post | PostClone) {
    if (this.nodes.uniqueIDRoot) { $.on(this.nodes.uniqueIDRoot, 'click', IDHighlight.click(this)); }
    if (this.nodes.capcode) { $.on(this.nodes.capcode,      'click', IDHighlight.click(this)); }
    if (!this.isClone) { return IDHighlight.set(this); }
  },

  set(post: Post | PostClone) {
    const match = (post.info.uniqueID || post.info.capcode) === IDHighlight.uniqueID;
    return $[match ? 'addClass' : 'rmClass'](post.nodes.post, 'highlight');
  },

  click(post: Post | PostClone) { return function() {
    const uniqueID = post.info.uniqueID || post.info.capcode;
    IDHighlight.uniqueID = IDHighlight.uniqueID === uniqueID ? null : uniqueID;
    return g.posts!.forEach(IDHighlight.set);
  }; }
};
export default IDHighlight;
