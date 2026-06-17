import $ from "../platform/$";
import type Thread from "./Thread";

export default class CatalogThread {
  declare thread: Thread;
  declare ID: number;
  declare board: any;
  declare nodes: {
    root: HTMLElement;
    thumb: HTMLElement;
    icons: HTMLElement;
    postCount: HTMLElement;
    fileCount: HTMLElement;
    pageCount: HTMLElement;
    replies: HTMLElement | null;
  };

  toString() { return this.ID; }

  constructor(root: HTMLElement, thread: Thread) {
    this.thread = thread;
    this.ID    = this.thread.ID;
    this.board = this.thread.board;
    const {post} = this.thread.OP.nodes;
    this.nodes = {
      root,
      thumb:     $('.catalog-thumb', post),
      icons:     $('.catalog-icons', post),
      postCount: $('.post-count',    post),
      fileCount: $('.file-count',    post),
      pageCount: $('.page-count',    post),
      replies:   null
    };
    this.thread.catalogView = this;
  }
}
