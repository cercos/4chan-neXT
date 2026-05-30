import Callbacks from '../classes/Callbacks';
import Header from '../General/Header';
import Unread from '../Monitoring/Unread';
import { Conf, d, g } from '../globals/globals';
import $ from '../platform/$';
import { debounce } from '../platform/helpers';
import type Post from '../classes/Post';
import type Thread from '../classes/Thread';

const ScrollMarkers = {
  container: undefined as HTMLElement | undefined,
  thread: undefined as Thread | undefined,
  flashPost: undefined as Post | undefined,
  flashTimer: 0 as ReturnType<typeof setTimeout> | 0,

  init() {
    if (g.VIEW !== 'thread') return;

    ScrollMarkers.container = $.el('div', { id: 'scroll-markers' });
    ScrollMarkers.container.hidden = true;

    for (const key of [
      'Scrollbar Markers',
      'Scrollbar Mark Own Posts',
      'Scrollbar Mark Quotes You',
      'Scrollbar Mark Ghost Posts',
      'Scrollbar Mark Unread Line',
      'Unread Line',
    ] as const) {
      $.sync(key, (val: boolean) => {
        Conf[key] = val;
        ScrollMarkers.refreshDeferred();
      });
    }

    Callbacks.Thread.push({
      name: 'Scroll Markers',
      cb: ScrollMarkers.node,
    });
  },

  node(this: Thread) {
    ScrollMarkers.thread = this;
    if (!ScrollMarkers.container) return;
    $.add(d.body, ScrollMarkers.container);
    ScrollMarkers.container.hidden = false;

    $.on(d, '4chanXInitFinished', ScrollMarkers.refreshDeferred);
    $.on(d, 'PostsInserted', ScrollMarkers.refreshDeferred);
    $.on(d, 'ThreadUpdate', ScrollMarkers.refreshDeferred);
    $.on(d, 'RefreshScrollMarkers', ScrollMarkers.refreshDeferred);
    $.on(window, 'resize', ScrollMarkers.refreshDeferred);
    $.on(window, 'load', ScrollMarkers.refreshDeferred);

    ScrollMarkers.refreshDeferred();
  },

  refreshDeferred: debounce(150, () => ScrollMarkers.refresh(), false),

  refresh() {
    const container = ScrollMarkers.container;
    if (!ScrollMarkers.thread || !container?.parentNode) return;
    if (!Conf['Scrollbar Markers']) {
      container.textContent = '';
      container.hidden = true;
      return;
    }
    container.hidden = false;

    const docHeight =
      d.documentElement.scrollHeight || d.body.scrollHeight || 0;
    if (!(docHeight > 0)) return;

    const frag = $.frag();
    const showOwn = Conf['Scrollbar Mark Own Posts'];
    const showYou = Conf['Scrollbar Mark Quotes You'];
    const showGhost = Conf['Scrollbar Mark Ghost Posts'];
    const showUnread = Conf['Unread Line'] && Conf['Scrollbar Mark Unread Line'];

    ScrollMarkers.thread.posts.forEach((post: Post) => {
      if (post.isHidden || post.isClone || post.isFetchedQuote) return;
      const root = post.nodes.root as HTMLElement;
      if (!root || root.offsetParent == null || !root.getClientRects().length) return;

      const isOwn = showOwn && root.classList.contains('yourPost');
      const isYou = showYou && root.classList.contains('quotesYou');
      const isGhost = showGhost && root.classList.contains('from-archive');
      if (!isOwn && !isYou && !isGhost) return;

      const rect = root.getBoundingClientRect();
      const topInDoc = rect.top + window.scrollY;
      const topPct = (topInDoc / docHeight) * 100;
      const heightPct = Math.max((rect.height / docHeight) * 100, 0.15);

      const make = (cls: string) => {
        const marker = $.el('div', {
          className: `scroll-marker ${cls}`,
        });
        marker.style.cssText = `top:${topPct}%;height:${heightPct}%`;
        ScrollMarkers.bind(marker, post);
        $.add(frag, marker);
      };

      if (isOwn) make('scroll-marker-own');
      if (isYou) make('scroll-marker-you');
      if (isGhost) make('scroll-marker-ghost');
    });

    if (showUnread && Unread?.hr?.isConnected && !Unread.hr.hidden) {
      const rect = Unread.hr.getBoundingClientRect();
      const topInDoc = rect.top + window.scrollY;
      const topPct = (topInDoc / docHeight) * 100;
      const marker = $.el('div', {
        className: 'scroll-marker scroll-marker-unread',
        title: 'Unread line',
      });
      marker.style.cssText = `top:${topPct}%;height:2px`;
      $.add(frag, marker);
    }

    container.textContent = '';
    $.add(container, frag);
  },

  bind(marker: HTMLElement, post: Post) {
    marker.title = `Post No.${post.ID}`;
    $.on(marker, 'mouseenter', () => ScrollMarkers.highlightPost(post));
    $.on(marker, 'mouseleave', () => ScrollMarkers.unhighlightPost(post));
    $.on(marker, 'click', (e: MouseEvent) => {
      e.preventDefault();
      ScrollMarkers.jumpTo(post);
    });
  },

  highlightPost(post: Post) {
    const root = post?.nodes?.root;
    if (!root?.isConnected) return;
    $.addClass(root, g.SITE.classes.highlight);
  },

  unhighlightPost(post: Post) {
    const root = post?.nodes?.root;
    if (!root) return;
    $.rmClass(root, g.SITE.classes.highlight);
  },

  jumpTo(post: Post) {
    const root = post?.nodes?.root;
    if (!root?.isConnected) return;
    Header.scrollTo(root);
    $.addClass(root, g.SITE.classes.highlight);
    if (ScrollMarkers.flashTimer) clearTimeout(ScrollMarkers.flashTimer);
    ScrollMarkers.flashPost = post;
    ScrollMarkers.flashTimer = setTimeout(() => {
      const r = ScrollMarkers.flashPost?.nodes?.root;
      if (r) $.rmClass(r, g.SITE.classes.highlight);
      ScrollMarkers.flashPost = undefined;
    }, 1500);
  },

  // Back-compat: QuoteYou.js calls ScrollMarkers.markScroll().
  markScroll() {
    ScrollMarkers.refreshDeferred();
  },
};

export default ScrollMarkers;
