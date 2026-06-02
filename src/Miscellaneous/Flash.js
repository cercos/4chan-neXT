import { g } from "../globals/globals";
import $ from "../platform/$";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
var Flash = {
  init() {
    if (g.BOARD.ID === 'f') {
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
