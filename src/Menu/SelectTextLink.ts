import type Post from "../classes/Post";
import Get from "../General/Get";
import Icon from "../Icons/icon";
import { g, Conf, d, doc } from "../globals/globals";
import $ from "../platform/$";
import QR from "../Posting/QR";
import Menu from "./Menu";

var SelectTextLink = {
  post: undefined as Post | undefined,
  dialog: undefined as HTMLElement | undefined,
  backdrop: undefined as HTMLElement | undefined,
  body: undefined as HTMLElement | undefined,
  selection: '',

  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread') || !Conf['Menu']) { return; }

    const a = $.el('a', {
      className: 'select-text-link',
      href: 'javascript:;',
      textContent: 'Select Text'
    });
    $.on(a, 'click', SelectTextLink.openDialog);

    return Menu.menu.addEntry({
      el: a,
      order: 8,
      open(post: Post) {
        SelectTextLink.post = post.origin || post;
        return doc.classList.contains('xt-mobile');
      }
    });
  },

  openDialog() {
    const {post} = SelectTextLink;
    if (!post) { return; }
    $.event('CloseMenu');
    SelectTextLink.close();

    const backdrop = (SelectTextLink.backdrop = $.el('div',
      {id: 'select-text-backdrop'}));
    const dialog = (SelectTextLink.dialog = $.el('div', {
      id: 'select-text',
      className: 'dialog'
    }));

    const header = $.el('div', {className: 'select-text-header'});
    const title = $.el('span', {
      className: 'select-text-title',
      textContent: `Select text from >>${post.ID}`
    });
    const closeBtn = $.el('a', {
      href: 'javascript:;',
      className: 'select-text-close'
    });
    Icon.set(closeBtn, 'xmark');
    $.on(closeBtn, 'click', (e: MouseEvent) => {
      e.preventDefault();
      SelectTextLink.close();
    });
    $.add(header, [title, closeBtn]);

    const body = (SelectTextLink.body = $.el('div',
      {className: 'select-text-body'}));
    const clone = post.nodes.comment.cloneNode(true) as HTMLElement;
    for (const inline of [...clone.querySelectorAll('.inline')]) { $.rm(inline); }
    $.add(body, clone);

    const actions = $.el('div', {className: 'select-text-actions'});
    const copyBtn = $.el('a', {
      href: 'javascript:;',
      className: 'select-text-copy',
      textContent: 'Copy'
    });
    $.on(copyBtn, 'click', SelectTextLink.copy);
    $.add(actions, copyBtn);
    if (Conf['Quick Reply']) {
      const quoteBtn = $.el('a', {
        href: 'javascript:;',
        className: 'select-text-quote',
        textContent: 'Quote in QR'
      });
      $.on(quoteBtn, 'click', SelectTextLink.quote);
      $.add(actions, quoteBtn);
    }

    $.add(dialog, [header, body, actions]);
    $.on(backdrop, 'click', SelectTextLink.close);
    SelectTextLink.selection = '';
    $.on(d, 'selectionchange', SelectTextLink.trackSelection);
    $.add(d.body, [backdrop, dialog]);
  },

  trackSelection() {
    const {body} = SelectTextLink;
    const sel = d.getSelection();
    if (!body || !sel || sel.isCollapsed || !sel.anchorNode) { return; }
    if (!body.contains(sel.anchorNode)) { return; }
    SelectTextLink.selection = sel.toString();
  },

  grabText(): string {
    const {body, post} = SelectTextLink;
    const sel = d.getSelection();
    if (sel && !sel.isCollapsed && sel.anchorNode && body?.contains(sel.anchorNode)) {
      return sel.toString();
    }
    return SelectTextLink.selection || post?.commentOrig() || '';
  },

  copy() {
    const text = SelectTextLink.grabText();
    SelectTextLink.close();
    if (!text) { return; }
    const el = $.el('textarea', {value: text}) as HTMLTextAreaElement;
    $.add(d.body, el);
    el.select();
    try {
      d.execCommand('copy');
    } catch (error) {}
    return $.rm(el);
  },

  quote() {
    const {post} = SelectTextLink;
    const text = SelectTextLink.grabText();
    SelectTextLink.close();
    if (!post || !QR.postingIsEnabled) { return; }
    const ref = post.board.ID === g.BOARD!.ID ? `>>${post}` : `>>>/${post.board}/${post}`;
    let quoted = `${ref}\n`;
    if (text.trim()) {
      quoted += text.trim().split('\n').map(line => `>${line}`).join('\n') + '\n';
    }

    QR.openPost();
    const {com, thread} = QR.nodes;
    if (!com.value) { thread.value = Get.threadFromNode(post.nodes.post) as any; } // loose: Get.threadFromNode return type owned by ../General/Get

    const wasOnlyQuotes = QR.selected.isOnlyQuotes();
    const caretPos = com.selectionStart;
    com.value = com.value.slice(0, caretPos) + quoted + com.value.slice(com.selectionEnd);
    const range = caretPos + quoted.length;
    com.setSelectionRange(range, range);
    com.focus();
    if (wasOnlyQuotes) { QR.selected.quotedText = com.value; }
    QR.selected.save(com);
    return QR.selected.save(thread);
  },

  close() {
    const {dialog, backdrop} = SelectTextLink;
    if (!dialog) { return; }
    $.off(d, 'selectionchange', SelectTextLink.trackSelection);
    $.rm(dialog);
    if (backdrop) { $.rm(backdrop); }
    SelectTextLink.dialog = undefined;
    SelectTextLink.backdrop = undefined;
    SelectTextLink.body = undefined;
    SelectTextLink.selection = '';
  }
};
export default SelectTextLink;
