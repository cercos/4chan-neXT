import Callbacks from "../classes/Callbacks";
import { g, Conf, d } from "../globals/globals";
import $ from "../platform/$";
import type Post from "../classes/Post";

var MarkNewIPs = {
  ipCount: null as any, // loose: late-assigned
  postCount: null as any, // loose: late-assigned
  init() {
    if ((g.SITE!.software !== 'yotsuba') || (g.VIEW !== 'thread') || !Conf['Mark New IPs']) { return; }
    return Callbacks.Thread.push({
      name: 'Mark New IPs',
      cb:   this.node
    });
  },

  node(this: any) {
    MarkNewIPs.ipCount = this.ipCount;
    MarkNewIPs.postCount = this.posts.keys.length;
    return $.on(d, 'ThreadUpdate', MarkNewIPs.onUpdate);
  },

  onUpdate(e: CustomEvent) {
    let fullID;
    const {ipCount, postCount, newPosts, deletedPosts} = e.detail;
    if (ipCount == null) { return; }

    switch (ipCount - MarkNewIPs.ipCount) {
      case (postCount - MarkNewIPs.postCount) + deletedPosts.length:
        var i = MarkNewIPs.ipCount;
        for (fullID of newPosts) {
          const post = g.posts!.get(fullID);
          if (post) { MarkNewIPs.markNew(post, ++i); }
        }
        break;
      case -deletedPosts.length:
        for (fullID of newPosts) {
          const post = g.posts!.get(fullID);
          if (post) { MarkNewIPs.markOld(post); }
        }
        break;
    }
    MarkNewIPs.ipCount = ipCount;
    return MarkNewIPs.postCount = postCount;
  },

  markNew(post: Post, ipCount: number) {
    const suffix = ((Math.floor(ipCount / 10)) % 10) === 1 ?
      'th'
    :
      ['st', 'nd', 'rd'][(ipCount % 10) - 1] || 'th'; // fuck switches
    const counter = $.el('span', {
      className: 'ip-counter',
      textContent: `(${ipCount})`
    }
    );
    post.nodes.nameBlock.title = `This is the ${ipCount}${suffix} IP in the thread.`;
    $.add(post.nodes.nameBlock, [$.tn(' '), counter]);
    return $.addClass(post.nodes.root, 'new-ip');
  },

  markOld(post: Post) {
    post.nodes.nameBlock.title = 'Not the first post from this IP.';
    return $.addClass(post.nodes.root, 'old-ip');
  }
};
export default MarkNewIPs;
