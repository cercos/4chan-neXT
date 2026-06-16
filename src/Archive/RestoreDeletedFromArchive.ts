import Redirect from './Redirect';
import Notice from '../classes/Notice';
import { Conf, g, E } from '../globals/globals';
import CrossOrigin from '../platform/CrossOrigin';
import $ from '../platform/$';
import Header from '../General/Header';
import { type RawArchivePost, parseArchivePost } from './Parse';
import QuoteThreading from '../Quotelinks/QuoteThreading';
import type Post from '../classes/Post';
import Get from '../General/Get';

const RestoreDeletedFromArchive = {
  restore() {
    const { boardID, threadID } = g;
    if (!boardID || threadID == null) return;
    const url = Redirect.to('threadJSON', { boardID, threadID });
    if (!url) {
      new Notice('warning', 'No archive found', 3);
      return;
    }
    const encryptionOK = url.startsWith('https://');
    if (encryptionOK || Conf['Exempt Archives from Encryption']) {
      CrossOrigin.ajax(url, { onloadend(this: XMLHttpRequest) {
        if (this.status < 200 || this.status >= 400) {
          const domain = E(new URL(url).origin);
          new Notice('error', $.el('div', {
              innerHTML: 'There was an error while fetching from the archive. See the console for details.<br />' +
                'Some archive check the browser first before checking content, you might need to open the archive ' +
                `first to get past the browser check: <a href="${domain}" target="_blank">${domain}</a><br />` +
                'If that doesn\'t work, try a different archive under Settings > Advanced > Archives > Thread fetching.'
            }));
          console.error(this);
          return;
        }
        let nrRestored = 0;
        const archivePosts = this.response[threadID.toString()].posts as Record<string, RawArchivePost>;
        for (const [postID, raw] of Object.entries(archivePosts)) {
          if (RestoreDeletedFromArchive.insert(raw)[1]) {
            ++nrRestored;
          }
        }

        let msg: string;
        if (nrRestored === 0) {
          msg = 'No removed posts found';
        } else if (nrRestored === 1) {
          msg = '1 post restored';
        } else {
          msg = `${nrRestored} posts restored`;
        }

        new Notice('info', msg, 3);
      }});
    }
  },

  init() {
    if (g.VIEW !== 'thread') return;

    const menuEntry = $.el('a', {
      href: 'javascript:;',
      textContent: 'Restore from archive',
    });
    $.on(menuEntry, 'click', () => {
      RestoreDeletedFromArchive.restore();
      Header.menu.close();
    });
    Header.menu.addEntry({
      el: menuEntry,
      order: 10,
    });
  },

  /**
   * Inserts a post from the archive in the thread. Will automatically skip posts from other threads and posts already
   * in the thread.
   * @param raw The raw data returned from the archive
   * @returns A tuple with as first value the new post, and the second value a boolean whether is was inserted into the
   * page.
   */
  insert(raw: RawArchivePost): [(Post | undefined), boolean] {
    const key = `${raw.board.shortname}.${raw.num}`;
    const posts = g.posts;
    if (!posts) return [undefined, false];
    if (posts.keys.includes(key)) return [undefined, false];

    let inserted = false;

    const post = parseArchivePost(raw);
    post.resurrect();
    post.markAsFromArchive();

    if (post.threadID === g.threadID && g.VIEW === 'thread') {
      const newPostIndex = posts.insert(key, post, key => +(key.split('.')[1]) < post.ID);

      if (Conf['Thread Quotes']) {
        post.thread.nodes.root.insertAdjacentElement('beforeend', post.root);
      } else {
        posts.get(posts.keys[newPostIndex - 1]).root.insertAdjacentElement('afterend', post.root);
      }

      QuoteThreading.insert(post);
      inserted = true;
      for (const quotelink of Get.allQuotelinksLinkingTo(post) as HTMLAnchorElement[]) {
        quotelink.href = `#p${post.ID}`;
      }
    }
    return [post, inserted];
  },
}

export default RestoreDeletedFromArchive;
