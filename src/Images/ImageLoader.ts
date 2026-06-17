import Callbacks from "../classes/Callbacks";
import type Post from "../classes/Post";
import Header from "../General/Header";
import { g, Conf, d, doc } from "../globals/globals";
import Icon from "../Icons/icon";
import $ from "../platform/$";

var ImageLoader = {
  // Assigned later; declared so the singleton's type includes them. Loosely typed
  // where a precise type would cascade new errors; tighten during the strict pass.
  prefetchEnabled: false,

  init() {
    if (g.VIEW !== 'index' && g.VIEW !== 'thread' && g.VIEW !== 'archive') { return; }
    const replace = Conf['Replace Thumbnails'] && (
      Conf['Replace JPG'] ||
      Conf['Replace PNG'] ||
      Conf['Replace GIF'] ||
      Conf['Replace WEBM']
    );
    if (!Conf['Image Prefetching'] && !replace) { return; }

    Callbacks.Post.push({
      name: 'Image Replace',
      cb:   this.node
    });

    $.on(d, 'PostsInserted', function() {
      if (ImageLoader.prefetchEnabled || replace) {
        return g.posts!.forEach(ImageLoader.prefetchAll);
      }
    });

    if (Conf['Replace Thumbnails'] && Conf['Replace WEBM']) {
      $.on(d, 'scroll visibilitychange 4chanXInitFinished PostsInserted', this.playVideos);
    }

    if (!Conf['Image Prefetching'] || (g.VIEW !== 'index' && g.VIEW !== 'thread')) { return; }

    const el = $.el('a', {
      href: 'javascript:;',
      title: 'Prefetch Images',
      className: 'disabled',
    });
    Icon.set(el, 'bolt', 'Prefetch')

    $.on(el, 'click', this.toggle);

    return Header.addShortcut('prefetch', el, 525);
  },

  node(this: Post) {
    if (this.isClone) { return; }
    for (var file of this.files) {
      if (Conf['Replace Thumbnails'] && Conf['Replace WEBM'] && file.isVideo) { ImageLoader.replaceVideo(this, file); }
      ImageLoader.prefetch(this, file);
    }
  },

  replaceVideo(post: Post, file: any) { // loose: File interface omits .src/.alt on thumb; tighten in strict pass
    const {thumb} = file;
    const video = $.el('video', {
      preload:     'none',
      loop:        true,
      muted:       true,
      poster:      thumb.src || thumb.dataset.src,
      textContent: thumb.alt,
      className:   thumb.className
    }
    );
    video.setAttribute('muted', 'muted');
    video.dataset.md5 = thumb.dataset.md5;
    for (var attr of ['height', 'width', 'maxHeight', 'maxWidth'] as const) { video.style[attr] = thumb.style[attr]; }
    video.src         = file.url;
    $.replace(thumb, video);
    file.thumb      = video;
    return file.videoThumb = true;
  },

  prefetch(post: Post, file: any) { // loose: File interface omits .isPrefetched/.preload; tighten in strict pass
    let clone, type;
    const {isImage, isVideo, thumb, url} = file;
    if (file.isPrefetched || !(isImage || isVideo) || post.isHidden || post.thread.isHidden) { return; }
    if (isVideo) {
      type = 'WEBM';
    } else {
      type = url.match(/\.([^.]+)$/)?.[1].toUpperCase();
      if (type === 'JPEG') { type = 'JPG'; }
    }
    const replace = Conf['Replace Thumbnails'] && Conf[`Replace ${type}`] && !/spoiler/.test(thumb.src || thumb.dataset.src);
    if (!replace && !ImageLoader.prefetchEnabled) { return; }
    if ($.hasClass(doc, 'catalog-mode')) { return; }
    if (![post, ...post.clones].some(clone => doc.contains(clone.nodes.root))) { return; }
    file.isPrefetched = true;
    if (file.videoThumb) {
      for (clone of post.clones) { (clone.file.thumb as HTMLVideoElement).preload = 'auto'; }
      thumb.preload = 'auto';
      // XXX Cloned video elements with poster in Firefox cause momentary display of image loading icon.
      if ($.engine === 'gecko') {
        $.on(thumb, 'loadeddata', function(this: HTMLElement) { return this.removeAttribute('poster'); });
      }
      return;
    }

    const el = $.el(isImage ? 'img' : 'video');
    if (isVideo) { (el as HTMLVideoElement).preload = 'auto'; }
    if (replace && isImage) {
      $.on(el, 'load', function() {
        for (clone of post.clones) { (clone.file.thumb as HTMLImageElement).src = url; }
        return thumb.src = url;
      });
    }
    return el.src = url;
  },

  prefetchAll(post: Post) {
    for (var file of post.files) {
      ImageLoader.prefetch(post, file);
    }
  },

  toggle(this: HTMLElement) {
    ImageLoader.prefetchEnabled = !ImageLoader.prefetchEnabled;
    this.classList.toggle('disabled', !ImageLoader.prefetchEnabled);
    if (ImageLoader.prefetchEnabled) {
      g.posts!.forEach(ImageLoader.prefetchAll);
    }
  },

  playVideos() {
    // Special case: Quote previews are off screen when inserted into document, but quickly moved on screen.
    const qpClone = $.id('qp')?.firstElementChild;
    return g.posts!.forEach(function(post) {
      for (post of [post, ...post.clones]) {
        for (var file of post.files) {
          if (file.videoThumb) {
            var {thumb} = file;
            if (Header.isNodeVisible(thumb) || (post.nodes.root === qpClone)) { (thumb as HTMLVideoElement).play(); } else { (thumb as HTMLVideoElement).pause(); }
          }
        }
      }
    });
  }
};
export default ImageLoader;
