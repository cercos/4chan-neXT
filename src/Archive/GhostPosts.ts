import Callbacks from '../classes/Callbacks';
import Redirect from './Redirect';
import RestoreDeletedFromArchive from './RestoreDeletedFromArchive';
import { type RawArchivePost } from './Parse';
import CrossOrigin from '../platform/CrossOrigin';
import $ from '../platform/$';
import { Conf, c, d, g } from '../globals/globals';
import type Thread from '../classes/Thread';

const GhostPosts = {
  thread: null as Thread | null,
  fetched: false,

  init() {
    if (g.VIEW !== 'thread') return;
    if (!Conf['Fetch Ghost Posts']) return;
    if (!Conf['Resurrect Quotes']) return;

    Callbacks.Thread.push({
      name: 'Ghost Posts',
      cb:   GhostPosts.node,
    });
  },

  node(this: Thread) {
    GhostPosts.thread = this;
    GhostPosts.fetched = false;
    $.one(d, '4chanXInitFinished', GhostPosts.start);
    $.on(d, 'ThreadUpdate', GhostPosts.onThreadUpdate);
  },

  onThreadUpdate(e: CustomEvent) {
    if (e.detail[404]) return;
    if (!e.detail.deletedPosts?.length) return;
    GhostPosts.fetched = false;
    GhostPosts.start();
  },

  start() {
    if (GhostPosts.fetched) return;
    if (!GhostPosts.thread) return;
    GhostPosts.fetched = true;

    const { boardID, ID: threadID } = GhostPosts.thread;
    const url = Redirect.to('threadJSON', { boardID: String(boardID), threadID });
    if (!url) return;
    if (!Redirect.securityCheck(url)) return;

    CrossOrigin.cache(url, function (this: XMLHttpRequest) {
      GhostPosts.handle(this);
    });
  },

  handle(req: XMLHttpRequest) {
    const { status, response } = req;
    if (![200, 304].includes(status) || !response) return;
    if (!GhostPosts.thread) return;

    const threadID = GhostPosts.thread.ID;
    const threadObj = response[String(threadID)] ?? response[threadID as any];
    if (!threadObj?.posts) return;

    for (const postIDStr of Object.keys(threadObj.posts)) {
      const postID = +postIDStr;
      if (!postID) continue;
      const raw = threadObj.posts[postIDStr] as RawArchivePost;
      try {
        RestoreDeletedFromArchive.insert(raw);
      } catch (err) {
        c.error?.('GhostPosts insert failed for', postID, err);
      }
    }
  },
};

export default GhostPosts;
