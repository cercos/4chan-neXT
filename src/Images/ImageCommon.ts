import Redirect from "../Archive/Redirect";
import Notice from "../classes/Notice";
import { g, Conf, d } from "../globals/globals";
import $ from "../platform/$";
import CrossOrigin from "../platform/CrossOrigin";
import ImageHost from "./ImageHost";
import Volume from "./Volume";
import type Post from "../classes/Post";

var ImageCommon = {
  // Assigned later; declared so the singleton's type includes them. Loosely typed
  // (read across modules) where a precise type would cascade new errors.
  cache: null as any,

  // Pause and mute video in preparation for removing the element from the document.
  pause(video: HTMLVideoElement) {
    if (video.nodeName !== 'VIDEO') { return; }
    video.pause();
    $.off(video, 'volumechange', Volume.change);
    return video.muted = true;
  },

  rewind(el: HTMLElement) {
    if (el.nodeName === 'VIDEO') {
      const video = el as HTMLVideoElement;
      if (video.readyState >= video.HAVE_METADATA) { return video.currentTime = 0; }
    } else if (/\.gif$/.test((el as HTMLImageElement).src)) {
      const img = el as HTMLImageElement;
      return $.queueTask(() => img.src = img.src);
    }
  },

  pushCache(el: HTMLElement) {
    ImageCommon.cache = el;
    return $.on(el, 'error', ImageCommon.cacheError);
  },

  popCache() {
    const el = ImageCommon.cache;
    $.off(el, 'error', ImageCommon.cacheError);
    delete ImageCommon.cache;
    return el;
  },

  cacheError() {
    if (ImageCommon.cache === this) { return delete ImageCommon.cache; }
  },

  decodeError(file: any, fileObj: any) { // loose: file is media el, fileObj is domain File object — precise types cascade
    let message;
    if (file.error?.code !== MediaError.MEDIA_ERR_DECODE) { return false; }
    if (!(message = $('.warning', fileObj.thumb.parentNode))) {
      message = $.el('div', {className:   'warning'});
      $.after(fileObj.thumb, message);
    }
    message.textContent = 'Error: Corrupt or unplayable video';
    return true;
  },

  isFromArchive(file: { src: string }) {
    return (g.SITE!.software === 'yotsuba') && !ImageHost.test(file.src.split('/')[2]);
  },

  error(file: { src: string }, post: Post, fileObj: any, delay: number | null, cb: (url: string | null | undefined) => void) { // loose: fileObj is domain File object — precise type cascades
    let timeoutID: ReturnType<typeof setTimeout> | undefined;
    const src = fileObj.url.split('/');
    let url: string | null = null;
    if ((g.SITE!.software === 'yotsuba') && Conf['404 Redirect']) {
      url = Redirect.to('file', {
        boardID:  post.board.ID,
        filename: src[src.length - 1]
      } as any);
    }
    if (!url || !Redirect.securityCheck(url)) { url = null; }

    if ((post.isDead || fileObj.isDead) && !ImageCommon.isFromArchive(file)) { return cb(url); }

    if (delay != null) { timeoutID = setTimeout((() => cb(url)), delay); }
    if (post.isDead || fileObj.isDead) { return; }
    const redirect = function() {
      if (!ImageCommon.isFromArchive(file)) {
        if (delay != null) { clearTimeout(timeoutID); }
        return cb(url);
      }
    };

    const threadJSON = g.SITE!.urls.threadJSON?.(post);
    if (!threadJSON) { return; }
    var parseJSON = function(this: XMLHttpRequest, isArchiveURL?: boolean) {
      let needle, postObj;
      if (this.status === 404) {
        let archivedThreadJSON;
        if (!isArchiveURL && (archivedThreadJSON = g.SITE!.urls.archivedThreadJSON?.(post))) {
          $.ajax(archivedThreadJSON, {onloadend() { return parseJSON.call(this, true); }});
        } else {
          post.kill(!post.isClone, fileObj.index);
        }
      }
      if (this.status !== 200) { return redirect(); }
      for (postObj of this.response.posts) {
        if (postObj.no === post.ID) { break; }
      }
      if (postObj.no !== post.ID) {
        post.kill();
        return redirect();
      } else if ((needle = fileObj.docIndex, g.SITE!.Build.parseJSON(postObj, post.board).filesDeleted.includes(needle))) {
        post.kill(true);
        return redirect();
      } else {
        return url = fileObj.url;
      }
    };
    return $.ajax(threadJSON, {onloadend() { return parseJSON.call(this, undefined); }});
  },

  // XXX Estimate whether clicks are on the video controls and should be ignored.
  onControls(e: MouseEvent) {
    const target = e.target as any; // loose: target is a video/control element; precise narrowing isn't available here
    return (Conf['Show Controls'] && Conf['Click Passthrough'] && (target.nodeName === 'VIDEO')) ||
      (target.controls && ((target.getBoundingClientRect().bottom - e.clientY) < 35));
  },

  download(this: HTMLAnchorElement, e: Event) {
    if (this.protocol === 'blob:') { return true; }
    e.preventDefault();
    const {href, download} = this;
    return CrossOrigin.file(href, function(blob) {
      if (blob) {
        const a = $.el('a', {
          href: URL.createObjectURL(blob),
          download,
          hidden: true
        }
        );
        $.add(d.body, a);
        a.click();
        return $.rm(a);
      } else {
        return new Notice('warning', `Could not download ${href}`, 20);
      }
    });
  }
};
export default ImageCommon;
