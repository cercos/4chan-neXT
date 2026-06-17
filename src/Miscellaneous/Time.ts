import $ from "../platform/$";
import Callbacks from "../classes/Callbacks";
import Post from "../classes/Post";
import { g, Conf } from "../globals/globals";

var Time = {
  init() {
    if ((g.VIEW !== 'index' && g.VIEW !== 'thread' && g.VIEW !== 'archive') || !Conf['Time Formatting']) { return; }

    Callbacks.Post.push({
      name: 'Time Formatting',
      cb:   this.node
    });
  },

  node(this: Post) {
    if (!this.info.date || this.isClone) { return; }
    const {textContent} = this.nodes.date;
    this.nodes.date.textContent = textContent.match(/^\s*/)[0] + Time.format(this.info.date) + textContent.match(/\s*$/)[0];
  },

  format(date: Date, formatString: string = Conf['time']) {
    return formatString.replace(/%(.)/g, function(s, c) {
      if ($.hasOwn(Time.formatters, c)) {
        return Time.formatters[c].call(date);
      } else {
        return s;
      }
    });
  },

  zeroPad(n) { if (n < 10) { return `0${n}`; } else { return n; } },

  // Setting up the formatter takes more time than actually formatting the date,
  // So while setting up this cache is a bit more code, it's faster at runtime
  formatterCache: new Map<String, Intl.DateTimeFormat>(),

  formatters: {
    a(this: Date) {
      let formatter = Time.formatterCache.get('a');
      if (!formatter) {
        // || undefined to fall back to browser locale, an empty string gives an error
        formatter = Intl.DateTimeFormat(Conf['timeLocale'] || undefined, {weekday: 'short'});
        Time.formatterCache.set('a', formatter)
      }
      return formatter.format(this);
    },
    A(this: Date) {
      let formatter = Time.formatterCache.get('A');
      if (!formatter) {
        formatter = Intl.DateTimeFormat(Conf['timeLocale'] || undefined, {weekday: 'long'});
        Time.formatterCache.set('A', formatter)
      }
      return formatter.format(this);
    },
    b(this: Date) {
      let formatter = Time.formatterCache.get('b');
      if (!formatter) {
        formatter = Intl.DateTimeFormat(Conf['timeLocale'] || undefined, {month: 'short'});
        Time.formatterCache.set('b', formatter)
      }
      return formatter.format(this);
    },
    B(this: Date) {
      let formatter = Time.formatterCache.get('B');
      if (!formatter) {
        formatter = Intl.DateTimeFormat(Conf['timeLocale'] || undefined, {month: 'long'});
        Time.formatterCache.set('B', formatter)
      }
      return formatter.format(this);
    },
    d(this: Date) { return Time.zeroPad(this.getDate()); },
    e(this: Date) { return this.getDate(); },
    H(this: Date) { return Time.zeroPad(this.getHours()); },
    I(this: Date) { return Time.zeroPad((this.getHours() % 12) || 12); },
    k(this: Date) { return this.getHours(); },
    l(this: Date) { return (this.getHours() % 12) || 12; },
    m(this: Date) { return Time.zeroPad(this.getMonth() + 1); },
    n(this: Date) { return this.getMonth() + 1; },
    M(this: Date) { return Time.zeroPad(this.getMinutes()); },
    p(this: Date) {
      let formatter = Time.formatterCache.get('p');
      if (!formatter) {
        formatter = Intl.DateTimeFormat(Conf['timeLocale'] || undefined, {hour: 'numeric', hour12: true});
        Time.formatterCache.set('p', formatter)
      }
      const parts = formatter.formatToParts(this);
      return parts.find((entry) => entry.type === 'dayPeriod')?.value || '';
    },
    P(this: Date) { return Time.formatters.p.call(this).toLowerCase(); },
    S(this: Date) { return Time.zeroPad(this.getSeconds()); },
    y(this: Date) { return this.getFullYear().toString().slice(2); },
    Y(this: Date) { return this.getFullYear(); },
    '%'(this: Date) { return '%'; }
  },
};
export default Time;
