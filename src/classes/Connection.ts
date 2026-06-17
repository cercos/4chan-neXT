import $ from "../platform/$";
import { g } from "../globals/globals";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
export default class Connection {
  declare target: Window | HTMLIFrameElement;
  declare origin: string;
  declare cb: { [type: string]: (value: any) => void };

  constructor(target: Window | HTMLIFrameElement, origin: string, cb: { [type: string]: (value: any) => void } = {}) {
    this.send = this.send.bind(this);
    this.onMessage = this.onMessage.bind(this);
    this.target = target;
    this.origin = origin;
    this.cb = cb;
    $.on(window, 'message', this.onMessage);
  }

  targetWindow() {
    if (this.target instanceof window.HTMLIFrameElement) {
      return this.target.contentWindow;
    } else {
      return this.target;
    }
  }

  send(data: any) {
    return this.targetWindow()?.postMessage(`${g.NAMESPACE}${JSON.stringify(data)}`, this.origin);
  }

  onMessage(e: MessageEvent) {
    if ((e.source !== this.targetWindow()) ||
      (e.origin !== this.origin) ||
      (typeof e.data !== 'string') ||
      (e.data.slice(0, g.NAMESPACE.length) !== g.NAMESPACE)) { return; }
    const data = JSON.parse(e.data.slice(g.NAMESPACE.length));
    for (var type in data) {
      var value = data[type];
      if ($.hasOwn(this.cb, type)) {
        this.cb[type](value);
      }
    }
  }
}
