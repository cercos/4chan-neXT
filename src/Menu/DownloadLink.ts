import type Post from "../classes/Post";
import { g, Conf } from "../globals/globals";
import ImageCommon from "../Images/ImageCommon";
import $ from "../platform/$";
import Menu from "./Menu";

const DownloadLink = {
  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread') || !Conf['Menu'] || !Conf['Download Link']) { return; }

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
        return true;
      }
    });
  }
};
export default DownloadLink;
