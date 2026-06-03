import Callbacks from '../classes/Callbacks';
import Header from '../General/Header';
import Unread from '../Monitoring/Unread';
import { Conf, d, doc, g } from '../globals/globals';
import $ from '../platform/$';
import { debounce } from '../platform/helpers';
import type Post from '../classes/Post';
import type Thread from '../classes/Thread';

type ScrollMarkerPosition = 'offset' | 'offset-single' | 'over' | 'over-columns';

const ScrollMarkers = {
  container: undefined as HTMLElement | undefined,
  thread: undefined as Thread | undefined,
  flashPost: undefined as Post | undefined,
  flashTimer: 0 as ReturnType<typeof setTimeout> | 0,
  preview: undefined as { el: HTMLElement; post: Post; marker: HTMLElement } | undefined,

  position(): ScrollMarkerPosition {
    const pos = Conf['Scrollbar Marker Position'];
    // Legacy values from prior builds collapsed into the unified Over (single) mode.
    if (pos === 'scrollbar' || pos === 'overlay' || pos === 'over') return 'over';
    if (pos === 'over-columns') return 'over-columns';
    if (pos === 'offset-single') return 'offset-single';
    return 'offset';
  },

  isOverMode(): boolean {
    const pos = ScrollMarkers.position();
    return pos === 'over' || pos === 'over-columns';
  },

  applyPosition() {
    const pos = ScrollMarkers.position();
    $.rmClass(doc,
      'scrollbar-markers-offset',
      'scrollbar-markers-offset-single',
      'scrollbar-markers-over',
      'scrollbar-markers-over-columns',
    );
    $.addClass(doc, `scrollbar-markers-${pos}`);
    ScrollMarkers.updateScrollbarMetrics();
    if (ScrollMarkers.isOverMode()) ScrollMarkers.scrollbar.install();
    else ScrollMarkers.scrollbar.uninstall();
  },

  measureScrollbarWidth() {
    let width = window.innerWidth - d.documentElement.clientWidth;
    if (width > 0) return width;
    const outer = $.el('div', {
      style: 'width:100px;height:100px;overflow:scroll;position:absolute;top:-9999px;visibility:hidden;pointer-events:none',
    });
    const inner = $.el('div', { style: 'width:100%' });
    $.add(outer, inner);
    $.add(d.body, outer);
    width = outer.offsetWidth - inner.offsetWidth;
    $.rm(outer);
    return width;
  },

  updateScrollbarMetrics() {
    const measured = ScrollMarkers.measureScrollbarWidth();
    // In classic-scrollbar browsers (Windows/Linux), the scrollbar lives
    // outside the initial containing block, so `right: 0` on a fixed
    // element already lands at the scrollbar's inner edge — no offset is
    // needed. Overlay scrollbars (Mac) float over content; reserve a small
    // gap there so markers don't sit under the thumb when it appears.
    const offset = measured > 0 ? 0 : 12;
    d.documentElement.style.setProperty('--xt-scrollbar-offset', `${offset}px`);
    d.documentElement.style.setProperty('--xt-scroll-marker-gutter', '6px');
    d.documentElement.style.setProperty('--xt-scroll-marker-track', '14px');
  },

  scrollbar: {
    track: undefined as HTMLElement | undefined,
    thumb: undefined as HTMLElement | undefined,
    rafId: 0,
    dragOffset: 0,
    activePointer: -1,
    onScrollListener: undefined as (() => void) | undefined,

    install() {
      const container = ScrollMarkers.container;
      if (!container || ScrollMarkers.scrollbar.thumb) return;
      const track = $.el('div', { className: 'scroll-marker-track' });
      const thumb = $.el('div', { className: 'scroll-marker-thumb' });
      ScrollMarkers.scrollbar.track = track;
      ScrollMarkers.scrollbar.thumb = thumb;
      $.add(container, track);
      $.add(container, thumb);
      const sched = () => ScrollMarkers.scrollbar.scheduleUpdate();
      ScrollMarkers.scrollbar.onScrollListener = sched;
      $.on(window, 'scroll', sched);
      $.on(window, 'resize', sched);
      $.on(thumb, 'pointerdown', ScrollMarkers.scrollbar.onThumbDown as (e: Event) => void);
      $.on(track, 'pointerdown', ScrollMarkers.scrollbar.onTrackDown as (e: Event) => void);
      ScrollMarkers.scrollbar.update();
    },

    uninstall() {
      const sb = ScrollMarkers.scrollbar;
      if (!sb.thumb) return;
      if (sb.onScrollListener) {
        $.off(window, 'scroll', sb.onScrollListener);
        $.off(window, 'resize', sb.onScrollListener);
        sb.onScrollListener = undefined;
      }
      if (sb.rafId) { cancelAnimationFrame(sb.rafId); sb.rafId = 0; }
      $.rm(sb.thumb);
      if (sb.track) $.rm(sb.track);
      sb.thumb = undefined;
      sb.track = undefined;
    },

    scheduleUpdate() {
      const sb = ScrollMarkers.scrollbar;
      if (sb.rafId) return;
      sb.rafId = requestAnimationFrame(() => {
        sb.rafId = 0;
        sb.update();
      });
    },

    update() {
      const thumb = ScrollMarkers.scrollbar.thumb;
      if (!thumb) return;
      const docHeight = d.documentElement.scrollHeight || d.body.scrollHeight || 0;
      const viewHeight = window.innerHeight;
      if (docHeight <= viewHeight + 1) {
        thumb.hidden = true;
        return;
      }
      thumb.hidden = false;
      const heightPct = Math.max((viewHeight / docHeight) * 100, 3);
      const scrollMax = docHeight - viewHeight;
      const topPct = scrollMax > 0
        ? (window.scrollY / scrollMax) * (100 - heightPct)
        : 0;
      thumb.style.top = `${topPct}%`;
      thumb.style.height = `${heightPct}%`;
    },

    onThumbDown(e: PointerEvent) {
      const sb = ScrollMarkers.scrollbar;
      const thumb = sb.thumb;
      if (!thumb || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = thumb.getBoundingClientRect();
      sb.dragOffset = e.clientY - rect.top;
      sb.activePointer = e.pointerId;
      thumb.classList.add('dragging');
      try { thumb.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      $.on(thumb, 'pointermove', sb.onThumbMove as (e: Event) => void);
      $.on(thumb, 'pointerup', sb.onThumbUp as (e: Event) => void);
      $.on(thumb, 'pointercancel', sb.onThumbUp as (e: Event) => void);
    },

    // Begin a thumb drag from a pointer that started somewhere else
    // (e.g. on a marker overlapping the thumb). Snaps the thumb under
    // the pointer first, then continues normal drag handling.
    startDragFromPointer(e: PointerEvent) {
      const sb = ScrollMarkers.scrollbar;
      const thumb = sb.thumb;
      const container = ScrollMarkers.container;
      if (!thumb || !container) return;
      const trackRect = container.getBoundingClientRect();
      const thumbHeight = thumb.offsetHeight;
      const range = trackRect.height - thumbHeight;
      if (range > 0) {
        const desiredTop = e.clientY - trackRect.top - thumbHeight / 2;
        const clampedTop = Math.max(0, Math.min(desiredTop, range));
        const scrollMax = (d.documentElement.scrollHeight || d.body.scrollHeight || 0) - window.innerHeight;
        window.scrollTo(0, (clampedTop / range) * scrollMax);
      }
      sb.dragOffset = thumbHeight / 2;
      sb.activePointer = e.pointerId;
      thumb.classList.add('dragging');
      try { thumb.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      $.on(thumb, 'pointermove', sb.onThumbMove as (e: Event) => void);
      $.on(thumb, 'pointerup', sb.onThumbUp as (e: Event) => void);
      $.on(thumb, 'pointercancel', sb.onThumbUp as (e: Event) => void);
    },

    onThumbMove(e: PointerEvent) {
      const sb = ScrollMarkers.scrollbar;
      const container = ScrollMarkers.container;
      const thumb = sb.thumb;
      if (!container || !thumb || e.pointerId !== sb.activePointer) return;
      const trackRect = container.getBoundingClientRect();
      const trackHeight = trackRect.height;
      const thumbHeight = thumb.offsetHeight;
      const range = trackHeight - thumbHeight;
      if (range <= 0) return;
      const desiredTop = e.clientY - trackRect.top - sb.dragOffset;
      const clampedTop = Math.max(0, Math.min(desiredTop, range));
      const scrollMax = (d.documentElement.scrollHeight || d.body.scrollHeight || 0) - window.innerHeight;
      window.scrollTo(0, (clampedTop / range) * scrollMax);
    },

    onThumbUp(e: PointerEvent) {
      const sb = ScrollMarkers.scrollbar;
      const thumb = sb.thumb;
      if (!thumb || e.pointerId !== sb.activePointer) return;
      sb.activePointer = -1;
      thumb.classList.remove('dragging');
      try { thumb.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      $.off(thumb, 'pointermove', sb.onThumbMove as (e: Event) => void);
      $.off(thumb, 'pointerup', sb.onThumbUp as (e: Event) => void);
      $.off(thumb, 'pointercancel', sb.onThumbUp as (e: Event) => void);
    },

    onTrackDown(e: PointerEvent) {
      const sb = ScrollMarkers.scrollbar;
      const track = sb.track;
      const thumb = sb.thumb;
      if (!track || !thumb || e.target !== track || e.button !== 0) return;
      e.preventDefault();
      const thumbRect = thumb.getBoundingClientRect();
      const direction = e.clientY < thumbRect.top ? -1 : 1;
      window.scrollBy({ top: direction * window.innerHeight * 0.9, behavior: 'smooth' });
    },
  },

  menu: {
    entry: undefined as { el: HTMLElement; order: number; open: () => boolean; subEntries: { el: HTMLElement }[] } | undefined,

    init() {
      if (!['thread', 'index'].includes(g.VIEW)) return;
      const el = $.el('span', { textContent: 'Scroll markers' });
      const entry = {
        el,
        order: 112,
        subEntries: [] as { el: HTMLElement }[],
        open() {
          entry.subEntries = ScrollMarkers.menu.buildSubEntries();
          return true;
        },
      };
      ScrollMarkers.menu.entry = entry;
      Header.menu.addEntry(entry);
    },

    buildSubEntries() {
      const options: Array<[ScrollMarkerPosition, string]> = [
        ['offset', 'Beside scrollbar (columns)'],
        ['offset-single', 'Beside scrollbar (single)'],
        ['over-columns', 'Over scrollbar (columns)'],
        ['over', 'Over scrollbar (single)'],
      ];
      const current = ScrollMarkers.position();
      return options.map(([value, label]) => {
        const a = $.el('a', {
          href: 'javascript:;',
          textContent: `${current === value ? '✓ ' : '  '}${label}`,
          className: 'entry scroll-marker-position-option',
        });
        $.on(a, 'click', (e: Event) => {
          e.preventDefault();
          Conf['Scrollbar Marker Position'] = value;
          $.set('Scrollbar Marker Position', value);
          ScrollMarkers.applyPosition();
          ScrollMarkers.refreshDeferred();
          $.event('CloseMenu');
        });
        return { el: a };
      });
    },
  },

  init() {
    ScrollMarkers.menu.init();
    if (g.VIEW !== 'thread') return;

    ScrollMarkers.container = $.el('div', { id: 'scroll-markers' });
    ScrollMarkers.container.hidden = true;
    ScrollMarkers.applyPosition();

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
    $.sync('Scrollbar Marker Position', (val: string) => {
      Conf['Scrollbar Marker Position'] = val;
      ScrollMarkers.applyPosition();
      ScrollMarkers.refreshDeferred();
    });

    Callbacks.Thread.push({
      name: 'Scroll Markers',
      cb: ScrollMarkers.node,
    });
  },

  node(this: Thread) {
    ScrollMarkers.thread = this;
    if (!ScrollMarkers.container) return;
    ScrollMarkers.applyPosition();
    $.add(d.body, ScrollMarkers.container);
    ScrollMarkers.container.hidden = true;

    $.on(d, '4chanXInitFinished', ScrollMarkers.refreshDeferred);
    $.on(d, 'PostsInserted', ScrollMarkers.refreshDeferred);
    $.on(d, 'ThreadUpdate', ScrollMarkers.refreshDeferred);
    $.on(d, 'RefreshScrollMarkers', ScrollMarkers.refreshDeferred);
    $.on(window, 'resize', () => {
      ScrollMarkers.updateScrollbarMetrics();
      ScrollMarkers.refreshDeferred();
    });
    $.on(window, 'load', ScrollMarkers.refreshDeferred);

    ScrollMarkers.refreshDeferred();
  },

  refreshDeferred: debounce(150, () => ScrollMarkers.refresh(), false),

  refresh() {
    const container = ScrollMarkers.container;
    if (!ScrollMarkers.thread || !container?.parentNode) return;
    if (!Conf['Scrollbar Markers']) {
      ScrollMarkers.hidePreview();
      container.textContent = '';
      container.hidden = true;
      return;
    }
    ScrollMarkers.hidePreview();
    ScrollMarkers.applyPosition();

    const docHeight =
      d.documentElement.scrollHeight || d.body.scrollHeight || 0;
    if (!(docHeight > 0)) return;

    const frag = $.frag();
    const pos = ScrollMarkers.position();
    const onTrack = pos !== 'offset';
    const isColumnsMode = pos === 'offset' || pos === 'over-columns';
    const showOwn = Conf['Scrollbar Mark Own Posts'];
    const showYou = Conf['Scrollbar Mark Quotes You'];
    const showGhost = Conf['Scrollbar Mark Ghost Posts'];
    const showUnread = Conf['Unread Line'] && Conf['Scrollbar Mark Unread Line'];

    // First pass: collect the marker descriptors and note which types
    // actually have any content. Absent types are left out so the
    // remaining types can split the gutter equally.
    type MarkerType = 'you' | 'own' | 'ghost';
    type Item = { post: Post; type: MarkerType; cls: string; topPct: number; heightStyle: string };
    const items: Item[] = [];
    let hasYou = false, hasOwn = false, hasGhost = false;

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
      const heightStyle = onTrack ? 'height:3px' : `height:${heightPct}%`;

      if (isYou) { items.push({ post, type: 'you', cls: 'scroll-marker-you', topPct, heightStyle }); hasYou = true; }
      if (isOwn) { items.push({ post, type: 'own', cls: 'scroll-marker-own', topPct, heightStyle }); hasOwn = true; }
      if (isGhost) { items.push({ post, type: 'ghost', cls: 'scroll-marker-ghost', topPct, heightStyle }); hasGhost = true; }
    });

    // Slot 0 = rightmost (nearest the scrollbar). Priority order:
    // you > own > ghost. Only present types consume a slot.
    const slot: Partial<Record<MarkerType, number>> = {};
    let nextSlot = 0;
    if (hasYou) slot.you = nextSlot++;
    if (hasOwn) slot.own = nextSlot++;
    if (hasGhost) slot.ghost = nextSlot++;
    const slotCount = nextSlot || 1;
    const slotWidthPct = 100 / slotCount;

    for (const item of items) {
      const marker = $.el('div', { className: `scroll-marker ${item.cls}` });
      let style = `top:${item.topPct}%;${item.heightStyle}`;
      if (isColumnsMode) {
        const s = slot[item.type] ?? 0;
        style += `;right:${s * slotWidthPct}%;width:${slotWidthPct}%`;
      }
      marker.style.cssText = style;
      ScrollMarkers.bind(marker, item.post);
      $.add(frag, marker);
    }

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

    for (const m of Array.from(container.querySelectorAll('.scroll-marker'))) m.remove();
    $.add(container, frag);
    const overMode = ScrollMarkers.isOverMode();
    container.hidden = !overMode && !container.querySelector('.scroll-marker');
    if (overMode) ScrollMarkers.scrollbar.update();
  },

  bind(marker: HTMLElement, post: Post) {
    marker.title = `Post No.${post.ID}`;
    $.on(marker, 'mouseenter', (e: MouseEvent) => {
      ScrollMarkers.highlightPost(post);
      ScrollMarkers.showPreview(marker, post, e);
    });
    $.on(marker, 'mousemove', (e: MouseEvent) => ScrollMarkers.movePreview(marker, e));
    $.on(marker, 'mouseleave', () => {
      ScrollMarkers.unhighlightPost(post);
      ScrollMarkers.hidePreview();
    });
    // pointerdown lets us tell a click apart from a drag: release-without-
    // movement = jump to the post, drag past threshold in Over mode = hand
    // the gesture off to the custom scrollbar thumb. Markers are only a
    // few pixels tall, so we capture the pointer to keep receiving move
    // events once the cursor leaves the marker's box.
    $.on(marker, 'pointerdown', (downEvent: PointerEvent) => {
      if (downEvent.button !== 0) return;
      const startY = downEvent.clientY;
      const overMode = ScrollMarkers.isOverMode();
      let handedOff = false;
      try { marker.setPointerCapture(downEvent.pointerId); } catch { /* ignore */ }

      const cleanup = () => {
        $.off(marker, 'pointermove', move as (e: Event) => void);
        $.off(marker, 'pointerup', up as (e: Event) => void);
        $.off(marker, 'pointercancel', up as (e: Event) => void);
      };

      const move = (moveEvent: PointerEvent) => {
        if (handedOff) return;
        if (!overMode) return;
        if (Math.abs(moveEvent.clientY - startY) <= 2) return;
        handedOff = true;
        cleanup();
        ScrollMarkers.hidePreview();
        ScrollMarkers.unhighlightPost(post);
        // Release the marker's capture so setPointerCapture on the thumb
        // takes over cleanly.
        try { marker.releasePointerCapture(moveEvent.pointerId); } catch { /* ignore */ }
        ScrollMarkers.scrollbar.startDragFromPointer(moveEvent);
      };

      const up = (upEvent: PointerEvent) => {
        cleanup();
        try { marker.releasePointerCapture(upEvent.pointerId); } catch { /* ignore */ }
        if (handedOff) return;
        upEvent.preventDefault();
        ScrollMarkers.hidePreview();
        ScrollMarkers.jumpTo(post);
      };

      $.on(marker, 'pointermove', move as (e: Event) => void);
      $.on(marker, 'pointerup', up as (e: Event) => void);
      $.on(marker, 'pointercancel', up as (e: Event) => void);
    });
  },

  showPreview(marker: HTMLElement, post: Post, e: MouseEvent) {
    if (!post?.nodes?.root?.isConnected) return;
    ScrollMarkers.hidePreview();

    const preview = $.el('div', {
      id: 'qp',
      className: 'dialog',
    });
    const clone = post.addClone(post.context, true);
    // Match quote preview presentation: keep only the post body,
    // not side arrows / stubs / other container chrome.
    $.rmAll(clone.nodes.root);
    $.add(clone.nodes.root, clone.nodes.post);
    $.add(preview, clone.nodes.root);
    $.add(Header.hover, preview);
    ScrollMarkers.preview = { el: preview, post, marker };
    ScrollMarkers.positionPreview(e);
  },

  movePreview(marker: HTMLElement, e: MouseEvent) {
    if (ScrollMarkers.preview?.marker !== marker) return;
    ScrollMarkers.positionPreview(e);
  },

  positionPreview(e: MouseEvent) {
    const preview = ScrollMarkers.preview?.el;
    if (!preview) return;

    const rect = preview.getBoundingClientRect();
    const viewportWidth = d.documentElement.clientWidth;
    const viewportHeight = d.documentElement.clientHeight;
    const gap = 16;
    const edge = 8;

    let left = e.clientX + gap;
    if (left + rect.width > viewportWidth - edge) {
      left = Math.max(edge, e.clientX - rect.width - gap);
    }

    let top = e.clientY - Math.min(120, rect.height / 2);
    top = Math.max(edge, Math.min(top, viewportHeight - rect.height - edge));

    preview.style.left = `${left}px`;
    preview.style.top = `${top}px`;
    preview.style.right = '';
    preview.style.bottom = '';
  },

  hidePreview() {
    const preview = ScrollMarkers.preview;
    if (!preview) return;
    ScrollMarkers.preview = undefined;
    $.event('PostsRemoved', null, Header.hover);

    const cloneRoot = preview.el.firstElementChild as HTMLElement | null;
    const cloneIndex = cloneRoot?.dataset?.clone;
    if (cloneIndex != null) {
      preview.post.rmClone(+cloneIndex);
    }
    $.rm(preview.el);
  },

  // Same targets as QuotePreview when hovering a >>quotelink (Quote Highlighting).
  postsForQuoteHighlight(post: Post) {
    return [post].concat(post.clones || []);
  },

  highlightPost(post: Post) {
    for (const p of ScrollMarkers.postsForQuoteHighlight(post)) {
      const el = p.nodes?.post;
      if (!el?.isConnected || Header.hover?.contains(el)) continue;
      $.addClass(el, 'qphl');
    }
  },

  unhighlightPost(post: Post) {
    for (const p of ScrollMarkers.postsForQuoteHighlight(post)) {
      const el = p.nodes?.post;
      if (el) $.rmClass(el, 'qphl');
    }
  },

  jumpTo(post: Post) {
    const root = post?.nodes?.root;
    if (!root?.isConnected) return;
    Header.scrollTo(root);
    ScrollMarkers.unhighlightPost(post);
    const el = post.nodes?.post;
    if (!el) return;
    $.addClass(el, 'qphl');
    if (ScrollMarkers.flashTimer) clearTimeout(ScrollMarkers.flashTimer);
    ScrollMarkers.flashPost = post;
    ScrollMarkers.flashTimer = setTimeout(() => {
      const flashEl = ScrollMarkers.flashPost?.nodes?.post;
      if (flashEl) $.rmClass(flashEl, 'qphl');
      ScrollMarkers.flashPost = undefined;
    }, 1500);
  },

  // Back-compat: QuoteYou.js calls ScrollMarkers.markScroll().
  markScroll() {
    ScrollMarkers.refreshDeferred();
  },
};

export default ScrollMarkers;
