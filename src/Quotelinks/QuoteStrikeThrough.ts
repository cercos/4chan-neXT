import Callbacks from "../classes/Callbacks";
import Get from "../General/Get";
import { g, Conf } from "../globals/globals";
import $ from "../platform/$";
import type Post from "../classes/Post";

const QuoteStrikeThrough = {
  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread') ||
      (!Conf['Reply Hiding Buttons'] && (!Conf['Menu'] || !Conf['Reply Hiding Link']) && !Conf['Filter'])) { return; }

    return Callbacks.Post.push({
      name: 'Strike-through Quotes',
      cb:   this.node
    });
  },

  node(this: Post) {
    if (this.isClone) { return; }
    for (var quotelink of this.nodes.quotelinks) {
      var {boardID, postID} = Get.postDataFromLink(quotelink);
      if (g.posts!.get(`${boardID}.${postID}`)?.isHidden) {
        $.addClass(quotelink, 'filtered');
      }
    }
  }
};
export default QuoteStrikeThrough;
