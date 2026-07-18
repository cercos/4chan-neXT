import Callbacks from '../classes/Callbacks';
import Header from '../General/Header';
import Unread from '../Monitoring/Unread';
import { Conf, d, doc, g } from '../globals/globals';
import $ from '../platform/$';
import { debounce } from '../platform/helpers';
import type Post from '../classes/Post';
import type Thread from '../classes/Thread';

type ScrollMarkerPosition = 'offset' | 'offset-single' | 'over' | 'over-columns';

type MarkerType = 'you' | 'own' | 'ghost';
type MarkerItem = { post: Post; type: MarkerType; cls: string; topPct: number; heightStyle: string };

const ScrollMarkers = {
  container: undefined as HTMLElement | undefined,
  thread: undefined as Thread | undefined,
  wired: false,
  ready: false,
  flashPost: undefined as Post | undefined,
  flashTimer: 0 as ReturnType<typeof setTimeout> | 0,
  preview: undefined as { el: HTMLElement; post: Post; marker: HTMLElement } | undefined,
  scrollbarWidth: undefined as number | undefined,
  scrollbarDPR: undefined as number | undefined,

  position(): ScrollMarkerPosition {
    const pos = Conf['Scrollbar Marker Position'];
    let resolved: ScrollMarkerPosition;
    if (pos === 'over-columns') resolved = 'over-columns';
    // Legacy values fold into the single Over mode.
    else if (pos === 'scrollbar' || pos === 'overlay' || pos === 'over') resolved = 'over';
    else if (pos === 'offset-single') resolved = 'offset-single';
    else resolved = 'offset';
    // Over modes only work on overlay scrollbars; on classic scrollbars the native
    // bar paints over the markers and they vanish. The menu forbids *selecting* an
    // over mode without overlay scrollbars, but a value already saved in storage (or
    // a legacy 'over'/'overlay'/'scrollbar') bypasses that, so degrade it here to the
    // beside equivalent — markers can never be silently hidden.
    if ((resolved === 'over' || resolved === 'over-columns') && !ScrollMarkers.overlayScrollbars()) {
      resolved = resolved === 'over-columns' ? 'offset' : 'offset-single';
    }
    return resolved;
  },

  // 0 width means overlay scrollbars (the only kind the over modes can sit on).
  overlayScrollbars(): boolean {
    return ScrollMarkers.measureScrollbarWidth() === 0;
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
  },

  measureScrollbarWidth() {
    const dpr = window.devicePixelRatio || 1;
    if (ScrollMarkers.scrollbarWidth != null && ScrollMarkers.scrollbarDPR === dpr) {
      return ScrollMarkers.scrollbarWidth;
    }
    const outer = $.el('div', {
      style: 'width:100px;height:100px;overflow:scroll;position:absolute;top:-9999px;visibility:hidden;pointer-events:none',
    });
    $.add(d.body, outer);
    const width = outer.offsetWidth - outer.clientWidth;
    $.rm(outer);
    ScrollMarkers.scrollbarDPR = dpr;
    return (ScrollMarkers.scrollbarWidth = width);
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
    // Scrollbar lane width the over modes size their strip to (12px for overlay).
    d.documentElement.style.setProperty('--xt-scrollbar-width', `${measured > 0 ? measured : 12}px`);
  },


  menu: {
    entry: undefined as { el: HTMLElement; order: number; open: () => boolean; subEntries: { el: HTMLElement }[] } | undefined,

    init() {
      if (g.VIEW !== 'thread' && g.VIEW !== 'index' && g.VIEW !== 'archive' && g.VIEW !== 'catalog') return;
      const el = $.el('span', { textContent: 'Scroll markers' });
      // Wholly-neXT menu: one green dot on the header, no per-row dots inside.
      el.dataset.nextKey = 'Scrollbar Markers';
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
      const enabledLabel = $.el('label', {
        className: 'entry scroll-marker-enabled-option',
        title: 'Show colored markers along the right edge of the page.',
        innerHTML: '<input type="checkbox" name="Scrollbar Markers"> Enabled',
      });
      const enabledBox = $('input', enabledLabel) as HTMLInputElement;
      enabledBox.checked = Conf['Scrollbar Markers'];
      // Keep the menu open so the checkbox state is visible after toggling.
      $.on(enabledLabel, 'click', (e: Event) => e.stopPropagation());
      $.on(enabledBox, 'change', () => {
        const next = enabledBox.checked;
        Conf['Scrollbar Markers'] = next;
        $.set('Scrollbar Markers', next);
        if (!next) ScrollMarkers.hidePreview();
        ScrollMarkers.refreshDeferred();
      });

      const options: Array<[ScrollMarkerPosition, string, boolean]> = [
        ['offset-single', 'Beside scrollbar (single)', false],
        ['offset', 'Beside scrollbar (columns)', false],
        ['over', 'Over scrollbar (single)', true],
        ['over-columns', 'Over scrollbar (columns)', true],
      ];
      const current = ScrollMarkers.position();
      const overlay = ScrollMarkers.overlayScrollbars();
      const entries: { el: HTMLElement }[] = options.map(([value, label, needsOverlay]) => {
        const disabled = needsOverlay && !overlay;
        const a = $.el('a', {
          href: 'javascript:;',
          textContent: `${current === value ? '✓ ' : '  '}${label}`,
          className: `entry scroll-marker-position-option${disabled ? ' disabled' : ''}`,
        });
        if (disabled) {
          a.title = 'Requires overlay scrollbars (#overlay-scrollbars flag).';
        } else {
          $.on(a, 'click', (e: Event) => {
            e.preventDefault();
            Conf['Scrollbar Marker Position'] = value;
            $.set('Scrollbar Marker Position', value);
            ScrollMarkers.applyPosition();
            ScrollMarkers.refreshDeferred();
            $.event('CloseMenu');
          });
        }
        return { el: a };
      });
      entries.unshift({ el: enabledLabel });
      if (!overlay) {
        const note = $.el('div', {
          className: 'scroll-marker-note',
          textContent:
            'Over modes need overlay scrollbars: turn on the #overlay-scrollbars '
            + 'flag (chrome/brave/edge://flags/#overlay-scrollbars).',
        });
        entries.push({ el: note });
      } else if ($.engine === 'gecko') {
        // Firefox has no ::-webkit-scrollbar, so over modes can't fade the native thumb; it steals pointer events from the markers.
        const note = $.el('div', {
          className: 'scroll-marker-note',
          textContent:
            'Firefox and some browsers draw the scrollbar over the markers, so '
            + 'hovering to preview can be unreliable. Use a Beside mode if '
            + 'hovering is essential to you.',
        });
        entries.push({ el: note });
      }
      const manage = $.el('a', {
        href: 'javascript:;',
        textContent: 'Manage styles',
        className: 'entry scroll-marker-manage-styles',
      });
      $.on(manage, 'click', (e: Event) => {
        e.preventDefault();
        $.event('OpenSettings', 'Styling');
        $.event('CloseMenu');
      });
      entries.push({ el: manage });

      const previewLabel = $.el('label', {
        className: 'entry scroll-marker-hover-preview-option',
        title: 'Show a post preview when hovering a marker.',
        innerHTML: '<input type="checkbox" name="Scrollbar Marker Hover Preview"> Show preview',
      });
      const previewBox = $('input', previewLabel) as HTMLInputElement;
      previewBox.checked = Conf['Scrollbar Marker Hover Preview'];
      // Keep the menu open so the checkbox state is visible after toggling.
      $.on(previewLabel, 'click', (e: Event) => e.stopPropagation());
      $.on(previewBox, 'change', () => {
        const next = previewBox.checked;
        Conf['Scrollbar Marker Hover Preview'] = next;
        $.set('Scrollbar Marker Hover Preview', next);
        if (!next) ScrollMarkers.hidePreview();
      });
      entries.push({ el: previewLabel });
      return entries;
    },
  },

  init() {
    ScrollMarkers.menu.init();
    if (g.VIEW !== 'thread' && g.VIEW !== 'index' && g.VIEW !== 'archive' && g.VIEW !== 'catalog') return;

    ScrollMarkers.container = $.el('div', { id: 'scroll-markers' });
    ScrollMarkers.container.hidden = true;
    ScrollMarkers.applyPosition();

    for (const key of [
      'Scrollbar Markers',
      'Scrollbar Mark Own Posts',
      'Scrollbar Mark Quotes You',
      'Scrollbar Mark Ghost Posts',
      'Scrollbar Mark Unread Line',
      'Scrollbar Marker Hover Preview',
      'Unread Line',
      'stylingSectionScrollbarMarkers',
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

    // thread/archive get a per-Thread callback (to capture the Thread object);
    // index/catalog have many/no threads, so mount directly — the
    // 4chanXInitFinished + PostsInserted listeners drive the first draw.
    if (g.VIEW === 'thread' || g.VIEW === 'archive') {
      Callbacks.Thread.push({
        name: 'Scroll Markers',
        cb: ScrollMarkers.node,
      });
    } else {
      // init() can run before <body> exists; mount() appends to it, so defer.
      $.onExists(doc, 'body', () => ScrollMarkers.mount());
    }
  },

  node(this: Thread) {
    ScrollMarkers.thread = this;
    ScrollMarkers.mount();
  },

  // Append the marker container to <body> (not the view root, so it survives
  // index/catalog re-renders) and wire refresh listeners exactly once.
  // Idempotent: safe to call from a Thread callback, init(), or a rebuild.
  mount() {
    if (!ScrollMarkers.container) return;
    if (ScrollMarkers.container.parentNode) {
      ScrollMarkers.applyPosition();
      ScrollMarkers.refreshDeferred();
      return;
    }
    ScrollMarkers.applyPosition();
    $.add(d.body, ScrollMarkers.container);
    ScrollMarkers.container.hidden = true;

    if (!ScrollMarkers.wired) {
      ScrollMarkers.wired = true;
      // One listener set for all views. IndexRefresh/ThreadUpdate are
      // harmless no-ops in the views where they never fire.
      $.on(d, '4chanXInitFinished', ScrollMarkers.markReady);
      $.on(d, 'PostsInserted', ScrollMarkers.refreshDeferred);
      $.on(d, 'IndexRefresh', ScrollMarkers.refreshDeferred);
      $.on(d, 'ThreadUpdate', ScrollMarkers.refreshDeferred);
      $.on(d, 'RefreshScrollMarkers', ScrollMarkers.refreshDeferred);
      $.on(window, 'resize', () => {
        ScrollMarkers.scrollbarWidth = undefined;
        ScrollMarkers.updateScrollbarMetrics();
        ScrollMarkers.refreshDeferred();
      });
      $.on(window, 'load', ScrollMarkers.markReady);
    }

    ScrollMarkers.refreshDeferred();
  },

  refreshDeferred: debounce(150, () => ScrollMarkers.refresh(), false),

  markReady() {
    ScrollMarkers.ready = true;
    ScrollMarkers.refreshDeferred();
  },

  // Collect marker descriptors for the current view. Thread/archive read the
  // active thread's posts; index (including the JSON catalog mode) sweeps all
  // visible posts via g.posts. Native catalog has no Post objects or "(You)"
  // data, so it yields nothing.
  // TODO: native-catalog "your thread" markers could be derived from QuoteYou.db.
  collectMarkerItems(
    docHeight: number, onTrack: boolean,
    showOwn: boolean, showYou: boolean, showGhost: boolean,
  ): { items: MarkerItem[]; hasYou: boolean; hasOwn: boolean; hasGhost: boolean } {
    const items: MarkerItem[] = [];
    let hasYou = false, hasOwn = false, hasGhost = false;
    if (g.VIEW === 'catalog' || (!showOwn && !showYou && !showGhost)) {
      return { items, hasYou, hasOwn, hasGhost };
    }

    const source = g.VIEW === 'index' ? g.posts : ScrollMarkers.thread?.posts;
    source?.forEach((post: Post) => {
      if (post.isHidden || post.isClone || post.isFetchedQuote) return;
      const root = post.nodes.root as HTMLElement;
      if (!root) return;

      // Cheap class checks first; only force layout (getBoundingClientRect)
      // for the few posts that actually carry a marker — matters on large
      // "all pages" indexes where g.posts can hold thousands of posts.
      const isOwn = showOwn && root.classList.contains('yourPost');
      const isYou = showYou && root.classList.contains('quotesYou');
      const isGhost = showGhost && root.classList.contains('from-archive');
      if (!isOwn && !isYou && !isGhost) return;
      if (root.offsetParent == null || !root.getClientRects().length) return;

      const rect = root.getBoundingClientRect();
      const topInDoc = rect.top + window.scrollY;
      const topPct = (topInDoc / docHeight) * 100;
      const heightPct = Math.max((rect.height / docHeight) * 100, 0.15);
      const heightStyle = onTrack ? 'height:3px' : `height:${heightPct}%`;

      if (isYou) { items.push({ post, type: 'you', cls: 'scroll-marker-you', topPct, heightStyle }); hasYou = true; }
      if (isOwn) { items.push({ post, type: 'own', cls: 'scroll-marker-own', topPct, heightStyle }); hasOwn = true; }
      if (isGhost) { items.push({ post, type: 'ghost', cls: 'scroll-marker-ghost', topPct, heightStyle }); hasGhost = true; }
    });

    return { items, hasYou, hasOwn, hasGhost };
  },

  refresh() {
    const container = ScrollMarkers.container;
    if (!container?.parentNode) return;
    // Read Conf directly to avoid a Settings <-> ScrollMarkers import cycle.
    if (
      !Conf['Scrollbar Markers'] || Conf['stylingSectionScrollbarMarkers'] === false
      || doc.classList.contains('xt-mobile')
    ) {
      ScrollMarkers.hidePreview();
      container.textContent = '';
      container.hidden = true;
      return;
    }
    if (!ScrollMarkers.ready) return;
    ScrollMarkers.hidePreview();

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

    // First pass: collect the marker descriptors (view-aware) and note which
    // types actually have any content. Absent types are left out so the
    // remaining types can split the gutter equally.
    const { items, hasYou, hasOwn, hasGhost } =
      ScrollMarkers.collectMarkerItems(docHeight, onTrack, showOwn, showYou, showGhost);

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

    if (g.VIEW === 'thread' && showUnread && Unread?.hr?.isConnected && !Unread.hr.hidden) {
      const rect = Unread.hr.getBoundingClientRect();
      const topInDoc = rect.top + window.scrollY;
      const topPct = (topInDoc / docHeight) * 100;
      const marker = $.el('div', {
        className: 'scroll-marker scroll-marker-unread',
      });
      marker.style.cssText = `top:${topPct}%;height:2px`;
      $.add(frag, marker);
    }

    for (const m of Array.from(container.querySelectorAll('.scroll-marker'))) m.remove();
    $.add(container, frag);
    container.hidden = !container.querySelector('.scroll-marker');
  },

  bind(marker: HTMLElement, post: Post) {
    $.on(marker, 'mouseenter', (e: MouseEvent) => {
      ScrollMarkers.highlightPost(post);
      ScrollMarkers.showPreview(marker, post, e);
    });
    $.on(marker, 'mousemove', (e: MouseEvent) => ScrollMarkers.movePreview(marker, e));
    $.on(marker, 'mouseleave', () => {
      ScrollMarkers.unhighlightPost(post);
      ScrollMarkers.hidePreview();
    });
    $.on(marker, 'click', (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      ScrollMarkers.hidePreview();
      ScrollMarkers.jumpTo(post);
    });
  },

  showPreview(marker: HTMLElement, post: Post, e: MouseEvent) {
    if (!Conf['Scrollbar Marker Hover Preview']) return;
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
