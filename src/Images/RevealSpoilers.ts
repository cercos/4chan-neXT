import Callbacks from "../classes/Callbacks";
import type Post from "../classes/Post";
import { g, Conf } from "../globals/globals";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const RevealSpoilers = {
  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread' && g.VIEW !== 'archive') || !Conf['Reveal Spoiler Thumbnails']) { return; }

    return Callbacks.Post.push({
      name: 'Reveal Spoiler Thumbnails',
      cb:   this.node
    });
  },

  node(this: Post) {
    if (this.isClone) { return; }
    for (var file of this.files) {
      if (file.thumb && file.isSpoiler) {
        var {thumb} = file;
        // Remove old width and height.
        thumb.removeAttribute('style');
        // Enforce thumbnail size if thumbnail is replaced.
        thumb.style.maxHeight = (thumb.style.maxWidth = this.isReply ? '125px' : '250px');
        if ((thumb as HTMLImageElement).src) {
          (thumb as HTMLImageElement).src = file.thumbURL!;
        } else {
          thumb.dataset.src = file.thumbURL;
        }
      }
    }
  }
};
export default RevealSpoilers;
