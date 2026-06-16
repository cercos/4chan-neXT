import Callbacks from "../classes/Callbacks";
import Notice from "../classes/Notice";
import Config from "../config/Config";
import Get from "../General/Get";
import Settings from "../General/Settings";
import UndoStack from "../General/UndoStack";
import { g, Conf, doc } from "../globals/globals";
import Menu from "../Menu/Menu";
import Unread from "../Monitoring/Unread";
import $ from "../platform/$";
import $$ from "../platform/$$";
import { dict } from "../platform/helpers";
import QuoteYou from "../Quotelinks/QuoteYou";
import PostHiding from "./PostHiding";
import ThreadHiding from "./ThreadHiding";
import Post from "../classes/Post";
import Recursive from "./Recursive";

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */

interface FilterObj {
  regexp: string | RegExp;
  boards: any;
  excludes: any;
  mask: any;
  hide: boolean;
  stub: any;
  hl: string;
  tile?: boolean;
  top?: boolean;
  noti?: boolean;
  poster?: boolean;
  replies?: boolean;
  reason?: string;
  override?: boolean;
  label?: string;
}

export interface FilterResults {
  hide: boolean;
  stub?: boolean;
  hl?: string[] | null;
  top?: boolean;
  noti?: boolean;
  poster?: boolean;
  replies?: boolean;
  reasons?: string[];
};

type FilterType = "postID" | "name" | "uniqueID" | "tripcode" | "capcode" | "pass" | "email" | "subject" | "comment"
  | "flag" | "filename" | "dimensions" | "filesize" | "MD5";

