import { g } from "../globals/globals";
import Main from "../main/Main";
import $ from "../platform/$";

const Tinyboard = {
  init() {
    if (g.SITE!.software !== 'tinyboard') { return; }
    if (g.VIEW === 'thread') {
      return Main.ready(() => $.global("initTinyBoard", { boardID: g.BOARD!.ID, threadID: g.THREADID!.toString() }));
    }
  }
};
export default Tinyboard;
