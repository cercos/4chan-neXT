import $ from "../platform/$";
import CSS from "../css/CSS";
import { Conf } from "../globals/globals";
import Settings from "../General/Settings";

const CustomCSS = {
  init() {
    if (Settings.shouldDeferStylingToStylechan()) {
      if (Conf['Custom CSS']) {
        Conf['Custom CSS'] = false;
        $.set('Custom CSS', false);
      }
      if (Conf['customCSSHome']) {
        Conf['customCSSHome'] = false;
        $.set('customCSSHome', false);
      }
      return;
    }
    if (!Conf['Custom CSS']) { return; }
    return this.addStyle();
  },

  currentCSS() {
    return Settings.styleConf('usercss') || '';
  },

  addStyle() {
    return this.style = $.addStyle(CSS.sub(this.currentCSS()), 'custom-css', '#fourchanx-css');
  },

  rmStyle() {
    if (this.style) {
      $.rm(this.style);
      return delete this.style;
    }
  },

  update() {
    if (!this.style) {
      return this.addStyle();
    }
    return this.style.textContent = CSS.sub(this.currentCSS());
  }
};
export default CustomCSS;
