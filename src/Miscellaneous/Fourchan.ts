import Callbacks from "../classes/Callbacks";
import BoardConfig from "../General/BoardConfig";
import { d, doc, g } from "../globals/globals";
import Main from "../main/Main";
import $ from "../platform/$";
import $$ from "../platform/$$";
import ExpandComment from "./ExpandComment";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
var Fourchan = {
  init() {
    if ((g.SITE.software !== 'yotsuba') || !['index', 'thread', 'archive'].includes(g.VIEW)) { return; }
    BoardConfig.ready(this.initBoard);
    return Main.ready(this.initReady);
  },

  initBoard() {
    if (g.BOARD.config.code_tags) {
      $.on(window, 'prettyprint:cb', function(e) {
        let post, pre;
        if (!(post = g.posts.get(e.detail.ID))) { return; }
        if (!(pre  = $$('.prettyprint', post.nodes.comment)[+e.detail.i])) { return; }
        if (!$.hasClass(pre, 'prettyprinted')) {
          pre.innerHTML = e.detail.html;
          return $.addClass(pre, 'prettyprinted');
        }
      });
      $.global('fourChanPrettyPrintListener');
      Callbacks.Post.push({
        name: 'Parse [code] tags',
        cb:   Fourchan.code
      });
      g.posts.forEach(function(post) {
        if (post.callbacksExecuted) {
          return Callbacks.Post.execute(post, ['Parse [code] tags'], true);
        }
      });
      ExpandComment.callbacks.push(Fourchan.code);
    }

    if (g.BOARD.config.math_tags) {
      $.global('fourChanMathjaxListener');
      Callbacks.Post.push({
        name: 'Parse [math] tags',
        cb:   Fourchan.math
      });
      g.posts.forEach(function(post) {
        if (post.callbacksExecuted) {
          return Callbacks.Post.execute(post, ['Parse [math] tags'], true);
        }
      });
      return ExpandComment.callbacks.push(Fourchan.math);
    }
  },

  // Disable 4chan's ID highlighting (replaced by IDHighlight) and reported post hiding.
  initReady() {
    return $.global('disable4chanIdHl');
  },

  code() {
    if (this.isClone) { return; }
    return $.ready(() => {
      const iterable = $$('.prettyprint', this.nodes.comment);
      for (let i = 0; i < iterable.length; i++) {
        var pre = iterable[i];
        if (!$.hasClass(pre, 'prettyprinted')) {
          $.event('prettyprint', {ID: this.fullID, i, html: pre.innerHTML}, window);
        }
      }
    });
  },

  math() {
    let wbrs;
    if (!/\[(math|eqn)\]/.test(this.nodes.comment.textContent)) { return; }
    // XXX <wbr> tags frequently break MathJax; remove them.
    if ((wbrs = $$('wbr', this.nodes.comment)).length) {
      for (var wbr of wbrs) { $.rm(wbr); }
      this.nodes.comment.normalize();
    }
    var cb = () => {
      if (!doc.contains(this.nodes.comment)) { return; }
      $.off(d, 'PostsInserted', cb);
      return $.event('mathjax', null, this.nodes.comment);
    };
    $.on(d, 'PostsInserted', cb);
    return cb();
  }
};
export default Fourchan;
