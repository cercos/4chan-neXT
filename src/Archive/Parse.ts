import Redirect from './Redirect';
import { isEscaped } from '../globals/jsx';
import Main from '../main/Main';
import ImageHost from '../Images/ImageHost';
import Board from '../classes/Board';
import Fetcher from '../classes/Fetcher';
import Post, { type File } from '../classes/Post';
import Thread from '../classes/Thread';
import { E, g } from '../globals/globals';
import { dict } from '../platform/helpers';
import $ from '../platform/$';

// Got this from just putting a response in a json to ts converter, it might be incomplete.
export interface RawArchivePost {
  doc_id: string;
  num: string;
  subnum: string;
  thread_num: string;
  op: string;
  timestamp: number;
  timestamp_expired: string;
  capcode: string;
  email: any;
  name: string;
  trip: any;
  title: any;
  comment: string;
  poster_hash: any;
  poster_country?: string;
  troll_country_code?: string;
  troll_country_name?: any;
  sticky: string;
  locked: string;
  deleted: string;
  nreplies: any;
  nimages: any;
  fourchan_date: string;
  comment_sanitized: string;
  comment_processed: string;
  formatted: boolean;
  title_processed: any;
  name_processed: string;
  email_processed: any;
  trip_processed: any;
  poster_hash_processed: any;
  poster_country_name: boolean;
  poster_country_name_processed: string;
  extra_data: any[];
  exif?: string;
  media: {
    media_id: string;
    spoiler: string;
    preview_orig: string;
    media: string;
    preview_op: any;
    preview_reply: string;
    preview_w: string;
    preview_h: string;
    media_filename: string;
    media_w: string;
    media_h: string;
    media_size: string;
    media_hash: string;
    media_orig: string;
    exif: any;
    total: string;
    banned: string;
    media_status: string;
    safe_media_hash: string;
    remote_media_link: string;
    media_link: string;
    thumb_link: string;
    media_filename_processed: string;
  };
  board: {
    name: string;
    shortname: string;
  };
}


export const parseArchivePost = (data: RawArchivePost) => {
  // https://github.com/eksopl/asagi/blob/v0.4.0b74/src/main/java/net/easymodo/asagi/YotsubaAbstract.java#L82-L129
  // https://github.com/FoolCode/FoolFuuka/blob/800bd090835489e7e24371186db6e336f04b85c0/src/Model/Comment.php#L368-L428
  // https://github.com/bstats/b-stats/blob/6abe7bffaf6e5f523498d760e54b110df5331fbb/inc/classes/Yotsuba.php#L157-L168
  let comment: any = (data.comment || '').split(/(\n|\[\/?(?:b|spoiler|code|moot|banned|fortune(?: color="#\w+")?|i|red|green|blue)\])/);
  comment = comment.map((text: string, i: number) => {
    if ((i % 2) === 1) {
      var tag = Fetcher.archiveTags[text.replace(/\ .*\]/, ']') as keyof typeof Fetcher.archiveTags];
      return (typeof tag === 'function') ? tag(text) : tag;
    } else {
      var greentext = text[0] === '>';
      text = text
        .replace(/(\[\/?[a-z]+):lit(\])/g, '$1$2')
        .split(/(>>(?:>\/[a-z\d]+\/)?\d+)/g)
        .map((text2: string, j: number) => ((j % 2) ? `<span class="deadlink">${E(text2)}</span>` : E(text2)))
        .join('');
      return { innerHTML: (greentext ? `<span class="quote">${text}</span>` : text) };
    }
  });
  comment = { innerHTML: E.cat(comment), [isEscaped]: true };

  const o = {
    ID: data.num,
    threadID: data.thread_num,
    boardID: data.board.shortname,
    isReply: data.num !== data.thread_num,
    fileDeleted: false,
    info: {
      subject: data.title,
      email: data.email,
      name: data.name || '',
      tripcode: data.trip,
      capcode: (() => {
        switch (data.capcode) {
          // https://github.com/pleebe/FoolFuuka/blob/bf4224eed04637a4d0bd4411c2bf5f9945dfec0b/assets/themes/foolz/foolfuuka-theme-fuuka/src/Partial/Board.php#L77
          case 'M': return 'Mod';
          case 'A': return 'Admin';
          case 'D': return 'Developer';
          case 'V': return 'Verified';
          case 'F': return 'Founder';
          case 'G': return 'Manager';
        }
      })(),
      uniqueID: data.poster_hash,
      flagCode: data.poster_country,
      flagCodeTroll: data.troll_country_code,
      flag: data.poster_country_name || data.troll_country_name,
      dateUTC: data.timestamp,
      dateText: data.fourchan_date,
      commentHTML: comment,
    },
    file: null as any,
    extra: null as any,
  };
  if (o.info.capcode) { delete o.info.uniqueID; }
  if (data.media && !!+data.media.banned) {
    o.fileDeleted = true;
  } else if (data.media?.media_filename) {
    let { thumb_link } = data.media;
    let media_link = Redirect.to('file', { boardID: o.boardID, filename: data.media.media_orig });
    if (!Redirect.securityCheck(media_link)) { media_link = ''; }
    // Fix root-relative thumb URLs by prefixing the archive origin (same host the
    // file is served from). Previously referenced an undefined `url`, throwing.
    if (thumb_link?.[0] === '/' && media_link) { thumb_link = media_link.split('/', 3).join('/') + thumb_link; }
    if (!Redirect.securityCheck(thumb_link)) { thumb_link = ''; }
    o.file = {
      name: data.media.media_filename,
      url: media_link ||
        (o.boardID === 'f' ?
          `${location.protocol}//${ImageHost.flashHost()}/${o.boardID}/${encodeURIComponent(E(data.media.media_filename))}`
          :
          `${location.protocol}//${ImageHost.host()}/${o.boardID}/${data.media.media_orig}`),
      height: data.media.media_h,
      width: data.media.media_w,
      MD5: data.media.media_hash,
      size: $.bytesToString(+data.media.media_size),
      thumbURL: thumb_link || `${location.protocol}//${ImageHost.thumbHost()}/${o.boardID}/${data.media.preview_orig}`,
      theight: data.media.preview_h,
      twidth: data.media.preview_w,
      isSpoiler: data.media.spoiler === '1'
    };
    if (!/\.pdf$/.test(o.file.url)) { o.file.dimensions = `${o.file.width}x${o.file.height}`; }
    if ((o.boardID === 'f') && data.media.exif) { o.file.tag = JSON.parse(data.media.exif).Tag; }
  }
  o.extra = dict();

  const board = (g.boards as unknown as Record<string, Board>)[o.boardID] ||
    new Board(o.boardID);
  const thread = g.threads!.get(`${o.boardID}.${o.threadID}`) ||
    new Thread(o.threadID, board);
  const post = new Post(g.SITE!.Build.post(o), thread, board);
  post.resurrect();
  post.markAsFromArchive();
  if (post.file) { post.file.thumbURL = o.file.thumbURL; }
  Main.callbackNodes('Post', [post]);
  return post;
};
export default parseArchivePost;
