import type Post from "../classes/Post";
import { g, Conf, d } from "../globals/globals";
import $ from "../platform/$";
import Menu from "./Menu";

var ReportLink = {
  url: null as any,   // loose: late-assigned report URL
  dims: null as any,  // loose: late-assigned window dimensions

  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread') || !Conf['Menu'] || !Conf['Report Link']) { return; }

    const a = $.el('a', {
      className: 'report-link',
      href: 'javascript:;',
      textContent: 'Report'
    }
    );
    $.on(a, 'click', ReportLink.report);

    return Menu.menu.addEntry({
      el: a,
      order: 10,
      open(post: Post) {
        ReportLink.url = `//sys.${location.hostname.split('.')[1]}.org/${post.board}/imgboard.php?mode=report&no=${post}`;
        if (d.cookie.indexOf('pass_enabled=1') >= 0) {
          ReportLink.dims = 'width=350,height=275';
        } else {
          ReportLink.dims = 'width=400,height=550';
        }
        return true;
      }
    });
  },

  report() {
    const {url, dims} = ReportLink;
    const id  = Date.now();
    const set = `toolbar=0,scrollbars=1,location=0,status=1,menubar=0,resizable=1,${dims}`;
    return window.open(url, String(id), set);
  }
};
export default ReportLink;
