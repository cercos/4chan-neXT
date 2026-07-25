import type Post from "../classes/Post";
import { g, Conf, doc } from "../globals/globals";
import $ from "../platform/$";
import QR from "../Posting/QR";
import Menu from "./Menu";

var ReplyLink = {
  post: undefined as Post | undefined,

  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread') || !Conf['Menu'] || !Conf['Quick Reply']) { return; }

    const reply = $.el('a', {
      className: 'reply-link',
      href: 'javascript:;',
      textContent: 'Reply'
    });
    $.on(reply, 'click', ReplyLink.reply);
    return Menu.menu.addEntry({
      el: reply,
      order: 6,
      open(post: Post) {
        ReplyLink.post = post.origin || post;
        return doc.classList.contains('xt-mobile');
      }
    });
  },

  reply() {
    const {post} = ReplyLink;
    if (!post) { return; }
    $.event('CloseMenu');
    return QR.quote.call(post.nodes.post, undefined);
  }
};
export default ReplyLink;
