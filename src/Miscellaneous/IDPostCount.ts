import Callbacks from "../classes/Callbacks";
import Get from "../General/Get";
import { g, Conf } from "../globals/globals";
import $ from "../platform/$";
import type { default as Post } from "../classes/Post";

var IDPostCount = {
  thread: null as any, // loose:

  init() {
    if ((g.VIEW !== 'thread') || !Conf['Count Posts by ID']) { return; }
    Callbacks.Thread.push({
      name: 'Count Posts by ID',
      cb() { return IDPostCount.thread = this; }
    });
    return Callbacks.Post.push({
      name: 'Count Posts by ID',
      cb:   this.node
    });
  },

  node(this: Post) {
    if (this.nodes.uniqueID && (this.thread === IDPostCount.thread)) {
      return $.on(this.nodes.uniqueID, 'mouseover', IDPostCount.count);
    }
  },

  count(this: HTMLElement) {
    const post = Get.postFromNode(this);
    if (!post) { return; }
    const {uniqueID} = post.info;
    let n = 0;
    IDPostCount.thread.posts.forEach(function(post: Post) {
      if (post.info.uniqueID === uniqueID) { return n++; }
    });
    return this.title = `${n} post${n === 1 ? '' : 's'} by this ID`;
  }
};
export default IDPostCount;
