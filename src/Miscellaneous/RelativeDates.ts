import Callbacks from "../classes/Callbacks";
import Post from "../classes/Post";
import Index from "../General/Index";
import { g, Conf, d, doc } from "../globals/globals";
import $ from "../platform/$";
import { DAY, HOUR, MINUTE, SECOND } from "../platform/helpers";

var RelativeDates = {
  INTERVAL: 30000,
  callbackRegistered: false,
  listenersBound: false,

  init() {
    RelativeDates.ensureListeners();
    $.on(d, 'RelativePostDatesChanged', RelativeDates.reapply);
    $.sync('RelativeTime', (RelativeTime) => {
      Conf.RelativeTime = RelativeTime;
      RelativeDates.reapply();
    });

    if (Conf.RelativeTime !== 'No') {
      return RelativeDates.ensureCallback();
    }
  },

  ensureListeners() {
    if (RelativeDates.listenersBound) return;
    RelativeDates.listenersBound = true;
    $.on(d, 'visibilitychange PostsInserted', RelativeDates.flush);
  },

  ensureCallback() {
    if (RelativeDates.callbackRegistered) return;
    RelativeDates.callbackRegistered = true;
    return Callbacks.Post.push({
      name: 'Relative Post Dates',
      cb:   RelativeDates.node
    });
  },

  node(this: Post) {
    if (Conf.RelativeTime === 'No') { return; }
    if (!this.info.date) { return; }
    const dateEl = this.nodes.date;
    if (Conf.RelativeTime === 'Hover') {
      RelativeDates.bindHover(this);
      return;
    }
    if (this.isClone) { return; }

    // Show original absolute time as tooltip so users can still know exact times
    // Since "Time Formatting" runs its `node` before us, the title tooltip will
    // pick up the user-formatted time instead of 4chan time when enabled.
    if (Conf.RelativeTime === 'Show') {
      dateEl.dataset.fullTime = dateEl.textContent;
      dateEl.title = dateEl.textContent;
    }

    return RelativeDates.update(this);
  },

  bindHover(post: Post) {
    const dateEl = post.nodes.date;
    if (dateEl.dataset.relativeHoverBound) return;
    dateEl.dataset.relativeHoverBound = '1';
    $.on(dateEl, 'mouseover', () => RelativeDates.hover(post));
  },

  reapply() {
    clearTimeout(RelativeDates.timeout);
    RelativeDates.timeout = undefined;
    RelativeDates.stale = [];

    if (!['index', 'thread', 'archive'].includes(g.VIEW)) return;

    const mode = Conf.RelativeTime;
    if (mode !== 'No') {
      RelativeDates.ensureListeners();
      RelativeDates.ensureCallback();
    }

    g.posts.forEach((post: Post) => {
      if (!post.info.date || post.isFetchedQuote || !doc.contains(post.nodes.root)) return;
      RelativeDates.restore(post);
      if (mode === 'No') return;
      if (mode === 'Hover') {
        RelativeDates.bindHover(post);
        return;
      }
      if (!post.isClone) RelativeDates.update(post);
    });

    if (['Show', 'Both', 'BothRelativeFirst'].includes(mode)) {
      RelativeDates.flush();
    }
  },

  restore(post: Post) {
    for (const singlePost of [post].concat(post.clones)) {
      const node = singlePost.nodes.date;
      const full = node.dataset.fullTime;
      if (full) node.textContent = full;
      node.removeAttribute('title');
    }
  },

  /** @param diff is milliseconds from now. */
  relative(diff: number, now: Date, date: Date, abbrev = false): string {
    let number: number;
    let unit: string;
        if ((number = (diff / DAY)) >= 1) {
      const years = now.getFullYear() - date.getFullYear();
      let months = now.getMonth() - date.getMonth();
      const days = now.getDate() - date.getDate();
      if (years > 1) {
        number = years - ((months < 0) || ((months === 0) && (days < 0)) ? 1 : 0);
        unit = 'year';
      } else if ((years === 1) && ((months > 0) || ((months === 0) && (days >= 0)))) {
        number = years;
        unit = 'year';
      } else if ((months = months + (12*years)) > 1) {
        number = months - (days < 0 ? 1 : 0);
        unit = 'month';
      } else if ((months === 1) && (days >= 0)) {
        number = months;
        unit = 'month';
      } else {
        unit = 'day';
      }
    } else if ((number = (diff / HOUR)) >= 1) {
      unit = 'hour';
    } else if ((number = (diff / MINUTE)) >= 1) {
      unit = 'minute';
    } else {
      // prevent "-1 seconds ago"
      number = Math.max(0, diff) / SECOND;
      unit = 'second';
    }

    const rounded = Math.round(number);

    if (abbrev) {
      unit = unit === 'month' ? 'mo' : unit[0];
    } else {
      if (rounded !== 1) { unit += 's'; } // pluralize
    }

    if (abbrev) { return `${rounded}${unit}`; } else { return `${rounded} ${unit} ago`; }
  },

  // Changing all relative dates as soon as possible incurs many annoying
  // redraws and scroll stuttering. Thus, sacrifice accuracy for UX/CPU economy,
  // and perform redraws when the DOM is otherwise being manipulated (and scroll
  // stuttering won't be noticed), falling back to INTERVAL while the page
  // is visible.
  //
  // Each individual dateTime element will add its update() function to the stale list
  // when it is to be called.
  stale: [],
  timeout: undefined as undefined | number,
  flush() {
    // No point in changing the dates until the user sees them.
    if (d.hidden) { return; }

    const now = new Date();
    for (var data of RelativeDates.stale) { RelativeDates.update(data, now); }
    RelativeDates.stale = [];

    // Reset automatic flush.
    clearTimeout(RelativeDates.timeout);
    RelativeDates.timeout = setTimeout(RelativeDates.flush, RelativeDates.INTERVAL);
  },

  hover(post) {
    const { date } = post.info;
    const now  = new Date();
    const diff = now.getTime() - date.getTime();
    post.nodes.date.title = RelativeDates.relative(diff, now, date);
  },

  // `update()`, when called from `flush()`, updates the elements,
  // and re-calls `setOwnTimeout()` to re-add `data` to the stale list later.
  update(data: Post | HTMLElement, now = new Date()) {
    let abbrev: boolean, date: Date;
    const isPost = data instanceof Post;
    if (isPost) {
      ({ date } = data.info);
      abbrev = false;
    } else {
      date = new Date(+data.dataset.utc);
      abbrev = !!data.dataset.abbrev;
    }
    const diff = now.getTime() - date.getTime();
    const relative = RelativeDates.relative(diff, now, date, abbrev);
    if (isPost) {
      for (var singlePost of [data].concat(data.clones)) {
        const node = singlePost.nodes.date;
        if (Conf.RelativeTime === 'Show') {
          node.textContent = relative;
        } else {
          let full = node.dataset.fullTime;
          if (!full) {
            full = node.textContent;
            node.dataset.fullTime = full;
          }
          node.textContent = Conf.RelativeTime === 'Both' ? `${full}, ${relative}` : `${relative}, ${full}`;
        }
      }
    } else {
      data.firstChild.textContent = relative;
    }
    RelativeDates.setOwnTimeout(diff, data);
  },

  setOwnTimeout(diff, data) {
    const delay = diff < MINUTE ?
      SECOND - ((diff + (SECOND / 2)) % SECOND)
    : diff < HOUR ?
      MINUTE - ((diff + (MINUTE / 2)) % MINUTE)
    : diff < DAY ?
      HOUR - ((diff + (HOUR / 2)) % HOUR)
    :
      DAY - ((diff + (DAY / 2)) % DAY);
    setTimeout(RelativeDates.markStale, delay, data);
  },

  markStale(data) {
    if (RelativeDates.stale.includes(data)) { return; } // We can call RelativeDates.update() multiple times.
    if (data instanceof Post && !g.posts.get(data.fullID)) { return; } // collected post.
    if (data instanceof Element && !doc.contains(data)) { return; } // removed catalog reply.
    RelativeDates.stale.push(data);
  }
};
export default RelativeDates;
