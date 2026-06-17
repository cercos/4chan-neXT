import { Conf, g } from "../globals/globals";
import $ from "../platform/$";

var Flash = {
  init() {
    if ((g.BOARD!.ID === 'f') && Conf['Enable Native Flash Embedding']) {
      return $.ready(Flash.initReady);
    }
  },

  initReady() {
    if ($.hasStorage) {
      $.global('initFlash');
    } else {
      if (g.VIEW === 'thread') {
        $.global('setThreadId');
      }
      $.global('initFlashNoStorage');
    }
  }
};
export default Flash;
