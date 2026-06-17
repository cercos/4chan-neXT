import { Conf, d, g } from "../globals/globals";
import $ from "../platform/$";
import { dict, HOUR } from "../platform/helpers";

// loose: any — board values are deeply heterogeneous (thread->post->val nested
// dicts, or scalar values) and vary per DataBoard key; precise typing would
// cascade across .get/.set/.setUnsafe which are explicitly noted as not-yet-typed.
type DataBoardBoardValue = any;

type DataBoardSite = {
  boards: {
    [threadId: string]: DataBoardBoardValue;
  };
  lastChecked?: number;
  version?: number;
};

type DataBoardData = {
  [site: string]: DataBoardSite;
} & { version?: number };

interface PostInfo {
  /** Defaults to g.SITE.ID */
  siteID?: string,
  boardID: string,
  threadID ?: string | number,
  postID ?: string | number
};

/**
 * This class handles data related to specific threads or posts. This data is automatically cleaned up when the thread
 * ages out.
 * TODO At this moment, .get and .set aren't fully typed yet.
 */
export default class DataBoard {
  static keys = [
    'hiddenThreads',
    'hiddenPosts',
    'hiddenPosterIds',
    'lastReadPosts',
    'yourPosts',
    'watchedThreads',
    'watcherLastModified',
    'customTitles',
    'sounds',
  ] as const;

  declare data: DataBoardData;
  declare changes: any[];
  declare key: (typeof DataBoard.keys)[number];
  declare sync?: () => void;

  constructor(key: (typeof DataBoard.keys)[number], sync?: () => void, dontClean = false) {
    this.changes = [];
    this.onSync = this.onSync.bind(this);
    this.key = key;
    this.initData(Conf[this.key]);
    $.sync(this.key, this.onSync);
    if (!dontClean) this.clean();
    if (!sync) return;
    // Chrome also fires the onChanged callback on the current tab,
    // so we only start syncing when we're ready.
    var init = () => {
      $.off(d, '4chanXInitFinished', init);
      this.sync = sync;
    };
    $.on(d, '4chanXInitFinished', init);
  }

  initData(data: any) {
    let boards: DataBoardSite['boards'];
    this.data = data;
    if (this.data.boards) {
      let lastChecked: DataBoardSite['lastChecked'];
      ({boards, lastChecked} = this.data as unknown as DataBoardSite);
      (this.data as Record<string, DataBoardSite>)['4chan.org'] = {boards, lastChecked};
      delete this.data.boards;
      delete this.data.lastChecked;
    }
    return this.data[g.SITE!.ID] || (this.data[g.SITE!.ID] = { boards: dict() });
  }

  save(change: () => void, cb?: () => void) {
    change();
    this.changes.push(change);
    return $.get(this.key, { boards: dict() }, (items: DataBoardData) => {
      if (!this.changes.length) { return; }
      const needSync = ((items[this.key].version || 0) > (this.data.version || 0));
      if (needSync) {
        this.initData(items[this.key]);
        for (change of this.changes) { change(); }
      }
      this.changes = [];
      this.data.version = (this.data.version || 0) + 1;
      return $.set(this.key, this.data, () => {
        if (needSync) { this.sync?.(); }
        return cb?.();
      });
    });
  }

  forceSync(cb?: () => void) {
    return $.get(this.key, { boards: dict() }, (items: DataBoardData) => {
      if ((items[this.key].version || 0) > (this.data.version || 0)) {
        this.initData(items[this.key]);
        for (var change of this.changes) { change(); }
        this.sync?.();
      }
      return cb?.();
    });
  }

  delete({siteID, boardID, threadID, postID}: PostInfo, cb?: () => void) {
    if (!siteID) { siteID = g.SITE!.ID; }
    if (!this.data[siteID]) { return; }
    this.save(() => {
      if (postID) {
        if (!(this.data[siteID].boards[boardID] as any)?.[threadID!]) { return; } // loose: DataBoardData board values mistyped as number
        delete (this.data[siteID].boards[boardID] as any)[threadID!][postID];
        this.deleteIfEmpty({siteID, boardID, threadID});
      } else if (threadID) {
        if (!this.data[siteID].boards[boardID]) { return; }
        delete this.data[siteID].boards[boardID][threadID];
        this.deleteIfEmpty({siteID, boardID});
      } else {
        delete this.data[siteID].boards[boardID];
      }
    }
    , cb);
  }

  deleteIfEmpty({ siteID, boardID, threadID }: { siteID: string, boardID: string, threadID?: string | number }) {
    if (!this.data[siteID]) { return; }
    if (threadID) {
      if (!Object.keys(this.data[siteID].boards[boardID][threadID]).length) {
        delete this.data[siteID].boards[boardID][threadID];
        this.deleteIfEmpty({siteID, boardID});
      }
    } else if (!Object.keys(this.data[siteID].boards[boardID]).length) {
      delete this.data[siteID].boards[boardID];
    }
  }

