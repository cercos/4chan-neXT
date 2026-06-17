import Callbacks from "../classes/Callbacks";
import type Post from "../classes/Post";
import type CatalogThread from "../classes/CatalogThread";
import Header from "../General/Header";
import UI from "../General/UI";
import { Conf, doc, g } from "../globals/globals";
import $ from "../platform/$";

var FappeTyme = {
  // Assigned later; declared so the singleton's type includes them. Loosely typed
  // where a precise type would cascade new errors; tighten during the strict pass.
  nodes: null as any,
  enabled: null as any,

  init() {
    if ((!Conf['Fappe Tyme'] && !Conf['Werk Tyme']) || (g.VIEW !== 'index' && g.VIEW !== 'thread' && g.VIEW !== 'archive')) { return; }

    this.nodes = {};
    this.enabled = {
      fappe: false,
      werk:  Conf['werk']
    };

    for (var type of ["Fappe", "Werk"]) {
      if (Conf[`${type} Tyme`]) {
        var lc = type.toLowerCase();
        var el = UI.checkbox(lc, `${type} Tyme`, false);
        el.title = `${type} Tyme`;

        this.nodes[lc] = el.firstElementChild;
        if (Conf[lc]) { this.set(lc, true); }
        $.on(this.nodes[lc], 'change', this.toggle.bind(this, lc));

        Header.menu.addEntry({
          el,
          order: 97
        });

        var indicator = $.el('span', {
          className: 'indicator',
          textContent: type[0],
          title: `${type} Tyme active`
        }
        );
        $.on(indicator, 'click', function(this: HTMLElement) {
          const check = $.getOwn(FappeTyme.nodes, (this.parentNode as HTMLElement).id.replace('shortcut-', ''));
          check.checked = !check.checked;
          return $.event('change', null, check);
        });
        Header.addShortcut(lc, indicator, 410);
      }
    }

    if (Conf['Werk Tyme']) {
      $.sync('werk', this.set.bind(this, 'werk'));
    }

    Callbacks.Post.push({
      name: 'Fappe Tyme',
      cb:   this.node
    });

    return Callbacks.CatalogThread.push({
      name: 'Werk Tyme',
      cb:   this.catalogNode
    });
  },

  node(this: Post) {
    return this.nodes.root.classList.toggle('noFile', !this.files.length);
  },

  catalogNode(this: CatalogThread) {
    const file = this.thread.OP.files[0];
    if (!file) { return; }
    const filename = $.el('div', {
      textContent: file.name,
      className:   'werkTyme-filename'
    }
    );
    return $.add(this.nodes.thumb.parentNode, filename);
  },

  set(type: string, enabled: boolean) {
    this.enabled[type] = (this.nodes[type].checked = enabled);
    return $[`${enabled ? 'add' : 'rm'}Class`](doc, `${type}Tyme`);
  },

  toggle(type: string) {
    this.set(type, !this.enabled[type]);
    if (type === 'werk') { return $.cb.checked.call(this.nodes[type]); }
  }
};
export default FappeTyme;
