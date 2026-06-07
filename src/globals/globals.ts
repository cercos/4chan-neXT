import version from "../../version.json";
import meta from "../../package.json";
import type SimpleDict from "../classes/SimpleDict";
import type Post from "../classes/Post";
import type Thread from "../classes/Thread";
import type SWTinyboard from "../site/SW.tinyboard";
import type SWYotsuba from "../site/SW.yotsuba";

// The active site (g.SITE). At runtime it's `Object.create(SW[software])` with
// `{ID, siteID, software, properties}` mixed in (see Site.set). SWYotsuba is the
// fuller implementation (superset of the optional site hooks), so we base the
// shared shape on it plus the runtime-attached fields.
export type Site = typeof SWYotsuba & Partial<typeof SWTinyboard> & {
  ID:         string,
  siteID:     string,
  software:   string,
  properties: Record<string, any>,
};

// interfaces might be incomplete
export interface BoardConfig {
  board:      string
  bump_limit: number
  cooldowns: {
    threads: number,
    replies: number,
    images:  number,
  }
  custom_spoilers:   1 | 0,
  image_limit:       number,
  is_archived:       1 | 0,
  max_comment_chars: number
  max_filesize:      number
  max_webm_duration: number
  max_webm_filesize: number
  meta_description:  string,
  pages:             number,
  per_page:          number,
  spoilers:          number,
  title:             string
  ws_board:          1 | 0
  country_flags:     number,
  board_flags:       Record<string, string>,
  user_ids?:         number,
  code_tags?:        1 | 0,
  math_tags?:        1 | 0,
  require_subject?:  1 | 0,
  text_only?:        1 | 0,
}

export interface Board {
  ID:      string,
  boardID: string,
  siteID:  string,
  config:  BoardConfig,
  posts:   SimpleDict<Post>,
  threads: SimpleDict<Thread>,
}

export const Conf = Object.create(null);

export const g: {
  VERSION:   string,
  VERSION_DATE: Date,
  NAMESPACE: string,
  sites:     Site[],
  boardID?:  string,
  boards:    Board[],
  posts?:    SimpleDict<Post>,
  threads?:  SimpleDict<Thread>,
  threadID?: number,
  THREADID?: number,
  threadArchived?: boolean,
  SITE?:     Site,
  BOARD?:    Board,
  VIEW?:     string,
} = {
  VERSION:   version.version,
  VERSION_DATE: new Date(version.date),
  NAMESPACE: meta.name,
  sites:     Object.create(null),
  boards:    Object.create(null)
};

export const E = (function () {
  const str = {
    '&': '&amp;',
    "'": '&#039;',
    '"': '&quot;',
    '<': '&lt;',
    '>': '&gt;'
  };
  const regex = /[&"'<>]/g;
  const fn = function (x: string) {
    return str[x];
  };
  const output = function (text: string) {
    return text.toString().replace(regex, fn);
  };
  output.cat = function (templates) {
    let html = '';
    for (let i = 0; i < templates.length; i++) {
      html += templates[i].innerHTML;
    }
    return html;
  };
  return output;
})();

export const d = document;
export const doc = d.documentElement;

export const c = console;

export const docSet = function () {
  // return (doc = d.documentElement);
  return doc;
};