  set(data: Parameters<DataBoard['setUnsafe']>[0], cb?: () => void) {
    this.save(() => {
      this.setUnsafe(data);
    }, cb);
  }

  setUnsafe({ siteID, boardID, threadID, postID, val }: PostInfo & { val?: any }) {
    if (!siteID) { siteID = g.SITE!.ID; }
    if (!this.data[siteID]) this.data[siteID] = { boards: dict() };
    const boards = this.data[siteID].boards;
    if (postID !== undefined) {
      let base;
      const threadKey = threadID as string | number;
      (((base = boards[boardID] || (boards[boardID] = dict())))[threadKey] || (base[threadKey] = dict()))[postID] = val;
    } else if (threadID !== undefined) {
      (boards[boardID] || (boards[boardID] = dict()))[threadID] = val;
    } else {
      boards[boardID] = val;
    }
  }

  extend(
    { siteID, boardID, threadID, postID, val }: PostInfo & { val?: any },
    cb?: () => void,
  ) {
    this.save(() => {
      const oldVal = this.get({ siteID, boardID, threadID, postID, defaultValue: dict() });
      for (var key in val) {
        var subVal = val[key];
        if (typeof subVal === 'undefined') {
          delete oldVal[key];
        } else {
          oldVal[key] = subVal;
        }
      }
      this.setUnsafe({siteID, boardID, threadID, postID, val: oldVal});
    }, cb);
  }

  setLastChecked(key='lastChecked') {
    this.save(() => {
      (this.data as any)[key] = Date.now();
    });
  }

  get({ siteID, boardID, threadID, postID, defaultValue }: PostInfo & { defaultValue?: any }) {
    let board, val;
    if (!siteID) { siteID = g.SITE!.ID; }
    if (board = this.data[siteID]?.boards[boardID]) {
      let thread: any; // loose: any — iterates board entries as either index counter or nested dict
      if (threadID == null) {
        if (postID != null) {
          for (thread = 0; thread < board.length; thread++) {
            if (postID in thread) {
              val = thread[postID];
              break;
            }
          }
        } else {
          val = board;
        }
      } else if (thread = board[threadID]) {
        val = (postID != null) ? thread[postID] : thread;
      }
    }
    return val || defaultValue;
  }

  clean() {
    let boardID, middle;
    const siteID = g.SITE!.ID;
    for (boardID in this.data[siteID].boards) {
      this.deleteIfEmpty({siteID, boardID});
    }
    const now = Date.now();
    if (now - (2 * HOUR) >= ((middle = this.data[siteID].lastChecked || 0)) || middle > now) {
      this.data[siteID].lastChecked = now;
      for (boardID in this.data[siteID].boards) {
        this.ajaxClean(boardID);
      }
    }
  }

  ajaxClean(boardID: string) {
    const that = this;
    const siteID = g.SITE!.ID;
    const threadsList = g.SITE!.urls.threadsListJSON?.({siteID, boardID});
    if (!threadsList) { return; }
    $.cache(threadsList, function(this: XMLHttpRequest) {
      if (this.status !== 200) { return; }
      const archiveList = g.SITE!.urls.archiveListJSON?.({siteID, boardID});
      if (!archiveList) return that.ajaxCleanParse(boardID, this.response);
      const response1 = this.response;
      $.cache(archiveList, function(this: XMLHttpRequest) {
        if ((this.status !== 200) && (!!g.SITE!.archivedBoardsKnown || (this.status !== 404))) { return; }
        that.ajaxCleanParse(boardID, response1, this.response);
      });
    });
  }

  ajaxCleanParse(boardID: string, response1: any, response2?: any) {
    let board, ID;
    const siteID = g.SITE!.ID;
    if (!(board = this.data[siteID].boards[boardID])) return;
    const threads = dict();
    if (response1) {
      for (var page of response1) {
        for (var thread of page.threads) {
          ID = thread.no;
          if (ID in board) { threads[ID] = board[ID]; }
        }
      }
    }
    if (response2) {
      for (ID of response2) {
        if (ID in board) threads[ID] = board[ID];
      }
    }
    this.data[siteID].boards[boardID] = threads;
    this.deleteIfEmpty({siteID, boardID});
    $.set(this.key, this.data);
  }

  onSync(data?: DataBoardData) {
    if (!data) { return; }
    if ((data.version || 0) <= (this.data.version || 0)) { return; }
    this.initData(data);
    this.sync?.();
  }
}
