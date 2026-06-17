import { Conf, d } from "../globals/globals";
import $ from "../platform/$";
import PassMessagePage from './PassMessage/PassMessageHtml';
const PassMessage = {
  init() {
    if (Conf['passMessageClosed']) { return; }
    const msg = $.el('div',
      {className: 'box-outer top-box'}
    ,
      PassMessagePage);
    msg.style.cssText = 'padding-bottom: 0;';
    const close = $('a', msg);
    $.on(close, 'click', function() {
      $.rm(msg);
      return $.set('passMessageClosed', true);
    });
    return $.ready(function() {
      let hd;
      if (hd = $.id('hd')) {
        return $.after(hd, msg);
      } else {
        return $.prepend(d.body, msg);
      }
    });
  }
};
export default PassMessage;
