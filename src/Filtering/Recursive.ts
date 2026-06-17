import Callbacks from "../classes/Callbacks";
import type Post from "../classes/Post";
import { g } from "../globals/globals";

type DropFirst<T extends unknown[]> = T extends [any, ...infer U] ? U : never;

var Recursive = {
  recursives: new Map<string, { recursives: ((...args: any) => void)[], args: any[][] }>(),

  init() {
    if (g.VIEW !== 'index' && g.VIEW !== 'thread') return;
    Callbacks.Post.push({
      name: 'Recursive',
      cb:   this.node
    });
  },

  node(this: Post) {
    if (this.isClone || this.isFetchedQuote) return;
    for (var quote of this.quotes) {
      const obj = Recursive.recursives.get(quote);
      if (obj) {
        for (var i = 0; i < obj.recursives.length; i++) {
          obj.recursives[i](this, ...obj.args[i]);
        }
      }
    }
  },

  add<Fn extends (post: Post, ...args: any[]) => void>(recursive: Fn, post: Post, ...args: DropFirst<Parameters<Fn>>) {
    let obj = Recursive.recursives.get(post.fullID);
    if (!obj) {
      obj = { recursives: [], args: [] };
      Recursive.recursives.set(post.fullID, obj);
    }
    obj.recursives.push(recursive);
    obj.args.push(args);
  },

  rm(recursive: (...args: any[]) => void, post: Post) {
    const obj = Recursive.recursives.get(post.fullID);
    if (!obj) return;
    for (let i = obj.recursives.length - 1; i >= 0; --i) {
      if (obj.recursives[i] === recursive) {
        obj.recursives.splice(i, 1);
        obj.args.splice(i, 1);
      }
    }
  },

  apply<Fn extends (post: Post, ...args: any[]) => void>(
    recursive: Fn,
    post: Post,
    ...args: DropFirst<Parameters<Fn>>
  ) {
    const {fullID} = post;
    g.posts!.forEach(function(post) {
      if (post.quotes.includes(fullID)) {
        recursive(post, ...args);
      }
    });
  },

  applyAndAdd<Fn extends (post: Post, ...args: any[]) => void>(
    recursive: Fn,
    post: Post,
    ...args: DropFirst<Parameters<Fn>>
  ) {
    Recursive.apply(recursive, post, ...args);
    this.add(recursive, post, ...args);
  },
};
export default Recursive;
