import $ from "../platform/$";
import { d } from "../globals/globals";
import type Post from "../classes/Post";

const KEY = 'lastGeoFlag';

export interface GeoFlagInfo {
  code: string;
  name: string;
  at: number;
}

const GeoFlag = {
  note(post: Post) {
    const code = post.info.flagCode;
    if (!code) { return; }
    const at = post.info.date ? +post.info.date : Date.now();
    $.get(KEY, null, (items: Record<string, any>) => {
      const prev = items[KEY] as GeoFlagInfo | null;
      if (prev && prev.at >= at) { return; }
      const info: GeoFlagInfo = { code: code.toLowerCase(), name: post.info.flag || code, at };
      $.set(KEY, info);
      $.event('GeoFlagChanged', info, d);
    });
  },

  get(cb: (info: GeoFlagInfo | null) => void) {
    $.get(KEY, null, (items: Record<string, any>) => {
      const info = items[KEY];
      cb(info && typeof info.code === 'string' && /^[a-z0-9]+$/.test(info.code) ? info as GeoFlagInfo : null);
    });
  },
};

export default GeoFlag;
