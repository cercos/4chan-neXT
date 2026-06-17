import $ from "../platform/$";
import type Post from "../classes/Post";
import Redirect from "../Archive/Redirect";
import Filter from "../Filtering/Filter";
import { g, Conf } from "../globals/globals";
import Menu from "./Menu";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const ArchiveLink = {
  init() {
    const site = g.SITE;
    if (!site || (site.software !== 'yotsuba') || (g.VIEW !== 'index' && g.VIEW !== 'thread') || !Conf['Menu'] || !Conf['Archive Link']) { return; }

    const div = $.el('div',
      {textContent: 'Archive'});

    const entry = {
      el: div,
      order: 60,
      open({ID, thread, board}: Post) {
        return !!Redirect.to('thread', {postID: ID, threadID: thread.ID, boardID: board.ID});
      },
      subEntries: [] as any[]
    };

    for (var type of [
      ['Post',      'post'],
      ['Name',      'name'],
      ['Tripcode',  'tripcode'],
      ['Capcode',   'capcode'],
      ['Subject',   'subject'],
      ['Flag',      'country'],
      ['Filename',  'filename'],
      ['Image MD5', 'MD5']
    ]) {
      // Add a sub entry for each type.
      entry.subEntries.push(this.createSubEntry(type[0], type[1]));
    }

    return Menu.menu.addEntry(entry);
  },

  createSubEntry(text: string, type: string) {
    const el = $.el('a', {
      textContent: text,
      target: '_blank'
    }
    );

    const open = type === 'post' ?
      function({ID, thread, board}: Post) {
        el.href = Redirect.to('thread', {postID: ID, threadID: thread.ID, boardID: board.ID});
        return true;
      }
    :
      function(post: Post) {
        const typeParam = (type === 'country') && post.info.flagCodeTroll ?
          'troll_country'
        :
          type;
        const value = type === 'country' ?
          post.info.flagCode || post.info.flagCodeTroll?.toLowerCase()
        :
          Filter.values(type, post)[0];
        // We want to parse the exact same stuff as the filter does already.
        if (!value) { return false; }
        el.href = Redirect.to('search', {
          boardID:  post.board.ID,
          type:     typeParam,
          value,
          isSearch: true
        } as any
        );
        return true;
      };

    return {
      el,
      open
    };
  }
};
export default ArchiveLink;
