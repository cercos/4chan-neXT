import Callbacks from "../classes/Callbacks";
import type Post from "../classes/Post";
import UI from "../General/UI";
import { g, Conf } from "../globals/globals";
import $ from "../platform/$";
import Icon from "../Icons/icon";

var Menu = {
  button: null as any,  // loose: late-assigned element, read by other modules
  menu: null as any,    // loose: late-assigned UI.Menu instance, read by other modules

  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread') || !Conf['Menu']) { return; }

    this.button = $.el('a', {
      className: 'menu-button',
      href:      'javascript:;'
    }
    );

    Icon.set(this.button, 'caretDown');

    this.menu = new UI.Menu('post');
    Callbacks.Post.push({
      name: 'Menu',
      cb:   this.node
    });

    return Callbacks.CatalogThread.push({
      name: 'Menu',
      cb:   this.catalogNode
    });
  },

  node(this: Post) {
    if (this.isClone) {
      const button = $('.menu-button', this.nodes.info);
      $.rmClass(button, 'active');
      $.rm($('.dialog', this.nodes.info));
      Menu.makeButton(this, button);
      return;
    }
    return $.add(this.nodes.info, Menu.makeButton(this));
  },

  catalogNode(this: Post) {
    return $.after((this.nodes as any).icons, Menu.makeButton(this.thread.OP));
  },

  makeButton(post: Post, button?: HTMLElement) {
    if (!button) { button = Menu.button.cloneNode(true); }
    $.on(button, 'click', function(this: HTMLElement, e) {
      return Menu.menu.toggle(e, this, post);
    });
    return button;
  }
};
export default Menu;
