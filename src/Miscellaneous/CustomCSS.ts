import $ from "../platform/$";
import CSS from "../css/CSS";
import { Conf } from "../globals/globals";
import Settings from "../General/Settings";

const CustomCSS = {
  // Assigned later; declared so the singleton's type includes it. Loosely typed
  // where a precise type would cascade new errors; tighten during the strict pass.
  style: null as any,

  init() {
    if (!Settings.stylingSectionEnabled('customCSS')) { return; }
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
    if (!Settings.stylingSectionEnabled('customCSS') || !Conf['Custom CSS']) {
      return this.rmStyle();
    }
    if (!this.style) {
      return this.addStyle();
    }
    return this.style.textContent = CSS.sub(this.currentCSS());
  }
};
export default CustomCSS;
