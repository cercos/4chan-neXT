import type Post from "../classes/Post";
import { g, Conf } from "../globals/globals";
import ImageCommon from "../Images/ImageCommon";
import { detectMobileDevice, resolveMobileLayout } from "../Miscellaneous/MobileLayout";
import $ from "../platform/$";
import Menu from "./Menu";

const DownloadLink = {
  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread') || !Conf['Menu']) { return; }
    const mobile = resolveMobileLayout(Conf['Mobile Layout'], detectMobileDevice());
    if (!Conf['Download Link'] && !mobile) { return; }

    const a = $.el('a', {
      className: 'download-link',
      textContent: 'Download file'
    }
    );

    // Specifying the filename with the download attribute only works for same-origin links.
    $.on(a, 'click', ImageCommon.download);

    return Menu.menu.addEntry({
      el: a,
      order: 100,
      open({file}: Post) {
        if (!file) { return false; }
        a.href     = file.url;
        a.download = file.name;
        if (mobile) {
          const details = file.dimensions ? `${file.size}, ${file.dimensions}` : file.size;
          a.textContent = `Download file (${details})`;
        }
        return true;
      }
    });
  }
};
export default DownloadLink;
