import { Conf, d } from "../globals/globals";
import Main from "../main/Main";
import $ from "../platform/$";
import $$ from "../platform/$$";
import { dict } from "../platform/helpers";
import SWYotsuba from "./SW.yotsuba";
import type Post from "../classes/Post";
import type Thread from "../classes/Thread";

type IDArg = { siteID?: string; boardID?: string; threadID?: string | number; postID?: string | number };
type SiteBoardArg = { siteID: string; boardID: string };
type TBArg = { siteID: string; boardID: string; threadID?: string | number };

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const SWTinyboard = {
  isOPContainerThread: true,
  mayLackJSON: true,
  threadModTimeIgnoresSage: true,

  disabledFeatures: [
    'Resurrect Quotes',
    'Quick Reply Personas',
    'Quick Reply',
    'Cooldown',
    'Report Link',
    'Delete Link',
    'Edit Link',
    'Quote Inlining',
    'Quote Previewing',
    'Quote Backlinks',
    'File Info Formatting',
    'Image Expansion',
    'Image Expansion (Menu)',
    'Comment Expansion',
    'Thread Expansion',
    'Favicon',
    'Quote Threading',
    'Thread Updater',
    'Banner',
    'Flash Features',
    'Reply Pruning'
  ],

  detect() {
    for (var script of $$('script:not([src])', d.head)) {
      var m;
      if (m = script.textContent.match(/\bvar configRoot=(".*?")/)) {
        var properties = dict();
        try {
          var root = JSON.parse(m[1]);
          if (root[0] === '/') {
            properties.root = location.origin + root;
          } else if (/^https?:/.test(root)) {
            properties.root = root;
          }
        } catch (error) {}
        return properties;
      }
    }
    return false;
  },

  awaitBoard(cb: () => void) {
    let reactUI;
    if (reactUI = $.id('react-ui')) {
      const s = (this.selectors = Object.create(this.selectors));
      s.boardFor = {index: '.page-container'};
      s.thread = 'div[id^="thread_"]';
      return Main.mounted(cb);
    } else {
      return cb();
    }
  },

  urls: {
    thread({siteID, boardID, threadID}: TBArg, isArchived?: boolean) {
      return `${Conf['siteProperties'][siteID]?.root || `http://${siteID}/`}${boardID}/${isArchived ? 'archive/' : ''}res/${threadID}.html`;
    },
    post({postID}: IDArg)                   { return `#${postID}`; },
    index({siteID, boardID}: TBArg)          { return `${Conf['siteProperties'][siteID]?.root || `http://${siteID}/`}${boardID}/`; },
    catalog({siteID, boardID}: TBArg)          { return `${Conf['siteProperties'][siteID]?.root || `http://${siteID}/`}${boardID}/catalog.html`; },
    threadJSON({siteID, boardID, threadID}: TBArg, isArchived?: boolean) {
      const root = Conf['siteProperties'][siteID]?.root;
      if (root) { return `${root}${boardID}/${isArchived ? 'archive/' : ''}res/${threadID}.json`; } else { return ''; }
    },
    archivedThreadJSON(thread: TBArg) {
      return SWTinyboard.urls.threadJSON(thread, true);
    },
    threadsListJSON({siteID, boardID}: TBArg) {
      const root = Conf['siteProperties'][siteID]?.root;
      if (root) { return `${root}${boardID}/threads.json`; } else { return ''; }
    },
    archiveListJSON({siteID, boardID}: TBArg) {
      const root = Conf['siteProperties'][siteID]?.root;
      if (root) { return `${root}${boardID}/archive/archive.json`; } else { return ''; }
    },
    catalogJSON({siteID, boardID}: TBArg) {
      const root = Conf['siteProperties'][siteID]?.root;
      if (root) { return `${root}${boardID}/catalog.json`; } else { return ''; }
    },
    file({siteID, boardID}: TBArg, filename: string) {
      return `${Conf['siteProperties'][siteID]?.root || `http://${siteID}/`}${boardID}/${filename}`;
    },
    thumb(board: TBArg, filename: string) {
      return SWTinyboard.urls.file(board, filename);
    }
  },

  selectors: {
    board:         'form[name="postcontrols"]',
    thread:        'input[name="board"] ~ div[id^="thread_"]',
    threadDivider: 'div[id^="thread_"] > hr:last-child',
    summary:       '.omitted',
    postContainer: 'div[id^="reply_"]:not(.hidden)', // postContainer is thread for OP
    opBottom:      '.op',
    replyOriginal: 'div[id^="reply_"]:not(.hidden)',
    infoRoot:      '.intro',
    info: {
      subject:   '.subject',
      name:      '.name',
      email:     '.email',
      tripcode:  '.trip',
      uniqueID:  '.poster_id',
      capcode:   '.capcode',
      flag:      '.flag',
      date:      'time',
      nameBlock: 'label',
      quote:     'a[href*="#q"]',
      reply:     'a[href*="/res/"]:not([href*="#"])'
    },
    icons: {
      isSticky:   '.fa-thumb-tack',
      isClosed:   '.fa-lock'
    },
    file: {
      text:  '.fileinfo',
      link:  '.fileinfo > a',
      thumb: 'a > .post-image'
    },
    thumbLink: '.file > a',
    multifile: '.files > .file',
    highlightable: {
      op:      ' > .op',
      reply:   '.reply',
      catalog: ' > .thread'
    },
    comment:   '.body',
    spoiler:   '.spoiler',
    quotelink: 'a[onclick*="highlightReply("]',
    catalog: {
      board:  '#Grid',
      thread: '.mix',
      thumb:  '.thread-image'
    },
    boardList: '.boardlist',
    boardListBottom: '.boardlist.bottom',
    styleSheet: '#stylesheet',
    psa:       '.blotter',
    nav: {
      prev: '.pages > form > [value=Previous]',
      next: '.pages > form > [value=Next]'
    }
  },

  classes: {
    highlight: 'highlighted'
  },

  xpath: {
    thread:         'div[starts-with(@id,"thread_")]',
    postContainer:  'div[starts-with(@id,"reply_") or starts-with(@id,"thread_")]',
    replyContainer: 'div[starts-with(@id,"reply_")]'
  },

  regexp: {
    quotelink:
      new RegExp(`\
/\
([^/]+)\
/res/\
(\\d+)\
(?:\\.\\w+)?#\
(\\d+)\
$\
`),
    quotelinkHTML:
      /<a [^>]*\bhref="[^"]*\/([^\/]+)\/res\/(\d+)(?:\.\w+)?#(\d+)"/g
  },

  Build: {
    parseJSON(data: any, board: SiteBoardArg) { // loose: data is the raw 4chan API JSON post object (no shared type)
      const o: any = SWYotsuba.Build.parseJSON(data, board); // loose: built post object, accessed via dynamic props
      if (data.ext === 'deleted') {
        delete o.file;
        $.extend(o, {
          files: [],
          fileDeleted: true,
          filesDeleted: [0]
        });
      } else if (o.file) {
        // Yotsuba's parseJSON built o.file using 4chan's flat /board/<tim>.ext +
        // /board/<tim>s.jpg layout. Rebuild it with tinyboard/vichan's layout
        // (files under src/, thumbs under thumb/ as .png) so synthesized URLs
        // (e.g. Thread Watcher thumbnails) resolve instead of 404ing.
        o.file = this.parseJSONFile(data, board);
        o.files = [o.file];
      }
      if (data.extra_files) {
        let file;
        for (let i = 0; i < data.extra_files.length; i++) {
          var extra_file = data.extra_files[i];
          if (extra_file.ext === 'deleted') {
            o.filesDeleted.push(i);
          } else {
            file = SWYotsuba.Build.parseJSONFile(data, board);
            o.files.push(file);
          }
        }
        if (o.files.length) {
          o.file = o.files[0];
        }
      }
      return o;
    },

    parseJSONFile(data: any, board: SiteBoardArg) { // loose: data is the raw 4chan API JSON post object (no shared type)
      const o = SWYotsuba.Build.parseJSONFile(data, board);
      const {siteID, boardID} = board;
      // Vichan/tinyboard JSON only exposes the source `ext`; thumbnails live in a
      // thumb/ subfolder and are regenerated as .png by default. Allow per-site
      // override via siteProperties.thumbExt for instances that keep jpg thumbs.
      const thumbExt = Conf['siteProperties'][siteID]?.thumbExt || '.png';
      o.url = SWTinyboard.urls.file({siteID, boardID}, `src/${data.tim}${data.ext}`);
      o.thumbURL = SWTinyboard.urls.thumb({siteID, boardID}, `thumb/${data.tim}${thumbExt}`);
      return o;
    },

    parseComment(html: string) {
      html = html
        .replace(/<br\b[^<]*>/gi, '\n')
        .replace(/<[^>]*>/g, '');
      return $.unescape(html);
    }
  },

  bgColoredEl() {
    return $.el('div', {className: 'post reply'});
  },

  isFileURL(url: URL | Location) {
    return /\/src\/[^\/]+/.test(url.pathname);
  },

  preParsingFixes(board: HTMLElement) {
    // fixes effects of unclosed link in announcement
    let broken;
    if (broken = $('a > input[name="board"]', board)) {
      return $.before(broken.parentNode, broken);
    }
  },

  parseNodes(post: Post, nodes: any) { // loose: nodes is the DOM-node bag (.uniqueID/.nameBlock/.info), not a shared type
    // Add vichan's span.poster_id around the ID if not already present.
    let m;
    if (nodes.uniqueID) { return; }
    let text = '';
    let node = nodes.nameBlock.nextSibling;
    while (node && (node.nodeType === 3)) {
      text += node.textContent;
      node = node.nextSibling;
    }
    if (m = text.match(/(\s*ID:\s*)(\S+)/)) {
      let uniqueID;
      nodes.info.normalize();
      let {nextSibling} = nodes.nameBlock;
      nextSibling = nextSibling.splitText(m[1].length);
      nextSibling.splitText(m[2].length);
      nodes.uniqueID = (uniqueID = $.el('span', {className: 'poster_id'}));
      $.replace(nextSibling, uniqueID);
      return $.add(uniqueID, nextSibling);
    }
  },

  parseDate(node: HTMLElement) {
    let date = Date.parse(node.getAttribute('datetime')?.trim() as string);
    if (!isNaN(date)) { return new Date(date); }
    date = Date.parse((node.textContent as string).trim() + ' UTC'); // e.g. onesixtwo.club
    if (!isNaN(date)) { return new Date(date); }
    return undefined;
  },

  parseFile(post: Post, file: any) { // loose: file is the in-progress DOM file bag (.text/.link/.thumb nodes), not the finished File interface
    let info, infoNode;
    const {text, link, thumb} = file;
    if ($.x(`ancestor::${this.xpath.postContainer}[1]`, text) !== post.nodes.root) { return false; } // file belongs to a reply
    if (!(infoNode = link.nextSibling?.textContent.includes('(') ? link.nextSibling : link.nextElementSibling)) { return false; }
    if (!(info = infoNode.textContent.match(/\((.*,\s*)?([\d.]+ ?[KMG]?B).*\)/))) { return false; }
    const nameNode = $('.postfilename', text);
    $.extend(file, {
      name:       nameNode ? (nameNode.title || nameNode.textContent) : link.pathname.match(/[^/]*$/)[0],
      size:       info[2],
      dimensions: info[0].match(/\d+x\d+/)?.[0]
    });
    if (thumb) {
      $.extend(file, {
        thumbURL:  /\/static\//.test(thumb.src) && $.isImage(link.href) ? link.href : thumb.src,
        isSpoiler: /^Spoiler/i.test(info[1] || '') || (link.textContent === 'Spoiler Image')
      }
      );
    }
    return true;
  },

  isThumbExpanded(file: any) { // loose: file is the in-progress DOM file bag (.thumb node), not the finished File interface
    // Detect old Tinyboard image expansion that changes src attribute on thumbnail.
    return $.hasClass(file.thumb.parentNode, 'expanded') || (file.thumb.parentNode.dataset.expanded === 'true');
  },

  isLinkified(link: HTMLAnchorElement) {
    return /\bnofollow\b/.test(link.rel);
  },

  catalogPin(threadRoot: HTMLElement) {
    return threadRoot.dataset.sticky = 'true';
  }
};
export default SWTinyboard;
