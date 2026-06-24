import $ from "../platform/$";
import Callbacks from "../classes/Callbacks";
import type Post from "../classes/Post";
import CrossOrigin from "../platform/CrossOrigin";
import { Conf, d, g } from "../globals/globals";
import Get from "../General/Get";

// Sites known to strip WebM title metadata, making this feature only show "no title" and pointless to display.
export const noWebmTitleMetadataSites = ['4chan.org'];

var Metadata = {
  init() {
    if (!Conf['WEBM Metadata'] || (g.VIEW !== 'index' && g.VIEW !== 'thread')) { return; }
    if (noWebmTitleMetadataSites.includes(g.SITE!.ID)) { return; }

    return Callbacks.Post.push({
      name: 'WEBM Metadata',
      cb:   this.node
    });
  },

  node(this: Post) {
    for (let i = 0; i < this.files.length; i++) {
      var file = this.files[i];
      if (/webm$/i.test(file.url)) {var el;
      
        if (this.isClone) {
          el = $('.webm-title', file.text as unknown as Element);
        } else {
          el = $.el('span',
            {className: 'webm-title'});
          el.dataset.index = String(i);
          $.extend(el,
            {innerHTML: "<a href=\"javascript:;\"></a>"});
          $.add(file.text, [$.tn(' '), el]);
        }
        if (el.children.length === 1) { $.one(el.lastElementChild, 'mouseover focus', Metadata.load); }
      }
    }
  },

  load(this: HTMLElement) {
    $.rmClass(this.parentNode, 'error');
    $.addClass(this.parentNode, 'loading');
    const {index} = (this.parentNode as HTMLElement).dataset;
    const post = Get.postFromNode(this);
    if (!post) { return; }
    return CrossOrigin.binary(post.files[+index!].url, data => {
      $.rmClass(this.parentNode, 'loading');
      if (data != null) {
        const title = Metadata.parse(data);
        const output = $.el('span',
          {textContent: title || ''});
        if (title == null) { $.addClass(this.parentNode, 'not-found'); }
        $.before(this, output);
        (this.parentNode as HTMLElement).tabIndex = 0;
        if (d.activeElement === this) { (this.parentNode as HTMLElement).focus(); }
        return this.tabIndex = -1;
      } else {
        $.addClass(this.parentNode, 'error');
        return $.one(this, 'click', Metadata.load);
      }
    }
    ,
      {Range: 'bytes=0-9999'});
  },

  parse(data: Uint8Array) {
    const readInt = function() {
      let n = data[i++];
      let len = 0;
      while (n < (0x80 >> len)) { len++; }
      n ^= (0x80 >> len);
      while (len-- && (i < data.length)) {
        n = (n << 8) ^ data[i++];
      }
      return n;
    };

    var i = 0;
    while (i < data.length) {
      var element = readInt();
      var size    = readInt();
      if (element === 0x3BA9) { // Title
        var title = '';
        while (size-- && (i < data.length)) {
          title += String.fromCharCode(data[i++]);
        }
        return decodeURIComponent(escape(title)); // UTF-8 decoding
      } else if (![0x8538067, 0x549A966].includes(element)) { // Segment, Info
        i += size;
      }
    }
    return null;
  }
};
export default Metadata;
