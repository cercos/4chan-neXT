import { g, Conf, d } from "../globals/globals";
import Header from "../General/Header";
import Main from "../main/Main";
import $ from "../platform/$";
import { detectMobileDevice, resolveMobileLayout } from "../Miscellaneous/MobileLayout";
const PassLink = {
  init() {
    if ((g.SITE!.software !== 'yotsuba') || !Conf['Pass Link']) { return; }
    return Main.ready(PassLink.ready);
  },

  open() {
    window.open(`//sys.${location.hostname.split('.')[1]}.org/auth`,
      String(Date.now()),
      'width=500,height=280,toolbar=0');
  },

  ready() {
    if (resolveMobileLayout(Conf['Mobile Layout'], detectMobileDevice())) {
      const entry = $.el('a', {
        href: 'javascript:;',
        textContent: '4chan Pass'
      });
      $.on(entry, 'click', PassLink.open);
      Header.menu.addEntry({
        el: entry,
        order: 300,
        open() { return d.cookie.indexOf('pass_enabled=1') < 0; }
      });
    }

    let styleSelector;
    if (!(styleSelector = $.id('styleSelector'))) { return; }

    const passLink = $.el('span',
      {className: 'brackets-wrap pass-link-container'});
    $.extend(passLink, {innerHTML: "<a href=\"javascript:;\">4chan Pass</a>"});
    $.on(passLink.firstElementChild, 'click', PassLink.open);
    return $.before(styleSelector.previousSibling, [passLink, $.tn('  ')]);
  }
};
export default PassLink;