var Filter = {
  /**
   * Uses a Map for string types, with the value to filter for as the key.
   * This allows faster lookup than iterating over every filter.
   */
  filters: new Map<FilterType, FilterObj[] | Map<string, FilterObj[]>>(),

  init(this: typeof Filter) {
    if (!['index', 'thread', 'catalog'].includes(g.VIEW) || !Conf['Filter']) return;
    if ((g.VIEW === 'catalog') && !Conf['Filter in Native Catalog']) return;

    if (!Conf['Filtered Backlinks']) {
      $.addClass(doc, 'hide-backlinks');
    }

    const easyLines = Filter.easyFilterLines();
    Filter.injectEasyHighlightColors();
    for (var key in Config.filter) {
      const lines = (Conf[key] as string).split('\n');
      if (key === 'general' && easyLines.length) lines.push(...easyLines);
      for (var line of lines) {
        let hl:       string;
        let tile =    false;
        let regexp:   RegExp | string;
        let top:      boolean;
        let hide =    true;
        let mask =    0;
        let boards:   any = false;
        let excludes: any = false;
        let reason:   string | undefined;
        let poster =  false;
        let replies = false;
        let noti =    false;
        let override = false;
        let stub =    Conf.Stubs;

        if (line[0] === '#') continue;

        const regexpMatch = line.match(/\/(.*)\/(\w*)/);
        if (!regexpMatch) {
          continue;
        }

        if (key === 'uniqueID' || key === 'MD5') {
          // MD5 filter will use strings instead of regular expressions.
          regexp = regexpMatch[1];
        } else {
          try {
            // Please, don't write silly regular expressions.
            regexp = RegExp(regexpMatch[1], regexpMatch[2]);
          } catch (err) {
            // I warned you, bro.
            new Notice('warning', [
              $.tn(`Invalid ${key} filter:`),
              $.el('br'),
              $.tn(line),
              $.el('br'),
              $.tn(err.message)
            ], 60);
            continue;
          }
        }

        // Don't mix up filter flags with the regular expression.
        const options = line.length > regexpMatch[0].length ? line.replace(regexpMatch[0], '') : '';

        if (options) {

          // List of the boards this filter applies to.
          boards = this.parseBoards(options.match(/(?:^|;)\s*boards:([^;]+)/)?.[1]);

          // Boards to exclude from an otherwise global rule.
          excludes = this.parseBoards(options.match(/(?:^|;)\s*exclude:([^;]+)/)?.[1]);

          // Filter OPs along with their threads or replies only.
          const op = options.match(/(?:^|;)\s*op:(no|only)/)?.[1] || '';
          mask = $.getOwn({'no': 1, 'only': 2}, op) || 0;

          // Filter only posts with/without files.
          const file = options.match(/(?:^|;)\s*file:(no|only)/)?.[1] || '';
          mask = mask | ($.getOwn({'no': 4, 'only': 8}, file) || 0);

          // Overrule the `Show Stubs` setting.
          // Defaults to stub showing.
          stub = (() => { switch (options.match(/(?:^|;)\s*stub:(yes|no)/)?.[1]) {
            case 'yes':
              return true;
            case 'no':
              return false;
            default:
              return Conf['Stubs'];
          } })();

          // Desktop notification
          noti = /(?:^|;)\s*notify/.test(options);

          // Highlight the post.
          // If not specified, the highlight class will be filter-highlight.
          // Accepts a comma-separated list of classes (e.g. `highlight:xt-hl-ff0000,my-class`),
          // applied together; test() splits them apart.
          const highlightRes = options.match(/(?:^|;)\s*highlight(?::([\w,-]+))?/)
          if (highlightRes) {
            hl = highlightRes[1] || 'filter-highlight';
            // Glow around the whole catalog entry (image + text) instead of
            // just the thumbnail. Catalog-only; no effect in thread view.
            tile = /(?:^|;)\s*tile(?:[;:]|$)/.test(options);
            // Put highlighted OP's thread on top of the board page or not.
            // Defaults to on top.
            top = (options.match(/(?:^|;)\s*top:(yes|no)/)?.[1] || 'yes') === 'yes';
            hide = /(?:^|;)\s*hide(?:[;:]|$)/.test(options);
          }

          // Whitelist: a matching highlight with this flag prevents the post from
          // being hidden by any other rule. Only meaningful on highlight filters.
          override = !!hl && /(?:^|;)\s*override(?:[;:]|$)/.test(options);

          // Hide the post (default case).
          hide = hide || !(hl || noti);

          reason = options.match(/(?:^|;)\s*reason:([^;$]+)/)?.[1];

          poster = /(?:^|;)\s*poster(?:[;:]|$)/.test(options);

          replies = /(?:^|;)\s*replies(?:[;:]|$)/.test(options);
        }

        const label = (regexp instanceof RegExp)
          ? `${key}: /${regexp.source}/${regexp.flags}`
          : `${key}: ${regexp}`;

        const filterObj: FilterObj
          = { regexp, boards, excludes, mask, hide, stub, hl, tile, top, noti, reason, poster, replies, override, label };

        // Fields that this filter applies to (for 'general' filters)
        if (key === 'general') {
          const types = options.match(/(?:^|;)\s*type:([^;]*)/)?.[1].split(',')
            || ['subject', 'name', 'filename', 'comment'];
          for (var type of types) {
            this.filters.get(type)?.push(filterObj) ?? this.filters.set(type, [filterObj]);
          }
        } else {
          this.filters.get(key)?.push(filterObj) ?? this.filters.set(key, [filterObj]);
        }
      }
    }

    if (!this.filters.size) return;

    // conversion from array to map for string types
    for (const type of ['MD5', 'uniqueID'] satisfies FilterType[]) {
      const filtersForType = this.filters.get(type);
      if (!filtersForType) continue;

      const map = new Map<string, FilterObj[]>();
      for (const filter of filtersForType) {
        map.get(filter.regexp)?.push(filter) ?? map.set(filter.regexp, [filter]);
      }

      this.filters.set(type, map);
    }

    if (g.VIEW === 'catalog') {
      return Filter.catalog();
    } else {
      return Callbacks.Post.push({
        name: 'Filter',
        cb:   this.node
      });
    }
  },

  // Parse comma-separated list of boards.
  // Sites can be specified by a beginning part of the site domain followed by a colon.
  parseBoards(boardsRaw: string) {
    let boards;
    if (!boardsRaw) { return false; }
    if (boards = Filter.parseBoardsMemo[boardsRaw]) { return boards; }
    boards = dict();
    let siteFilter = '';
    for (var boardID of boardsRaw.split(',')) {
      if (boardID.includes(':')) {
        [siteFilter, boardID] = boardID.split(':').slice(-2);
      }
      for (var siteID in g.sites) {
        var site = g.sites[siteID];
        if (siteID.slice(0, siteFilter.length) === siteFilter) {
          if (['nsfw', 'sfw'].includes(boardID)) {
            for (var boardID2 of site.sfwBoards?.(boardID === 'sfw') || []) {
              boards[`${siteID}/${boardID2}`] = true;
            }
          } else {
            boards[`${siteID}/${encodeURIComponent(boardID)}`] = true;
          }
        }
      }
    }
    Filter.parseBoardsMemo[boardsRaw] = boards;
    return boards;
  },

  parseBoardsMemo: dict(),

  test(post: Post, hideable = true): FilterResults {
    if (post.filterResults) return post.filterResults;
    let hide           = false;
    let stub           = true;
    let hl  : string[] = undefined;
    let top            = false;
    let noti           = false;
    let poster         = false;
    let replies        = false;
    let hlOverride     = false;
    let reasons: string[];
    if (QuoteYou.isYou(post)) {
      hideable = false;
    }
    let mask = (post.isReply ? 2 : 1);
    mask = (mask | (post.file ? 4 : 8));
    const board = `${post.siteID}/${post.boardID}`;
    const site = `${post.siteID}/*`;
    for (const type of Filter.filters.keys()) {
      for (const value of Filter.values(type, post)) {
        const filtersOrMap = Filter.filters.get(type);

        const filtersForType: FilterObj[] = Array.isArray(filtersOrMap) ? filtersOrMap : filtersOrMap.get(value);
        if (!filtersForType) continue;

        const isString = type === 'uniqueID' || type === 'MD5';

        for (const filter of filtersForType) {
          if (
            (filter.boards   && !(filter.boards[board]   || filter.boards[site]  )) ||
            (filter.excludes &&  (filter.excludes[board] || filter.excludes[site])) ||
            (filter.mask & mask) ||
            (isString ? (filter.regexp !== value) : !(filter.regexp as RegExp).test(value))
          ) continue;
          if (filter.hide) {
            if (hideable) {
              hide = true;
              if (stub) {
                ({ stub } = filter);
                (reasons || (reasons = [])).push(filter.reason || `Filtered ${type} ${filter.regexp}`);
              }
            }
          }
          if (filter.hl) {
            // A filter may carry several comma-separated highlight classes.
            for (const cls of filter.hl.split(',')) {
              if (!cls || hl?.includes(cls)) continue;
              (hl || (hl = [])).push(cls);
              // A generated `xt-hl-<rrggbb>` class only sets color variables; pair it
              // with `filter-highlight` so the actual highlight styling applies (see
              // injectEasyHighlightColors).
              if (cls.startsWith('xt-hl-') && !hl.includes('filter-highlight')) {
                hl.push('filter-highlight');
              }
            }
          }
          // `;tile` glows the whole catalog entry instead of the thumbnail.
          if (filter.hl && filter.tile && !hl.includes('filter-glow-tile')) {
            hl.push('filter-glow-tile');
          }
          if (filter.override && filter.hl) hlOverride = true;
          if (!top) { ({ top } = filter); }
          if (filter.noti) noti = true;
          if (filter.poster) poster = true;
          if (filter.replies) replies = true;
        }
      }
    }
    if (hide && hlOverride) {
      hide = false;
      reasons = undefined;
    }
    post.filterResults = {hide, stub, hl, top, noti, poster, replies, reasons};
    return post.filterResults;
  },

  // Normalizes one stored/edited Simple Filter rule into a canonical shape, the single
  // source of truth shared by the Settings UI, the live filters, and the injected CSS.
  // A highlight can carry a swatch color (`color` + `colorOn`) and/or a custom CSS
  // class (`hlClass`), applied together ("tandem"). Backward compatible: an older rule
  // whose `color` held a class name is migrated to `hlClass`; a bare hex color turns the
  // swatch on.
  normalizeEasyRule(rule: any) {
    if (!rule || typeof rule !== 'object') return null;

    const pattern = typeof rule.pattern === 'string' ? rule.pattern
      : typeof rule.match === 'string' ? rule.match
      : '';
    const type = (rule.type in Config.filter) ? rule.type : ({
      title: 'subject', body: 'comment', name: 'name',
    } as Record<string, string>)[rule.field] || 'general';
    const hide = (rule.hide != null)
      ? !!rule.hide
      : !['highlight', 'notify'].includes(rule.action);

    const rawColor = typeof rule.color === 'string' ? rule.color.trim() : '';
    const hex = /^#?([0-9a-fA-F]{6})$/.exec(rawColor);
    let hlClass = typeof rule.hlClass === 'string' ? rule.hlClass.trim() : '';
    // Legacy rules stored a CSS class name in `color`; move it to the class field.
    if (!hex && rawColor && !hlClass) hlClass = rawColor;
    hlClass = hlClass.replace(/^\.+/, '').replace(/[^\w-]/g, '');

    return {
      enabled: rule.enabled != null ? !!rule.enabled : true,
      pattern,
      boards: typeof rule.boards === 'string' ? rule.boards : '',
      type,
      color: hex ? `#${hex[1].toLowerCase()}` : '#dd0000',
      colorOn: rule.colorOn != null ? !!rule.colorOn : !!hex,
      hlClass,
      auto: !!rule.auto,
      hide,
      override: !!rule.override,
      action: rule.action,
      caseSensitive: !!rule.caseSensitive,
    };
  },

  // Parses the stored easyFilters blob (JSON string or array) into normalized rules.
  parseEasyFilterRules(raw: unknown): any[] {
    let rules: any[] = [];
    if (Array.isArray(raw)) {
      rules = raw;
    } else if (typeof raw === 'string' && raw.trim()) {
      try { rules = JSON.parse(raw); } catch { rules = []; }
    }
    if (!Array.isArray(rules)) return [];
    return rules.map(r => Filter.normalizeEasyRule(r)).filter(Boolean);
  },

  // The highlight CSS classes a normalized rule applies: a generated `xt-hl-<rrggbb>`
  // color class (when the swatch is on) and/or the user's custom class. Both ride
  // together; an empty list means the theme's default highlight.
  easyHighlightClasses(rule: any): string[] {
    const classes: string[] = [];
    if (rule.colorOn && /^#[0-9a-f]{6}$/.test(rule.color)) {
      classes.push(`xt-hl-${rule.color.slice(1)}`);
    }
    if (rule.hlClass) classes.push(rule.hlClass);
    return classes;
  },

  // Builds the advanced-filter line for one normalized rule (or null to skip it).
  easyRuleToLine(rule: any): string | null {
    if (!rule?.enabled) return null;
    const match = (rule.pattern || '').trim();
    if (!match) return null;

    const flags = rule.caseSensitive ? '' : 'i';
    let line = `/${Filter.escape(match)}/${flags}`;

    const options: string[] = [];
    if ((rule.boards || '').trim()) options.push(`boards:${rule.boards.trim()}`);

    const type = (rule.type in Config.filter) ? rule.type : 'general';
    options.push(`type:${type === 'general' ? 'subject,name,comment' : type}`);

    if (!rule.hide) {
      const classes = Filter.easyHighlightClasses(rule);
      options.push(classes.length ? `highlight:${classes.join(',')}` : 'highlight');
      options.push(`top:${rule.auto ? 'yes' : 'no'}`);
      if (rule.override) options.push('override');
    }

    if (rule.action === 'notify') options.push('notify');

    if (options.length) line += `;${options.join(';')}`;
    return line;
  },

  easyFilterLines(): string[] {
    const lines: string[] = [];
    for (const rule of Filter.parseEasyFilterRules(Conf['easyFilters'])) {
      const line = Filter.easyRuleToLine(rule);
      if (line) lines.push(line);
    }
    return lines;
  },

  // Injects a stylesheet defining the highlight color variables for every custom
  // `xt-hl-<rrggbb>` class used by Simple Filters. The generated class sits on the
  // post root alongside `filter-highlight` (added in test()), so all the existing
  // filter-highlight styling (edge bar, side arrows, catalog glow) picks up the color.
  injectEasyHighlightColors() {
    const colors = new Set<string>();
    for (const rule of Filter.parseEasyFilterRules(Conf['easyFilters'])) {
      if (!rule.enabled || rule.hide || !rule.colorOn) continue;
      const hex = /^#([0-9a-f]{6})$/.exec(rule.color);
      if (hex) colors.add(hex[1]);
    }

    const existing = $.id('xt-easy-highlight-colors');
    if (existing) $.rm(existing);
    if (!colors.size) return;

    const css = [...colors].map(hex =>
      `.xt-hl-${hex}{--xt-filter-highlight:#${hex};--xt-highlight-side-arrow:#${hex};--xt-highlight-shadow:#${hex};}`
    ).join('\n');
    $.addStyle(css, 'xt-easy-highlight-colors');
  },

  node(this: Post) {
    if (
      this.isClone ||
      // Happens when hovering over a dead link in the catalog.
      (!this.isReply && !this.thread.nodes.root)
    ) return;

    const {hide, stub, hl, noti, poster, replies }: FilterResults = Filter.test(
      this,
      (!this.isFetchedQuote && (this.isReply || (g.VIEW === 'index')))
    );

    // Add temporary filter for the poster ID for future posts.
    let reason: string;
    if (poster && this.info.uniqueID) {
      reason = `Hidden because it's the same poster as ${this.ID} (${this.filterResults.reasons})`;
      const { uniqueID } = this.info;
      const newFilter: FilterObj = {
        regexp: uniqueID,
        boards: false,
        excludes: false,
        mask: 0,
        hide,
        stub,
        replies,
        // A filter can only have one hl class.
        hl: hl?.[0],
        reason,
      }
      const map: Map<string, FilterObj[]> = Filter.filters.get('uniqueID');
      if (map) {
        map.get(uniqueID)?.push(newFilter) ?? map.set(uniqueID, [newFilter]);
      } else {
        Filter.filters.set('uniqueID', (new Map()).set(uniqueID, [newFilter]))
      }
    }

    if (hide) {
      if (this.isReply) {
        PostHiding.hide(this, stub);
        if (replies) {
          Recursive.applyAndAdd(PostHiding.hide, this, stub, undefined, `Hidden recursively from ${this.ID}`);
        }
        if (poster && this.info.uniqueID) {
          g.posts.forEach((p) => {
            if (p.info.uniqueID === this.info.uniqueID && p !== this) {
              PostHiding.hide(p, stub, replies, reason);
              if (replies) {
                Recursive.applyAndAdd(PostHiding.hide, p, stub, undefined, `Hidden recursively from ${p.ID}`);
              }
            }
          });
        }
      } else {
        ThreadHiding.hide(this.thread, stub);
      }
    }
    if (hl) {
      this.highlights = hl;
      $.addClass(this.nodes.root, ...hl);
      if (this.isReply) {
        const hlFn = (post: Post, ...hl: string[]) => { $.addClass(post.nodes.root, ...hl); };

        if (replies) Recursive.applyAndAdd(hlFn, this, ...hl);

        if (poster && this.info.uniqueID) {
          g.posts.forEach((p) => {
            if (p.info.uniqueID === this.info.uniqueID && p !== this) {
              $.addClass(p.nodes.root, ...hl);
              if (replies) Recursive.applyAndAdd(hlFn, p, ...hl);
            }
          });
        }
      }
    }
    if (noti && Unread.posts && (this.ID > Unread.lastReadPost) && !QuoteYou.isYou(this)) {
      Unread.openNotification(this, ' triggered a notification filter');
    }
    if (this.file?.thumbLink) {
      $.on(this.file.thumbLink, 'click', (e: MouseEvent) => {
        if (!e.shiftKey || !Conf['MD5 Quick Filter in Threads']) return;
        Filter.quickFilterMD5.call(this);
        e.preventDefault();
        e.stopImmediatePropagation();
      });
    }
  },

  catalog() {
    let url;
    if (!(url = g.SITE.urls.catalogJSON?.(g.BOARD))) { return; }
    Filter.catalogData = dict();
    $.ajax(url,
      {onloadend: Filter.catalogParse});
    return Callbacks.CatalogThreadNative.push({
      name: 'Filter',
      cb:   this.catalogNode
    });
  },

  catalogParse() {
    if (![200, 404].includes(this.status)) {
      new Notice('warning', `Failed to fetch catalog JSON data. ${this.status ? `Error ${this.statusText} (${this.status})` : 'Connection Error'}`, 1);
      return;
    }
    for (var page of this.response) {
      for (var item of page.threads) {
        Filter.catalogData[item.no] = item;
      }
    }
    g.BOARD.threads.forEach(function(thread) {
      if (thread.catalogViewNative) {
        return Filter.catalogNode.call(thread.catalogViewNative);
      }
    });
  },

  catalogNode(this: Post) {
    if ((this.boardID !== g.BOARD.ID) || !Filter.catalogData[this.ID]) { return; }
    if (QuoteYou.db?.get({siteID: g.SITE.ID, boardID: this.boardID, threadID: this.ID, postID: this.ID})) { return; }
    const {hide, hl, top} = Filter.test(g.SITE.Build.parseJSON(Filter.catalogData[this.ID], this));
    if (hide) {
      this.nodes.root.hidden = true;
    }
    if (hl) {
      this.highlights = hl;
      $.addClass(this.nodes.root, ...hl);
    }
    if (top) {
      $.prepend(this.nodes.root.parentNode, this.nodes.root);
      g.SITE.catalogPin?.(this.nodes.root);
    }
  },

  isHidden(post: Post) {
    return !!Filter.test(post).hide;
  },

  valueF: {
    postID (post) { return [`${post.ID}`]; },
    name(post) { return post.info.name === undefined ? [] : [post.info.name]; },
    uniqueID(post) { return [post.info.uniqueID || '']; },
    tripcode(post) { return post.info.tripcode === undefined ? [] : [post.info.tripcode]; },
    capcode(post) { return post.info.capcode === undefined ? [] : [post.info.capcode]; },
    pass(post) { return [post.info.pass]; },
    email(post) { return [post.info.email]; },
    subject(post) { return [post.info.subject || (post.isReply ? undefined : '')]; },
    comment(post) {
      if (post.info.comment == null) {
        post.info.comment = g.sites[post.siteID]?.Build?.parseComment?.((post.info as any).commentHTML.innerHTML);
      }
      return [post.info.comment];
    },
    flag(post) { return post.info.flag === undefined ? [] : [post.info.flag]; },
    filename(post) { return post.files.map(f => f.name); },
    dimensions(post) { return post.files.map(f => f.dimensions); },
    filesize(post) { return post.files.map(f => f.size); },
    MD5(post) { return post.files.map(f => f.MD5); }
  } satisfies Record<FilterType, (post: Post) => string[]>,

  values(key: FilterType, post: Post): string[] {
    if ($.hasOwn(Filter.valueF, key)) {
      return Filter.valueF[key](post).filter(v => v != null);
    } else {
      return [key.split('+').map(function(k) {
        let f: (post: Post) => string[];
        if (f = $.getOwn(Filter.valueF, k)) {
          return f(post).map(v => v || '').join('\n');
        } else {
          return '';
        }
      }).join('\n')];
    }
  },

  addFilter(type: FilterType, re: string, cb?: () => void) {
    if (!$.hasOwn(Config.filter, type)) { return; }
    return $.get(type, Conf[type], function(item) {
      const existingLines = (item[type] || '').split('\n');
      const existingSet = new Set(existingLines.map(line => line.trim()).filter(Boolean));
      const linesToAdd = re.split('\n').map(line => line.trim()).filter(Boolean)
        .filter(line => !existingSet.has(line));
      if (!linesToAdd.length) { return cb?.(); }
      const save = [...existingLines, ...linesToAdd].filter(Boolean).join('\n');
      return $.set(type, save, cb);
    });
  },

  removeFilters(type: FilterType, res: FilterObj[] | Map<string, FilterObj[]>, cb?: () => void) {
    return $.get(type, Conf[type], function (item) {
      let save = item[type];
      const filterArray = Array.isArray(res) ? res : [...res.values()].flat();
      const r = filterArray.map(Filter.escape).join('|');
      save = save.replace(RegExp(`(?:$\n|^)(?:${r})$`, 'mg'), '');
      return $.set(type, save, cb);
    });
  },

  showFilters(type) {
    // Open the settings and display & focus the relevant filter textarea.
    Settings.forcedFiltersMode = 'advanced';
    Settings.forcedFilterType = type;
    if (Settings.dialog) {
      const filteringTab = $('.tab-filters', Settings.dialog) as HTMLAnchorElement | null;
      filteringTab?.click();
    } else {
      Settings.open('Filter');
    }
    const section = Settings.dialog ? $('section', Settings.dialog) : $('.section-container');
    return $.onExists(section, `textarea[name="${type}"]`, function(ta: HTMLTextAreaElement) {
      const tl = ta.textLength;
      ta.setSelectionRange(tl, tl);
      return ta.focus();
    });
  },

  quickFilterMD5() {
    const post: Post = this instanceof Post ? this : Get.postFromNode(this);
    const files = post.files.filter(f => f.MD5);
    if (!files.length) { return; }
    const md5s = new Set(files.map(f => f.MD5));
    const filter = files.map(f => `/${f.MD5}/`).join('\n');
    Filter.addFilter('MD5', filter);
    const reason = files.map(f => `Filtered MD5 ${f.MD5}`).join(' & ');
    const origin = (post.origin || post) as Post;
    const hidden: Post[] = [];
    const hideMatchingPost = (candidate: Post) => {
      if (candidate.isHidden || !candidate.files.some(file => file.MD5 && md5s.has(file.MD5))) return;
      delete candidate.filterResults;
      if (candidate.isReply) {
        PostHiding.hide(candidate, undefined, undefined, reason);
      } else if (g.VIEW === 'index') {
        ThreadHiding.hide(candidate.thread);
      }
      hidden.push(candidate);
    };

    if (g.VIEW === 'thread') {
      g.posts.forEach(hideMatchingPost);
    } else {
      hideMatchingPost(origin);
    }

    // Make the quick-filter undoable from the keybind, mirroring the notice's
    // [undo] link: drop the filter we just added and reveal what it hid.
    UndoStack.record('Removed MD5 filter', () => {
      Filter.removeFilters('MD5', [filter]);
      for (const p of hidden) {
        if (p.isReply) {
          PostHiding.show(p);
        } else if (g.VIEW === 'index') {
          ThreadHiding.show(p.thread);
        }
      }
    });

    if (!Conf['MD5 Quick Filter Notifications']) {
      // Feedback for when nothing gets hidden.
      if (post.nodes.post.getBoundingClientRect().height) {
        new Notice('info', 'MD5 filtered.', 2);
      }
      return;
    }

    let {notice} = Filter.quickFilterMD5;
    if (notice) {
      if (!notice.filters.includes(filter)) {
        notice.filters.push(filter);
      }
      if (!notice.posts.includes(origin)) {
        notice.posts.push(origin);
      }
      $('span', notice.el).textContent = `${notice.filters.length} MD5s filtered.`;
      notice.resetTimer();
    } else {
      const msg = $.el('div',
        {innerHTML: "<span>MD5 filtered.</span> [<a href=\"javascript:;\">show</a>] [<a href=\"javascript:;\">undo</a>]"});
      notice = (Filter.quickFilterMD5.notice = new Notice('info', msg, 10, () => delete Filter.quickFilterMD5.notice));
      notice.filters = [filter];
      notice.posts = [origin];
      const links = $$('a', msg);
      $.on(links[0], 'click', Filter.quickFilterCB.show.bind(notice));
      $.on(links[1], 'click', Filter.quickFilterCB.undo.bind(notice));
    }
  },

  quickFilterCB: {
    show() {
      Settings.forcedFiltersMode = 'advanced';
      Filter.showFilters('MD5');
      return this.close();
    },
    undo() {
      Filter.removeFilters('MD5', this.filters);
      for (var post of this.posts) {
        if (post.isReply) {
          PostHiding.show(post);
        } else if (g.VIEW === 'index') {
          ThreadHiding.show(post.thread);
        }
      }
      return this.close();
    }
  },

  escape(value) {
    return value.replace(/\/|\\|\^|\$|\n|\.|\(|\)|\{|\}|\[|\]|\?|\*|\+|\|/g, (c) => {
      if (c === '\n') {
        return '\\n';
      } else {
        return `\\${c}`;
      }
    });
  },

  menu: {
    init() {
      if (!['index', 'thread'].includes(g.VIEW) || !Conf['Menu'] || !Conf['Filter']) { return; }

      const div = $.el('div',
        {textContent: 'Filter'});

      const entry = {
        el: div,
        order: 50,
        open(post) {
          Filter.menu.post = post;
          return true;
        },
        subEntries: []
      };

      for (var type of [
        ['Name',             'name'],
        ['Unique ID',        'uniqueID'],
        ['Tripcode',         'tripcode'],
        ['Capcode',          'capcode'],
        ['Pass Date',        'pass'],
        ['Email',            'email'],
        ['Subject',          'subject'],
        ['Comment',          'comment'],
        ['Flag',             'flag'],
        ['Filename',         'filename'],
        ['Image dimensions', 'dimensions'],
        ['Filesize',         'filesize'],
        ['Image MD5',        'MD5']
      ] satisfies [string, FilterType][]) {
        // Add a sub entry for each filter type.
        entry.subEntries.push(Filter.menu.createSubEntry(type[0], type[1]));
      }

      return Menu.menu.addEntry(entry);
    },

    createSubEntry(text, type) {
      const el = $.el('a', {
        href: 'javascript:;',
        textContent: text
      }
      );
      el.dataset.type = type;
      $.on(el, 'click', Filter.menu.makeFilter);

      return {
        el,
        open(post) {
          return Filter.values(type, post).length;
        }
      };
    },

    makeFilter() {
      const {type} = this.dataset;
      // Convert value -> regexp, unless type is MD5
      const values = Filter.values(type, Filter.menu.post);
      const res = values.map((value) => {
        if (['uniqueID', 'MD5'].includes(type)) {
          return `/${value}/`;
        } else {
          return `/^${Filter.escape(value)}$/`;
        }
      }).join('\n');

      return Filter.addFilter(type, res, () => Filter.showFilters(type));
    }
  }
};
export default Filter;
