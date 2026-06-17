import Callbacks from "../classes/Callbacks";
import type Post from "../classes/Post";
// #region tests_enabled
import Test from "../General/Test";
// #endregion
import { g, Conf } from "../globals/globals";
import ImageHost from "../Images/ImageHost";
import ExpandComment from "../Miscellaneous/ExpandComment";
import $ from "../platform/$";
import $$ from "../platform/$$";
import Embedding from "./Embedding";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
var Linkify = {
  init() {
    if (g.VIEW !== 'index' && g.VIEW !== 'thread' && g.VIEW !== 'archive') { return; }

    // Live-toggle: re-sweep page when the user flips the setting in Settings.
    $.sync('Convert X to xcancel', enabled => {
      Conf['Convert X to xcancel'] = enabled;
      Linkify.refreshFrontEndRewrites();
    });

    $.sync('Convert YouTube to yewtu.be', enabled => {
      Conf['Convert YouTube to yewtu.be'] = enabled;
      Linkify.refreshFrontEndRewrites();
    });

    const shouldLinkify = Conf['Linkify'];
    const shouldRewriteX = Conf['Convert X to xcancel'];
    const shouldRewriteYouTube = Conf['Convert YouTube to yewtu.be'];
    if (!shouldLinkify && !shouldRewriteX && !shouldRewriteYouTube) { return; }

    if (shouldLinkify && Conf['Comment Expansion']) {
      ExpandComment.callbacks.push(this.node);
    }

    Callbacks.Post.push({
      name: 'Linkify',
      cb:   this.node
    });

    if (shouldLinkify) {
      return Embedding.init();
    }
  },

  refreshFrontEndRewrites() {
    const shouldRewriteX = Conf['Convert X to xcancel'];
    const shouldRewriteYouTube = Conf['Convert YouTube to yewtu.be'];
    if (shouldRewriteX || shouldRewriteYouTube) {
      // Apply rewrite to every <a> in post comments currently on the page.
      const selector = g.SITE?.selectors?.comment;
      if (!selector) { return; }
      for (const comment of $$(selector)) {
        for (const link of $$('a', comment)) {
          if (shouldRewriteX) {
            Linkify.rewriteXLink(link);
          } else if (link.dataset.xcancelOrigHref) {
            link.href = link.dataset.xcancelOrigHref;
            if (link.dataset.xcancelOrigText != null && link.children.length === 0) {
              link.textContent = link.dataset.xcancelOrigText;
            }
            delete link.dataset.xcancelOrigHref;
            delete link.dataset.xcancelOrigText;
          }

          if (shouldRewriteYouTube) {
            Linkify.rewriteYouTubeLink(link);
          } else if (link.dataset.yewtuOrigHref) {
            link.href = link.dataset.yewtuOrigHref;
            if (link.dataset.yewtuOrigText != null && link.children.length === 0) {
              link.textContent = link.dataset.yewtuOrigText;
            }
            delete link.dataset.yewtuOrigHref;
            delete link.dataset.yewtuOrigText;
          }
        }
      }
      return;
    }

    // Revert links we previously rewrote.
    for (const link of $$('a[data-xcancel-orig-href]')) {
      link.href = link.dataset.xcancelOrigHref;
      if (link.dataset.xcancelOrigText != null && link.children.length === 0) {
        link.textContent = link.dataset.xcancelOrigText;
      }
      delete link.dataset.xcancelOrigHref;
      delete link.dataset.xcancelOrigText;
    }
    for (const link of $$('a[data-yewtu-orig-href]')) {
      link.href = link.dataset.yewtuOrigHref;
      if (link.dataset.yewtuOrigText != null && link.children.length === 0) {
        link.textContent = link.dataset.yewtuOrigText;
      }
      delete link.dataset.yewtuOrigHref;
      delete link.dataset.yewtuOrigText;
    }
  },

  node(this: Post) {
    let link;
    if (this.isClone) { return Embedding.events(this); }
    if (!Linkify.regString.test(this.info.comment)) {
      if (Conf['Convert X to xcancel'] || Conf['Convert YouTube to yewtu.be']) {
        for (link of $$('a', this.nodes.comment)) {
          if (Conf['Convert X to xcancel']) { Linkify.rewriteXLink(link); }
          if (Conf['Convert YouTube to yewtu.be']) { Linkify.rewriteYouTubeLink(link); }
        }
      }
      return;
    }
    for (link of $$('a', this.nodes.comment)) {
      if (Conf['Convert X to xcancel']) { Linkify.rewriteXLink(link); }
      if (Conf['Convert YouTube to yewtu.be']) { Linkify.rewriteYouTubeLink(link); }
      if (g.SITE?.isLinkified?.(link)) {
        $.addClass(link, 'linkify');
        if ((ImageHost as any).useFaster) { ImageHost.fixLinks([link]); }
        Embedding.process(link, this);
      }
    }
    const links = Linkify.process(this.nodes.comment);
    if ((ImageHost as any).useFaster) { ImageHost.fixLinks(links); }
    for (link of links) { Embedding.process(link, this); }
  },

  process(node: Node) {
    let length;
    const test     = /[^\s"]+/g;
    const space    = /[\s"]/;
    const snapshot = $.X('.//br|.//text()', node);
    let i = 0;
    const links: any[] = [];
    while ((node = snapshot.snapshotItem(i++))) {
      var result;
      var {data} = (node as Text);
      if (!data || (node.parentElement!.nodeName === "A")) { continue; }

      while ((result = test.exec(data))) {
        var {index} = result;
        var endNode = node;
        var word    = result[0];
        // End of node, not necessarily end of space-delimited string
        if ((length = index + word.length) === data.length) {
          var saved;
          test.lastIndex = 0;

          while (saved = snapshot.snapshotItem(i++)) {
            var end;
            if ((saved.nodeName === 'BR') || ((saved.parentElement.nodeName === 'P') && !saved.previousSibling)) {
              var part1, part2;
              if (
                // link deliberately split
                (part1 = word.match(/(https?:\/\/)?([a-z\d-]+\.)*[a-z\d-]+$/i)) &&
                (part2 = snapshot.snapshotItem(i)?.data?.match(/^(\.[a-z\d-]+)*\//i)) &&
                ((part1[0] + part2[0]).search(Linkify.regString) === 0)
              ) {
                continue;
              } else {
                break;
              }
            }

            if ((saved.parentElement.nodeName === "A") && !Linkify.regString.test(word)) {
              break;
            }

            endNode  = saved;
            ({data}   = saved);

            if (end = space.exec(data)) {
              // Set our snapshot and regex to start on this node at this position when the loop resumes
              word += data.slice(0, end.index);
              test.lastIndex = (length = end.index);
              i--;
              break;
            } else {
              ({length} = data);
              word    += data;
            }
          }
        }

        if (Linkify.regString.test(word)) {
          links.push(Linkify.makeRange(node, endNode, index, length));

          // #region tests_enabled
          if (links.length) {
            Test.assert(() => word === links[links.length - 1]?.toString());
          }
          // #endregion
        }

        if (!test.lastIndex || (node !== endNode)) { break; }
      }
    }

    i = links.length;
    while (i--) {
      links[i] = Linkify.makeLink(links[i]);
    }
    return links;
  },

  regString: new RegExp(`(\
\
(https?|mailto|git|magnet|ftp|irc):(\
[a-z\\d%/?]\
)\
|\
([-a-z\\d]+[.])+(\
aero|asia|biz|cat|com|coop|dance|info|int|jobs|mobi|moe|museum|name|net|org|post|pro|tel|travel|xxx|xyz|edu|gov|mil|[a-z]{2}\
)([:/]|(?![^\\s"]))\
|\
[\\d]{1,3}\\.[\\d]{1,3}\\.[\\d]{1,3}\\.[\\d]{1,3}\
|\
[-\\w\\d.@]+@[a-z\\d.-]+\\.[a-z\\d]\
)`, 'i'),

  makeRange(startNode: Node, endNode: Node, startOffset: number, endOffset: number) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode,   endOffset);
    return range;
  },

  makeLink(range: Range) {
    let t;
    let encodedDomain;
    let text = range.toString();

    // Clean start of range
    let i = text.search(Linkify.regString);

    if (i > 0) {
      text = text.slice(i);
      while ((range.startOffset + i) >= (range.startContainer as Text).data.length) { i--; }

      if (i) { range.setStart(range.startContainer, range.startOffset + i); }
    }

    // Clean end of range
    i = 0;
    while (/[)\]}>.,]/.test(t = text.charAt(text.length - (1 + i)))) {
      if (!/[.,]/.test(t) && !((text.match(/[()\[\]{}<>]/g))!.length % 2)) { break; }
      i++;
    }

    if (i) {
      text = text.slice(0, -i);
      while ((range.endOffset - i) < 0) { i--; }

      if (i) {
        range.setEnd(range.endContainer, range.endOffset - i);
      }
    }

    // Make our link 'valid' if it is formatted incorrectly.
    if (!/((mailto|magnet):|.+:\/\/)/.test(text)) {
      text = (
        /@/.test(text) ?
          'mailto:'
        :
          'http://'
      ) + text;
    }

    // Decode percent-encoded characters in domain so that they behave consistently across browsers.
    if (encodedDomain = text.match(/^(https?:\/\/[^/]*%[0-9a-f]{2})(.*)$/i)) {
      text = encodedDomain[1].replace(/%([0-9a-f]{2})/ig, function(x: string, y: string) {
        if (y === '25') { return x; } else { return String.fromCharCode(parseInt(y, 16)); }
      }) + encodedDomain[2];
    }

    const rewrittenHref = Linkify.rewriteURLs(text);
    const a = $.el('a', {
      className: 'linkify',
      rel:       'noreferrer noopener',
      target:    '_blank',
      href:      rewrittenHref
    }
    );

    // Insert the range into the anchor, the anchor into the range's DOM location, and destroy the range.
    $.add(a, range.extractContents());
    range.insertNode(a);

    if (rewrittenHref !== text) {
      if (Conf['Convert X to xcancel'] && Linkify.rewriteXURL(text) !== text) {
        a.dataset.xcancelOrigHref = text;
        if (a.children.length === 0) { a.dataset.xcancelOrigText = a.textContent || ''; }
      } else if (Conf['Convert YouTube to yewtu.be'] && Linkify.rewriteYouTubeURL(text) !== text) {
        a.dataset.yewtuOrigHref = text;
        if (a.children.length === 0) { a.dataset.yewtuOrigText = a.textContent || ''; }
      }
      Linkify.rewriteVisibleText(a);
    }

    return a;
  },

  rewriteXLink(link: HTMLAnchorElement) {
    if (!Conf['Convert X to xcancel']) { return; }
    const oldHref = link.href;
    const newHref = Linkify.rewriteXURL(oldHref);
    if (newHref !== oldHref) {
      if (!link.dataset.xcancelOrigHref) {
        link.dataset.xcancelOrigHref = oldHref;
        if (link.children.length === 0) { link.dataset.xcancelOrigText = link.textContent as string; }
      }
      link.href = newHref;
      Linkify.rewriteVisibleText(link);
    }
  },

  rewriteYouTubeLink(link: HTMLAnchorElement) {
    if (!Conf['Convert YouTube to yewtu.be']) { return; }
    const oldHref = link.href;
    const newHref = Linkify.rewriteYouTubeURL(oldHref);
    if (newHref !== oldHref) {
      if (!link.dataset.yewtuOrigHref) {
        link.dataset.yewtuOrigHref = oldHref;
        if (link.children.length === 0) { link.dataset.yewtuOrigText = link.textContent as string; }
      }
      link.href = newHref;
      Linkify.rewriteVisibleText(link);
    }
  },

  rewriteVisibleText(link: HTMLAnchorElement) {
    // Replace twitter.com / x.com hostnames in the link's visible text with xcancel.com.
    // Replace youtube.com / youtu.be hostnames in the link's visible text with yewtu.be.
    // Only touches text nodes so we don't disturb embed icons or nested markup.
    const replaceX = (s: string) => s.replace(
      /\b((?:www\.|mobile\.)?(?:fx|vx)?twitter\.com|(?:www\.|mobile\.)?(?:fixup|fixv)?x\.com|twittpr\.com)\b/gi,
      'xcancel.com'
    );
    const replaceYouTube = (s: string) => s.replace(
      /\b((?:www\.|m\.|music\.|mobile\.)?(?:youtu\.be|youtube\.com|youtube-nocookie\.com))\b/gi,
      'yewtu.be'
    );
    const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      let updated = node.data;
      if (Conf['Convert X to xcancel']) {
        updated = replaceX(updated);
      }
      if (Conf['Convert YouTube to yewtu.be']) {
        updated = replaceYouTube(updated);
      }
      if (updated !== node.data) { node.data = updated; }
    }
  },

  rewriteXURL(urlString: string) {
    if (!Conf['Convert X to xcancel']) { return urlString; }
    try {
      const base = (typeof location === 'object' && location?.href) ? location.href : undefined;
      const url = base ? new URL(urlString, base) : new URL(urlString);
      if (!/^https?:$/.test(url.protocol)) { return urlString; }

      // Direct links.
      if (/(?:^|\.)twitter\.com$/i.test(url.hostname) || /(?:^|\.)x\.com$/i.test(url.hostname)) {
        url.hostname = 'xcancel.com';
        return url.toString();
      }

      // Wrapped redirect links (e.g. ?url=https://x.com/...).
      const redirectParams = ['url', 'u', 'to', 'target', 'dest', 'destination', 'redirect', 'redir', 'r'];
      for (const key of redirectParams) {
        const value = url.searchParams.get(key);
        if (!value) { continue; }
        const rewritten = Linkify.rewriteXURL(value);
        if (rewritten !== value) {
          url.searchParams.set(key, rewritten);
          return url.toString();
        }
      }
    } catch {}
    return urlString;
  },

  rewriteYouTubeURL(urlString: string) {
    if (!Conf['Convert YouTube to yewtu.be']) { return urlString; }
    try {
      const base = (typeof location === 'object' && location?.href) ? location.href : undefined;
      const url = base ? new URL(urlString, base) : new URL(urlString);
      if (!/^https?:$/.test(url.protocol)) { return urlString; }

      const isYouTube = /(?:^|\.)youtube\.com$/i.test(url.hostname)
        || /(?:^|\.)youtube-nocookie\.com$/i.test(url.hostname)
        || /^(?:www\.)?youtu\.be$/i.test(url.hostname);

      // Direct links.
      if (isYouTube) {
        if (/^(?:www\.)?youtu\.be$/i.test(url.hostname)) {
          const shortId = url.pathname.replace(/^\//, '');
          if (/^[\w-]{11}$/.test(shortId)) {
            if (!url.searchParams.get('v')) {
              url.searchParams.set('v', shortId);
            }
            url.pathname = '/watch';
          }
        }
        url.hostname = 'yewtu.be';
        return url.toString();
      }

      // Wrapped redirect links (e.g. ?url=https://youtube.com/...).
      const redirectParams = ['url', 'u', 'to', 'target', 'dest', 'destination', 'redirect', 'redir', 'r'];
      for (const key of redirectParams) {
        const value = url.searchParams.get(key);
        if (!value) { continue; }
        const rewritten = Linkify.rewriteYouTubeURL(value);
        if (rewritten !== value) {
          url.searchParams.set(key, rewritten);
          return url.toString();
        }
      }
    } catch {}
    return urlString;
  },

  rewriteURLs(urlString: string) {
    const rewrittenX = Linkify.rewriteXURL(urlString);
    return Linkify.rewriteYouTubeURL(rewrittenX);
  }
};
export default Linkify;
