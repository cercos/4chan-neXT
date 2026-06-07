import $ from "../platform/$";
import CSS from "../css/CSS";
import { Conf } from "../globals/globals";
import Settings from "../General/Settings";

const CustomCSS = {
  init() {
    // The Custom CSS section's master switch (only ever off when StyleChan is
    // installed) gates injection without touching the user's `Custom CSS` /
    // `usercss` settings, so re-enabling the section restores their CSS.
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
