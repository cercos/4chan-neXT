import DataBoard from '../classes/DataBoard';
import $ from '../platform/$';
import { Conf, d, g } from '../globals/globals';
import { dict } from '../platform/helpers';
import Beep from './ThreadUpdater/beep.wav';

interface LibraryEntry {
  id: string;
  name: string;
  data: string; // url or data: URI
  builtin?: boolean;
}

interface PostInfo {
  siteID?: string;
  boardID: string;
  threadID?: string | number;
  postID?: string | number;
}

const BUILTIN_DEFAULT_ID = 'builtin:default';

const SoundManager = {
  db: undefined as DataBoard | undefined,
  threadUpdateHooked: false,

  init() {
    if (this.db) {
      this.hookThreadUpdate();
      return;
    }
    this.db = new DataBoard('sounds');
    this.migrateBeepSource();
    this.hookThreadUpdate();
  },

  hookThreadUpdate() {
    if (this.threadUpdateHooked) return;
    this.threadUpdateHooked = true;
    $.on(d, 'ThreadUpdate', SoundManager.onThreadUpdate);
  },

  onThreadUpdate(e: CustomEvent) {
    if (!e.detail?.[404]) return;
    const thread = g.threads!.get(e.detail.threadID);
    if (!thread) return;
    SoundManager.clearThreadPostOverrides(thread.board.ID, thread.ID);
  },

  clearThreadPostOverrides(boardID: string, threadID: string | number, siteID = g.SITE!.ID) {
    if (!this.db) return;
    this.db.delete({ siteID, boardID, threadID });
  },

  /** One-time: if a legacy `beepSource` URL/data URI exists, fold it into the library. */
  migrateBeepSource() {
    const src = Conf.beepSource;
    if (!src) return;
    const lib: LibraryEntry[] = Array.isArray(Conf.soundLibrary) ? Conf.soundLibrary : [];
    const alreadyIn = lib.some((e) => e.data === src);
    if (!alreadyIn) {
      const id = this.addToLibrary('Imported default', src);
      if (!Conf.defaultSoundId) this.setDefaultSoundId(id);
    }
    Conf.beepSource = '';
    $.set('beepSource', '');
  },

  builtins(): LibraryEntry[] {
    return [
      { id: BUILTIN_DEFAULT_ID, name: 'Beep', data: `data:audio/wav;base64,${Beep}`, builtin: true },
    ];
  },

  library(): LibraryEntry[] {
    const user: LibraryEntry[] = Array.isArray(Conf.soundLibrary) ? Conf.soundLibrary : [];
    return [...this.builtins(), ...user];
  },

  getEntry(id: string): LibraryEntry | undefined {
    if (!id) return undefined;
    return this.library().find(e => e.id === id);
  },

  addToLibrary(name: string, data: string, cb?: () => void) {
    const id = `user:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const next = [...(Array.isArray(Conf.soundLibrary) ? Conf.soundLibrary : []), { id, name, data }];
    Conf.soundLibrary = next;
    $.set('soundLibrary', next, cb);
    return id;
  },

  renameLibraryEntry(id: string, name: string, cb?: () => void) {
    const list = Array.isArray(Conf.soundLibrary) ? Conf.soundLibrary : [];
    const next = list.map((e: LibraryEntry) => e.id === id ? { ...e, name } : e);
    Conf.soundLibrary = next;
    $.set('soundLibrary', next, cb);
  },

  removeFromLibrary(id: string, cb?: () => void) {
    const list = Array.isArray(Conf.soundLibrary) ? Conf.soundLibrary : [];
    const next = list.filter((e: LibraryEntry) => e.id !== id);
    Conf.soundLibrary = next;
    if (Conf.defaultSoundId === id) {
      Conf.defaultSoundId = '';
      $.set('defaultSoundId', '');
    }
    $.set('soundLibrary', next, cb);
  },

  getDefaultSoundId(): string {
    return Conf.defaultSoundId || '';
  },

  setDefaultSoundId(id: string, cb?: () => void) {
    Conf.defaultSoundId = id || '';
    $.set('defaultSoundId', Conf.defaultSoundId, cb);
  },

  isDefault(id: string): boolean {
    const cur = Conf.defaultSoundId || '';
    if (cur) return cur === id;
    return id === BUILTIN_DEFAULT_ID;
  },

  boardKey(boardID: string, siteID = g.SITE!.ID) {
    return `${siteID}/${boardID}`;
  },

  getBoardOverride(boardID: string, siteID = g.SITE!.ID): string | undefined {
    const map = Conf.boardSounds || {};
    return map[this.boardKey(boardID, siteID)];
  },

  setBoardOverride(boardID: string, soundId: string | null, cb?: () => void) {
    const map = { ...(Conf.boardSounds || {}) };
    const key = this.boardKey(boardID);
    if (soundId) {
      map[key] = soundId;
    } else {
      delete map[key];
    }
    Conf.boardSounds = map;
    $.set('boardSounds', map, cb);
  },

  allBoardOverrides(): Array<{ siteID: string; boardID: string; soundId: string }> {
    const map = Conf.boardSounds || {};
    const out: Array<{ siteID: string; boardID: string; soundId: string }> = [];
    for (const key in map) {
      const [siteID, boardID] = key.split('/');
      if (boardID) out.push({ siteID, boardID, soundId: map[key] });
    }
    return out;
  },

  getPostOverride({ siteID, boardID, threadID, postID }: PostInfo): string | undefined {
    if (postID == null) return undefined;
    const entry = this.db?.get({ siteID, boardID, threadID });
    return entry?.posts?.[postID];
  },

  setPostOverride({ siteID, boardID, threadID, postID }: PostInfo, soundId: string | null, cb?: () => void) {
    if (!this.db || postID == null) return;
    const existing = this.db.get({ siteID, boardID, threadID }) || dict();
    const posts = { ...(existing.posts || {}) };
    if (soundId) {
      posts[postID] = soundId;
    } else {
      delete posts[postID];
    }
    const next: any = { ...existing };
    if (Object.keys(posts).length) {
      next.posts = posts;
    } else {
      delete next.posts;
    }
    if (next.posts && Object.keys(next.posts).length) {
      this.db.set({ siteID, boardID, threadID, val: next }, cb);
    } else {
      this.db.delete({ siteID, boardID, threadID }, cb);
    }
  },

  /** Walk the DataBoard and list every post-level override across sites/boards/threads. */
  allPostOverrides(): Array<{ siteID: string; boardID: string; threadID: string; postID: string; soundId: string }> {
    const out: Array<{ siteID: string; boardID: string; threadID: string; postID: string; soundId: string }> = [];
    const data: any = this.db?.data; // loose: DataBoardData types board values as number; real shape is nested
    if (!data) return out;
    for (const siteID in data) {
      const boards = data[siteID]?.boards;
      if (!boards) continue;
      for (const boardID in boards) {
        const threads = boards[boardID];
        if (!threads || typeof threads !== 'object') continue;
        for (const threadID in threads) {
          const wrapper = threads[threadID];
          if (!wrapper?.posts) continue;
          for (const postID in wrapper.posts) {
            const soundId = wrapper.posts[postID];
            if (soundId) out.push({ siteID, boardID, threadID, postID, soundId });
          }
        }
      }
    }
    return out;
  },

  /**
   * Resolve a sound source URL by walking the override hierarchy.
   * `quotedYouPost` (optional) - info for a You-post being quoted; checked first.
   * `context` - board/thread for fallback when no You-post override hits.
   * Returns a playable source URL (data: URI or http).
   */
  resolveSource({
    quotedYouPost,
    context,
  }: {
    quotedYouPost?: { boardID: string; threadID: string | number; postID: string | number };
    context: { boardID: string; threadID?: string | number };
  }): string {
    const tryId = (id?: string) => {
      if (!id) return null;
      return this.getEntry(id)?.data || null;
    };

    if (quotedYouPost) {
      const src = tryId(this.getPostOverride(quotedYouPost));
      if (src) return src;
    }
    const boardSrc = tryId(this.getBoardOverride(context.boardID));
    if (boardSrc) return boardSrc;
    const defaultSrc = tryId(this.getDefaultSoundId());
    if (defaultSrc) return defaultSrc;
    return this.getEntry(BUILTIN_DEFAULT_ID)!.data;
  },
};

export default SoundManager;
