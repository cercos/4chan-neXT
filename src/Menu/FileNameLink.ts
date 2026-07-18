import type Post from "../classes/Post";
import { g, Conf } from "../globals/globals";
import { detectMobileDevice, resolveMobileLayout } from "../Miscellaneous/MobileLayout";
import $ from "../platform/$";
import Menu from "./Menu";

const FileNameLink = {
  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread') || !Conf['Menu']) { return; }
    if (!resolveMobileLayout(Conf['Mobile Layout'], detectMobileDevice())) { return; }

    const a = $.el('a', {
      className: 'filename-link',
      target: '_blank'
    }) as HTMLAnchorElement;

    return Menu.menu.addEntry({
      el: a,
      order: 99,
      open({file}: Post) {
        if (!file) { return false; }
        a.href = file.url;
        a.textContent = file.name;
        return true;
      }
    });
  }
};
export default FileNameLink;
