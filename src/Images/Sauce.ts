import Callbacks from "../classes/Callbacks";
import type Post from "../classes/Post";
import type { File } from "../classes/Post";
import Notice from "../classes/Notice";
import Filter from "../Filtering/Filter";
import { g, Conf, doc } from "../globals/globals";
import $ from "../platform/$";
import { dict } from "../platform/helpers";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
var Sauce = {
  // Assigned later; declared so the singleton's type includes them. Loosely typed
  // (read across modules) where a precise type would cascade new errors.
  link: null as any,
  links: null as any,

  init() {
    let link;
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread') || !Conf['Sauce']) { return; }
    $.addClass(doc, 'show-sauce');

    const links: any[] = [];
    for (link of Conf['sauces'].split('\n')) {
      var linkData;
      if ((link[0] !== '#') && (linkData = this.parseLink(link))) {
        links.push(linkData);
      }
    }
    if (!links.length) { return; }

    this.links = links;
    this.link  = $.el('a', {
      target:    '_blank',
      className: 'sauce'
    }
    );
    return Callbacks.Post.push({
      name: 'Sauce',
      cb:   this.node
    });
  },

  parseLink(link: string) {
    if (!(link = link.trim())) { return null; }
    const parts = dict();
    const iterable = link.split(/;(?=(?:text|boards|types|regexp|sandbox):?)/);
    for (let i = 0; i < iterable.length; i++) {
      var part = iterable[i];
      if (i === 0) {
        parts['url'] = part;
      } else {
        var m = part.match(/^(\w*):?(.*)$/);
        parts[m![1]!] = m![2];
      }
    }
    if (!parts['text']) { parts['text'] = parts['url'].match(/(\w+)\.\w+\//)?.[1] || '?'; }
    // Normalize legacy default trace.moe label.
    if ((parts['text'] || '').trim().toLowerCase() === 'wait' && /(?:^|\/\/)trace\.moe\//i.test(parts['url'] || '')) {
      parts['text'] = 'trace';
    }
    if ('boards' in parts) {
      parts['boards'] = Filter.parseBoards(parts['boards']);
    }
    if ('regexp' in parts) {
      try {
        let regexp;
        if (regexp = parts['regexp'].match(/^\/(.*)\/(\w*)$/)) {
          parts['regexp'] = RegExp(regexp[1], regexp[2]);
        } else {
          parts['regexp'] = RegExp(parts['regexp']);
        }
      } catch (err) {
        new Notice('warning', [
          $.tn("Invalid regexp for Sauce link:"),
          $.el('br'),
          $.tn(link),
          $.el('br'),
          $.tn(err instanceof Error ? err.message : String(err))
        ], 60);
        return null;
      }
    }
    return parts;
  },

  createSauceLink(link: any, post: Post, file: File) { // loose: link is a parseLink() parts dict()
    let a, needle;
    let matches: RegExpMatchArray | null = null;
    const ext = file.url.match(/[^.]*$/)![0];
    const parts = dict();
    $.extend(parts, link);

    if (!!parts['boards'] && !parts['boards'][`${post.siteID}/${post.boardID}`] && !parts['boards'][`${post.siteID}/*`]) { return null; }
    if (!!parts['types']  && (needle = ext, !parts['types'].split(',').includes(needle))) { return null; }
    if (!!parts['regexp'] && (!(matches = file.name.match(parts['regexp'])))) { return null; }

    const missing: string[] = [];
    for (var key of ['url', 'text']) {
      parts[key] = parts[key].replace(/%(T?URL|IMG|[sh]?MD5|board|name|%|semi|\$\d+)/g, function(orig: string, parameter: string) {
        let type;
        if (parameter[0] === '$') {
          if (!matches) { return orig; }
          type = matches[Number(parameter.slice(1))] || '';
        } else {
          type = Sauce.formatters[parameter as keyof typeof Sauce.formatters](post, file, ext);
          if ((type == null)) {
            missing.push(parameter);
            return '';
          }
        }

        if ((key === 'url') && !['%', 'semi'].includes(parameter)) {
          if (/^javascript:/i.test(parts['url'])) { type = JSON.stringify(type); }
          type = encodeURIComponent(type);
        }
        return type;
      });
    }

    if (g.SITE!.areMD5sDeferred?.(post.board) && missing.length && !missing.filter(x => !/^.?MD5$/.test(x)).length) {
      a = Sauce.link.cloneNode(false);
      a.dataset.skip = '1';
      return a;
    }

    if (missing.length) { return null; }

    a = Sauce.link.cloneNode(false);
    a.href = parts['url'];
    a.textContent = parts['text'];
    if (/^javascript:/i.test(parts['url'])) { a.removeAttribute('target'); }
    return a;
  },

  node(this: Post) {
    if (this.isClone) { return; }
    for (var file of this.files) {
      Sauce.file(this, file);
    }
  },

  file(post: Post, file: File) {
    let link, node;
    const nodes: any[] = [];
    const skipped: any[] = [];
    for (link of Sauce.links) {
      if (node = Sauce.createSauceLink(link, post, file)) {
        nodes.push($.tn(' '), node);
        if (node.dataset.skip) { skipped.push([link, node]); }
      }
    }
    if (!nodes.length) { return; }
    const container = $.el('span', {className: 'sauce-container'});
    $.add(container, nodes);
    $.add(file.text, container);

    if (skipped.length) {
      var observer = new MutationObserver(function() {
        if ((file.text as unknown as HTMLElement).dataset.md5) { // file.text holds the file-container HTMLElement at runtime; Post.File.text is declared string
          for ([link, node] of skipped) {
            var node2;
            if (node2 = Sauce.createSauceLink(link, post, file)) {
              $.replace(node, node2);
            }
          }
          return observer.disconnect();
        }
      });
      return observer.observe(file.text as unknown as HTMLElement, {attributes: true}); // file.text holds the file-container HTMLElement at runtime; Post.File.text is declared string
    }
  },

  formatters: {
    TURL(post: Post, file: File) { return file.thumbURL; },
    URL(post: Post, file: File) { return file.url; },
    IMG(post: Post, file: File, ext: string) { if (['gif', 'jpg', 'jpeg', 'png'].includes(ext)) { return file.url; } else { return file.thumbURL; } },
    MD5(post: Post, file: File) { return file.MD5; },
    sMD5(post: Post, file: File) { return file.MD5?.replace(/[+/=]/g, (c: string) => ({'+': '-', '/': '_', '=': ''})[c as '+' | '/' | '=']); },
    hMD5(post: Post, file: File) {
      if (file.MD5) {
        return Array.from(atob(file.MD5), c => c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
      }
    },
    board(post: Post) { return post.board.ID; },
    name(post: Post, file: File) { return file.name; },
    '%'() { return '%'; },
    semi() { return ';'; }
  }
};
export default Sauce;
