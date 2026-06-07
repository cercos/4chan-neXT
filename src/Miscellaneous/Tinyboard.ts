import { g } from "../globals/globals";
import Main from "../main/Main";
import $ from "../platform/$";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const Tinyboard = {
  init() {
    if (g.SITE.software !== 'tinyboard') { return; }
    if (g.VIEW === 'thread') {
      return Main.ready(() => $.global("initTinyBoard", { boardID: g.BOARD.ID, threadID: g.THREADID.toString() }));
    }
  }
};
export default Tinyboard;
