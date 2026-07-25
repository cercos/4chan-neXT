import Callbacks from "../classes/Callbacks";
import Fetcher from "../classes/Fetcher";
import Get from "../General/Get";
import Icon from "../Icons/icon";
import { Conf, d, doc, g } from "../globals/globals";
import $ from "../platform/$";
import QuoteInline from "../Quotelinks/QuoteInline";
import { detectMobileDevice, resolveMobileLayout } from "./MobileLayout";
import { backAction, canDrill, chipLabel, countBacklinks, rootTitle, tapAction } from "./MobileRepliesLogic";
import type Post from "../classes/Post";

interface ViewEntry {
  boardID: string;
  threadID: number;
  postID: number;
  quoter: Post;
}

interface RepliesView {
  title: string;
  fullID: string;
  entries: ViewEntry[];
}

const MobileReplies = {
  popup: undefined as HTMLElement | undefined,
  backdrop: undefined as HTMLElement | undefined,
  list: undefined as HTMLElement | undefined,
  title: undefined as HTMLElement | undefined,
  stack: [] as RepliesView[],

  init() {
    if (g.VIEW !== 'index' && g.VIEW !== 'thread') { return; }
    if (!Conf['Quote Backlinks']) { return; }
    if (!resolveMobileLayout(Conf['Mobile Layout'], detectMobileDevice())) { return; }

    MobileReplies.applyEnabled(Conf['Mobile Replies Popup']);
    $.sync('Mobile Replies Popup', MobileReplies.applyEnabled);

    // Delegated so chips inside clones (inline embeds, previews) work too.
    $.on(d, 'click', MobileReplies.chipClick);
    $.on(d, 'MobileSheetOpened', MobileReplies.close);

    Callbacks.Post.push({
      name: 'Mobile Replies',
      cb:   this.node
    });
  },

  applyEnabled(enabled: boolean) {
    doc.classList.toggle('xt-replies-chip', !!enabled);
    if (!enabled) { MobileReplies.close(); }
  },

  node(this: Post) {
    if (this.isClone) { return; }
    MobileReplies.update(this);
    for (const quote of this.quotes) {
      const quoted = g.posts!.get(quote);
      if (quoted) { MobileReplies.update(quoted); }
    }
  },

  update(post: Post) {
    const container = (post.nodes as any).backlinkContainer as HTMLElement | undefined;
    if (!container) { return; }
    const count = countBacklinks([...container.children].map(el => el.className));
    let chip = (post.nodes as any).repliesChip as HTMLAnchorElement | undefined;
    if (!count) {
      if (chip) { chip.hidden = true; }
      return;
    }
    if (!chip) {
      chip = MobileReplies.buildChip();
      (post.nodes as any).repliesChip = chip;
      $.add(post.nodes.info, chip);
    }
    chip.hidden = false;
    $('.mobile-replies-count', chip).textContent = chipLabel(count);
  },

  buildChip(): HTMLAnchorElement {
    const chip = $.el('a', {
      href: 'javascript:;',
      className: 'mobile-replies-chip'
    }) as HTMLAnchorElement;
    const icon = $.el('span', {className: 'mobile-replies-icon'});
    Icon.set(icon, 'comment');
    const count = $.el('span', {className: 'mobile-replies-count'});
    $.add(chip, [icon, count]);
    return chip;
  },

  chipClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const chip = target.closest?.('.mobile-replies-chip') as HTMLElement | null;
    if (!chip) { return; }
    if (MobileReplies.popup?.contains(chip)) { return; } // popupClick handles these
    e.preventDefault();
    const post = Get.postFromNode(chip);
    if (!post) { return; }
    MobileReplies.onChipTap(post.origin || post);
  },

  onChipTap(post: Post) {
    const container = (post.nodes as any).backlinkContainer as HTMLElement | undefined;
    if (!container) { return; }
    const links = [...container.getElementsByClassName('backlink')] as HTMLAnchorElement[];
    if (tapAction(links.length) === 'popup') {
      MobileReplies.open(post, links);
    }
  },

  open(post: Post, links: HTMLAnchorElement[]) {
    MobileReplies.close();

    const entries: ViewEntry[] = links.map(link => {
      const {boardID, threadID, postID} = Get.postDataFromLink(link);
      return {boardID, threadID, postID, quoter: post} as ViewEntry;
    });
    MobileReplies.stack = [{title: rootTitle(entries.length), fullID: post.fullID, entries}];

    const popup = (MobileReplies.popup = $.el('div', {
      id: 'mobile-replies',
      className: 'dialog'
    }));
    const backdrop = (MobileReplies.backdrop = $.el('div',
      {id: 'mobile-replies-backdrop'}));

    const header = $.el('div', {className: 'mobile-replies-header'});
    const backBtn = $.el('a', {
      href: 'javascript:;',
      className: 'mobile-replies-back'
    });
    Icon.set(backBtn, 'caretLeft');
    $.on(backBtn, 'click', (e: MouseEvent) => {
      e.preventDefault();
      MobileReplies.back();
    });
    const title = (MobileReplies.title = $.el('span',
      {className: 'mobile-replies-title'}));
    const closeBtn = $.el('a', {
      href: 'javascript:;',
      className: 'mobile-replies-close'
    });
    Icon.set(closeBtn, 'xmark');
    $.on(closeBtn, 'click', (e: MouseEvent) => {
      e.preventDefault();
      MobileReplies.close();
    });
    $.add(header, [backBtn, title, closeBtn]);

    const list = (MobileReplies.list = $.el('div',
      {className: 'mobile-replies-list'}));

    $.add(popup, [header, list]);
    popup.addEventListener('click', MobileReplies.popupClick, true);
    $.on(backdrop, 'click', MobileReplies.close);
    $.add(d.body, [backdrop, popup]);
    $.addClass(doc, 'xt-replies-open');
    MobileReplies.render();
  },

  render() {
    const {list, title, stack} = MobileReplies;
    const view = stack[stack.length - 1];
    if (!list || !title || !view) { return; }
    MobileReplies.cleanList();
    title.textContent = view.title;
    for (const {boardID, threadID, postID, quoter} of view.entries) {
      const item = $.el('div', {className: 'mobile-replies-item'});
      $.add(list, item);
      new Fetcher(boardID, threadID, postID as any, item, quoter);
    }
    list.scrollTop = 0;
  },

  back() {
    switch (backAction(MobileReplies.stack.length)) {
      case 'pop':
        MobileReplies.stack.pop();
        MobileReplies.render();
        break;
      case 'close':
        MobileReplies.close();
        break;
    }
  },

  popupClick(e: MouseEvent) {
    const {popup} = MobileReplies;
    if (!popup) { return; }
    const target = e.target as HTMLElement;

    // Reply chips on posts inside the popup drill one level deeper.
    const chip = target.closest?.('.mobile-replies-chip') as HTMLElement | null;
    if (chip && popup.contains(chip)) {
      e.stopPropagation();
      e.preventDefault();
      const clicked = Get.postFromNode(chip);
      const origin: Post | undefined = clicked?.origin || clicked;
      if (!origin) { return; }
      // Don't reopen a replies view that's already in the trail (quote loops).
      if (!canDrill(MobileReplies.stack.map(view => view.fullID), origin.fullID)) { return; }
      const container = (origin.nodes as any)?.backlinkContainer as HTMLElement | undefined;
      if (!container) { return; }
      const links = [...container.getElementsByClassName('backlink')] as HTMLAnchorElement[];
      if (!links.length) { return; }
      const entries: ViewEntry[] = links.map(link => {
        const {boardID, threadID, postID} = Get.postDataFromLink(link);
        return {boardID, threadID, postID, quoter: origin} as ViewEntry;
      });
      MobileReplies.stack.push({
        title: `${rootTitle(entries.length)} to >>${origin.ID}`,
        fullID: origin.fullID,
        entries
      });
      MobileReplies.render();
      return;
    }

    // Quote links embed the post inline, like thread mode.
    const link = target.closest?.('a.quotelink, a.backlink') as HTMLAnchorElement | null;
    if (!link || !popup.contains(link)) { return; }
    // Keep QuoteInline and QuotePreview from acting inside the popup.
    e.stopPropagation();
    e.preventDefault();
    MobileReplies.toggleInline(link);
  },

  toggleInline(link: HTMLAnchorElement) {
    const {boardID, threadID, postID} = Get.postDataFromLink(link);
    if (!canDrill(MobileReplies.stack.map(view => view.fullID), `${boardID}.${postID}`)) { return; }
    const isBacklink = $.hasClass(link, 'backlink');
    const root = QuoteInline.findRoot(link, isBacklink);
    if (!root) { return; }
    if ($.hasClass(link, 'inlined')) {
      const inline = $.x(`following-sibling::div[@data-full-i-d='${boardID}.${postID}'][1]`, root) as HTMLElement | null;
      if (inline) { MobileReplies.rmInline(inline); }
    } else {
      if ($.x(`ancestor::div[@data-full-i-d='${boardID}.${postID}']`, link)) { return; }
      const quoter = Get.postFromNode(link);
      if (!quoter) { return; }
      const inline = $.el('div', {className: 'inline'});
      inline.dataset.fullID = `${boardID}.${postID}`;
      $.after(root as Element, inline);
      new Fetcher(boardID, threadID, postID as any, inline, quoter);
    }
    link.classList.toggle('inlined');
  },

  rmInline(inline: HTMLElement) {
    const parent = inline.parentNode ?? undefined;
    for (const div of [inline, ...inline.getElementsByClassName('inline')] as HTMLElement[]) {
      const root = div.firstElementChild as HTMLElement | null;
      if (!root?.dataset.clone) { continue; }
      Get.postFromRoot(root)?.origin?.rmClone(root.dataset.clone);
    }
    $.rm(inline);
    $.event('PostsRemoved', null, parent);
  },

  cleanList() {
    const {list} = MobileReplies;
    if (!list) { return; }
    for (const root of [...list.querySelectorAll('[data-clone]')] as HTMLElement[]) {
      Get.postFromRoot(root)?.origin?.rmClone(root.dataset.clone);
    }
    $.event('PostsRemoved', null, list);
    $.rmAll(list);
  },

  close() {
    const {popup, backdrop} = MobileReplies;
    if (!popup) { return; }
    MobileReplies.cleanList();
    $.rm(popup);
    if (backdrop) { $.rm(backdrop); }
    MobileReplies.popup = undefined;
    MobileReplies.backdrop = undefined;
    MobileReplies.list = undefined;
    MobileReplies.title = undefined;
    MobileReplies.stack = [];
    $.rmClass(doc, 'xt-replies-open');
  }
};

export default MobileReplies;
