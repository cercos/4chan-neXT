import Callbacks from "../classes/Callbacks";
import { Conf, g, E } from "../globals/globals";
import $ from "../platform/$";
import $$ from "../platform/$$";
import Icon from "../Icons/icon";
import type { default as Post, PostClone } from "../classes/Post";

var PostJumper = {
  buttons: null as any, // loose:

  init() {
    if (!Conf['Unique ID and Capcode Navigation'] || (g.VIEW !== 'index' && g.VIEW !== 'thread')) { return; }

    this.buttons = this.makeButtons();
    Icon.set(this.buttons.firstChild, 'arrowUpLong');
    Icon.set(this.buttons.lastChild, 'arrowDownLong');

    return Callbacks.Post.push({
      name: 'Post Jumper',
      cb:   this.node
    });
  },

  node(this: Post | PostClone) {
    if (this.isClone) {
      for (var buttons of $$('.postJumper', this.nodes.info)) {
        PostJumper.addListeners(buttons);
      }
      return;
    }

    if (this.nodes.uniqueIDRoot) {
      PostJumper.addButtons(this,'uniqueID');
    }

    if (this.nodes.capcode) {
      return PostJumper.addButtons(this,'capcode');
    }
  },

  addButtons(post: Post, type: 'uniqueID' | 'capcode') {
    const value = post.info[type];
    const buttons = PostJumper.buttons.cloneNode(true);
    $.extend(buttons.dataset, {type, value});
    $.after((post.nodes as any)[type+(type === 'capcode' ? '' : 'Root')], buttons); // loose: dynamic node key
    return PostJumper.addListeners(buttons);
  },

  addListeners(buttons: HTMLElement) {
    $.on(buttons.firstChild, 'click', PostJumper.buttonClick);
    return $.on(buttons.lastChild, 'click', PostJumper.buttonClick);
  },

  buttonClick(this: HTMLElement) {
    let toJumper;
    const dir = $.hasClass(this, 'prev') ? -1 : 1;
    if (toJumper = PostJumper.find(this.parentNode as HTMLElement, dir)) {
      return PostJumper.scroll(this.parentNode as HTMLElement, toJumper);
    }
  },

  find(jumper: HTMLElement, dir: number) {
    const {type, value} = jumper.dataset;
    const xpath = `span[contains(@class,\"postJumper\") and @data-value=\"${value}\" and @data-type=\"${type}\"]`;
    const axis = dir < 0 ? 'preceding' : 'following';
    let jumper2 = jumper;
    while (jumper2 = $.x(`${axis}::${xpath}`, jumper2)) {
      if (jumper2.getBoundingClientRect().height) { return jumper2; }
    }
    if (jumper2 = $.x(`(//${xpath})[${dir < 0 ? 'last()' : '1'}]`)) {
      if (jumper2.getBoundingClientRect().height) { return jumper2; }
    }
    while ((jumper2 = $.x(`${axis}::${xpath}`, jumper2)) && (jumper2 !== jumper)) {
      if (jumper2.getBoundingClientRect().height) { return jumper2; }
    }
    return null;
  },

  makeButtons() {
    const charPrev = '\u23EB';
    const charNext = '\u23EC';
    const classPrev = 'prev';
    const classNext = 'next';
    const span = $.el('span',
      {className: 'postJumper'});
    $.extend(span, {innerHTML: "<a href=\"javascript:;\" class=\"" + E(classPrev) + "\">" + E(charPrev) + "</a><a href=\"javascript:;\" class=\"" + E(classNext) + "\">" + E(charNext) + "</a>"});
    return span;
  },

  scroll(fromJumper: HTMLElement, toJumper: HTMLElement) {
    const prevPos = fromJumper.getBoundingClientRect().top;
    const destPos = toJumper.getBoundingClientRect().top;
    return window.scrollBy(0, destPos-prevPos);
  }
};
export default PostJumper;
