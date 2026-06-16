import { g } from "../globals/globals";
import $ from "../platform/$";
import Board from "./Board";
import Thread from "./Thread";

export default class CatalogThreadNative {
  declare nodes: {
    root: HTMLElement;
    thumb: HTMLElement;
  };
  declare siteID: string;
  declare boardID: string;
  declare board: Board;
  declare ID: number;
  declare threadID: number;
  declare thread: Thread;

  toString() { return this.ID; }

  constructor(root) {
    this.nodes = {
      root,
      thumb: $(g.SITE.selectors.catalog.thumb, root)
    };
    this.siteID  = g.SITE.ID;
    this.boardID = (this.nodes.thumb.parentNode as any).pathname.split(/\/+/)[1];
    this.board = g.boards[this.boardID] || new Board(this.boardID);
    this.ID = (this.threadID = +(root.dataset.id || root.id).match(/\d*$/)[0]);
    this.thread = this.board.threads.get(String(this.ID)) || new Thread(String(this.ID), this.board);
  }
}
