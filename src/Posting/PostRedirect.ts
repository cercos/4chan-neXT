import { d } from "../globals/globals";
import $ from "../platform/$";

const PostRedirect = {
  init() {
    return $.on(d, 'QRPostSuccessful', e => {
      if (!e.detail.redirect) { return; }
      this.event = e;
      this.delays = 0;
      return $.queueTask(() => {
        if ((e === this.event) && (this.delays === 0)) {
          return location.href = e.detail.redirect;
        }
      });
    });
  },

  delays: 0,
  event: null as any, // loose: late-assigned singleton state

  delay() {
    if (!this.event) { return null; }
    const e = this.event;
    this.delays++;
    return () => {
      if (e !== this.event) { return; }
      this.delays--;
      if (this.delays === 0) {
        return location.href = e.detail.redirect;
      }
    };
  }
};
export default PostRedirect;
