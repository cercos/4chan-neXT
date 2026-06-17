import Callbacks from "../classes/Callbacks";
import { Conf, d, doc } from "../globals/globals";
import $ from "../platform/$";
import $$ from "../platform/$$";
import type { default as Post } from "../classes/Post";

var AntiAutoplay = {
  init() {
    if (!Conf['Disable Autoplaying Sounds']) { return; }
    $.addClass(doc, 'anti-autoplay');
    for (var audio of $$('audio[autoplay]', doc)) { this.stop(audio); }
    window.addEventListener('loadstart', (e => this.stop(e.target as HTMLAudioElement)), true);
    Callbacks.Post.push({
      name: 'Disable Autoplaying Sounds',
      cb:   this.node
    });
    return $.ready(() => this.process(d.body));
  },

  stop(audio: HTMLAudioElement) {
    if (!audio.autoplay) { return; }
    audio.pause();
    audio.autoplay = false;
    if (audio.controls) { return; }
    audio.controls = true;
    return $.addClass(audio, 'controls-added');
  },

  node(this: Post) {
    return AntiAutoplay.process(this.nodes.comment);
  },

  process(root: HTMLElement | Document) {
    for (var iframe of $$('iframe[src*="youtube"][src*="autoplay=1"]', root)) {
      AntiAutoplay.processVideo(iframe, 'src');
    }
    for (var object of $$('object[data*="youtube"][data*="autoplay=1"]', root)) {
      AntiAutoplay.processVideo(object, 'data');
    }
  },

  processVideo(el: any, attr: 'src' | 'data') { // loose: el indexed dynamically by attr
    el[attr] = el[attr].replace(/\?autoplay=1&?/, '?').replace('&autoplay=1', '');
    if (window.getComputedStyle(el).display === 'none') { el.style.display = 'block'; }
    return $.addClass(el, 'autoplay-removed');
  }
};
export default AntiAutoplay;
