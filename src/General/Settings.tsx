import SettingsPage from './Settings/SettingsHtml';
import FilterGuidePage from './Settings/Filter-guide.html';
import SaucePage from './Settings/Sauce.html';
import AdvancedPage from './Settings/Advanced.html';
import KeybindsPage from './Settings/Keybinds.html';
import FilterSelectPage from './Settings/Filter-select.html';
import SimpleFiltersPage from './Settings/SimpleFilters.html';
import StylingPage from './Settings/Styling.html';
import Redirect from '../Archive/Redirect';
import Config, { styleVariantKeys } from '../config/Config';
import ImageHost from '../Images/ImageHost';
import CustomCSS from '../Miscellaneous/CustomCSS';
import FileInfo from '../Miscellaneous/FileInfo';
import Keybinds from '../Miscellaneous/Keybinds';
import Time from '../Miscellaneous/Time';
import Favicon from '../Monitoring/Favicon';
import ThreadUpdater from '../Monitoring/ThreadUpdater';
import SoundManager from '../Monitoring/SoundManager';
import Unread from '../Monitoring/Unread';
import $$ from '../platform/$$';
import $ from '../platform/$';
import meta from '../../package.json';
import { c, Conf, d, doc, E, g } from '../globals/globals';
import Header from './Header';
import h, { hFragment } from '../globals/jsx';
import { dict } from '../platform/helpers';
import Icon from '../Icons/icon';
import { dragstart } from './UI';
import Filter from '../Filtering/Filter';
import QuoteYou from '../Quotelinks/QuoteYou';
import Index from './Index';
import BoardConfig from './BoardConfig';

export type StyleVariant = 'sfw' | 'nsfw';

var Settings = {
  dialog: undefined as HTMLDivElement | undefined,
  searchQuery: '',
  activeSection: null as any,
  renderedSection: null as any,
  rememberLayout: false,
  savedWindowLayout: '',
  detailsState: dict() as Record<string, boolean>,
  pointerDownInsideDialog: false,
  customCSSEditorThemeObserver: null as MutationObserver | null,
  stylingPreviewPanel: null as HTMLDivElement | null,
  activeSiteStylePicker: null as HTMLElement | null,
  siteStylePickerOutsideHandler: null as ((e: Event) => void) | null,
  stylingEditingVariant: null as StyleVariant | null,
  styleVariantKeySet: new Set<string>(styleVariantKeys),
  resolvedStyleColorCache: null as Record<string, string> | null,

  // What's currently applied to the page. Always derived from the board
  // (or the forced mode); the Styling settings page does NOT override this,
  // so opening the dialog or clicking SFW/NSFW tabs never changes the
  // currently-rendered board styling.
  getActiveVariant(): StyleVariant {
    return Settings.getBoardVariant();
  },

  // The variant that *would* apply on this page if the settings dialog were
  // closed. Used by the hint label so the user can see why a particular
  // variant is being applied.
  getBoardVariant(): StyleVariant {
    const mode = Conf['sfwNsfwMode'];
    if (mode === 'sfw') return 'sfw';
    if (mode === 'nsfw') return 'nsfw';
    if (!g.boardID) return 'sfw';
    // BoardConfig.isSFW returns false for unknown boards too, so check the
    // boards map explicitly to keep the SFW fallback for missing data.
    const boards = (BoardConfig as any).boards || Conf['boardConfig']?.boards;
    const board = boards?.[g.boardID];
    if (!board) return 'sfw';
    return board.ws_board ? 'sfw' : 'nsfw';
  },

  variantKey(key: string, variant: StyleVariant = Settings.getActiveVariant()): string {
    return `${key} ${variant.toUpperCase()}`;
  },

  styleConf<T = any>(key: string, variant?: StyleVariant): T {
    return Conf[Settings.variantKey(key, variant)];
  },

  styleKeyBase(key: string): string {
    return key.replace(/ (SFW|NSFW)$/, '');
  },
  prepareDrag(e) {
    const settingsWindow = $('#fourchanx-settings', Settings.dialog) as HTMLDivElement;
    const rect = settingsWindow.getBoundingClientRect();
    settingsWindow.style.left = `${rect.left}px`;
    settingsWindow.style.top = `${rect.top}px`;
    settingsWindow.style.right = '';
    settingsWindow.style.bottom = '';
    settingsWindow.style.margin = '0';
    settingsWindow.style.transform = 'none';
    dragstart.call(this, e);
  },

  init() {
    // 4chan X settings link
    const link = $.el('a', {
      className: 'settings-link',
      title:     `${meta.name} Settings`,
      href:      '#'
    });
    Icon.set(link, 'wrench', 'Settings');
    $.on(link, 'click', e => {
      e.preventDefault();
      Settings.open();
    });

    Header.addShortcut('settings', link, 820);

    const add = this.addSection;

    add('General',         this.general);
    add('Styling',         this.styling);
    add('Interface',       this.interface);
    add('Threads & Posts', this.threadsAndPosts);
    add('Media',           this.media);
    add('Posting',         this.posting);
    add('Filtering',       this.filter);
    add('Keybinds',        this.keybinds);
    add('Advanced',        this.advanced);
    add('All Settings',    this.allSettings);

    $.on(d, 'AddSettingsSection',   Settings.addSection);
    $.on(d, 'OpenSettings', e => Settings.open(e.detail));

    if ((g.SITE.software === 'yotsuba') && Conf['Disable Native Extension']) {
      if ($.hasStorage) {
        // Run in page context to handle case where 4chan X has localStorage access but not the page.
        // (e.g. Pale Moon 26.2.2, GM 3.8, cookies disabled for 4chan only)
        $.global('disableNativeExtension');
      } else {
        $.global('disableNativeExtensionNoStorage');
      }
    }

    Settings.applyStylingVars();
  },

  // StyleChan injects `<style id="ch4SS">` into <head> and a header shortcut
  // anchor `#StyleChanLink`. Either is sufficient as a "present" signal; the
  // style tag goes in earlier so it's the more reliable check.
  isStylechanInstalled(): boolean {
    return !!(d.getElementById('ch4SS') || d.getElementById('StyleChanLink'));
  },

  // Open StyleChan's settings without closing ours. StyleChan appends its
  // own `<div id="overlay">` + `#oneechan-options` dialog to <body>. Our
  // overlay uses `id="xt-settings-overlay"` to avoid an id collision (their
  // show()/close() did `document.getElementById('overlay')` and would tear
  // ours out of the DOM). Their overlay sits above ours in stacking order
  // and intercepts clicks, so clicking the dim backdrop closes StyleChan
  // first (via their own outside-click handler) and a second click closes us.
  openStylechanSettings(): boolean {
    const link = d.getElementById('StyleChanLink') as HTMLAnchorElement | null;
    if (!link) return false;
    link.click();
    return true;
  },

  shouldDeferStylingToStylechan(): boolean {
    return Settings.isStylechanInstalled();
  },

  enforceStylechanStylingDeferral(section?: HTMLElement, inputs?: Record<string, HTMLInputElement>) {
    if (!Settings.shouldDeferStylingToStylechan()) return;

    const setFalse = (key: string) => {
      if (!Conf[key]) return;
      Conf[key] = false;
      $.set(key, false);
      const input = inputs?.[key] || (section ? $(`[name="${key}"]`, section) as HTMLInputElement | null : null);
      if (input?.type === 'checkbox') {
        input.checked = false;
        const container = input.closest('[data-name]') as HTMLElement | null;
        if (container) container.dataset.checked = 'false';
      }
    };

    setFalse('siteStyleHome');
    setFalse('customCSSHome');
    setFalse('Custom CSS');
  },

  open(openSection) {
    let dialog, sectionToOpen;
    if (Settings.dialog) { return; }
    $.event('CloseMenu');

    // id `xt-settings-overlay` avoids a collision with StyleChan, which also
    // injects an `<div id="overlay">` and would otherwise tear our dialog out
    // of the DOM when its show()/close() called `document.getElementById`.
    Settings.dialog = (dialog = $.el('div',
      { id: 'xt-settings-overlay' }
      , SettingsPage));
    const settingsWindow = $('#fourchanx-settings', dialog) as HTMLDivElement;

    $.on($('.export', dialog), 'click', e => { e.preventDefault(); Settings.export(); });
    $.on($('.import', dialog), 'click', e => { e.preventDefault(); Settings.import.call(e.currentTarget); });
    $.on($('.reset',  dialog), 'click', e => { e.preventDefault(); Settings.reset(); });
    $.on($('input[type=file]', dialog), 'change', Settings.onImport);
    $.on($('.settings-search input', dialog), 'input', Settings.onSearchInput);
    $.on($('.expand-all',   dialog), 'click', e => { e.preventDefault(); Settings.toggleAllDetails(true); });
    $.on($('.collapse-all', dialog), 'click', e => { e.preventDefault(); Settings.toggleAllDetails(false); });
    $.on($('.move', settingsWindow), 'touchstart mousedown', Settings.prepareDrag);
    $.on($('#settings-remember-layout', dialog), 'change', Settings.onRememberLayoutChange);
    for (const actionEl of $$('.settings-titlebar-actions > *', settingsWindow)) {
      $.on(actionEl, 'touchstart mousedown', e => e.stopPropagation());
    }

    const links = [];
    let defaultLink;
    for (const section of Settings.sections) {
      const link = $.el('a', {
        className: `tab-${section.hyphenatedTitle}`,
        textContent: section.title,
        href: '#'
      }
      );
      $.on(link, 'click', e => {
        e.preventDefault();
        Settings.openSection.call(section);
      });
      links.push(link);
      if (!defaultLink && section.title === 'General') defaultLink = link;
      if (
        section.title === openSection
        || (['Filter', 'Filters', 'Simple Filters'].includes(openSection) && section.title === 'Filtering')
        || (openSection === 'Main' && section.title === 'General')
      ) { sectionToOpen = link; }
    }
    $.add($('.sections-list', dialog), links);
    // Opening on "All Settings" eagerly renders every section, which is
    // noticeably slower in Firefox. Default to the lightweight General view
    // unless the caller explicitly requested another section.
    const initialLink = sectionToOpen || defaultLink || links[0];
    if (openSection !== 'none') { initialLink.click(); }

    Icon.set($('.close', dialog), 'xmark');
    $.on($('.close', dialog), 'click', e => { e.preventDefault(); Settings.close(); });
    $.on(window, 'beforeunload', Settings.close);
    $.on(dialog, 'mousedown touchstart', e => {
      Settings.pointerDownInsideDialog = settingsWindow.contains(e.target as Node);
    });
    $.on(dialog, 'click', e => {
      if (e.target !== dialog) { return; }
      if (Settings.pointerDownInsideDialog) {
        Settings.pointerDownInsideDialog = false;
        return;
      }
      // Do not close when the mouse ends up outside the modal when selecting text in an input.
      if (d.activeElement?.tagName === 'INPUT' || d.activeElement?.tagName === 'TEXTAREA') return;
      Settings.close();
    });
    $.on(settingsWindow, 'click', e => e.stopPropagation());

    $.add(d.body, dialog);
    Settings.restoreWindowLayout(settingsWindow);
    initialLink?.focus();
    Settings.loadLayoutPrefs();

    $.event('OpenSettings', null, dialog);
  },

  close() {
    if (!Settings.dialog) { return; }
    // Unfocus current field to trigger change event.
    d.activeElement?.blur();
    if (Settings.rememberLayout) {
      Settings.persistCurrentDetailsState();
      const settingsWindow = $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null;
      if (settingsWindow) Settings.saveWindowLayout(settingsWindow);
    }
    Settings.closeImpExpPicker();
    $.rm(Settings.dialog);
    Settings.searchQuery = '';
    Settings.activeSection = null;
    Settings.renderedSection = null;
    Settings.rememberLayout = false;
    Settings.savedWindowLayout = '';
    Settings.detailsState = dict();
    Settings.customCSSEditorThemeObserver?.disconnect();
    Settings.customCSSEditorThemeObserver = null;
    Settings.closeStylingPreview();
    if (Settings.siteStylePickerOutsideHandler) {
      d.removeEventListener('mousedown', Settings.siteStylePickerOutsideHandler, true);
      Settings.siteStylePickerOutsideHandler = null;
    }
    Settings.activeSiteStylePicker = null;
    Settings.resolvedStyleColorCache = null;
    delete Settings.dialog;
    // The editing variant is dialog-only UI state; clear it on close.
    Settings.stylingEditingVariant = null;
  },

  toggleAllDetails(open) {
    if (!Settings.dialog) return;
    const section = $('section', Settings.dialog);
    if (!section) return;
    for (const details of $$('details', section)) {
      (details as HTMLDetailsElement).open = open;
    }
    if (Settings.rememberLayout) {
      Settings.persistCurrentDetailsState();
      $.set('settings.detailsState', Settings.detailsState);
    }
  },

  loadLayoutPrefs() {
    if (!Settings.dialog) return;
    $.get({
      'settings.rememberLayout': false,
      'settings.windowLayout': '',
      'settings.detailsState': dict(),
    }, prefs => {
      if (!Settings.dialog) return;
      Settings.rememberLayout = !!prefs['settings.rememberLayout'];
      Settings.savedWindowLayout = typeof prefs['settings.windowLayout'] === 'string' ? prefs['settings.windowLayout'] : '';
      const detailsState = prefs['settings.detailsState'];
      Settings.detailsState = (detailsState && typeof detailsState === 'object') ? detailsState : dict();

      const toggle = $('#settings-remember-layout', Settings.dialog) as HTMLInputElement | null;
      if (toggle) toggle.checked = Settings.rememberLayout;

      const settingsWindow = $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null;
      if (settingsWindow && Settings.rememberLayout) {
        Settings.restoreWindowLayout(settingsWindow);
      }

      if (Settings.renderedSection) {
        const section = $('section', Settings.dialog);
        if (section) {
          Settings.decorateDetailsWithKeys(section, Settings.renderedSection);
        }
      }
    });
  },

  onRememberLayoutChange() {
    const enabled = (this as HTMLInputElement).checked;
    Settings.rememberLayout = enabled;
    $.set('settings.rememberLayout', enabled);

    if (!enabled) {
      Settings.savedWindowLayout = '';
      Settings.detailsState = dict();
      $.delete(['settings.windowLayout', 'settings.detailsState']);
      return;
    }

    if (Settings.dialog) {
      const settingsWindow = $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null;
      if (settingsWindow) Settings.saveWindowLayout(settingsWindow);
      Settings.persistCurrentDetailsState();
      $.set({
        'settings.windowLayout': Settings.savedWindowLayout,
        'settings.detailsState': Settings.detailsState
      });
    }
  },


  restoreWindowLayout(settingsWindow: HTMLDivElement) {
    if (Settings.rememberLayout && Settings.savedWindowLayout) {
      settingsWindow.style.cssText += `;${Settings.savedWindowLayout}`;
      return;
    }
    if (!settingsWindow.style.left && !settingsWindow.style.right && !settingsWindow.style.top && !settingsWindow.style.bottom) {
      const rect = settingsWindow.getBoundingClientRect();
      settingsWindow.style.left = `${Math.max(0, (doc.clientWidth - rect.width) / 2)}px`;
      settingsWindow.style.top = `${Math.max(0, (doc.clientHeight - rect.height) / 2)}px`;
    }
  },

  saveWindowLayout(settingsWindow: HTMLDivElement) {
    const style = settingsWindow.style;
    let layout = '';
    if (style.left) layout += `left:${style.left};`;
    if (style.right) layout += `right:${style.right};`;
    if (style.top) layout += `top:${style.top};`;
    if (style.bottom) layout += `bottom:${style.bottom};`;
    if (style.width) layout += `width:${style.width};`;
    if (style.height) layout += `height:${style.height};`;
    Settings.savedWindowLayout = layout;
    $.set('settings.windowLayout', layout);
  },

  detailStateScope(root, sectionInfo) {
    let sectionTitle = sectionInfo?.title || '';
    if (sectionTitle === 'All Settings') {
      const block = root.closest('.settings-section-block') as HTMLElement | null;
      sectionTitle = $('.settings-section-header', block)?.textContent?.trim() || '';
    }
    // Use the same scope key for both "All Settings" and single-section views
    // so collapse state stays in sync across both places.
    return `section:${sectionTitle}`;
  },

  detailsStateKey(details: HTMLDetailsElement, sectionInfo) {
    const root = details.parentElement as HTMLElement | null;
    if (!root) return '';
    const scope = Settings.detailStateScope(root, sectionInfo);
    const summary = details.querySelector('summary')?.textContent?.trim() || '';
    const peers = $$('details', root)
      .filter(peer => (peer.querySelector('summary')?.textContent?.trim() || '') === summary);
    const index = Math.max(0, peers.indexOf(details));
    return `${scope}|${summary}|${index}`;
  },

  decorateDetailsWithKeys(sectionRoot, sectionInfo, applyRememberedState = true) {
    for (const details of $$('details', sectionRoot)) {
      const shouldRememberState = (details as HTMLElement).dataset.rememberLayout !== 'false';
      const key = Settings.detailsStateKey(details as HTMLDetailsElement, sectionInfo);
      if (!key) continue;
      (details as HTMLElement).dataset.detailsStateKey = key;
      if (applyRememberedState && shouldRememberState && Settings.rememberLayout && Object.prototype.hasOwnProperty.call(Settings.detailsState, key)) {
        (details as HTMLDetailsElement).open = !!Settings.detailsState[key];
      }
      if ((details as any)._detailsStateBound) continue;
      (details as any)._detailsStateBound = true;
      $.on(details, 'toggle', function() {
        if (!Settings.rememberLayout || !shouldRememberState) return;
        const stateKey = (this as HTMLElement).dataset.detailsStateKey;
        if (!stateKey) return;
        Settings.detailsState[stateKey] = (this as HTMLDetailsElement).open;
        $.set('settings.detailsState', Settings.detailsState);
      });
    }
  },

  persistCurrentDetailsState() {
    if (!Settings.dialog || !Settings.renderedSection) return;
    const section = $('section', Settings.dialog);
    if (!section) return;
    Settings.decorateDetailsWithKeys(section, Settings.renderedSection, false);
    for (const details of $$('details', section)) {
      if ((details as HTMLElement).dataset.rememberLayout === 'false') continue;
      const key = (details as HTMLElement).dataset.detailsStateKey;
      if (!key) continue;
      Settings.detailsState[key] = (details as HTMLDetailsElement).open;
    }
  },

  getActiveSection() {
    const selectedTab = $('.tab-selected', Settings.dialog);
    if (!selectedTab) return null;
    for (const section of Settings.sections) {
      if (selectedTab.classList.contains(`tab-${section.hyphenatedTitle}`)) return section;
    }
    return null;
  },

  onSearchInput() {
    Settings.searchQuery = (this as HTMLInputElement).value.toLowerCase().trim();
    if (Settings.searchQuery) {
      Settings.ensureAllSettingsRendered();
    } else {
      Settings.renderActiveSection();
    }
    Settings.applySearch();
  },

  applySearch() {
    if (!Settings.dialog) return;
    const query = Settings.searchQuery;
    const win = $('#fourchanx-settings', Settings.dialog);
    win.classList.toggle('settings-searching', !!query);
    const section = $('section', Settings.dialog);
    if (!section) return;

    for (const el of $$('.settings-search-hidden', section)) {
      $.rmClass(el, 'settings-search-hidden');
    }
    Settings.highlightSettingRow(section, query);

    if (!query) return;

    for (const el of $$('div[data-name], tr[data-name], details, .settings-group-heading, table, thead, tbody, summary, h4, .settings-section-block', section)) {
      $.addClass(el, 'settings-search-hidden');
    }

    for (const row of $$('div[data-name], tr[data-name]', section)) {
      const settingTitle = `${row.dataset.settingTitle || ''}`.toLowerCase();
      const settingDescription = `${row.dataset.settingDescription || ''}`.toLowerCase();
      const settingName = `${row.dataset.name || ''}`.toLowerCase();
      const fullText = `${settingName} ${settingTitle} ${settingDescription} ${row.textContent || ''}`.toLowerCase();
      if (fullText.indexOf(query) < 0) continue;

      const rowEl = row as HTMLElement;
      Settings.revealSearchMatch(rowEl, section);

      // Only reveal descendant rider settings when the setting's title itself
      // matched, to avoid broad description matches expanding unrelated rows.
      const titleMatched = settingTitle.indexOf(query) >= 0 || settingName.indexOf(query) >= 0;
      if (!titleMatched) continue;
      for (const sublist of $$('.suboption-list', rowEl)) {
        for (const rider of $$('div[data-name], tr[data-name]', sublist)) {
          Settings.revealSearchMatch(rider as HTMLElement, section);
        }
      }
    }

    for (const el of $$('summary, th, h4', section)) {
      if ((el.textContent || '').toLowerCase().indexOf(query) < 0) continue;
      Settings.revealSearchMatch(el as HTMLElement, section);
    }

    for (const heading of $$('.settings-section-header', section)) {
      if (!Settings.matchesSectionTitle(heading.textContent || '', query)) continue;
      const block = heading.closest('.settings-section-block') as HTMLElement | null;
      if (!block) continue;
      for (const el of $$('.settings-search-hidden', block)) {
        $.rmClass(el, 'settings-search-hidden');
      }
      Settings.revealSearchMatch(block, section);
    }
  },

  matchesSectionTitle(text, query) {
    const title = (text || '').toLowerCase();
    if (!title || !query) return false;
    if (query.includes(' ')) return title.indexOf(query) >= 0;
    const rx = RegExp(`\\b${Settings.escapeRegExp(query)}\\b`, 'i');
    return rx.test(text);
  },

  revealSearchMatch(node, root) {
    let cur = node;
    while (cur && cur !== root) {
      cur.classList.remove('settings-search-hidden');
      if (cur.tagName === 'DETAILS') {
        const summary = cur.firstElementChild as HTMLElement | null;
        if (summary?.tagName === 'SUMMARY') {
          summary.classList.remove('settings-search-hidden');
        }
      } else if (cur.tagName === 'TABLE') {
        for (const child of cur.children) {
          if (child.tagName === 'THEAD' || child.tagName === 'TBODY') {
            child.classList.remove('settings-search-hidden');
          }
        }
      }
      cur = cur.parentElement;
    }
  },

  highlightSettingRow(root, query) {
    for (const el of $$('.setting-title, .setting-description, .settings-section-header, summary, th, h4', root)) {
      const source = (el as HTMLElement).dataset.rawText ?? el.textContent ?? '';
      (el as HTMLElement).dataset.rawText = source;
      if (query) {
        const rx = RegExp(`(${Settings.escapeRegExp(query)})`, 'ig');
        el.innerHTML = source.replace(rx, '<mark>$1</mark>');
      } else {
        el.textContent = source;
      }
    }
  },

  escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  sections: [],

  addSection(title, open) {
    if (typeof title !== 'string') {
      ({title, open} = title.detail);
    }
    const hyphenatedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    Settings.sections.push({title, hyphenatedTitle, open});
  },

  openSection() {
    Settings.activeSection = this;
    Settings.selectSectionTab(this);
    if (Settings.searchQuery && this.title !== 'All Settings') {
      Settings.ensureAllSettingsRendered();
      Settings.applySearch();
      return;
    }
    Settings.renderSection(this);
  },

  selectSectionTab(sectionInfo) {
    let selected;
    if (selected = $('.tab-selected', Settings.dialog)) {
      $.rmClass(selected, 'tab-selected');
    }
    $.addClass($(`.tab-${sectionInfo.hyphenatedTitle}`, Settings.dialog), 'tab-selected');
  },

  getAllSettingsSection() {
    return Settings.sections.find(section => section.title === 'All Settings') || null;
  },

  ensureAllSettingsRendered() {
    const allSettingsSection = Settings.getAllSettingsSection();
    if (!allSettingsSection) return;
    if (Settings.renderedSection === allSettingsSection) return;
    Settings.renderSection(allSettingsSection);
  },

  renderActiveSection() {
    const section = Settings.activeSection || Settings.getActiveSection() || Settings.sections[0];
    if (!section) return;
    Settings.renderSection(section);
  },

  renderSection(sectionInfo) {
    const section = $('section', Settings.dialog);
    if (!section) return;
    const leavingStyling = Settings.renderedSection
      && Settings.renderedSection.hyphenatedTitle === 'styling'
      && sectionInfo.hyphenatedTitle !== 'styling';
    $.rmAll(section);
    section.className = `section-${sectionInfo.hyphenatedTitle}`;
    sectionInfo.open(section, g);
    Settings.decorateDetailsWithKeys(section, sectionInfo);
    section.scrollTop = 0;
    Settings.renderedSection = sectionInfo;
    Settings.applySearch();
    $.event('OpenSettings', null, section);
    if (leavingStyling) Settings.stylingEditingVariant = null;
  },

  allSettings(section) {
    for (const sectionInfo of Settings.sections) {
      if (sectionInfo.title === 'All Settings') continue;
      const block = $.el('div', {
        className: `settings-section-block section-${sectionInfo.hyphenatedTitle}`,
      });
      const heading = $.el('h3', {
        className: 'settings-section-header',
        textContent: sectionInfo.title,
      });
      const content = $.el('div', { className: 'settings-section-content' });
      $.add(block, [heading, content]);
      $.add(section, block);
      sectionInfo.open(content, g);
    }
  },

  warnings: {
    localStorage(cb) {
      if ($.cantSync) {
        const why = $.cantSet ? 'save your settings' : 'synchronize settings between tabs';
        cb($.el('li', {
          textContent: `\
${meta.name} needs local storage to ${why}.
Enable it on boards.${location.hostname.split('.')[1]}.org in your browser's privacy settings (may be listed as part of "local data" or "cookies").\
`
        }
        )
        );
      }
    },
    ads(cb) {
      $.onExists(doc, '.adg-rects > .desktop', ad => $.onExists(ad, 'iframe', function() {
        const url = Redirect.to('thread', {boardID: 'qa', threadID: 362590});
        cb($.el('li',
          <>
            To protect yourself from <a href={url} target="_blank">malicious ads</a>,
            you should <a href="https://github.com/gorhill/uBlock#ublock-origin" target="_blank">block ads</a> on 4chan.
          </>
        )
        );
      }));
    }
  },

  getMainSettingLookup() {
    const lookup = dict();
    for (const keyFS in Config.main) {
      const obj = Config.main[keyFS];
      for (const key in obj) {
        const arr = obj[key];
        if (Array.isArray(arr)) lookup[key] = arr;
      }
    }
    return lookup;
  },

  addCheckboxes(root, obj, items, inputs, includeSetting = (_key: string) => true) {
    const containers = [root];
    let count = 0;
    for (const key in obj) {
      const arr = obj[key];
      if (!(arr instanceof Array)) continue;
      if (!includeSetting(key)) continue;
      const description = arr[1] || '';
      const div = $.el('div',
        { innerHTML: `<label><input type="checkbox" name="${key}"><span class="setting-title">${key}</span></label><span class="description">: <span class="setting-description">${description}</span></span>` });
      div.dataset.name = key;
      div.dataset.settingTitle = key;
      div.dataset.settingDescription = description;
      const input = $('input', div) as HTMLInputElement;
      $.on(input, 'change', $.cb.checked);
      $.on(input, 'change', function() { this.parentNode.parentNode.dataset.checked = this.checked; });
      if (key === 'Comment Preview') {
        $.on(input, 'change', () => $.event('QRCommentPreviewChanged'));
      }
      items[key] = Conf[key];
      inputs[key] = input;
      const level = arr[2] || 0;
      if (containers.length <= level) {
        const container = $.el('div', { className: 'suboption-list' });
        $.add(containers[containers.length-1].lastElementChild, container);
        containers[level] = container;
      } else if (containers.length > (level+1)) {
        containers.splice(level+1, containers.length - (level+1));
      }
      $.add(containers[level], div);
      count++;
    }
    return count;
  },

  selectGroup(obj, keys, baseLevel = 0) {
    const group = dict();
    for (const key of keys) {
      const arr = obj[key];
      if (!arr) continue;
      const [defaultValue, description, level] = arr;
      const adjustedLevel = Math.max(0, (level || 0) - baseLevel);
      group[key] = [defaultValue, description, adjustedLevel];
    }
    return group;
  },

  renderMainGroups(section, options) {
    const {
      categories,
      includeWarnings,
      includeJSONIndex,
      includeHiddenCount,
      hideLegendFor = [],
      includeSetting = (_key: string) => true
    } = options;

    if (includeWarnings) {
      const warnings = $.el('details',
        { hidden: true, open: true },
        { innerHTML: '<summary>Warnings</summary><ul></ul>' });
      const addWarning = function(item) {
        $.add($('ul', warnings), item);
        warnings.hidden = false;
      };
      for (const key in Settings.warnings) {
        Settings.warnings[key](addWarning);
      }
      $.add(section, warnings);
    }

    const items = dict();
    const inputs = dict();

    for (const cat of categories) {
      let keyFS, subgroups;
      if (typeof cat === 'string') {
        keyFS = cat;
        subgroups = null;
      } else {
        keyFS = cat.name;
        subgroups = cat.subgroups;
      }
      const obj = Config.main[keyFS];
      if (!obj) continue;

      if (subgroups) {
        for (const [legendTitle, keys, baseLevel] of subgroups) {
          const fs = $.el('details',
            { open: true },
            { innerHTML: `<summary>${legendTitle}</summary>` });
          const group = Settings.selectGroup(obj, keys, baseLevel || 0);
          if (!Settings.addCheckboxes(fs, group, items, inputs, includeSetting)) continue;
          if (legendTitle === 'Captcha') {
            $.add(fs, $.el('p',
              { innerHTML: `For more info on captcha options and issues, see the <a href="${meta.captchaFAQ}" target="_blank">captcha FAQ</a>.` }));
          }
          $.add(section, fs);
        }
        continue;
      }

      const legendTitle = keyFS === 'Filtering' ? 'Content Controls' : keyFS;
      let fs;
      if (hideLegendFor.includes(keyFS)) {
        fs = $.el('div');
      } else {
        fs = $.el('details',
          { open: true },
          { innerHTML: `<summary>${legendTitle}</summary>` });
      }
      if (!Settings.addCheckboxes(fs, obj, items, inputs, includeSetting)) continue;
      if (keyFS === 'Posting and Captchas') {
        $.add(fs, $.el('p',
          { innerHTML: `For more info on captcha options and issues, see the <a href="${meta.captchaFAQ}" target="_blank">captcha FAQ</a>.` }));
      }
      $.add(section, fs);
    }

    if (includeJSONIndex) {
      const root = $('div[data-name="JSON Index"] > .suboption-list', section);
      if (root) Settings.addCheckboxes(root, Config.Index, items, inputs);
    }

    $.get(items, function(items) {
      for (const key in items) {
        const val = items[key];
        if (!inputs[key]) continue;
        inputs[key].checked = val;
        inputs[key].parentNode.parentNode.dataset.checked = val;
      }
    });

    if (!includeHiddenCount) return;

    const div = $.el('div',
      { innerHTML: '<button></button><span class="description">: Clear manually-hidden threads and posts on all boards. Reload the page to apply.' });
    const button = $('button', div);
    $.get({ hiddenThreads: dict(), hiddenPosts: dict() }, function({ hiddenThreads, hiddenPosts }) {
      let board, ID, site, thread;
      let hiddenNum = 0;
      for (ID in hiddenThreads) {
        site = hiddenThreads[ID];
        if (ID !== 'boards') {
          for (ID in site.boards) {
            board = site.boards[ID];
            hiddenNum += Object.keys(board).length;
          }
        }
      }
      for (ID in hiddenThreads.boards) {
        board = hiddenThreads.boards[ID];
        hiddenNum += Object.keys(board).length;
      }
      for (ID in hiddenPosts) {
        site = hiddenPosts[ID];
        if (ID !== 'boards') {
          for (ID in site.boards) {
            board = site.boards[ID];
            for (ID in board) {
              thread = board[ID];
              hiddenNum += Object.keys(thread).length;
            }
          }
        }
      }
      for (ID in hiddenPosts.boards) {
        board = hiddenPosts.boards[ID];
        for (ID in board) {
          thread = board[ID];
          hiddenNum += Object.keys(thread).length;
        }
      }
      button.textContent = `Hidden: ${hiddenNum}`;
    });
    $.on(button, 'click', function() {
      this.textContent = 'Hidden: 0';
      $.get('hiddenThreads', dict(), function({ hiddenThreads }) {
        if ($.hasStorage && (g.SITE.software === 'yotsuba')) {
          let boardID;
          for (boardID in hiddenThreads['4chan.org']?.boards) {
            localStorage.removeItem(`4chan-hide-t-${boardID}`);
          }
          for (boardID in hiddenThreads.boards) {
            localStorage.removeItem(`4chan-hide-t-${boardID}`);
          }
        }
        $.delete(['hiddenThreads', 'hiddenPosts']);
      });
    });
    const stubs = $('input[name="Stubs"]', section);
    if (stubs) stubs.closest('details').insertAdjacentElement('beforeend', div);
    else $.add(section, div);
  },

  addSelectFieldset(section, title, rows) {
    const fs = $.el('details',
      { open: true },
      { innerHTML: `<summary>${title}</summary>` });
    const items = dict();
    const inputs = dict();
    for (const row of rows) {
      const div = $.el('div');
      div.dataset.name = row.name;
      const label = $.el('label');
      const select = $.el('select', { name: row.name }) as HTMLSelectElement;
      for (const option of row.options) {
        select.appendChild($.el('option', { value: option[0], textContent: option[1] }));
      }
      $.add(label, [
        $.el('span', { textContent: `${row.label}: ` }),
        select
      ]);
      $.add(div, [
        label,
        $.el('span', { className: 'description', textContent: row.description ? `: ${row.description}` : '' })
      ]);
      $.on(select, 'change', $.cb.value);
      if (row.name === 'Comment Preview Position') {
        $.on(select, 'change', () => $.event('QRCommentPreviewChanged'));
      }
      items[row.name] = Conf[row.name];
      inputs[row.name] = select;
      $.add(fs, div);
    }
    $.add(section, fs);
    $.get(items, function(items) {
      for (const key in items) {
        inputs[key].value = items[key];
      }
    });
  },

  general(section) {
    Settings.renderMainGroups(section, {
      categories: [{
        name: 'Miscellaneous',
        subgroups: [
          ['System', ['JSON Index', `Use ${meta.name} Catalog`, 'Open Threads in New Tab', 'External Catalog', '404 Redirect', 'Archive Report', 'Exempt Archives from Encryption']],
          ['Compatibility', ['Disable Native Extension']]
        ]
      }],
      includeWarnings: true,
      includeJSONIndex: true
    });
  },

  interface(section) {
    const items = dict();
    const inputs = dict();

    const fsNav = $.el('details',
      { open: true },
      { innerHTML: '<summary>Custom Board Navigation</summary>' });
    const navContent = $.el('div', {
      innerHTML:
        '<div><textarea name="boardnav" class="field boardnav-field" spellcheck="false"></textarea></div>' +
        '<span class="note">New lines will be converted into spaces.</span><br><br>' +
        '<details class="boardnav-instructions" data-remember-layout="false">' +
          '<summary>Syntax guide</summary>' +
          '<div class="note">In the following examples for /g/, <code>g</code> can be changed to a different board ID (<code>a</code>, <code>b</code>, etc...), the current board (<code>current</code>), or the Twitter link (<code>@</code>).</div>' +
          '<div>Board link: <code>g</code></div>' +
          '<div>Archive link: <code>g-archive</code></div>' +
          '<div>Internal archive link: <code>g-expired</code></div>' +
          '<div>Title link: <code>g-title</code></div>' +
          '<div>Board link (Replace with title when on that board): <code>g-replace</code></div>' +
          '<div>Full text link: <code>g-full</code></div>' +
          '<div>Custom text link: <code>g-text:"Install Gentoo"</code></div>' +
          '<div>Index-only link: <code>g-index</code></div>' +
          '<div>Catalog-only link: <code>g-catalog</code></div>' +
          '<div>Index mode: <code>g-mode:"infinite scrolling"</code></div>' +
          '<div>Index sort: <code>g-sort:"creation date rev"</code></div>' +
          '<div>External link: <code>external-text:"Google","http://www.google.com"</code></div>' +
          '<div>Open in new tab: <code>g-nt</code></div>' +
          '<div>Combinations are possible: <code>g-index-text:"Technology Index"</code></div>' +
          '<div>Full board list toggle: <code>toggle-all</code></div>' +
          '<br>' +
          '<div class="note">' +
            '<code>[ toggle-all ] [current-title] [g-title / a-title / jp-title] [x / wsg / h] [t-text:"Piracy"]</code><br>' +
            'will give you<br>' +
            '<code>[ + ] [Technology] [Technology / Anime &amp; Manga / Otaku Culture] [x / wsg / h] [Piracy]</code><br>' +
            'if you are on /g/.' +
          '</div>' +
          '<div class="note">' +
            'For custom styling, you can wrap groups or individual links in <code>{{</code> and <code>}}</code>, to wrap them in a span. You can also add classes in double quotes right after the {{. For example: <br>' +
            '<code>[g-title] {{"favorites"[a-title / jp-title]}}</code><br>' +
            'Results in:<br>' +
            '<code>[&lt;a [...] &gt;Technology&lt;/a&gt;] &lt;span class="favorites"&gt;[&lt;a [...] &gt;Anime &amp;amp; Manga&lt;/a&gt; / &lt;a [...] &gt;Otaku Culture&lt;/a&gt;]&lt;/span&gt;</code>' +
          '</div>' +
        '</details>'
    });
    const textarea = $('textarea', navContent) as HTMLTextAreaElement;
    $.on(textarea, 'change', $.cb.value);
    $.on(textarea, 'change', Settings.boardnav);
    items['boardnav'] = Conf['boardnav'];
    inputs['boardnav'] = textarea;
    $.add(fsNav, navContent);
    $.add(section, fsNav);

    Settings.renderMainGroups(section, {
      categories: [
        {
          name: 'Miscellaneous',
          subgroups: [
            ['UI', ['Announcement Hiding', 'Follow Cursor', 'Catalog Links']],
            ['Notifications', ['Desktop Notifications', 'Posting Success Notifications']],
            ['Keyboard and Navigation', ['Keybinds', 'Comment Expansion', 'Thread Expansion', 'Index Navigation', 'Reply Navigation', 'Unique ID and Capcode Navigation', 'Normalize URL', 'Disable Autoplaying Sounds']]
          ]
        },
        'Menu'
      ]
    });

    $.get(items, function(items) {
      for (const key in items) {
        const input = inputs[key];
        if (input.type === 'checkbox') {
          input.checked = items[key];
          input.parentNode.parentNode.dataset.checked = items[key];
        } else {
          input.value = items[key];
        }
      }
    });
  },

  threadsAndPosts(section) {
    const items = dict();
    const inputs = dict();

    const fsFmt = $.el('details',
      { open: true },
      { innerHTML: '<summary>Formatting</summary>' });
    const lookup = Settings.getMainSettingLookup();
    const fmtGroup = dict();
    for (const key of [
      'Custom Board Titles',
      'Color User IDs',
      'Count Posts by ID',
      'Time Formatting',
      'File Info Formatting',
      'Quote Backlinks',
    ]) {
      if (lookup[key]) fmtGroup[key] = lookup[key];
    }
    Settings.addCheckboxes(fsFmt, fmtGroup, items, inputs);
    const inlineSelect = (name: string, label: string, description: string, opts: readonly (readonly [string, string])[]) => {
      const div = $.el('div');
      div.dataset.name = name;
      const lblEl = $.el('label');
      const select = $.el('select', { name }) as HTMLSelectElement;
      for (const [value, text] of opts) {
        select.appendChild($.el('option', { value, textContent: text }));
      }
      $.add(lblEl, [$.el('span', { textContent: `${label}: ` }), select]);
      $.add(div, [
        lblEl,
        $.el('span', { className: 'description', textContent: `: ${description}` })
      ]);
      $.on(select, 'change', $.cb.value);
      items[name] = Conf[name];
      inputs[name] = select;
      $.add(fsFmt, div);
    };
    inlineSelect('RelativeTime', 'Relative Post Dates',
      'Display dates like "3 minutes ago" inline, on hover, or both.',
      [
        ['No', 'Off'],
        ['Hover', 'Show on hover'],
        ['Show', 'Show inline (full date on hover)'],
        ['Both', 'Show timestamp, then relative'],
        ['BothRelativeFirst', 'Show relative, then timestamp']
      ]);
    inlineSelect('Spoiler Mode', 'Spoilers',
      'How to display [spoiler] text. "Default" matches the site’s native behavior.',
      [
        ['default', 'Default'],
        ['reveal', 'Reveal on hover'],
        ['remove', 'Remove entirely']
      ]);
    $.add(section, fsFmt);

    const stylingOnlyKeys = new Set([
      'Scrollbar Markers',
      'Scrollbar Mark Own Posts',
      'Scrollbar Mark Quotes You',
      'Scrollbar Mark Ghost Posts',
      'Scrollbar Mark Unread Line',
      'Highlight Posts Quoting You',
      'Highlight Own Posts',
      'Highlight Ghost Posts'
    ]);

    Settings.renderMainGroups(section, {
      categories: ['Filtering', 'Monitoring', 'Quote Links'],
      includeHiddenCount: true,
      includeSetting: (key: string) => !stylingOnlyKeys.has(key)
    });

    Settings.addThreadWatcherFieldset(section);

    Settings.addSelectFieldset(section, 'Thread Title', [
      {
        name: 'Thread Title',
        label: 'Title Content',
        description: 'Choose whether thread tabs use the original thread excerpt or the board title.',
        options: [
          ['excerpt', 'Original thread title'],
          ['board', 'Board title']
        ]
      },
      {
        name: 'Unread Title Count',
        label: 'Unread Count',
        description: 'Controls how unread and quoted-you indicators appear in the tab title.',
        options: [
          ['always', 'Always show count'],
          ['hide-zero', 'Hide zero count'],
          ['quoted', 'Show quote marker'],
          ['quoted-hide-zero', 'Quote marker and hide zero']
        ]
      }
    ]);

    const fsUC = $.el('details',
      { open: true },
      { innerHTML: '<summary>Updater & Cooldown</summary>' });
    const divInterval = $.el('div',
      { innerHTML: '<label>Update Interval: <input type="number" name="Interval" class="field" min="1"></label><span class="description">: Seconds between updates.</span>' });
    divInterval.dataset.name = 'Interval';
    const intervalInput = $('input', divInterval) as HTMLInputElement;
    $.on(intervalInput, 'change', ThreadUpdater.cb.interval);
    items['Interval'] = Conf['Interval'];
    inputs['Interval'] = intervalInput;
    $.add(fsUC, divInterval);
    const divCooldown = $.el('div',
      { innerHTML: '<label>Custom Cooldown: <input type="number" name="customCooldown" class="field" min="0"></label><span class="description">: Seconds to wait after posting.</span>' });
    divCooldown.dataset.name = 'customCooldown';
    const cooldownInput = $('input', divCooldown) as HTMLInputElement;
    $.on(cooldownInput, 'change', $.cb.value);
    items['customCooldown'] = Conf['customCooldown'];
    inputs['customCooldown'] = cooldownInput;
    $.add(fsUC, divCooldown);
    $.add(section, fsUC);

    $.get(items, function(items) {
      for (const key in items) {
        const input = inputs[key];
        if (input.type === 'checkbox') {
          input.checked = items[key];
          input.parentNode.parentNode.dataset.checked = items[key];
        } else {
          input.value = items[key];
        }
      }
    });
  },

  addThreadWatcherFieldset(section) {
    const fs = $.el('details',
      { open: true },
      { innerHTML: '<summary>Thread Watcher</summary>' });
    const items = dict();
    const inputs = dict();

    const displayName = (name: string) => ({
      'Show Mark All Read Icon': 'Mark All Read Icon',
      'Show Mark Thread Read Icons': 'Mark Thread Read Icons',
      'Show OP Thumbnails': 'Thumbnails',
    } as Record<string, string>)[name] || name;

    const watcherOrder = [
      'Current Board',
      'Auto Update Thread Watcher',
      'Auto Watch',
      'Auto Watch Reply',
      'Auto Prune',
      'Show Page',
      'Show Unread Count',
      'Show Site Prefix',
      'Show OP Thumbnails',
      'Show Mark All Read Icon',
      'Show Mark Thread Read Icons',
      'Require OP Quote Link',
    ];

    const syncThumbSizeToDialog = (size: number) => {
      const watcher = $.id('thread-watcher');
      if (watcher) watcher.style.setProperty('--watcher-thumb-size', `${size}px`);
    };
    const syncWatcherHeightToDialog = (height: number) => {
      const watcher = $.id('thread-watcher');
      if (watcher) watcher.style.setProperty('--watcher-max-height', `${height}px`);
    };
    const syncWatcherWidthToDialog = (width: number) => {
      const watcher = $.id('thread-watcher');
      if (watcher) watcher.style.setProperty('--watcher-max-width', `${width}px`);
    };

    for (const name of watcherOrder) {
      if (!Config.threadWatcher[name]) continue;
      const arr = Config.threadWatcher[name];
      const description = arr[1] || '';
      const hoverDescription = Config.threadWatcher['Thread Watcher Thumbnail Hover']?.[1] || '';
      let div: HTMLDivElement;

      if (name === 'Show OP Thumbnails') {
        div = $.el('div',
          { innerHTML: `<label><input type="checkbox" name="${name}">${displayName(name)}</label><span class="thread-watcher-inline-number"><input type="number" name="Thread Watcher Thumbnail Size" min="16" max="160" step="1" class="field thread-watcher-size-input" title="Thumbnail size in pixels"></span><span class="description">: <span class="setting-description">${description}</span></span><span class="thread-watcher-inline-subsetting"><label><input type="checkbox" name="Thread Watcher Thumbnail Hover">Hover Preview</label><span class="thread-watcher-inline-number"><input type="number" name="Thread Watcher Thumbnail Preview Size" min="10" max="99" step="1" class="field thread-watcher-preview-size-input" title="Hover preview size as a percentage">%</span><span class="description">: <span class="setting-description">${hoverDescription}</span></span></span>` });
        div.dataset.name = `${name} Thread Watcher Thumbnail Size Thread Watcher Thumbnail Hover Thread Watcher Thumbnail Preview Size`;
        div.dataset.settingTitle = displayName(name);
        div.dataset.settingDescription = `${description} ${hoverDescription} Thread Watcher Thumbnail Size Thread Watcher Thumbnail Hover Thread Watcher Thumbnail Preview Size`;

        const sizeInput = $('input[name="Thread Watcher Thumbnail Size"]', div) as HTMLInputElement;
        const previewToggle = $('input[name="Thread Watcher Thumbnail Hover"]', div) as HTMLInputElement;
        const previewSizeInput = $('input[name="Thread Watcher Thumbnail Preview Size"]', div) as HTMLInputElement;
        $.on(sizeInput, 'change', function() {
          let size = parseInt(this.value, 10);
          if (isNaN(size)) size = 40;
          size = Math.max(16, Math.min(160, size));
          this.value = `${size}`;
          $.set(this.name, size);
          Conf[this.name] = size;
          syncThumbSizeToDialog(size);
        });
        $.on(previewToggle, 'change', $.cb.checked);
        $.on(previewToggle, 'change', function() {
          if (!this.checked) {
            const hover = $.id('tw-ihover');
            if (hover) {
              hover.hidden = true;
              hover.removeAttribute('src');
              hover.removeAttribute('style');
            }
          }
        });
        $.on(previewSizeInput, 'change', function() {
          let size = parseInt(this.value, 10);
          if (isNaN(size)) size = 40;
          size = Math.max(10, Math.min(99, size));
          this.value = `${size}`;
          $.set(this.name, size);
          Conf[this.name] = size;
        });
        items['Thread Watcher Thumbnail Size'] = Conf['Thread Watcher Thumbnail Size'];
        items['Thread Watcher Thumbnail Hover'] = Conf['Thread Watcher Thumbnail Hover'];
        items['Thread Watcher Thumbnail Preview Size'] = Conf['Thread Watcher Thumbnail Preview Size'];
        inputs['Thread Watcher Thumbnail Size'] = sizeInput;
        inputs['Thread Watcher Thumbnail Hover'] = previewToggle;
        inputs['Thread Watcher Thumbnail Preview Size'] = previewSizeInput;
      } else {
        div = $.el('div',
          { innerHTML: `<label><input type="checkbox" name="${name}">${displayName(name)}</label><span class="description">: <span class="setting-description">${description}</span></span>` });
        div.dataset.name = name;
        div.dataset.settingTitle = displayName(name);
        div.dataset.settingDescription = description;
      }

      const level = arr[2] || 0;
      if (level > 0) div.classList.add('thread-watcher-subsetting');
      const input = $('input', div) as HTMLInputElement;
      $.on(input, 'change', $.cb.checked);
      $.on(input, 'change', function() { this.parentNode.parentNode.dataset.checked = this.checked; });
      items[name] = Conf[name];
      inputs[name] = input;
      $.add(fs, div);
    }

    const heightDiv = $.el('div',
      { innerHTML: '<label>TW Max H <input type="number" name="Thread Watcher Max Height" min="120" max="999" step="1" class="field thread-watcher-height-input"></label><label class="thread-watcher-inline-number">W <input type="number" name="Thread Watcher Max Width" min="120" max="999" step="1" class="field thread-watcher-width-input"></label><span class="description">: <span class="setting-description">Maximum watched-thread list height and width in pixels.</span></span>' });
    heightDiv.dataset.name = 'Thread Watcher Max Height Thread Watcher Max Width';
    heightDiv.dataset.settingTitle = 'TW Max H/W';
    heightDiv.dataset.settingDescription = 'Maximum watched-thread list height and width in pixels.';
    const heightInput = $('input[name="Thread Watcher Max Height"]', heightDiv) as HTMLInputElement;
    const widthInput = $('input[name="Thread Watcher Max Width"]', heightDiv) as HTMLInputElement;
    $.on(heightInput, 'change', function() {
      let height = parseInt(this.value, 10);
      if (isNaN(height)) height = 210;
      height = Math.max(120, Math.min(999, height));
      this.value = `${height}`;
      $.set(this.name, height);
      Conf[this.name] = height;
      syncWatcherHeightToDialog(height);
    });
    $.on(widthInput, 'change', function() {
      let width = parseInt(this.value, 10);
      if (isNaN(width)) width = 250;
      width = Math.max(120, Math.min(999, width));
      this.value = `${width}`;
      $.set(this.name, width);
      Conf[this.name] = width;
      syncWatcherWidthToDialog(width);
    });
    items['Thread Watcher Max Height'] = Conf['Thread Watcher Max Height'];
    items['Thread Watcher Max Width'] = Conf['Thread Watcher Max Width'];
    inputs['Thread Watcher Max Height'] = heightInput;
    inputs['Thread Watcher Max Width'] = widthInput;
    $.add(fs, heightDiv);

    $.add(section, fs);
    $.get(items, function(items) {
      for (const key in items) {
        const input = inputs[key];
        if (input.type === 'checkbox') {
          input.checked = items[key];
          input.parentNode.parentNode.dataset.checked = items[key];
        } else {
          input.value = items[key];
        }
      }
      const thumbSize = parseInt(`${items['Thread Watcher Thumbnail Size']}`, 10);
      if (Number.isFinite(thumbSize)) syncThumbSizeToDialog(Math.max(16, Math.min(160, thumbSize)));
      const watcherHeight = parseInt(`${items['Thread Watcher Max Height']}`, 10);
      if (Number.isFinite(watcherHeight)) syncWatcherHeightToDialog(Math.max(120, Math.min(999, watcherHeight)));
      const watcherWidth = parseInt(`${items['Thread Watcher Max Width']}`, 10);
      if (Number.isFinite(watcherWidth)) syncWatcherWidthToDialog(Math.max(120, Math.min(999, watcherWidth)));
    });
  },

  media(section) {
    const items = dict();
    const inputs = dict();
    const lookup = Settings.getMainSettingLookup();

    const groups: [string, string[]][] = [
      ['Image Behavior', ['Image Expansion', 'Image Hover', 'Image Hover in Catalog', 'Replace Thumbnails', 'Restart when Opened']],
      ['Images', ['Gallery', 'Fullscreen Gallery', 'PDF in Gallery', 'Sauce', 'Reveal Spoiler Thumbnails', 'Image Prefetching', 'Fappe Tyme', 'Werk Tyme']],
      ['Videos', ['WEBM Metadata', 'Autoplay', 'Show Controls', 'Click Passthrough', 'Allow Sound', 'Mouse Wheel Volume', 'Enable sound posts']]
    ];
    for (const [legendTitle, keys] of groups) {
      const fs = $.el('details', { open: true }, { innerHTML: `<summary>${legendTitle}</summary>` });
      const group = dict();
      for (const key of keys) {
        if (lookup[key]) group[key] = lookup[key];
      }
      if (!Settings.addCheckboxes(fs, group, items, inputs)) continue;
      $.add(section, fs);
    }

    Settings.renderMainGroups(section, {
      categories: ['Linkification']
    });

    $.get(items, function(items) {
      for (const key in items) {
        const input = inputs[key];
        if (!input) continue;
        input.checked = items[key];
        input.parentNode.parentNode.dataset.checked = items[key];
      }
    });

    const sauceFS = $.el('details',
      { open: true },
      { innerHTML: '<summary>Sauce</summary>' });
    const sauceWrap = $.el('div');
    Settings.sauce(sauceWrap);
    $.add(sauceFS, sauceWrap);
    $.add(section, sauceFS);
  },

  posting(section) {
    Settings.renderMainGroups(section, {
      categories: ['Posting and Captchas'],
      includeSetting: key => key !== 'Comment Preview',
    });

    const fs = $.el('details',
      { open: true },
      { innerHTML: '<summary>Comment Preview</summary>' }) as HTMLDetailsElement;
    const row = $.el('div', {
      innerHTML: `<label><input type="checkbox" name="Comment Preview"><span class="setting-title">Comment Preview</span></label><span class="description">: <span class="setting-description">${Config.main['Posting and Captchas']['Comment Preview'][1]}</span></span>`,
    }) as HTMLDivElement;
    row.dataset.name = 'Comment Preview';
    const toggle = $('input[name="Comment Preview"]', row) as HTMLInputElement;
    $.on(toggle, 'change', $.cb.checked);
    $.on(toggle, 'change', function() { this.parentNode.parentNode.dataset.checked = this.checked; });
    $.on(toggle, 'change', () => $.event('QRCommentPreviewChanged'));

    const sub = $.el('div', { className: 'suboption-list' });
    const positionRow = $.el('div') as HTMLDivElement;
    positionRow.dataset.name = 'Comment Preview Position';
    const label = $.el('label');
    const select = $.el('select', { name: 'Comment Preview Position' }) as HTMLSelectElement;
    for (const [value, text] of [
      ['below', 'Below the comment box'],
      ['right', 'Right of the comment box'],
      ['left', 'Left of the comment box'],
    ] as const) {
      $.add(select, $.el('option', { value, textContent: text }));
    }
    $.on(select, 'change', $.cb.value);
    $.on(select, 'change', () => $.event('QRCommentPreviewChanged'));
    $.add(label, [$.el('span', { textContent: 'Preview Position: ' }), select]);
    $.add(positionRow, [
      label,
      $.el('span', {
        className: 'description',
        textContent: ': Where the live preview appears relative to the comment box (requires Comment Preview enabled).',
      }),
    ]);
    $.add(sub, positionRow);
    $.add(row, sub);
    $.add(fs, row);
    $.add(section, fs);

    $.get({
      'Comment Preview': Conf['Comment Preview'],
      'Comment Preview Position': Conf['Comment Preview Position'],
    }, items => {
      toggle.checked = !!items['Comment Preview'];
      row.dataset.checked = toggle.checked ? 'true' : 'false';
      select.value = items['Comment Preview Position'] || 'below';
    });

  },

  styling(section) {
    let input: HTMLInputElement, name: string;
    $.extend(section, { innerHTML: StylingPage });

    // When StyleChan is present, replace the conflicting styling controls
    // with a banner that opens StyleChan's dialog on top of ours. CSS does
    // the hiding via the `styling-deferred` class on the section root.
    if (Settings.shouldDeferStylingToStylechan()) {
      section.classList.add('styling-deferred');
      const banner = $.el('div', { className: 'styling-defer-banner' });
      const text = $.el('div', {
        className: 'styling-defer-banner-text',
        innerHTML:
          '<b>StyleChan is managing site themes.</b> '
          + 'The theme picker has been disabled. '
          + 'Some 4chan-neXT styling options, including text colors and custom CSS, are hidden while StyleChan is installed. '
          + 'Highlight colors remain available here. '
          + 'Uninstall StyleChan to restore the full Styling section.'
      });
      const button = $.el('button', {
        type: 'button',
        className: 'styling-defer-open',
        textContent: 'Open StyleChan Settings',
      }) as HTMLButtonElement;
      $.on(button, 'click', e => {
        e.preventDefault();
        Settings.openStylechanSettings();
      });
      $.add(banner, [text, button]);
      section.insertBefore(banner, section.firstChild);
    }

    const inputs: Record<string, HTMLInputElement> = dict();
    for (input of $$('[name]', section)) {
      inputs[input.name] = input;
    }
    Settings.enforceStylechanStylingDeferral(section, inputs);

    // Mark the enclosing <details> for every variant-aware input so CSS
    // can outline the whole section (Highlight Colors, Scrollbar Markers,
    // Text Colors, Custom CSS, etc.) — much less visual noise than
    // outlining each input individually.
    for (const key of styleVariantKeys) {
      const inp = inputs[key];
      if (!inp) continue;
      const detail = inp.closest('details') as HTMLElement | null;
      if (detail) detail.dataset.variantAware = 'true';
    }

    // While the Styling page is open the editing variant overrides the
    // runtime variant so live preview + applyStylingVars reflect the values
    // the user is touching. Initialize from the variant the board would use.
    Settings.stylingEditingVariant = Settings.getBoardVariant();
    // Rename variant-aware inputs to point at the storage key for the
    // currently-edited variant so the form save path writes to the right slot.
    const renameVariantInputs = (variant: StyleVariant) => {
      for (const key of styleVariantKeys) {
        const inp = inputs[key];
        if (inp) inp.name = Settings.variantKey(key, variant);
      }
    };
    renameVariantInputs(Settings.stylingEditingVariant);

    Settings.populateSiteStylePicker(section, inputs['siteStyle'] as HTMLSelectElement);
    Settings.bindSiteStylePicker(section);
    Settings.bindAddCustomTheme(section);

    const setCheckedState = (checkbox: HTMLInputElement) => {
      const container = checkbox.closest('[data-name]') as HTMLElement | null;
      if (!container) return;
      const owner = container.firstElementChild?.querySelector?.('input[type="checkbox"]') as HTMLInputElement | null;
      if (owner !== checkbox) return;
      container.dataset.checked = checkbox.checked ? 'true' : 'false';
    };

    const catalogHighlightKeys = [
      'Catalog Highlight Own Posts',
      'Catalog Highlight Watched Threads',
    ] as const;
    const markerColorLinkPairs = [
      ['Scroll Marker Own Color', 'own', 'Scroll Marker Own Match Highlight'],
      ['Scroll Marker You Color', 'you', 'Scroll Marker You Match Highlight'],
      ['Scroll Marker Ghost Color', 'ghost', 'Scroll Marker Ghost Match Highlight'],
    ] as const;
    const markerMatchKeys = new Set(markerColorLinkPairs.map(([, , matchKey]) => matchKey));
    const highlightTextControlGroups = [
      {
        manualGroup: 'own',
        autoKey: 'Highlight Own Text Auto',
        colorKey: 'Highlight Own Color',
        opacityKey: 'Highlight Own Opacity',
        keys: ['Highlight Own Text Color', 'Highlight Own Link Color', 'Highlight Own Quote Color', 'Highlight Own Dead Link Color'] as const,
      },
      {
        manualGroup: 'you',
        autoKey: 'Highlight You Text Auto',
        colorKey: 'Highlight You Color',
        opacityKey: 'Highlight You Opacity',
        keys: ['Highlight You Text Color', 'Highlight You Link Color', 'Highlight You Quote Color', 'Highlight You Dead Link Color'] as const,
      },
      {
        manualGroup: 'ghost',
        autoKey: 'Highlight Ghost Text Auto',
        colorKey: 'Highlight Ghost Color',
        opacityKey: 'Highlight Ghost Opacity',
        keys: ['Highlight Ghost Text Color', 'Highlight Ghost Link Color', 'Highlight Ghost Quote Color', 'Highlight Ghost Dead Link Color'] as const,
      },
      {
        manualGroup: 'catalog-own',
        autoKey: 'Catalog Highlight Own Text Auto',
        colorKey: 'Catalog Highlight Own Color',
        opacityKey: 'Catalog Highlight Own Opacity',
        keys: ['Catalog Highlight Own Text Color', 'Catalog Highlight Own Subject Color', 'Catalog Highlight Own Link Color', 'Catalog Highlight Own Quote Color', 'Catalog Highlight Own Dead Link Color'] as const,
      },
      {
        manualGroup: 'catalog-watched',
        autoKey: 'Catalog Highlight Watched Text Auto',
        colorKey: 'Catalog Highlight Watched Color',
        opacityKey: 'Catalog Highlight Watched Opacity',
        keys: ['Catalog Highlight Watched Text Color', 'Catalog Highlight Watched Subject Color', 'Catalog Highlight Watched Link Color', 'Catalog Highlight Watched Quote Color', 'Catalog Highlight Watched Dead Link Color'] as const,
      },
    ] as const;
    const textColorKeys = [
      'Text Color',
      'Link Text Color',
      'Quote Text Color',
      'Dead Link Text Color',
    ] as const;
    const markerRefreshKeys = new Set([
      'Scrollbar Markers',
      'Scrollbar Mark Own Posts',
      'Scrollbar Mark Quotes You',
      'Scrollbar Mark Ghost Posts',
      'Scrollbar Mark Unread Line',
      'Scroll Marker Own Match Highlight',
      'Scroll Marker You Match Highlight',
      'Scroll Marker Ghost Match Highlight',
      'Enable Thread Highlights',
      'Enable Catalog Highlights',
      'Catalog Highlight Own Posts',
      'Catalog Highlight Watched Threads',
      'Highlight Own Posts',
      'Highlight Posts Quoting You',
      'Unread Line',
      'siteStyle',
      'siteStyleHome',
    ]);
    const textColorModeSelect = inputs['textColorMode'] as HTMLSelectElement | null;
    const textColorManualTree = $('#styling-text-color-manual', section) as HTMLElement | null;
    const highlightTextKeys = new Set(
      highlightTextControlGroups.flatMap(group => Array.from(group.keys))
    );
    // Inside the styling page, reads/writes target the *editing* variant
    // (which slot the user is currently looking at) rather than the runtime
    // board variant. Without this, switching tabs would either show the
    // wrong starting values or silently overwrite the other variant.
    const editVariant = () => Settings.stylingEditingVariant || Settings.getBoardVariant();
    const editConf = <T = any>(baseKey: string): T => Settings.styleConf<T>(baseKey, editVariant());
    const writeEditConf = (baseKey: string, value: any) => {
      const storageKey = Settings.styleVariantKeySet.has(baseKey)
        ? Settings.variantKey(baseKey, editVariant())
        : baseKey;
      Conf[storageKey] = value;
      $.set(storageKey, value);
    };
    const baseTextPalette = (baseBackground: [number, number, number]) => {
      const textColorMode = editConf<string>('textColorMode') === 'manual' ? 'manual' : 'auto';
      const autoTextPalette = Settings.autoTextPalette(baseBackground);
      return {
        text: textColorMode === 'auto' ? autoTextPalette.text : (editConf<string>('Text Color') || autoTextPalette.text),
        link: textColorMode === 'auto' ? autoTextPalette.link : (editConf<string>('Link Text Color') || autoTextPalette.link),
        quote: textColorMode === 'auto' ? autoTextPalette.quote : (editConf<string>('Quote Text Color') || autoTextPalette.quote),
        deadLink: textColorMode === 'auto' ? autoTextPalette.deadLink : (editConf<string>('Dead Link Text Color') || autoTextPalette.deadLink),
      };
    };
    const syncAutoHighlightPreviewInputs = () => {
      const baseBackground = Settings.getTextBaseBackground();
      const basePalette = baseTextPalette(baseBackground);
      const v = editVariant();
      for (const group of highlightTextControlGroups) {
        const autoToggle = inputs[group.autoKey] as HTMLInputElement | null;
        if (!autoToggle || !autoToggle.checked) continue;
        const palette = Settings.autoHighlightTextPalette(group.colorKey, group.opacityKey, baseBackground, v) || basePalette;
        const nextValues = [palette.text, palette.link, palette.quote, palette.deadLink] as const;
        for (let i = 0; i < group.keys.length; i++) {
          const key = group.keys[i];
          const next = nextValues[i];
          if (!next) continue;
          const colorInput = inputs[key];
          if (!colorInput) continue;
          colorInput.value = next;
          delete colorInput.dataset.unset;
        }
      }
    };
    const seedManualHighlightTextColors = (
      targetGroup?: typeof highlightTextControlGroups[number],
      overwrite = false,
    ) => {
      const baseBackground = Settings.getTextBaseBackground();
      const basePalette = baseTextPalette(baseBackground);
      const groups = targetGroup ? [targetGroup] : highlightTextControlGroups;
      const v = editVariant();
      for (const group of groups) {
        const autoToggle = inputs[group.autoKey] as HTMLInputElement | null;
        if (!autoToggle || autoToggle.checked) continue;
        const autoPalette = Settings.autoHighlightTextPalette(group.colorKey, group.opacityKey, baseBackground, v) || basePalette;
        const nextValues = [autoPalette.text, autoPalette.link, autoPalette.quote, autoPalette.deadLink] as const;
        for (let i = 0; i < group.keys.length; i++) {
          const key = group.keys[i];
          const next = nextValues[i];
          if (!next) continue;
          if (overwrite || !editConf<string>(key)) {
            writeEditConf(key, next);
          }
          const colorInput = inputs[key];
          if (!colorInput) continue;
          colorInput.value = editConf<string>(key) || next;
          delete colorInput.dataset.unset;
        }
      }
    };
    const refreshStylingPreview = () => Settings.refreshStylingPreviewFromDialog();
    const syncCatalogHighlightControls = () => {
      const catalogEnabled = !!inputs['Enable Catalog Highlights']?.checked;
      for (const key of catalogHighlightKeys) {
        const enabled = catalogEnabled && !!inputs[key]?.checked;
        const controls = key === 'Catalog Highlight Own Posts' ?
          [
            'Catalog Highlight Own Color', 'Catalog Highlight Own Opacity', 'Catalog Highlight Own Text Auto',
            'Catalog Highlight Own Text Color', 'Catalog Highlight Own Subject Color', 'Catalog Highlight Own Link Color', 'Catalog Highlight Own Quote Color', 'Catalog Highlight Own Dead Link Color',
          ] :
          [
            'Catalog Highlight Watched Color', 'Catalog Highlight Watched Opacity', 'Catalog Highlight Watched Text Auto',
            'Catalog Highlight Watched Text Color', 'Catalog Highlight Watched Subject Color', 'Catalog Highlight Watched Link Color', 'Catalog Highlight Watched Quote Color', 'Catalog Highlight Watched Dead Link Color',
          ];
        for (const controlKey of controls) {
          const control = inputs[controlKey];
          if (control) control.disabled = !enabled;
        }
      }
    };
    const syncMarkerColorControls = () => {
      Settings.syncLinkedMarkerColors(inputs, editVariant());
      for (const [key, markerType, matchKey] of markerColorLinkPairs) {
        const linked = !!inputs[matchKey]?.checked;
        const colorInput = inputs[key];
        if (colorInput) colorInput.disabled = linked;
        const row = $(`[data-marker-color="${markerType}"]`, section) as HTMLElement | null;
        if (row) {
          row.dataset.colorLinked = linked ? 'true' : 'false';
          const clearButton = $(`[data-clear="${key}"]`, row) as HTMLButtonElement | null;
          if (clearButton) clearButton.disabled = linked;
        }
      }
    };
    const syncTextColorControls = () => {
      const manualMode = (textColorModeSelect?.value || 'auto') === 'manual';
      if (textColorManualTree) textColorManualTree.hidden = !manualMode;
      for (const key of textColorKeys) {
        const colorInput = inputs[key];
        if (colorInput) colorInput.disabled = !manualMode;
        const clearButton = $(`[data-clear="${key}"]`, section) as HTMLButtonElement | null;
        if (clearButton) clearButton.disabled = !manualMode;
      }
    };
    const syncHighlightTextControls = () => {
      for (const group of highlightTextControlGroups) {
        const autoToggle = inputs[group.autoKey] as HTMLInputElement | null;
        const auto = autoToggle ? autoToggle.checked : true;
        const manualRoot = $(`[data-highlight-text-manual="${group.manualGroup}"]`, section) as HTMLElement | null;
        if (manualRoot) manualRoot.hidden = auto;
        for (const key of group.keys) {
          const colorInput = inputs[key];
          if (colorInput) colorInput.disabled = auto;
          const clearButton = $(`[data-clear="${key}"]`, section) as HTMLButtonElement | null;
          if (clearButton) clearButton.disabled = auto;
        }
      }
    };
    const setMatchTargetHighlight = (role: string, on: boolean) => {
      if (!role) return;
      const target = $(`[data-highlight-row="${role}"]`, section) as HTMLElement | null;
      if (!target) return;
      target.classList.toggle('styling-match-hover-target', on);
    };
    for (const matchLabel of $$('[data-match-target]', section) as HTMLElement[]) {
      const role = matchLabel.dataset.matchTarget || '';
      $.on(matchLabel, 'mouseenter', () => setMatchTargetHighlight(role, true));
      $.on(matchLabel, 'mouseleave', () => setMatchTargetHighlight(role, false));
      $.on(matchLabel, 'focusin', () => setMatchTargetHighlight(role, true));
      $.on(matchLabel, 'focusout', () => setMatchTargetHighlight(role, false));
    }
    const refreshUnsetColorInputs = () => {
      for (const key in inputs) {
        const inp = inputs[key];
        if (inp.type !== 'color' || inp.dataset.unset !== '1') continue;
        if (highlightTextKeys.has(key)) {
          const group = highlightTextControlGroups.find(item => item.keys.includes(key as any));
          const autoToggle = group ? inputs[group.autoKey] : null;
          if (autoToggle && !autoToggle.checked) continue;
        }
        Settings.setColorInputValue(inp, key, '');
      }
    };

    if (textColorModeSelect) {
      $.on(textColorModeSelect, 'change', () => {
        // $.cb.value (bound later) persists to the variant-suffixed
        // storage key; keep the local Conf entry in sync for the helpers
        // we call before it fires.
        writeEditConf('textColorMode', textColorModeSelect.value);
        syncTextColorControls();
        syncAutoHighlightPreviewInputs();
        Settings.applyStylingVars();
        refreshStylingPreview();
      });
    }
    for (const group of highlightTextControlGroups) {
      const autoToggle = inputs[group.autoKey] as HTMLInputElement | null;
      if (!autoToggle) continue;
      $.on(autoToggle, 'change', () => {
        writeEditConf(group.autoKey, !!autoToggle.checked);
        if (autoToggle.checked) {
          syncAutoHighlightPreviewInputs();
        } else {
          seedManualHighlightTextColors(group, true);
        }
        syncHighlightTextControls();
        Settings.applyStylingVars();
        refreshStylingPreview();
      });
    }

    const items: Record<string, any> = dict();
    for (name in inputs) {
      input = inputs[name];
      if (name === 'Custom CSS') continue; // handled below (special toggle)
      // input.name is the storage key (possibly variant-suffixed); items has
      // to be keyed by storage key so $.get fetches from the right slot.
      items[input.name] = Conf[input.name];
      const event = (
        (input.nodeName === 'SELECT') ||
        ['checkbox', 'radio', 'color', 'range'].includes(input.type) ||
        ((input.nodeName === 'TEXTAREA') && !(name in Settings))
      ) ? 'change' : 'input';
      const persist = $.cb[input.type === 'checkbox' ? 'checked' : 'value'];
      $.on(input, event, persist);
      if ((input.type === 'color' || input.type === 'range') && event !== 'input') {
        $.on(input, 'input', persist);
      }
      if (input.type === 'checkbox') {
        $.on(input, 'change', function() { setCheckedState(this as HTMLInputElement); });
        $.on(input, 'change', () => {
          syncAutoHighlightPreviewInputs();
          Settings.applyStylingVars();
          refreshStylingPreview();
        });
        if (catalogHighlightKeys.includes(name as typeof catalogHighlightKeys[number])) {
          $.on(input, 'change', syncCatalogHighlightControls);
        }
        if (markerMatchKeys.has(name as typeof markerColorLinkPairs[number][2])) {
          $.on(input, 'change', syncMarkerColorControls);
        }
        if (name === 'Enable Catalog Highlights') {
          $.on(input, 'change', syncCatalogHighlightControls);
        }
        if (markerRefreshKeys.has(name)) {
          $.on(input, 'change', () => $.event('RefreshScrollMarkers'));
        }
      }
      if (name in Settings) $.on(input, event, Settings[name]);
      if (input.type === 'color') {
        const applyColor = function() {
          delete (this as HTMLInputElement).dataset.unset;
          syncAutoHighlightPreviewInputs();
          Settings.applyStylingVars();
          refreshStylingPreview();
        };
        $.on(input, event, applyColor);
        if (event !== 'input') $.on(input, 'input', applyColor);
      } else if (input.type === 'range') {
        const applyRange = () => {
          syncAutoHighlightPreviewInputs();
          Settings.applyStylingVars();
          refreshStylingPreview();
        };
        $.on(input, event, applyRange);
        if (event !== 'input') $.on(input, 'input', applyRange);
      }
    }
    Settings.primeResolvedStyleColorCache(
      Object.keys(inputs).filter(key => inputs[key].type === 'color')
    );

    // Custom CSS toggle + textarea behavior (mirrors Advanced wiring).
    const customCSS: HTMLInputElement  = inputs['Custom CSS'];
    customCSS.checked          =  Conf['Custom CSS'];
    inputs['usercss'].disabled = !Conf['Custom CSS'];
    $.on(customCSS, 'change', Settings.togglecss);
    Settings.initCustomCSSEditor(section, inputs['usercss'] as unknown as HTMLTextAreaElement);

    const populateInputsFromLoaded = (loaded: Record<string, any>) => {
      for (const storageKey in loaded) {
        const val = loaded[storageKey];
        const baseName = Settings.styleKeyBase(storageKey);
        const inp = inputs[baseName];
        if (!inp) continue;
        if (inp.type === 'checkbox') {
          inp.checked = !!val;
          setCheckedState(inp);
        } else if (inp.type === 'color') {
          Settings.setColorInputValue(inp, baseName, val);
        } else if (inp.type === 'range') {
          inp.value = (val === '' || val == null) ? '1' : String(val);
        } else if (baseName === 'siteStyle' && !val) {
          // Keep whichever style is currently active selected in the picker
          // when no explicit site style preference has been saved yet.
        } else {
          inp.value = val ?? '';
        }
        inp.hidden = false;
        if (baseName in Settings) Settings[baseName].call(inp);
      }
      syncMarkerColorControls();
      syncCatalogHighlightControls();
      syncTextColorControls();
      syncHighlightTextControls();
      seedManualHighlightTextColors();
      syncAutoHighlightPreviewInputs();
      Settings.applyStylingVars();
      refreshUnsetColorInputs();
      Settings.refreshCustomCSSEditor(section);
      refreshStylingPreview();
    };

    $.get(items, populateInputsFromLoaded);

    // Clear buttons next to each color input — reset the Conf key to '' so
    // the theme default takes over again. data-clear holds the base key;
    // route the write through the storage key for the active variant.
    for (const btn of $$('[data-clear]', section) as HTMLButtonElement[]) {
      $.on(btn, 'click', () => {
        const baseKey = btn.dataset.clear!;
        const storageKey = Settings.styleVariantKeySet.has(baseKey)
          ? Settings.variantKey(baseKey)
          : baseKey;
        Conf[storageKey] = '';
        $.set(storageKey, '');
        Settings.applyStylingVars();
        const target = inputs[baseKey];
        if (target) {
          Settings.setColorInputValue(target, baseKey, '');
        }
        syncAutoHighlightPreviewInputs();
        refreshStylingPreview();
      });
    }

    const paletteSuggestionRoot = $('#styling-palette-suggestions', section) as HTMLElement | null;
    const suggestPalettesBtn = $('#styling-suggest-palettes', section) as HTMLButtonElement | null;
    const savedPaletteNameInput = $('#styling-saved-palette-name', section) as HTMLInputElement | null;
    const savePaletteBtn = $('#styling-save-palette', section) as HTMLButtonElement | null;
    const savedPalettesList = $('#styling-saved-palettes-list', section) as HTMLElement | null;
    const paletteStateMap = [
      ['own', 'Highlight Own Color', 'Thread: your post'],
      ['you', 'Highlight You Color', 'Thread: quotes you'],
      ['ghost', 'Highlight Ghost Color', 'Thread: ghost post'],
      ['catalogOwn', 'Catalog Highlight Own Color', 'Catalog: your post'],
      ['catalogWatched', 'Catalog Highlight Watched Color', 'Catalog: watched thread'],
    ] as const;
    const readCurrentPaletteColors = () => {
      const out = {
        own: '#000000',
        you: '#000000',
        ghost: '#000000',
        catalogOwn: '#000000',
        catalogWatched: '#000000',
      };
      for (const [slot, baseKey] of paletteStateMap) {
        const inputColor = inputs[baseKey]?.value || '';
        const storedColor = editConf<string>(baseKey) || '';
        const resolved = Settings.toHexColor(inputColor)
          || Settings.toHexColor(storedColor)
          || Settings.resolvedColorForKey(baseKey)
          || '#000000';
        out[slot] = resolved.toLowerCase();
      }
      return out;
    };
    function applySuggestedPalette(palette: {
      colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>;
    }) {
      for (const [slot, baseKey] of paletteStateMap) {
        const color = palette.colors[slot];
        if (!color) continue;
        writeEditConf(baseKey, color);
        const inp = inputs[baseKey];
        if (inp) Settings.setColorInputValue(inp, baseKey, color);
      }
      syncMarkerColorControls();
      syncAutoHighlightPreviewInputs();
      Settings.applyStylingVars();
      refreshStylingPreview();
    }
    function renderSuggestedPalettes() {
      if (!paletteSuggestionRoot) return;
      const { profile, palettes } = Settings.suggestedHighlightPalettes(editVariant());
      paletteSuggestionRoot.textContent = '';
      const header = $.el('div', { className: 'styling-palette-header' });
      const title = $.el('div', {
        className: 'styling-palette-title',
        textContent: `Suggested palettes for ${profile.label}`,
      });
      const note = $.el('div', {
        className: 'styling-palette-note note',
        textContent: profile.note,
      });
      const refresh = $.el('button', {
        type: 'button',
        textContent: 'Refresh',
      }) as HTMLButtonElement;
      $.on(refresh, 'click', () => renderSuggestedPalettes());
      $.add(header, [title, note, refresh]);
      $.add(paletteSuggestionRoot, header);

      const list = $.el('div', { className: 'styling-palette-list' });
      for (const palette of palettes) {
        const row = $.el('div', { className: 'styling-palette-row' });
        const apply = $.el('button', {
          type: 'button',
          textContent: 'Apply',
        }) as HTMLButtonElement;
        $.on(apply, 'click', () => applySuggestedPalette(palette));
        const name = $.el('div', { className: 'styling-palette-name', textContent: palette.name });
        const swatches = $.el('div', { className: 'styling-palette-swatches' });
        for (const [slot, , label] of paletteStateMap) {
          const color = palette.colors[slot];
          const swatch = $.el('span', {
            className: 'styling-palette-swatch',
            title: `${label}: ${color}`,
          }) as HTMLSpanElement;
          swatch.style.backgroundColor = color;
          $.add(swatches, swatch);
        }
        $.add(row, [apply, name, swatches]);
        $.add(list, row);
      }
      $.add(paletteSuggestionRoot, list);
    }
    function renderSavedPalettes() {
      if (!savedPalettesList) return;
      savedPalettesList.textContent = '';
      const palettes = Settings.savedHighlightPaletteList();
      if (!palettes.length) {
        const empty = $.el('div', {
          className: 'styling-palette-note note',
          textContent: 'No saved palettes yet.',
        });
        $.add(savedPalettesList, empty);
        return;
      }
      for (const [index, palette] of palettes.entries()) {
        const row = $.el('div', { className: 'styling-saved-palette-row' });
        const apply = $.el('button', {
          type: 'button',
          textContent: 'Apply',
        }) as HTMLButtonElement;
        const remove = $.el('button', {
          type: 'button',
          textContent: 'Delete',
          title: `Delete ${palette.name}`,
        }) as HTMLButtonElement;
        $.on(apply, 'click', () => applySuggestedPalette(palette));
        $.on(remove, 'click', () => {
          const list = Settings.savedHighlightPaletteList();
          list.splice(index, 1);
          Settings.setSavedHighlightPalettes(list);
          renderSavedPalettes();
        });
        const name = $.el('div', { className: 'styling-palette-name', textContent: palette.name });
        const swatches = $.el('div', { className: 'styling-palette-swatches' });
        for (const [slot, , label] of paletteStateMap) {
          const color = palette.colors[slot];
          const swatch = $.el('span', {
            className: 'styling-palette-swatch',
            title: `${label}: ${color}`,
          }) as HTMLSpanElement;
          swatch.style.backgroundColor = color;
          $.add(swatches, swatch);
        }
        $.add(row, [apply, remove, name, swatches]);
        $.add(savedPalettesList, row);
      }
    }
    function refreshSuggestedPalettesIfOpen() {
      if (!paletteSuggestionRoot || paletteSuggestionRoot.hidden) return;
      renderSuggestedPalettes();
    }
    if (suggestPalettesBtn && paletteSuggestionRoot) {
      $.on(suggestPalettesBtn, 'click', () => {
        paletteSuggestionRoot.hidden = !paletteSuggestionRoot.hidden;
        suggestPalettesBtn.textContent = paletteSuggestionRoot.hidden ? 'Suggest palettes' : 'Hide palettes';
        if (!paletteSuggestionRoot.hidden) renderSuggestedPalettes();
      });
    }
    if (savePaletteBtn && savedPaletteNameInput) {
      const saveCurrentPalette = () => {
        const name = savedPaletteNameInput.value.trim();
        if (!name) {
          savedPaletteNameInput.focus();
          return;
        }
        const colors = readCurrentPaletteColors();
        const list = Settings.savedHighlightPaletteList();
        const existing = list.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
        const entry = { name, colors };
        if (existing >= 0) {
          list[existing] = entry;
          Settings.setSavedHighlightPalettes(list);
        } else {
          list.unshift(entry);
          Settings.setSavedHighlightPalettes(list);
        }
        renderSavedPalettes();
      };
      $.on(savePaletteBtn, 'click', saveCurrentPalette);
      $.on(savedPaletteNameInput, 'keydown', (e: KeyboardEvent) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        saveCurrentPalette();
      });
    }
    renderSavedPalettes();
    $.get({ savedHighlightPalettes: Conf['savedHighlightPalettes'] }, ({ savedHighlightPalettes }) => {
      Conf['savedHighlightPalettes'] = savedHighlightPalettes;
      renderSavedPalettes();
    });

    // Randomize / reset highlight color buttons.
    const openPreview = $('#styling-open-preview', section);
    if (openPreview) {
      $.on(openPreview, 'click', () => {
        Settings.openStylingPreview(section);
      });
    }
    const randomize = $('#styling-randomize', section);
    if (randomize) {
      $.on(randomize, 'click', () => {
        for (const baseKey of [
          'Highlight Own Color',
          'Highlight You Color',
          'Highlight Ghost Color',
          'Catalog Highlight Own Color',
          'Catalog Highlight Watched Color',
        ] as const) {
          const color = Settings.randomHighlightColor();
          const storageKey = Settings.variantKey(baseKey);
          Conf[storageKey] = color;
          $.set(storageKey, color);
          const inp = inputs[baseKey];
          if (inp) Settings.setColorInputValue(inp, baseKey, color);
        }
        syncAutoHighlightPreviewInputs();
        Settings.applyStylingVars();
        refreshStylingPreview();
        refreshSuggestedPalettesIfOpen();
      });
    }
    const siteStyleInput = inputs['siteStyle'];
    if (siteStyleInput) {
      $.on(siteStyleInput, 'change', refreshSuggestedPalettesIfOpen);
    }

    // SFW / NSFW tab switcher.
    const variantBar = $('.styling-variant-bar', section) as HTMLElement | null;
    const variantHint = $('.styling-variant-hint', section) as HTMLElement | null;
    const tabsByVariant: Record<StyleVariant, HTMLButtonElement | null> = {
      sfw: $('.styling-variant-tabs [data-styling-variant="sfw"]', section) as HTMLButtonElement | null,
      nsfw: $('.styling-variant-tabs [data-styling-variant="nsfw"]', section) as HTMLButtonElement | null,
    };
    const updateVariantHint = () => {
      if (!variantHint) return;
      const board = Settings.getBoardVariant();
      const mode = Conf['sfwNsfwMode'];
      const editing = Settings.stylingEditingVariant || board;
      let reason: string;
      if (mode === 'sfw') reason = 'SFW (forced everywhere)';
      else if (mode === 'nsfw') reason = 'NSFW (forced everywhere)';
      else if (!g.boardID) reason = 'SFW (no board context)';
      else reason = `${board.toUpperCase()} (board ${g.boardID} is ${board === 'sfw' ? 'worksafe' : 'NSFW'})`;
      const editingNote = editing === board
        ? ''
        : ` — you are editing the ${editing.toUpperCase()} variant, which is not currently applied`;
      variantHint.textContent = `Active variant: ${reason}${editingNote}.`;
    };
    const updateVariantTabsSelected = () => {
      const v = Settings.stylingEditingVariant || 'sfw';
      for (const variant of ['sfw', 'nsfw'] as const) {
        const tab = tabsByVariant[variant];
        if (!tab) continue;
        const selected = variant === v;
        tab.classList.toggle('settings-subnav-tab-selected', selected);
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      }
    };
    // In the dedicated Styling view, `section` itself has class
    // `section-styling`. In the All Settings view, `section` is the inner
    // `.settings-section-content` and its parent block carries the
    // `section-styling` class — so route attributes to whichever ancestor
    // owns that class for the CSS selectors to match either way.
    const stylingHost = (section.closest('.section-styling') as HTMLElement | null) || section;
    const updateVariantDecoration = (variant: StyleVariant) => {
      // When deferring to StyleChan, the SFW/NSFW UI is hidden, so the
      // orange NSFW accent and corner badge would just be noise on the
      // sections that remain (Highlight Colors, Scrollbar Markers, etc.).
      if (section.classList.contains('styling-deferred')) return;
      const label = `Editing ${variant.toUpperCase()}`;
      if (variantBar) variantBar.dataset.editingVariant = variant;
      stylingHost.dataset.editingVariant = variant;
      stylingHost.dataset.editingVariantLabel = label;
    };
    const switchEditingVariant = (variant: StyleVariant) => {
      if (Settings.stylingEditingVariant === variant) return;
      Settings.stylingEditingVariant = variant;
      renameVariantInputs(variant);
      updateVariantDecoration(variant);
      // Re-fetch all variant-aware values so the inputs reflect the slot
      // we just switched to. We deliberately do NOT call Settings.siteStyle,
      // CustomCSS.update, or dispatch any CustomSiteThemeChanged /
      // RefreshScrollMarkers events here — the tab switcher only changes
      // which slot is being edited; it must not alter the board's
      // currently-applied styling. applyStylingVars (called via
      // populateInputsFromLoaded) will repaint the *dialog* with the new
      // editing variant; :root stays on the board variant.
      const refetch: Record<string, any> = dict();
      for (const baseKey of styleVariantKeys) {
        const inp = inputs[baseKey];
        if (!inp) continue;
        refetch[inp.name] = Conf[inp.name];
      }
      $.get(refetch, (loaded: Record<string, any>) => {
        populateInputsFromLoaded(loaded);
        updateVariantTabsSelected();
        updateVariantHint();
        refreshSuggestedPalettesIfOpen();
      });
    };
    for (const variant of ['sfw', 'nsfw'] as const) {
      const tab = tabsByVariant[variant];
      if (!tab) continue;
      tab.setAttribute('role', 'tab');
      $.on(tab, 'click', () => switchEditingVariant(variant));
    }
    const applyModeVisibility = () => {
      if (variantBar) variantBar.dataset.mode = Conf['sfwNsfwMode'] || 'auto';
    };
    const modeSelect = inputs['sfwNsfwMode'] as HTMLSelectElement | undefined;
    if (modeSelect) {
      $.on(modeSelect, 'change', () => {
        const mode = Conf['sfwNsfwMode'];
        // When the user forces a variant, pin the editing slot to it so the
        // inputs they see match the slot that's actually applied.
        if ((mode === 'sfw' || mode === 'nsfw') && Settings.stylingEditingVariant !== mode) {
          switchEditingVariant(mode);
        }
        applyModeVisibility();
        updateVariantHint();
        // Re-apply runtime styling in case the mode change shifts which
        // variant is active outside the dialog.
        Settings.applyStylingVars();
        // Re-inject the active variant's custom CSS (Custom CSS reads the
        // active variant's `usercss` slot, but the <style> tag only updates
        // when we tell it to).
        if (Conf['Custom CSS']) CustomCSS.update();
        $.event('CustomSiteThemeChanged');
        $.event('RefreshScrollMarkers');
        refreshSuggestedPalettesIfOpen();
      });
    }
    const initialMode = Conf['sfwNsfwMode'];
    if ((initialMode === 'sfw' || initialMode === 'nsfw') && Settings.stylingEditingVariant !== initialMode) {
      Settings.stylingEditingVariant = initialMode;
    }
    updateVariantTabsSelected();
    updateVariantHint();
    updateVariantDecoration(Settings.stylingEditingVariant || 'sfw');
    applyModeVisibility();
    // Apply the editing variant to the dialog so the page behind the
    // dialog stays on its variant but the preview/colors inside show what
    // we're editing.
    Settings.applyStylingVars();
  },

  stylingPreviewSampleText() {
    const sample = $('.thread .postMessage, .postContainer .postMessage', d.body) as HTMLElement | null;
    const fallback = 'Sample thread text. Adjust settings above to see post colors update live.';
    if (!sample) return fallback;
    const text = (sample.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return fallback;
    return text.length > 180 ? `${text.slice(0, 177)}...` : text;
  },

  stylingPreviewSampleMessageHTML() {
    return [
      'Regular text sample with a ',
      '<a href="https://example.com/thread-preview" target="_blank" rel="nofollow noopener">regular link</a>, ',
      '<a class="quotelink" href="#p1213499548" rel="nofollow">&gt;&gt;1213499548</a>, ',
      '<a class="quotelink deadlink" href="#p1213000000" rel="nofollow">&gt;&gt;1213000000</a>, ',
      'and <span class="quote">&gt;quoted text preview</span>.'
    ].join('');
  },

  stylingPreviewPostHTML({
    postID,
    extraClass = '',
    author = 'Anonymous',
    subject = '',
    message = '',
    messageHTML = '',
  }: {
    postID: number;
    extraClass?: string;
    author?: string;
    subject?: string;
    message?: string;
    messageHTML?: string;
  }) {
    const subjectHTML = subject ? `<span class="subject">${E(subject)}</span> ` : '';
    const renderedMessage = messageHTML || E(message || Settings.stylingPreviewSampleText());
    const classes = `postContainer replyContainer styling-preview-post ${extraClass}`.trim();
    return `
      <div class="${classes}" id="pc${postID}" itemprop="comment" itemscope itemtype="https://schema.org/Comment" data-full-i-d="g.${postID}">
        <div class="sideArrows" id="sa${postID}">&gt;&gt;</div>
        <div id="p${postID}" class="post reply">
          <div class="postInfoM mobile" id="pim${postID}">
            <span class="nameBlock"><span class="name">${E(author)}</span><br></span>
            <span class="dateTime postNum" data-utc="1780096072"><time datetime="2026-05-29T19:07:52-04:00">05/29/26(Fri)19:07:52</time> <a href="#p${postID}" rel="nofollow" title="Link to this post">No.</a><a href="javascript:quote('${postID}');" rel="nofollow" title="Reply to this post">${postID}</a></span>
          </div>
          <div class="postInfo desktop" id="pi${postID}">
            ${subjectHTML}<span class="nameBlock"><span class="name" itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">${E(author)}</span></span> </span>
            <span class="dateTime" data-utc="1780096072">05/29/26(Fri)19:07:52</span>&nbsp;<span class="postNum desktop"><a href="#p${postID}" rel="nofollow" title="Link to this post">No.</a><a href="javascript:quote('${postID}');" rel="nofollow" title="Reply to this post">${postID}</a></span><a class="menu-button" href="javascript:;"><svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 320 512"><path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z" fill="currentColor"></path></svg></a><span class="container"></span>
          </div>
          <blockquote class="postMessage" id="m${postID}" itemprop="text">${renderedMessage}</blockquote>
        </div>
      </div>
    `;
  },

  stylingPreviewCatalogThreadHTML({
    threadID,
    postID,
    extraThreadClass = '',
    extraContainerClass = '',
    subject = '',
    message = '',
    messageHTML = '',
    summary = '',
    excerpt = '',
  }: {
    threadID: number;
    postID: number;
    extraThreadClass?: string;
    extraContainerClass?: string;
    subject?: string;
    message?: string;
    messageHTML?: string;
    summary?: string;
    excerpt?: string;
  }) {
    const threadClasses = `thread catalog-thread ${extraThreadClass}`.trim();
    const containerClasses = `postContainer catalog-container ${extraContainerClass}`.trim();
    const safeSubject = E(subject || 'Catalog subject preview');
    const renderedMessage = messageHTML || E(message || Settings.stylingPreviewSampleText());
    const safeSummary = E(summary || '4 posts and 2 image replies');
    const safeExcerpt = E(excerpt || 'recent reply preview');
    return `
      <div class="${threadClasses}" id="t${threadID}" style="--tn-w: 250; --tn-h: 196;">
        <div class="${containerClasses}" id="pc${threadID}" data-full-i-d="g.${threadID}">
          <div id="p${postID}" class="post catalog-post">
            <a class="catalog-link" href="/g/thread/${threadID}">
              <img src="//i.4cdn.org/g/1745612650141704s.jpg" class="catalog-thumb" data-width="250" data-height="196" style="width: 150px; height: 117.6px;">
            </a>
            <div class="catalog-stats">
              <span title="Posts / Files / Page"><span class="post-count">12</span> / <span class="file-count">8</span> / <span class="page-count">1</span></span>
            </div>
            <div class="postInfo">
              <span class="subject">${safeSubject}</span>
            </div>
            <blockquote class="postMessage" id="m${postID}">${renderedMessage}</blockquote>
            <span class="summary preview-summary">${safeSummary}</span>
            <div class="catalog-replies">
              <div class="catalog-reply">
                <span><time data-utc="1780096072000" data-abbrev="1">1m</time>: </span>
                <a class="catalog-reply-excerpt" href="/g/thread/${threadID}#p${postID}">${safeExcerpt}</a>
                <a class="catalog-reply-preview" href="/g/thread/${threadID}#p${postID}">...</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  openStylingPreview(section?: HTMLElement) {
    if (!Settings.dialog) return;
    const targetSection = section || ($('.section-styling', Settings.dialog) as HTMLElement | null);
    if (!targetSection) return;
    const trigger = $('#styling-open-preview', targetSection) as HTMLButtonElement | null;

    if (Settings.stylingPreviewPanel && Settings.stylingPreviewPanel.isConnected) {
      const collapsed = Settings.stylingPreviewPanel.dataset.collapsed === 'true';
      Settings.stylingPreviewPanel.dataset.collapsed = collapsed ? 'false' : 'true';
      if (trigger) trigger.textContent = collapsed ? 'Hide preview' : 'Preview states';
      return;
    }

    const panel = $.el('div', { className: 'styling-preview styling-preview-dock dialog' }) as HTMLDivElement;
    panel.dataset.collapsed = 'false';
    const sampleMessageHTML = Settings.stylingPreviewSampleMessageHTML();
    panel.innerHTML = `
      <div class="styling-preview-layout">
        <div class="board styling-preview-thread">
          <div class="thread" id="t503286550">
            ${Settings.stylingPreviewPostHTML({ postID: 503286554, subject: 'Normal thread state', messageHTML: sampleMessageHTML })}
            ${Settings.stylingPreviewPostHTML({ postID: 503286555, extraClass: 'yourPost', author: 'You', subject: 'Your post state', messageHTML: sampleMessageHTML })}
            ${Settings.stylingPreviewPostHTML({ postID: 503286556, extraClass: 'quotesYou', subject: 'Quotes you state', messageHTML: sampleMessageHTML })}
            ${Settings.stylingPreviewPostHTML({ postID: 503286557, extraClass: 'from-archive', author: 'Archived', subject: 'Ghost post state', messageHTML: sampleMessageHTML })}
          </div>
        </div>
        <div class="board styling-preview-catalog catalog-small">
          ${Settings.stylingPreviewCatalogThreadHTML({
            threadID: 503286580,
            postID: 503286580,
            extraThreadClass: 'yourPost',
            extraContainerClass: 'yourPost',
            subject: 'Catalog own-post state',
            messageHTML: sampleMessageHTML,
            summary: '5 posts and 3 image replies',
            excerpt: 'your post reply sample',
          })}
          ${Settings.stylingPreviewCatalogThreadHTML({
            threadID: 503286590,
            postID: 503286590,
            extraThreadClass: 'watched',
            subject: 'Catalog watched-thread state',
            messageHTML: sampleMessageHTML,
            summary: '10 posts and 4 image replies',
            excerpt: 'watched thread reply sample',
          })}
        </div>
      </div>
    `;

    const actions = $('.styling-actions', targetSection) as HTMLElement | null;
    if (actions?.parentElement) {
      actions.parentElement.insertBefore(panel, actions.nextSibling);
    } else {
      $.add(targetSection, panel);
    }
    Settings.stylingPreviewPanel = panel;
    if (trigger) trigger.textContent = 'Hide preview';
    Settings.refreshStylingPreviewFromDialog();
  },

  closeStylingPreview() {
    if (!Settings.stylingPreviewPanel) return;
    const trigger = Settings.dialog ? ($('#styling-open-preview', Settings.dialog) as HTMLButtonElement | null) : null;
    if (trigger) trigger.textContent = 'Preview states';
    $.rm(Settings.stylingPreviewPanel);
    Settings.stylingPreviewPanel = null;
  },

  refreshStylingPreviewFromDialog() {
    const panel = Settings.stylingPreviewPanel;
    if (!panel) return;
    if (!panel.isConnected) {
      Settings.stylingPreviewPanel = null;
      return;
    }
    const readChecked = (name: string, fallback = false) => {
      const input = Settings.dialog ? ($(`[name="${name}"]`, Settings.dialog) as HTMLInputElement | null) : null;
      if (input) return !!input.checked;
      return Conf[name] == null ? fallback : !!Conf[name];
    };
    const ownEnabled = readChecked('Highlight Own Posts');
    const youEnabled = readChecked('Highlight Posts Quoting You');
    const ghostEnabled = readChecked('Highlight Ghost Posts');
    const threadHighlightsEnabled = readChecked('Enable Thread Highlights', true);
    const catalogHighlightsEnabled = readChecked('Enable Catalog Highlights', true);
    const catalogOwnEnabled = readChecked('Catalog Highlight Own Posts', true);
    const catalogWatchedEnabled = readChecked('Catalog Highlight Watched Threads', true);

    panel.dataset.highlightOwn = (threadHighlightsEnabled && ownEnabled) ? 'true' : 'false';
    panel.dataset.highlightYou = (threadHighlightsEnabled && youEnabled) ? 'true' : 'false';
    panel.dataset.highlightGhost = (threadHighlightsEnabled && ghostEnabled) ? 'true' : 'false';
    panel.dataset.highlightCatalogOwn = (catalogHighlightsEnabled && catalogOwnEnabled) ? 'true' : 'false';
    panel.dataset.highlightCatalogWatched = (catalogHighlightsEnabled && catalogWatchedEnabled) ? 'true' : 'false';

    const background = Settings.resolveCanvasBackgroundStyle();
    for (const previewPane of $$('.styling-preview-thread, .styling-preview-catalog', panel) as HTMLElement[]) {
      Settings.applyBackgroundStyle(previewPane, background);
    }
  },

  initCustomCSSEditor(section: HTMLElement, textarea: HTMLTextAreaElement | null) {
    if (!textarea) return;
    // Keep textarea layout deterministic so the text layer stays aligned with
    // the highlighted overlay regardless of theme or browser defaults.
    textarea.wrap = 'off';
    textarea.spellcheck = false;
    const editor = $('.custom-css-editor', section) as HTMLDivElement | null;
    const highlight = $('.custom-css-highlight', section) as HTMLPreElement | null;
    const themeSelect = $('#custom-css-theme', section) as HTMLSelectElement | null;
    const expandButton = $('#custom-css-expand', section) as HTMLButtonElement | null;
    if (!editor || !highlight || !themeSelect || !expandButton) return;

    const syncScroll = () => {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    };

    const updateExpandedState = (expanded: boolean, save = false) => {
      editor.dataset.expanded = expanded ? 'true' : 'false';
      editor.style.height = expanded ? '500px' : '180px';
      expandButton.dataset.expanded = editor.dataset.expanded;
      expandButton.textContent = expanded ? 'Collapse editor' : 'Expand editor';
      if (save) $.set('settings.customCSSEditorExpanded', expanded);
    };

    const updateTheme = (save = false) => {
      const choice = themeSelect.value || 'xt-system';
      editor.dataset.theme = Settings.resolveCustomCSSEditorTheme(choice);
      if (save) $.set('settings.customCSSEditorTheme', choice);
    };

    $.on(textarea, 'input', () => Settings.renderCustomCSSHighlight(textarea, highlight));
    $.on(textarea, 'scroll', syncScroll);
    $.on(textarea, 'change', () => {
      Settings.renderCustomCSSHighlight(textarea, highlight);
      if (Conf['Custom CSS']) CustomCSS.update();
    });
    $.on(themeSelect, 'change', () => updateTheme(true));
    $.on(expandButton, 'click', () => updateExpandedState(editor.dataset.expanded !== 'true', true));
    Settings.customCSSEditorThemeObserver?.disconnect();
    Settings.customCSSEditorThemeObserver = new MutationObserver(() => {
      if (themeSelect.value === 'xt-system') updateTheme(false);
    });
    Settings.customCSSEditorThemeObserver.observe(doc, {
      attributes: true,
      attributeFilter: ['class'],
    });

    $.get({
      'settings.customCSSEditorTheme': 'xt-system',
      'settings.customCSSEditorExpanded': false,
    }, prefs => {
      const theme = prefs['settings.customCSSEditorTheme'];
      const expanded = !!prefs['settings.customCSSEditorExpanded'];

      themeSelect.value = ['xt-system', 'xt-light', 'xt-dark', 'xt-solarized'].includes(theme) ? theme : 'xt-system';

      updateTheme(false);
      updateExpandedState(expanded, false);
      Settings.renderCustomCSSHighlight(textarea, highlight);
      syncScroll();
    });
  },

  resolveCustomCSSEditorTheme(theme: string) {
    if (theme !== 'xt-system') return theme || 'xt-light';
    const classList = doc.classList;
    if (classList.contains('tomorrow')) return 'xt-system-tomorrow';
    if (classList.contains('spooky')) return 'xt-system-spooky';
    if (classList.contains('yotsuba-b')) return 'xt-system-yotsuba-b';
    if (classList.contains('burichan')) return 'xt-system-burichan';
    if (classList.contains('yotsuba')) return 'xt-system-yotsuba';
    if (classList.contains('futaba')) return 'xt-system-futaba';
    if (classList.contains('photon')) return 'xt-system-photon';
    return 'xt-system-default';
  },

  refreshCustomCSSEditor(section: HTMLElement) {
    const textarea = $('textarea[name^="usercss"]', section) as HTMLTextAreaElement | null;
    const highlight = $('.custom-css-highlight', section) as HTMLPreElement | null;
    if (!textarea || !highlight) return;
    Settings.renderCustomCSSHighlight(textarea, highlight);
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  },

  renderCustomCSSHighlight(textarea: HTMLTextAreaElement, highlight: HTMLPreElement) {
    // Keep a trailing newline so the last line remains visible while typing.
    const source = textarea.value ? `${textarea.value}\n` : '\n';
    highlight.innerHTML = Settings.highlightCSSSource(source);
  },

  highlightCSSSource(source: string) {
    const wrapped = dict() as Record<string, string>;
    let wrappedCount = 0;
    const encodeTokenID = (index: number) => {
      let id = '';
      let value = index;
      do {
        id = String.fromCharCode(97 + (value % 26)) + id;
        value = Math.floor(value / 26) - 1;
      } while (value >= 0);
      return id;
    };
    const stash = (text: string, className: string) => {
      const id = encodeTokenID(wrappedCount++);
      wrapped[id] = `<span class="${className}">${E(text)}</span>`;
      return `\uE000${id}\uE001`;
    };

    let code = source;
    code = code.replace(/\/\*[\s\S]*?\*\//g, match => stash(match, 'css-token-comment'));
    code = code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, match => stash(match, 'css-token-string'));
    code = E(code);

    code = code.replace(/(^|[\s{;])(@[a-z-]+)/gim, '$1<span class="css-token-atrule">$2</span>');
    code = code.replace(/(^|[;{]\s*)((?:--)?[-a-z_][\w-]*)(\s*:)/gim, '$1<span class="css-token-property">$2</span>$3');
    code = code.replace(/#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi, '<span class="css-token-color">$&</span>');
    code = code.replace(/\b-?(?:\d+|\d*\.\d+)(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|rad|fr|ch|ex)?\b/gi, '<span class="css-token-number">$&</span>');
    code = code.replace(/\b!important\b/gi, '<span class="css-token-important">$&</span>');

    code = code.replace(/\uE000([a-z]+)\uE001/g, (_, id) => wrapped[id] || '');
    return code;
  },

  // Write styling Conf values to CSS custom properties so they apply
  // immediately. Called with no args, this writes the runtime (board)
  // variant onto :root and, if the settings dialog is open with an editing
  // variant, layers that variant's vars onto the dialog element so the
  // dialog + preview visually reflect what's being edited even while the
  // board behind it stays on its own variant.
  applyStylingVars() {
    Settings.writeStyleVarsTo(doc as HTMLElement, Settings.getBoardVariant(), true);
    Settings.syncLinkedMarkerColors(undefined, Settings.getBoardVariant());
    if (Settings.dialog && Settings.stylingEditingVariant
        && Settings.stylingEditingVariant !== Settings.getBoardVariant()) {
      Settings.writeStyleVarsTo(Settings.dialog, Settings.stylingEditingVariant, false);
    } else if (Settings.dialog) {
      // Same variant — clear any leftover dialog-scoped overrides so the
      // dialog inherits from :root.
      Settings.clearStyleVarsOn(Settings.dialog);
    }
    Settings.resolvedStyleColorCache = null;
    Settings.refreshUnsetStylingColorInputs();
    Settings.refreshStylingPreviewFromDialog();
  },

  // The list of CSS variables we write, kept here so clearStyleVarsOn can
  // strip them off the dialog when the editing variant matches the board.
  STYLE_VAR_NAMES: [
    '--xt-highlight-own', '--xt-highlight-you', '--xt-highlight-ghost',
    '--xt-highlight-own-opacity', '--xt-highlight-you-opacity', '--xt-highlight-ghost-opacity',
    '--xt-catalog-own-highlight', '--xt-catalog-own-highlight-opacity',
    '--xt-catalog-watched-highlight', '--xt-catalog-watched-highlight-opacity',
    '--xt-scroll-marker-own', '--xt-scroll-marker-you', '--xt-scroll-marker-ghost', '--xt-scroll-marker-unread',
    '--xt-scroll-marker-own-opacity', '--xt-scroll-marker-you-opacity',
    '--xt-scroll-marker-ghost-opacity', '--xt-scroll-marker-unread-opacity',
    '--xt-text-color', '--xt-link-text-color', '--xt-quote-text-color', '--xt-dead-link-text-color',
    '--xt-highlight-own-text', '--xt-highlight-own-link', '--xt-highlight-own-quote', '--xt-highlight-own-dead-link',
    '--xt-highlight-you-text', '--xt-highlight-you-link', '--xt-highlight-you-quote', '--xt-highlight-you-dead-link',
    '--xt-highlight-ghost-text', '--xt-highlight-ghost-link', '--xt-highlight-ghost-quote', '--xt-highlight-ghost-dead-link',
    '--xt-catalog-own-text', '--xt-catalog-own-subject', '--xt-catalog-own-link', '--xt-catalog-own-quote', '--xt-catalog-own-dead-link',
    '--xt-catalog-watched-text', '--xt-catalog-watched-subject', '--xt-catalog-watched-link', '--xt-catalog-watched-quote', '--xt-catalog-watched-dead-link',
  ] as const,

  clearStyleVarsOn(target: HTMLElement) {
    for (const name of Settings.STYLE_VAR_NAMES) target.style.removeProperty(name);
  },

  // Write all variant-aware CSS variables for `variant` onto `target`.
  // `updateRootClasses` toggles the shared highlight classes on the root
  // element (only true when called with target=doc; the dialog overlay
  // doesn't need them because the cascade already inherits the doc's classes).
  writeStyleVarsTo(target: HTMLElement, variant: StyleVariant, updateRootClasses: boolean) {
    const setVar = (cssVar: string, value: string) => {
      if (value) target.style.setProperty(cssVar, value);
      else target.style.removeProperty(cssVar);
    };
    const cv = (key: string) => Settings.styleConf(key, variant);
    const threadHighlightsEnabled = Conf['Enable Thread Highlights'] !== false;
    const catalogHighlightsEnabled = Conf['Enable Catalog Highlights'] !== false;
    const catalogOwnEnabled = catalogHighlightsEnabled && Conf['Catalog Highlight Own Posts'] !== false;
    const catalogWatchedEnabled = catalogHighlightsEnabled && Conf['Catalog Highlight Watched Threads'] !== false;
    if (updateRootClasses) {
      doc.classList.toggle('highlight-own', threadHighlightsEnabled && !!Conf['Highlight Own Posts']);
      doc.classList.toggle('highlight-you', threadHighlightsEnabled && !!Conf['Highlight Posts Quoting You']);
      doc.classList.toggle('highlight-ghost', threadHighlightsEnabled && !!Conf['Highlight Ghost Posts']);
      doc.classList.toggle('xt-set-own-highlight',
        threadHighlightsEnabled && !!Conf['Highlight Own Posts'] && !!cv('Highlight Own Color'));
      doc.classList.toggle('xt-set-you-highlight',
        threadHighlightsEnabled && !!Conf['Highlight Posts Quoting You'] && !!cv('Highlight You Color'));
      doc.classList.toggle('xt-set-ghost-highlight',
        threadHighlightsEnabled && !!Conf['Highlight Ghost Posts'] && !!cv('Highlight Ghost Color'));
      doc.classList.toggle('xt-highlight-catalog-own', catalogOwnEnabled);
      doc.classList.toggle('xt-highlight-catalog-watched', catalogWatchedEnabled);
    }
    setVar('--xt-highlight-own',   cv('Highlight Own Color'));
    setVar('--xt-highlight-you',   cv('Highlight You Color'));
    setVar('--xt-highlight-ghost', cv('Highlight Ghost Color'));
    setVar('--xt-highlight-own-opacity',
      cv('Highlight Own Opacity') === '' ? '' : String(cv('Highlight Own Opacity')));
    setVar('--xt-highlight-you-opacity',
      cv('Highlight You Opacity') === '' ? '' : String(cv('Highlight You Opacity')));
    setVar('--xt-highlight-ghost-opacity',
      cv('Highlight Ghost Opacity') === '' ? '' : String(cv('Highlight Ghost Opacity')));
    setVar('--xt-catalog-own-highlight', catalogOwnEnabled ? cv('Catalog Highlight Own Color') : '');
    setVar('--xt-catalog-own-highlight-opacity',
      (catalogOwnEnabled && cv('Catalog Highlight Own Opacity') !== '') ? String(cv('Catalog Highlight Own Opacity')) : '');
    setVar('--xt-catalog-watched-highlight', catalogWatchedEnabled ? cv('Catalog Highlight Watched Color') : '');
    setVar('--xt-catalog-watched-highlight-opacity',
      (catalogWatchedEnabled && cv('Catalog Highlight Watched Opacity') !== '') ? String(cv('Catalog Highlight Watched Opacity')) : '');
    const ownMarkerLinked = !!cv('Scroll Marker Own Match Highlight');
    const youMarkerLinked = !!cv('Scroll Marker You Match Highlight');
    const ghostMarkerLinked = !!cv('Scroll Marker Ghost Match Highlight');
    setVar('--xt-scroll-marker-own',
      ownMarkerLinked ? cv('Highlight Own Color') : cv('Scroll Marker Own Color'));
    setVar('--xt-scroll-marker-you',
      youMarkerLinked ? cv('Highlight You Color') : cv('Scroll Marker You Color'));
    setVar('--xt-scroll-marker-ghost',
      ghostMarkerLinked ? cv('Highlight Ghost Color') : cv('Scroll Marker Ghost Color'));
    setVar('--xt-scroll-marker-unread', cv('Scroll Marker Unread Color'));
    setVar('--xt-scroll-marker-own-opacity',
      cv('Scroll Marker Own Opacity') === '' ? '' : String(cv('Scroll Marker Own Opacity')));
    setVar('--xt-scroll-marker-you-opacity',
      cv('Scroll Marker You Opacity') === '' ? '' : String(cv('Scroll Marker You Opacity')));
    setVar('--xt-scroll-marker-ghost-opacity',
      cv('Scroll Marker Ghost Opacity') === '' ? '' : String(cv('Scroll Marker Ghost Opacity')));
    setVar('--xt-scroll-marker-unread-opacity',
      cv('Scroll Marker Unread Opacity') === '' ? '' : String(cv('Scroll Marker Unread Opacity')));

    const baseBackground = Settings.getTextBaseBackground();
    const textColorMode = cv('textColorMode') === 'manual' ? 'manual' : 'auto';
    const autoTextPalette = Settings.autoTextPalette(baseBackground);
    const textColor = textColorMode === 'auto' ? autoTextPalette.text : cv('Text Color');
    const linkColor = textColorMode === 'auto' ? autoTextPalette.link : cv('Link Text Color');
    const quoteColor = textColorMode === 'auto' ? autoTextPalette.quote : cv('Quote Text Color');
    const deadLinkColor = textColorMode === 'auto' ? autoTextPalette.deadLink : cv('Dead Link Text Color');
    const hasAnyTextOverride = !!(textColor || linkColor || quoteColor || deadLinkColor);
    if (updateRootClasses) {
      if (hasAnyTextOverride) {
        $.addClass(doc, 'xt-custom-text-colors');
      } else {
        $.rmClass(doc, 'xt-custom-text-colors');
      }
    }
    setVar('--xt-text-color', textColor || '');
    setVar('--xt-link-text-color', linkColor || '');
    setVar('--xt-quote-text-color', quoteColor || '');
    setVar('--xt-dead-link-text-color', deadLinkColor || '');

    const autoHighlightPalette = (
      colorKey:
        | 'Highlight Own Color' | 'Highlight You Color' | 'Highlight Ghost Color'
        | 'Catalog Highlight Own Color' | 'Catalog Highlight Watched Color',
      opacityKey:
        | 'Highlight Own Opacity' | 'Highlight You Opacity' | 'Highlight Ghost Opacity'
        | 'Catalog Highlight Own Opacity' | 'Catalog Highlight Watched Opacity',
    ) => Settings.autoHighlightTextPalette(colorKey, opacityKey, baseBackground, variant);
    const withManual = (
      autoPalette: ReturnType<typeof Settings.autoTextPalette> | null,
      autoKey:
        | 'Highlight Own Text Auto' | 'Highlight You Text Auto' | 'Highlight Ghost Text Auto'
        | 'Catalog Highlight Own Text Auto' | 'Catalog Highlight Watched Text Auto',
      textKey:
        | 'Highlight Own Text Color' | 'Highlight You Text Color' | 'Highlight Ghost Text Color'
        | 'Catalog Highlight Own Text Color' | 'Catalog Highlight Watched Text Color',
      subjectKey:
        | null
        | 'Catalog Highlight Own Subject Color' | 'Catalog Highlight Watched Subject Color',
      linkKey:
        | 'Highlight Own Link Color' | 'Highlight You Link Color' | 'Highlight Ghost Link Color'
        | 'Catalog Highlight Own Link Color' | 'Catalog Highlight Watched Link Color',
      quoteKey:
        | 'Highlight Own Quote Color' | 'Highlight You Quote Color' | 'Highlight Ghost Quote Color'
        | 'Catalog Highlight Own Quote Color' | 'Catalog Highlight Watched Quote Color',
      deadKey:
        | 'Highlight Own Dead Link Color' | 'Highlight You Dead Link Color' | 'Highlight Ghost Dead Link Color'
        | 'Catalog Highlight Own Dead Link Color' | 'Catalog Highlight Watched Dead Link Color',
    ) => {
      const base = autoPalette || {
        text: textColor || '',
        subject: textColor || '',
        link: linkColor || '',
        quote: quoteColor || '',
        deadLink: deadLinkColor || '',
      };
      if (cv(autoKey)) return base;
      return {
        text: cv(textKey) || base.text,
        subject: (subjectKey ? cv(subjectKey) : '') || base.subject || base.text,
        link: cv(linkKey) || base.link,
        quote: cv(quoteKey) || base.quote,
        deadLink: cv(deadKey) || base.deadLink,
      };
    };
    const ownPalette = withManual(
      autoHighlightPalette('Highlight Own Color', 'Highlight Own Opacity'),
      'Highlight Own Text Auto',
      'Highlight Own Text Color',
      null,
      'Highlight Own Link Color',
      'Highlight Own Quote Color',
      'Highlight Own Dead Link Color',
    );
    const youPalette = withManual(
      autoHighlightPalette('Highlight You Color', 'Highlight You Opacity'),
      'Highlight You Text Auto',
      'Highlight You Text Color',
      null,
      'Highlight You Link Color',
      'Highlight You Quote Color',
      'Highlight You Dead Link Color',
    );
    const ghostPalette = withManual(
      autoHighlightPalette('Highlight Ghost Color', 'Highlight Ghost Opacity'),
      'Highlight Ghost Text Auto',
      'Highlight Ghost Text Color',
      null,
      'Highlight Ghost Link Color',
      'Highlight Ghost Quote Color',
      'Highlight Ghost Dead Link Color',
    );
    const catalogOwnPalette = withManual(
      autoHighlightPalette('Catalog Highlight Own Color', 'Catalog Highlight Own Opacity'),
      'Catalog Highlight Own Text Auto',
      'Catalog Highlight Own Text Color',
      'Catalog Highlight Own Subject Color',
      'Catalog Highlight Own Link Color',
      'Catalog Highlight Own Quote Color',
      'Catalog Highlight Own Dead Link Color',
    );
    const catalogWatchedPalette = withManual(
      autoHighlightPalette('Catalog Highlight Watched Color', 'Catalog Highlight Watched Opacity'),
      'Catalog Highlight Watched Text Auto',
      'Catalog Highlight Watched Text Color',
      'Catalog Highlight Watched Subject Color',
      'Catalog Highlight Watched Link Color',
      'Catalog Highlight Watched Quote Color',
      'Catalog Highlight Watched Dead Link Color',
    );
    setVar('--xt-highlight-own-text', ownPalette?.text || '');
    setVar('--xt-highlight-own-link', ownPalette?.link || '');
    setVar('--xt-highlight-own-quote', ownPalette?.quote || '');
    setVar('--xt-highlight-own-dead-link', ownPalette?.deadLink || '');
    setVar('--xt-highlight-you-text', youPalette?.text || '');
    setVar('--xt-highlight-you-link', youPalette?.link || '');
    setVar('--xt-highlight-you-quote', youPalette?.quote || '');
    setVar('--xt-highlight-you-dead-link', youPalette?.deadLink || '');
    setVar('--xt-highlight-ghost-text', ghostPalette?.text || '');
    setVar('--xt-highlight-ghost-link', ghostPalette?.link || '');
    setVar('--xt-highlight-ghost-quote', ghostPalette?.quote || '');
    setVar('--xt-highlight-ghost-dead-link', ghostPalette?.deadLink || '');
    setVar('--xt-catalog-own-text', catalogOwnPalette?.text || '');
    setVar('--xt-catalog-own-subject', catalogOwnPalette?.subject || '');
    setVar('--xt-catalog-own-link', catalogOwnPalette?.link || '');
    setVar('--xt-catalog-own-quote', catalogOwnPalette?.quote || '');
    setVar('--xt-catalog-own-dead-link', catalogOwnPalette?.deadLink || '');
    setVar('--xt-catalog-watched-text', catalogWatchedPalette?.text || '');
    setVar('--xt-catalog-watched-subject', catalogWatchedPalette?.subject || '');
    setVar('--xt-catalog-watched-link', catalogWatchedPalette?.link || '');
    setVar('--xt-catalog-watched-quote', catalogWatchedPalette?.quote || '');
    setVar('--xt-catalog-watched-dead-link', catalogWatchedPalette?.deadLink || '');
  },

  autoTextPalette(rgb?: [number, number, number]) {
    const bg = rgb || Settings.getTextBaseBackground();
    const lightText = '#f2f2f2';
    const darkText = '#111111';
    const lightContrast = Settings.contrastRatio(Settings.hexToRgb(lightText)!, bg);
    const darkContrast = Settings.contrastRatio(Settings.hexToRgb(darkText)!, bg);
    const useLight = lightContrast >= darkContrast;
    const text = useLight ? lightText : darkText;
    const palette = useLight
      ? {
          text,
          link: '#9cc1ff',
          quote: '#a8dd72',
          deadLink: '#b8c5ff',
        }
      : {
          text,
          link: '#0b52d6',
          quote: '#2f7d1a',
          deadLink: '#4c63be',
        };
    // Keep links/quotes readable; fall back to text color if contrast gets too low.
    const minRatio = 3;
    const safe = (hex: string) => {
      const c = Settings.hexToRgb(hex);
      return c && (Settings.contrastRatio(c, bg) >= minRatio) ? hex : text;
    };
    return {
      text,
      subject: text,
      link: safe(palette.link),
      quote: safe(palette.quote),
      deadLink: safe(palette.deadLink),
    };
  },

  hexToRgb(value: string): [number, number, number] | null {
    const hex = value?.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
    if (!hex) return null;
    if (hex.length === 3) {
      return [
        parseInt(`${hex[0]}${hex[0]}`, 16),
        parseInt(`${hex[1]}${hex[1]}`, 16),
        parseInt(`${hex[2]}${hex[2]}`, 16),
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  },

  mixRgb(base: [number, number, number], overlay: [number, number, number], alpha: number): [number, number, number] {
    const a = $.minmax(alpha, 0, 1);
    const out = [0, 1, 2].map(i => Math.round((base[i] * (1 - a)) + (overlay[i] * a)));
    return [out[0], out[1], out[2]];
  },

  contrastRatio(fg: [number, number, number], bg: [number, number, number]) {
    const l1 = Settings.relativeLuminance(fg);
    const l2 = Settings.relativeLuminance(bg);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  },

  relativeLuminance(rgb: [number, number, number]) {
    const toLinear = (channel: number) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const [r, g, b] = rgb.map(toLinear);
    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
  },

  parseCSSColorRGBA(value: string): [number, number, number, number] | null {
    if (!value) return null;
    const input = value.trim().toLowerCase();
    if (!input) return null;
    if (input === 'transparent') return [0, 0, 0, 0];

    const rgbBody = input.match(/^rgba?\((.+)\)$/i)?.[1];
    if (rgbBody) {
      const tokens = rgbBody.match(/[\d.]+%?/g);
      if (!tokens || tokens.length < 3) return null;
      const toChannel = (token: string) => {
        const num = parseFloat(token);
        if (!Number.isFinite(num)) return NaN;
        return token.endsWith('%') ? ((num / 100) * 255) : num;
      };
      const r = toChannel(tokens[0]);
      const g = toChannel(tokens[1]);
      const b = toChannel(tokens[2]);
      if (![r, g, b].every(Number.isFinite)) return null;
      const alphaToken = tokens[3];
      const alpha = alphaToken == null
        ? 1
        : (alphaToken.endsWith('%') ? (parseFloat(alphaToken) / 100) : parseFloat(alphaToken));
      if (!Number.isFinite(alpha)) return null;
      return [r, g, b, $.minmax(alpha, 0, 1)];
    }

    const hex = Settings.hexToRgb(input);
    if (hex) return [hex[0], hex[1], hex[2], 1];
    return null;
  },

  isTransparentCSSColor(value: string): boolean {
    const rgba = Settings.parseCSSColorRGBA(value);
    return !rgba || rgba[3] <= 0;
  },

  backgroundStyleFromComputed(style: CSSStyleDeclaration) {
    return {
      backgroundColor: style.backgroundColor || 'transparent',
      backgroundImage: style.backgroundImage || 'none',
      backgroundRepeat: style.backgroundRepeat || 'repeat',
      backgroundPosition: style.backgroundPosition || '0% 0%',
      backgroundSize: style.backgroundSize || 'auto',
      backgroundAttachment: style.backgroundAttachment || 'scroll',
    };
  },

  resolveCanvasBackgroundStyle() {
    const htmlStyle = Settings.backgroundStyleFromComputed(window.getComputedStyle(d.documentElement));
    if (!d.body) return htmlStyle;
    const bodyStyle = Settings.backgroundStyleFromComputed(window.getComputedStyle(d.body));
    // Mirror CSS canvas rules: body background is used only when html background
    // is effectively transparent with no image.
    const htmlDefersToBody = (
      htmlStyle.backgroundImage === 'none' &&
      Settings.isTransparentCSSColor(htmlStyle.backgroundColor)
    );
    return htmlDefersToBody ? bodyStyle : htmlStyle;
  },

  applyBackgroundStyle(el: HTMLElement, background: {
    backgroundColor: string;
    backgroundImage: string;
    backgroundRepeat: string;
    backgroundPosition: string;
    backgroundSize: string;
    backgroundAttachment: string;
  }) {
    el.style.backgroundColor = background.backgroundColor;
    el.style.backgroundImage = background.backgroundImage;
    el.style.backgroundRepeat = background.backgroundRepeat;
    el.style.backgroundPosition = background.backgroundPosition;
    el.style.backgroundSize = background.backgroundSize;
    el.style.backgroundAttachment = background.backgroundAttachment;
  },

  getTextBaseBackground(): [number, number, number] {
    const style = Settings.resolveCanvasBackgroundStyle();
    const rgba = Settings.parseCSSColorRGBA(style.backgroundColor);
    if (rgba && rgba[3] > 0) {
      return [rgba[0], rgba[1], rgba[2]];
    }
    // Transparent background color with only an image has no reliable average
    // color; use white as a neutral fallback for contrast calculations.
    return [255, 255, 255];
  },

  autoHighlightTextPalette(
    colorKey:
      | 'Highlight Own Color' | 'Highlight You Color' | 'Highlight Ghost Color'
      | 'Catalog Highlight Own Color' | 'Catalog Highlight Watched Color',
    opacityKey:
      | 'Highlight Own Opacity' | 'Highlight You Opacity' | 'Highlight Ghost Opacity'
      | 'Catalog Highlight Own Opacity' | 'Catalog Highlight Watched Opacity',
    baseBackground = Settings.getTextBaseBackground(),
    variant?: StyleVariant,
  ) {
    const color = Settings.styleConf<string>(colorKey, variant);
    const rgb = Settings.hexToRgb(color);
    if (!rgb) return null;
    const opacity = Settings.styleConf<string | number>(opacityKey, variant);
    const alpha = (
      opacity === '' || opacity == null
    ) ? 1 : $.minmax(parseFloat(String(opacity)), 0, 1);
    if (!Number.isFinite(alpha) || alpha <= 0) return null;
    return Settings.autoTextPalette(Settings.mixRgb(baseBackground, rgb, alpha));
  },

  colorExpressionForKey(key: string): string {
    switch (Settings.styleKeyBase(key)) {
      case 'Highlight Own Color':
        return 'var(--xt-highlight-own, var(--xt-border-highlight, #d83030))';
      case 'Highlight You Color':
        return 'var(--xt-highlight-you, var(--xt-border-highlight, #ff5050))';
      case 'Highlight Ghost Color':
        return 'var(--xt-highlight-ghost, #888888)';
      case 'Catalog Highlight Own Color':
        return 'var(--xt-catalog-own-highlight, var(--xt-highlight-own, #d83030))';
      case 'Catalog Highlight Watched Color':
        return 'var(--xt-catalog-watched-highlight, var(--xt-watched-border, rgba(255, 0, 0, .75)))';
      case 'Scroll Marker Own Color':
        return 'var(--xt-scroll-marker-own, var(--xt-border-highlight, #d83030))';
      case 'Scroll Marker You Color':
        return 'var(--xt-scroll-marker-you, var(--xt-border-highlight, #ff5050))';
      case 'Scroll Marker Ghost Color':
        return 'var(--xt-scroll-marker-ghost, #888888)';
      case 'Scroll Marker Unread Color':
        return 'var(--xt-scroll-marker-unread, #ffd400)';
      case 'Text Color':
        return 'var(--xt-text-color, #111111)';
      case 'Link Text Color':
        return 'var(--xt-link-text-color, #0b52d6)';
      case 'Quote Text Color':
        return 'var(--xt-quote-text-color, #2f7d1a)';
      case 'Dead Link Text Color':
        return 'var(--xt-dead-link-text-color, #4c63be)';
      case 'Highlight Own Text Color':
        return 'var(--xt-highlight-own-text, var(--xt-text-color, #111111))';
      case 'Highlight Own Link Color':
        return 'var(--xt-highlight-own-link, var(--xt-link-text-color, #0b52d6))';
      case 'Highlight Own Quote Color':
        return 'var(--xt-highlight-own-quote, var(--xt-quote-text-color, #2f7d1a))';
      case 'Highlight Own Dead Link Color':
        return 'var(--xt-highlight-own-dead-link, var(--xt-dead-link-text-color, #4c63be))';
      case 'Highlight You Text Color':
        return 'var(--xt-highlight-you-text, var(--xt-text-color, #111111))';
      case 'Highlight You Link Color':
        return 'var(--xt-highlight-you-link, var(--xt-link-text-color, #0b52d6))';
      case 'Highlight You Quote Color':
        return 'var(--xt-highlight-you-quote, var(--xt-quote-text-color, #2f7d1a))';
      case 'Highlight You Dead Link Color':
        return 'var(--xt-highlight-you-dead-link, var(--xt-dead-link-text-color, #4c63be))';
      case 'Highlight Ghost Text Color':
        return 'var(--xt-highlight-ghost-text, var(--xt-text-color, #111111))';
      case 'Highlight Ghost Link Color':
        return 'var(--xt-highlight-ghost-link, var(--xt-link-text-color, #0b52d6))';
      case 'Highlight Ghost Quote Color':
        return 'var(--xt-highlight-ghost-quote, var(--xt-quote-text-color, #2f7d1a))';
      case 'Highlight Ghost Dead Link Color':
        return 'var(--xt-highlight-ghost-dead-link, var(--xt-dead-link-text-color, #4c63be))';
      case 'Catalog Highlight Own Text Color':
        return 'var(--xt-catalog-own-text, var(--xt-text-color, #111111))';
      case 'Catalog Highlight Own Subject Color':
        return 'var(--xt-catalog-own-subject, var(--xt-catalog-own-text, var(--xt-text-color, #111111)))';
      case 'Catalog Highlight Own Link Color':
        return 'var(--xt-catalog-own-link, var(--xt-link-text-color, #0b52d6))';
      case 'Catalog Highlight Own Quote Color':
        return 'var(--xt-catalog-own-quote, var(--xt-quote-text-color, #2f7d1a))';
      case 'Catalog Highlight Own Dead Link Color':
        return 'var(--xt-catalog-own-dead-link, var(--xt-dead-link-text-color, #4c63be))';
      case 'Catalog Highlight Watched Text Color':
        return 'var(--xt-catalog-watched-text, var(--xt-text-color, #111111))';
      case 'Catalog Highlight Watched Subject Color':
        return 'var(--xt-catalog-watched-subject, var(--xt-catalog-watched-text, var(--xt-text-color, #111111)))';
      case 'Catalog Highlight Watched Link Color':
        return 'var(--xt-catalog-watched-link, var(--xt-link-text-color, #0b52d6))';
      case 'Catalog Highlight Watched Quote Color':
        return 'var(--xt-catalog-watched-quote, var(--xt-quote-text-color, #2f7d1a))';
      case 'Catalog Highlight Watched Dead Link Color':
        return 'var(--xt-catalog-watched-dead-link, var(--xt-dead-link-text-color, #4c63be))';
      default:
        return '';
    }
  },

  toHexColor(value: string): string | null {
    if (!value) return null;
    const hex = value.trim().toLowerCase();
    const longHex = hex.match(/^#([0-9a-f]{6})$/i)?.[0];
    if (longHex) return longHex.toLowerCase();
    const shortHex = hex.match(/^#([0-9a-f]{3})$/i)?.[1];
    if (shortHex) {
      return `#${shortHex[0]}${shortHex[0]}${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}`.toLowerCase();
    }
    const rgb = hex.match(/^rgba?\(([^)]+)\)$/i)?.[1];
    if (!rgb) return null;
    const parts = rgb.split(',').map(part => parseFloat(part.trim()));
    if (parts.length < 3 || parts.slice(0, 3).some(part => !Number.isFinite(part))) return null;
    const to = (n: number) => Math.round($.minmax(n, 0, 255)).toString(16).padStart(2, '0');
    return `#${to(parts[0])}${to(parts[1])}${to(parts[2])}`;
  },

  primeResolvedStyleColorCache(keys: string[]) {
    if (!keys.length || !d.body) return;
    const cache = Settings.resolvedStyleColorCache || (Settings.resolvedStyleColorCache = dict());
    const unresolvedKeys = Array.from(new Set(
      keys
        .map(key => Settings.styleKeyBase(key))
        .filter(key => !(key in cache) && !!Settings.colorExpressionForKey(key))
    ));
    if (!unresolvedKeys.length) return;

    // Resolve all needed fallback colors in one DOM insertion so Firefox
    // doesn't pay a full style flush per color input while opening Styling.
    const scope = Settings.dialog || d.body;
    const host = $.el('div') as HTMLDivElement;
    host.style.position = 'absolute';
    host.style.visibility = 'hidden';
    host.style.pointerEvents = 'none';
    host.style.left = '0';
    host.style.top = '0';

    const probes: Record<string, HTMLSpanElement> = dict();
    for (const key of unresolvedKeys) {
      const probe = $.el('span') as HTMLSpanElement;
      probe.style.color = Settings.colorExpressionForKey(key);
      probes[key] = probe;
      $.add(host, probe);
    }

    $.add(scope, host);
    for (const key of unresolvedKeys) {
      const color = Settings.toHexColor(window.getComputedStyle(probes[key]).color);
      if (color) cache[key] = color;
    }
    $.rm(host);
  },

  resolvedColorForKey(key: string): string | null {
    const baseKey = Settings.styleKeyBase(key);
    Settings.primeResolvedStyleColorCache([baseKey]);
    return Settings.resolvedStyleColorCache?.[baseKey] || null;
  },

  setColorInputValue(input: HTMLInputElement, key: string, rawValue: unknown) {
    const explicit = (typeof rawValue === 'string' && /^#[0-9a-f]{6}$/i.test(rawValue))
      ? rawValue.toLowerCase()
      : null;
    const fallback = Settings.resolvedColorForKey(key) || '#000000';
    input.value = explicit || fallback;
    if (explicit) {
      delete input.dataset.unset;
    } else {
      input.dataset.unset = '1';
    }
  },

  refreshUnsetStylingColorInputs() {
    if (!Settings.dialog) return;
    const inputs = $$(
      '#fourchanx-settings input[type="color"][name][data-unset="1"]',
      Settings.dialog,
    ) as HTMLInputElement[];
    Settings.primeResolvedStyleColorCache(inputs.map(input => input.name));
    for (const input of inputs) {
      Settings.setColorInputValue(input, input.name, '');
    }
  },

  syncLinkedMarkerColors(inputs?: Record<string, HTMLInputElement>, variant?: StyleVariant) {
    const colorPairs = [
      ['Highlight Own Color', 'Scroll Marker Own Color', 'Scroll Marker Own Match Highlight'],
      ['Highlight You Color', 'Scroll Marker You Color', 'Scroll Marker You Match Highlight'],
      ['Highlight Ghost Color', 'Scroll Marker Ghost Color', 'Scroll Marker Ghost Match Highlight'],
    ] as const;
    for (const [highlightKey, markerKey, matchKey] of colorPairs) {
      const linked = !!Settings.styleConf(matchKey, variant);
      const color = linked
        ? (Settings.styleConf<string>(highlightKey, variant) || '')
        : (Settings.styleConf<string>(markerKey, variant) || '');
      const markerStorageKey = Settings.variantKey(markerKey, variant);
      if (linked && (Conf[markerStorageKey] !== color)) {
        Conf[markerStorageKey] = color;
        $.set(markerStorageKey, color);
      }
      const markerInput = inputs?.[markerKey]
        || ($(`#fourchanx-settings [name="${markerStorageKey}"]`) as HTMLInputElement | null);
      if (!markerInput) continue;
      Settings.setColorInputValue(markerInput, markerKey, color);
    }
  },

  randomHighlightColor(): string {
    // HSL with a moderate saturation/lightness keeps colors legible against
    // most board themes without going eye-burningly saturated.
    const h = Math.floor(Math.random() * 360);
    const s = 55 + Math.floor(Math.random() * 25);
    const l = 40 + Math.floor(Math.random() * 25);
    const c = (1 - Math.abs(2 * l / 100 - 1)) * (s / 100);
    const hh = h / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hh < 1)      { r = c; g = x; }
    else if (hh < 2) { r = x; g = c; }
    else if (hh < 3) { g = c; b = x; }
    else if (hh < 4) { g = x; b = c; }
    else if (hh < 5) { r = x; b = c; }
    else             { r = c; b = x; }
    const m = l / 100 - c / 2;
    const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${to(r)}${to(g)}${to(b)}`;
  },

  highlightPaletteThemeProfile(variant?: StyleVariant) {
    const siteStyle = String(Settings.styleConf<string>('siteStyle', variant) || '').trim();
    const native = Settings.isCustomSiteThemeValue(siteStyle) ? '' : siteStyle.toLowerCase();
    const darkThemes = ['tomorrow', 'spooky', 'photon'];
    const lightThemes = ['yotsuba-b', 'yotsuba', 'futaba', 'burichan'];
    if (native) {
      if (darkThemes.some(name => native === name || native.includes(name))) {
        return {
          kind: 'dark' as const,
          label: Settings.nativeSiteThemeLabel(siteStyle),
          note: 'based on the selected site style',
        };
      }
      if (lightThemes.some(name => native === name || native.includes(name))) {
        return {
          kind: 'light' as const,
          label: Settings.nativeSiteThemeLabel(siteStyle),
          note: 'based on the selected site style',
        };
      }
    }

    const bg = Settings.getTextBaseBackground();
    const luminance = Settings.relativeLuminance(bg);
    const kind = luminance < 0.42 ? 'dark' as const : 'light' as const;
    return {
      kind,
      label: kind === 'dark' ? 'dark background' : 'light background',
      note: 'based on the current page background',
    };
  },

  suggestedHighlightPalettes(variant?: StyleVariant) {
    const profile = Settings.highlightPaletteThemeProfile(variant);
    const dark = [
      { id: 'ember-night', name: 'Ember Night', colors: { own: '#ff6b6b', you: '#ff9f43', ghost: '#9ca3af', catalogOwn: '#2dd4bf', catalogWatched: '#60a5fa' } },
      { id: 'aurora', name: 'Aurora', colors: { own: '#22d3ee', you: '#a78bfa', ghost: '#94a3b8', catalogOwn: '#f472b6', catalogWatched: '#facc15' } },
      { id: 'mint-ember', name: 'Mint Ember', colors: { own: '#34d399', you: '#fb7185', ghost: '#a1a1aa', catalogOwn: '#5eead4', catalogWatched: '#f59e0b' } },
      { id: 'blue-steel', name: 'Blue Steel', colors: { own: '#60a5fa', you: '#f97316', ghost: '#9aa4b2', catalogOwn: '#38bdf8', catalogWatched: '#f43f5e' } },
      { id: 'violet-lime', name: 'Violet Lime', colors: { own: '#c084fc', you: '#4ade80', ghost: '#a3a3a3', catalogOwn: '#818cf8', catalogWatched: '#fbbf24' } },
    ];
    const light = [
      { id: 'classic-balanced', name: 'Classic Balanced', colors: { own: '#d94f4f', you: '#b76311', ghost: '#7a7a7a', catalogOwn: '#2f8f6a', catalogWatched: '#2f6cd6' } },
      { id: 'ocean-ink', name: 'Ocean Ink', colors: { own: '#0f8fa8', you: '#5f3dc4', ghost: '#7f8c8d', catalogOwn: '#0a7a83', catalogWatched: '#b54708' } },
      { id: 'forest-rose', name: 'Forest Rose', colors: { own: '#2f855a', you: '#b83280', ghost: '#6b7280', catalogOwn: '#1d7a55', catalogWatched: '#a16207' } },
      { id: 'slate-citrus', name: 'Slate Citrus', colors: { own: '#2563eb', you: '#ca8a04', ghost: '#64748b', catalogOwn: '#0d9488', catalogWatched: '#dc2626' } },
      { id: 'rust-teal', name: 'Rust Teal', colors: { own: '#b45309', you: '#2563eb', ghost: '#78716c', catalogOwn: '#0f766e', catalogWatched: '#be123c' } },
    ];
    return {
      profile,
      palettes: profile.kind === 'dark' ? dark : light,
    };
  },

  normalizeSavedHighlightPalette(raw: any): {
    name: string;
    colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>;
  } | null {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name || '').trim();
    if (!name) return null;
    const colors = raw.colors && typeof raw.colors === 'object' ? raw.colors : {};
    const own = String(colors.own || '').trim().toLowerCase();
    const you = String(colors.you || '').trim().toLowerCase();
    const ghost = String(colors.ghost || '').trim().toLowerCase();
    const catalogOwn = String(colors.catalogOwn || '').trim().toLowerCase();
    const catalogWatched = String(colors.catalogWatched || '').trim().toLowerCase();
    const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
    if (![own, you, ghost, catalogOwn, catalogWatched].every(isHex)) return null;
    return {
      name,
      colors: { own, you, ghost, catalogOwn, catalogWatched },
    };
  },

  savedHighlightPaletteList(): {
    name: string;
    colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>;
  }[] {
    const raw = Conf['savedHighlightPalettes'];
    if (!Array.isArray(raw)) return [];
    const out: {
      name: string;
      colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>;
    }[] = [];
    for (const item of raw) {
      const normalized = Settings.normalizeSavedHighlightPalette(item);
      if (!normalized) continue;
      out.push(normalized);
    }
    return out;
  },

  setSavedHighlightPalettes(list: {
    name: string;
    colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>;
  }[]) {
    const cleaned = list
      .map(item => Settings.normalizeSavedHighlightPalette(item))
      .filter(Boolean) as {
      name: string;
      colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>;
    }[];
    Conf['savedHighlightPalettes'] = cleaned;
    $.set('savedHighlightPalettes', cleaned);
  },

  CUSTOM_SITE_THEME_PREFIX: 'custom:' as const,

  isCustomSiteThemeValue(value: string) {
    return typeof value === 'string' && value.startsWith(Settings.CUSTOM_SITE_THEME_PREFIX);
  },

  customSiteThemeName(value: string) {
    return Settings.isCustomSiteThemeValue(value)
      ? value.slice(Settings.CUSTOM_SITE_THEME_PREFIX.length)
      : '';
  },

  customSiteThemeList(): { name: string; css: string }[] {
    const raw = Conf['customSiteThemes'];
    if (!Array.isArray(raw)) return [];
    const out: { name: string; css: string }[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const name = String((item as any).name || '').trim();
      const css = String((item as any).css || '');
      if (!name) continue;
      out.push({ name, css });
    }
    return out;
  },

  findCustomSiteTheme(name: string) {
    return Settings.customSiteThemeList().find(t => t.name === name) || null;
  },

  nativeSiteThemes(): string[] {
    const themes: string[] = [];
    const seen = new Set<string>();
    const add = (value?: string | null) => {
      const v = value?.trim();
      if (!v || seen.has(v)) return;
      seen.add(v);
      themes.push(v);
    };
    const nativeSelector = $.id('styleSelector') as HTMLSelectElement | null;
    if (nativeSelector?.options?.length) {
      for (const opt of nativeSelector.options) add(opt.value || opt.textContent || '');
      return themes;
    }
    for (const link of $$('link[rel="alternate stylesheet"]', d.head) as HTMLLinkElement[]) {
      add(link.title);
    }
    return themes;
  },

  nativeSiteThemeLabel(name: string) {
    const trimmed = (name || '').trim();
    const withoutNew = trimmed.replace(/\s+new$/i, '');
    return withoutNew || trimmed;
  },

  populateSiteStylePicker(section: HTMLElement, select: HTMLSelectElement) {
    if (!select) return;
    const picker = $('.styling-theme-picker', section) as HTMLElement | null;
    const toggleBtn = picker ? ($('.styling-theme-toggle', picker) as HTMLButtonElement | null) : null;
    const currentLabel = picker ? ($('.styling-theme-current', picker) as HTMLElement | null) : null;
    const menu = picker ? ($('.styling-theme-menu', picker) as HTMLElement | null) : null;
    const note = $('#styling-site-style-note', section) as HTMLElement | null;

    const nativeThemes = Settings.nativeSiteThemes();
    const customThemes = Settings.customSiteThemeList();

    // Rebuild the hidden <select> as the source of truth for value/change events.
    while (select.firstChild) select.removeChild(select.firstChild);
    const seen = new Set<string>();
    const addOption = (value: string, text: string) => {
      if (!value || seen.has(value)) return;
      seen.add(value);
      $.add(select, $.el('option', { value, textContent: text || value }));
    };
    for (const name of nativeThemes) addOption(name, Settings.nativeSiteThemeLabel(name));
    for (const t of customThemes) addOption(`${Settings.CUSTOM_SITE_THEME_PREFIX}${t.name}`, `Custom: ${t.name}`);

    const noOptions = seen.size === 0;
    select.disabled = noOptions;
    if (toggleBtn) toggleBtn.disabled = noOptions;
    if (note) {
      if (noOptions) {
        note.hidden = false;
        note.textContent = 'Style options are only available on supported board pages. You can still add custom themes below.';
      } else {
        note.hidden = true;
      }
    }

    const desired = Settings.styleConf<string>('siteStyle');
    if (desired && seen.has(desired)) {
      select.value = desired;
    } else if (!noOptions && select.selectedIndex < 0) {
      select.selectedIndex = 0;
    }

    if (picker && menu && currentLabel) {
      Settings.renderSiteStyleMenu(picker, menu, select, currentLabel, customThemes, nativeThemes);
    }
  },

  renderSiteStyleMenu(
    picker: HTMLElement,
    menu: HTMLElement,
    select: HTMLSelectElement,
    currentLabel: HTMLElement,
    customThemes: { name: string; css: string }[],
    nativeThemes: string[],
  ) {
    while (menu.firstChild) menu.removeChild(menu.firstChild);
    const buildItem = (value: string, label: string, removable: boolean) => {
      const item = $.el('div', { className: 'styling-theme-item' }) as HTMLDivElement;
      item.setAttribute('role', 'option');
      item.dataset.value = value;
      const labelEl = $.el('span', { className: 'styling-theme-item-label', textContent: label });
      $.add(item, labelEl);
      if (removable) {
        const removeBtn = $.el('button', {
          type: 'button',
          className: 'styling-theme-item-remove',
          title: 'Remove custom theme',
          textContent: '✕',
        }) as HTMLButtonElement;
        removeBtn.setAttribute('aria-label', `Remove ${label}`);
        $.on(removeBtn, 'click', (e: Event) => {
          e.stopPropagation();
          Settings.removeCustomSiteTheme(Settings.customSiteThemeName(value));
        });
        $.add(item, removeBtn);
      }
      $.on(item, 'click', () => {
        Settings.selectSiteStyleValue(select, value);
        Settings.closeSiteStyleMenu(picker);
      });
      return item;
    };
    for (const name of nativeThemes) {
      $.add(menu, buildItem(name, Settings.nativeSiteThemeLabel(name), false));
    }
    if (customThemes.length && nativeThemes.length) {
      $.add(menu, $.el('div', { className: 'styling-theme-divider' }));
    }
    for (const t of customThemes) {
      $.add(menu, buildItem(`${Settings.CUSTOM_SITE_THEME_PREFIX}${t.name}`, `Custom: ${t.name}`, true));
    }
    Settings.refreshSiteStyleCurrentLabel(currentLabel, select);
  },

  refreshSiteStyleCurrentLabel(label: HTMLElement, select: HTMLSelectElement) {
    if (!label) return;
    const value = select.value;
    if (!value) {
      label.textContent = '—';
      return;
    }
    if (Settings.isCustomSiteThemeValue(value)) {
      label.textContent = `Custom: ${Settings.customSiteThemeName(value)}`;
    } else {
      label.textContent = Settings.nativeSiteThemeLabel(value);
    }
  },

  selectSiteStyleValue(select: HTMLSelectElement, value: string) {
    if (!value || select.value === value) {
      // Even if same, still re-apply (helps re-select after a remove).
    }
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  },

  openSiteStyleMenu(picker: HTMLElement) {
    const menu = $('.styling-theme-menu', picker) as HTMLElement | null;
    const toggle = $('.styling-theme-toggle', picker) as HTMLButtonElement | null;
    if (!menu || !toggle) return;
    picker.dataset.open = 'true';
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    Settings.activeSiteStylePicker = picker;
    if (!Settings.siteStylePickerOutsideHandler) {
      Settings.siteStylePickerOutsideHandler = (e: Event) => {
        const target = e.target as Node | null;
        const active = Settings.activeSiteStylePicker;
        if (active && target && !active.contains(target)) {
          Settings.closeSiteStyleMenu(active);
        }
      };
      d.addEventListener('mousedown', Settings.siteStylePickerOutsideHandler, true);
    }
  },

  closeSiteStyleMenu(picker: HTMLElement) {
    const menu = $('.styling-theme-menu', picker) as HTMLElement | null;
    const toggle = $('.styling-theme-toggle', picker) as HTMLButtonElement | null;
    if (!menu || !toggle) return;
    picker.dataset.open = 'false';
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (Settings.activeSiteStylePicker === picker) Settings.activeSiteStylePicker = null;
  },

  refreshSiteStylePickers() {
    if (!Settings.dialog) return;
    const section = $('.section-styling', Settings.dialog) as HTMLElement | null;
    if (!section) return;
    const select = $('[name^="siteStyle"]', section) as HTMLSelectElement | null;
    if (!select) return;
    Settings.populateSiteStylePicker(section, select);
    // Refresh the merge-mode "currently selected" label.
    const mergeLabel = $('.styling-add-theme-merge-current', section) as HTMLElement | null;
    if (mergeLabel) {
      const value = select.value || Settings.styleConf<string>('siteStyle') || '';
      mergeLabel.textContent = !value
        ? '—'
        : (Settings.isCustomSiteThemeValue(value)
          ? `Custom: ${Settings.customSiteThemeName(value)}`
          : Settings.nativeSiteThemeLabel(value));
    }
  },

  addCustomSiteTheme(name: string, css: string): { ok: boolean; error?: string } {
    const trimmedName = (name || '').trim();
    if (!trimmedName) return { ok: false, error: 'Theme name is required.' };
    if (!css || !css.trim()) return { ok: false, error: 'Theme CSS is empty.' };
    const list = Settings.customSiteThemeList();
    if (list.some(t => t.name === trimmedName)) {
      return { ok: false, error: `A custom theme named "${trimmedName}" already exists.` };
    }
    if (Settings.nativeSiteThemes().includes(trimmedName)) {
      return { ok: false, error: `"${trimmedName}" conflicts with a built-in theme name.` };
    }
    list.push({ name: trimmedName, css });
    Conf['customSiteThemes'] = list;
    $.set('customSiteThemes', list);
    Settings.refreshSiteStylePickers();
    return { ok: true };
  },

  removeCustomSiteTheme(name: string) {
    if (!name) return;
    const list = Settings.customSiteThemeList().filter(t => t.name !== name);
    Conf['customSiteThemes'] = list;
    $.set('customSiteThemes', list);
    const activeValue = `${Settings.CUSTOM_SITE_THEME_PREFIX}${name}`;
    // Clear the removed theme out of every variant slot so we don't leave a
    // dangling reference behind.
    const variants: StyleVariant[] = ['sfw', 'nsfw'];
    let activeRemoved = false;
    for (const variant of variants) {
      const key = Settings.variantKey('siteStyle', variant);
      if (Conf[key] === activeValue) {
        const fallback = Settings.nativeSiteThemes()[0] || '';
        Conf[key] = fallback;
        $.set(key, fallback);
        if (variant === Settings.getActiveVariant()) activeRemoved = true;
      }
    }
    if (activeRemoved) {
      const fallback = Settings.styleConf<string>('siteStyle') || '';
      if (Settings.dialog) {
        const select = $('#fourchanx-settings [name^="siteStyle"]') as HTMLSelectElement | null;
        if (select) {
          // Refresh first so the new option set is in the select before we dispatch.
          Settings.refreshSiteStylePickers();
          select.value = fallback;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }
      $.event('CustomSiteThemeChanged');
    }
    Settings.refreshSiteStylePickers();
    $.event('CustomSiteThemeChanged');
  },

  siteStyle(this: HTMLSelectElement) {
    const style = this.value;
    if (Settings.dialog) {
      const picker = $('.styling-theme-picker', Settings.dialog) as HTMLElement | null;
      if (picker) {
        const label = $('.styling-theme-current', picker) as HTMLElement | null;
        if (label) Settings.refreshSiteStyleCurrentLabel(label, this);
      }
    }
    // If the user is editing a variant slot that isn't currently applied to
    // this board, only update the picker label — don't switch the native
    // theme or change cookies, because the choice doesn't apply here yet.
    const editingVariant = Settings.stylingEditingVariant;
    if (editingVariant && editingVariant !== Settings.getBoardVariant()) {
      return;
    }
    if (!style) {
      $.event('CustomSiteThemeChanged');
      return;
    }

    if (Settings.isCustomSiteThemeValue(style)) {
      // Custom themes are applied by Main.setClass()/applyCustomSiteTheme().
      $.event('CustomSiteThemeChanged');
      if (Conf['siteStyleHome']) {
        // Custom themes can't be applied to the home page via cookie.
        Settings.setSiteStyleHomeCookie('');
      }
      return;
    }

    const nativeSelector = $.id('styleSelector') as HTMLSelectElement | null;
    if (nativeSelector?.options?.length) {
      const hasStyle = Array.from(nativeSelector.options).some(opt => opt.value === style);
      if (hasStyle && nativeSelector.value !== style) {
        nativeSelector.value = style;
        nativeSelector.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    $.event('CustomSiteThemeChanged');

    if (Conf['siteStyleHome']) {
      Settings.setSiteStyleHomeCookie(style);
    }
  },

  bindSiteStylePicker(section: HTMLElement) {
    const picker = $('.styling-theme-picker', section) as HTMLElement | null;
    if (!picker) return;
    const toggle = $('.styling-theme-toggle', picker) as HTMLButtonElement | null;
    if (toggle) {
      $.on(toggle, 'click', (e: Event) => {
        e.preventDefault();
        if (toggle.disabled) return;
        if (picker.dataset.open === 'true') Settings.closeSiteStyleMenu(picker);
        else Settings.openSiteStyleMenu(picker);
      });
    }
  },

  bindAddCustomTheme(section: HTMLElement) {
    const container = $('.styling-add-theme', section) as HTMLElement | null;
    if (!container) return;
    const nameInput = $('.styling-add-theme-name', container) as HTMLInputElement | null;
    const sourceSelect = $('.styling-add-theme-source-select', container) as HTMLSelectElement | null;
    const fileInput = $('.styling-add-theme-file', container) as HTMLInputElement | null;
    const pasteInput = $('.styling-add-theme-paste', container) as HTMLTextAreaElement | null;
    const mergeCurrentLabel = $('.styling-add-theme-merge-current', container) as HTMLElement | null;
    const addBtn = $('.styling-add-theme-button', container) as HTMLButtonElement | null;
    const status = $('.styling-add-theme-status', container) as HTMLElement | null;
    if (!nameInput || !sourceSelect || !fileInput || !pasteInput || !addBtn) return;
    const siteStyleSelect = $('[name^="siteStyle"]', section) as HTMLSelectElement | null;
    const refreshMergeCurrent = () => {
      if (!mergeCurrentLabel) return;
      const value = siteStyleSelect?.value || Settings.styleConf<string>('siteStyle') || '';
      mergeCurrentLabel.textContent = !value
        ? '—'
        : (Settings.isCustomSiteThemeValue(value)
          ? `Custom: ${Settings.customSiteThemeName(value)}`
          : Settings.nativeSiteThemeLabel(value));
    };
    if (siteStyleSelect) $.on(siteStyleSelect, 'change', refreshMergeCurrent);
    refreshMergeCurrent();

    const showStatus = (msg: string, ok: boolean) => {
      if (!status) return;
      status.textContent = msg;
      status.dataset.kind = ok ? 'ok' : 'error';
      status.hidden = !msg;
    };

    const setMode = (mode: string) => {
      for (const input of $$('.styling-add-theme-input', container) as HTMLElement[]) {
        input.hidden = input.dataset.mode !== mode;
      }
    };

    $.on(sourceSelect, 'change', () => {
      setMode(sourceSelect.value);
      showStatus('', true);
    });
    setMode(sourceSelect.value);

    const readFileAsText = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Read failed'));
        reader.readAsText(file);
      });

    const finalize = (result: { ok: boolean; error?: string }, themeName: string) => {
      if (!result.ok) {
        showStatus(result.error || 'Could not add theme.', false);
        return;
      }
      showStatus(`Added "${themeName}".`, true);
      nameInput.value = '';
      fileInput.value = '';
      pasteInput.value = '';
    };

    $.on(addBtn, 'click', async () => {
      const themeName = nameInput.value.trim();
      if (!themeName) {
        showStatus('Theme name is required.', false);
        return;
      }
      const mode = sourceSelect.value;
      try {
        if (mode === 'file') {
          const file = fileInput.files?.[0];
          if (!file) {
            showStatus('Choose a CSS file first.', false);
            return;
          }
          const css = await readFileAsText(file);
          finalize(Settings.addCustomSiteTheme(themeName, css), themeName);
        } else if (mode === 'paste') {
          const css = pasteInput.value;
          if (!css.trim()) {
            showStatus('Paste some CSS first.', false);
            return;
          }
          finalize(Settings.addCustomSiteTheme(themeName, css), themeName);
        } else if (mode === 'merge') {
          const base = siteStyleSelect?.value || Settings.styleConf<string>('siteStyle') || '';
          if (!base) {
            showStatus('Select a base theme in the Theme dropdown above first.', false);
            return;
          }
          const userCSS = String(Settings.styleConf<string>('usercss') || '');
          if (!userCSS.trim()) {
            showStatus('Custom CSS is empty — add CSS in the Custom CSS section below first.', false);
            return;
          }
          const baseLabel = Settings.isCustomSiteThemeValue(base)
            ? `Custom: ${Settings.customSiteThemeName(base)}`
            : Settings.nativeSiteThemeLabel(base);
          showStatus(`Fetching "${baseLabel}" stylesheet…`, true);
          try {
            const baseCSS = await Settings.fetchBaseThemeCSS(base);
            const combined = `/* === Base theme: ${baseLabel} === */\n${baseCSS}\n\n/* === Custom CSS overrides === */\n${userCSS}\n`;
            finalize(Settings.addCustomSiteTheme(themeName, combined), themeName);
          } catch (err) {
            showStatus(`Could not fetch "${baseLabel}": ${(err as Error)?.message || err}`, false);
          }
        }
      } catch (err) {
        showStatus(`Failed: ${(err as Error)?.message || err}`, false);
      }
    });
  },

  async fetchBaseThemeCSS(value: string): Promise<string> {
    if (Settings.isCustomSiteThemeValue(value)) {
      const theme = Settings.findCustomSiteTheme(Settings.customSiteThemeName(value));
      if (!theme) throw new Error('custom theme not found in storage');
      return String(theme.css || '');
    }
    // Find the <link> for the requested native theme name and read its CSS via fetch.
    const links = $$('link[rel="alternate stylesheet"], link[rel="stylesheet"]', d.head) as HTMLLinkElement[];
    let href: string | null = null;
    for (const link of links) {
      if ((link.title || '').trim() === value) { href = link.href; break; }
    }
    if (!href) {
      // Fallback: native style selector may point at a script-managed sheet.
      const selector = $.id('styleSelector') as HTMLSelectElement | null;
      if (selector && selector.value === value) {
        const active = $(g.SITE.selectors.styleSheet) as HTMLLinkElement | null;
        if (active?.href) href = active.href;
      }
    }
    if (!href) throw new Error('stylesheet URL not found');
    const res = await fetch(href, { credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  },

  siteStyleHome(this: HTMLInputElement) {
    if (!this.checked) return;
    const activeStyle = Settings.styleConf<string>('siteStyle');
    const style = activeStyle || ($('#fourchanx-settings [name^="siteStyle"]') as HTMLSelectElement | null)?.value || '';
    if (!style) return;
    if (!activeStyle) {
      const key = Settings.variantKey('siteStyle');
      Conf[key] = style;
      $.set(key, style);
    }
    Settings.setSiteStyleHomeCookie(style);
  },

  setSiteStyleHomeCookie(style: string) {
    if (!style) return;
    const domain = location.hostname.includes('4channel.org') ? '4channel.org' : '4chan.org';
    const expires = 60 * 60 * 24 * 365; // 1 year
    const cleanupDomains = [location.hostname, domain, `.${domain}`];
    const past = 'Thu, 01 Jan 1970 00:00:00 GMT';
    for (const key of ['ws_style', 'nws_style']) {
      d.cookie = `${key}=; Expires=${past}; Path=/`;
      for (const cookieDomain of cleanupDomains) {
        d.cookie = `${key}=; Expires=${past}; Path=/; Domain=${cookieDomain}`;
      }
      d.cookie = `${key}=${style}; Max-Age=${expires}; Path=/; Domain=${domain}`;
    }
  },

  exportOptionOrder: [
    'General',
    'Interface',
    'Threads & Posts',
    'Watched Threads',
    'Media',
    'Posting',
    'Filters',
    'Styling',
    'Custom CSS',
    'Keybinds',
    'Advanced'
  ],

  exportSectionOrder: [
    { name: 'General', option: 'General' },
    { name: 'Interface', option: 'Interface' },
    { name: 'Threads & Posts', option: 'Threads & Posts', children: ['Watched Threads'] },
    { name: 'Media', option: 'Media' },
    { name: 'Posting', option: 'Posting' },
    { name: 'Filters', option: 'Filters' },
    { name: 'Styling', option: 'Styling', children: ['Custom CSS'] },
    { name: 'Keybinds', option: 'Keybinds' },
    { name: 'Advanced', option: 'Advanced' }
  ],

  impExpPicker: null as HTMLDivElement | null,

  exportOptionKeys() {
    const options: Record<string, string[]> = dict();
    const keysIn = (category: string) => {
      const obj = Config.main[category] || dict();
      const keys: string[] = [];
      for (const key in obj) {
        if (Array.isArray(obj[key])) keys.push(key);
      }
      return keys;
    };
    const stylingOnlyKeys = [
      'Scrollbar Markers',
      'Scrollbar Mark Own Posts',
      'Scrollbar Mark Quotes You',
      'Scrollbar Mark Ghost Posts',
      'Scrollbar Mark Unread Line',
      'Highlight Posts Quoting You',
      'Highlight Own Posts',
      'Highlight Ghost Posts'
    ];

    options['General'] = [
      'JSON Index',
      `Use ${meta.name} Catalog`,
      'Open Threads in New Tab',
      'External Catalog',
      '404 Redirect',
      'Archive Report',
      'Exempt Archives from Encryption',
      'Disable Native Extension',
      ...Object.keys(Config.Index)
    ];

    options['Interface'] = [
      'Announcement Hiding',
      'Follow Cursor',
      'Catalog Links',
      'Desktop Notifications',
      'Posting Success Notifications',
      'Keybinds',
      'Comment Expansion',
      'Thread Expansion',
      'Index Navigation',
      'Reply Navigation',
      'Unique ID and Capcode Navigation',
      'Normalize URL',
      'Disable Autoplaying Sounds',
      'boardnav',
      ...keysIn('Menu')
    ];

    options['Threads & Posts'] = [
      'Custom Board Titles',
      'Color User IDs',
      'Count Posts by ID',
      'Spoiler Mode',
      'Time Formatting',
      'RelativeTime',
      'File Info Formatting',
      'Quote Backlinks',
      ...keysIn('Filtering').filter(key => !stylingOnlyKeys.includes(key)),
      ...keysIn('Monitoring').filter(key => !stylingOnlyKeys.includes(key)),
      ...keysIn('Quote Links').filter(key => !stylingOnlyKeys.includes(key)),
      ...Object.keys(Config.threadWatcher),
      'Thread Watcher Thumbnail Size',
      'Thread Watcher Thumbnail Preview Size',
      'Thread Watcher Max Height',
      'Thread Watcher Max Width',
      'Thread Title',
      'Unread Title Count',
      'Interval',
      'customCooldown'
    ];

    options['Watched Threads'] = ['watchedThreads', 'watcherBackup'];

    options['Media'] = [
      ...keysIn('Images and Videos'),
      ...keysIn('Linkification'),
      'sauces',
      'selectedArchives'
    ];

    options['Posting'] = [
      ...keysIn('Posting and Captchas'),
      'Comment Preview Position',
      'QR.personas'
    ];

    options['Filters'] = Object.keys(Config.filter).concat(['easyFilters']);

    options['Styling'] = [
      'customCSSHome',
      'siteStyle',
      'siteStyleHome',
      'customSiteThemes',
      'savedHighlightPalettes',
      'Enable Thread Highlights',
      'Enable Catalog Highlights',
      'textColorMode',
      'Text Color',
      'Link Text Color',
      'Quote Text Color',
      'Dead Link Text Color',
      'Scroll Marker Own Match Highlight',
      'Scroll Marker You Match Highlight',
      'Scroll Marker Ghost Match Highlight',
      'Catalog Highlight Own Posts',
      'Catalog Highlight Watched Threads',
      'Highlight Own Color',
      'Highlight You Color',
      'Highlight Ghost Color',
      'Catalog Highlight Own Color',
      'Catalog Highlight Watched Color',
      'Catalog Highlight Own Text Auto',
      'Catalog Highlight Watched Text Auto',
      'Catalog Highlight Own Text Color',
      'Catalog Highlight Own Subject Color',
      'Catalog Highlight Own Link Color',
      'Catalog Highlight Own Quote Color',
      'Catalog Highlight Own Dead Link Color',
      'Catalog Highlight Watched Text Color',
      'Catalog Highlight Watched Subject Color',
      'Catalog Highlight Watched Link Color',
      'Catalog Highlight Watched Quote Color',
      'Catalog Highlight Watched Dead Link Color',
      'Highlight Own Text Auto',
      'Highlight You Text Auto',
      'Highlight Ghost Text Auto',
      'Highlight Own Text Color',
      'Highlight Own Link Color',
      'Highlight Own Quote Color',
      'Highlight Own Dead Link Color',
      'Highlight You Text Color',
      'Highlight You Link Color',
      'Highlight You Quote Color',
      'Highlight You Dead Link Color',
      'Highlight Ghost Text Color',
      'Highlight Ghost Link Color',
      'Highlight Ghost Quote Color',
      'Highlight Ghost Dead Link Color',
      'Highlight Own Opacity',
      'Highlight You Opacity',
      'Highlight Ghost Opacity',
      'Catalog Highlight Own Opacity',
      'Catalog Highlight Watched Opacity',
      'Scroll Marker Own Color',
      'Scroll Marker You Color',
      'Scroll Marker Ghost Color',
      'Scroll Marker Unread Color',
      'Scroll Marker Own Opacity',
      'Scroll Marker You Opacity',
      'Scroll Marker Ghost Opacity',
      'Scroll Marker Unread Opacity',
      ...stylingOnlyKeys,
      'settings.customCSSEditorTheme',
      'settings.customCSSEditorExpanded'
    ];

    options['Custom CSS'] = ['Custom CSS', 'usercss'];
    options['Keybinds'] = Object.keys(Config.hotkeys);
    options['Advanced'] = [
      'archives',
      'archiveLists',
      'archiveAutoUpdate',
      'lastarchivecheck',
      'externalCatalogURLs',
      'fourchanImageHost',
      'captchaLanguage',
      'time',
      'timeLocale',
      'backlink',
      'pastedname',
      'fileInfo',
      'jsWhitelist',
      'XEmbedder',
      'fxtLang',
      'fxtUrl',
      'fxtMaxReplies',
      'beepVolume',
      'soundLibrary',
      'boardSounds',
      'defaultSoundId',
      'sounds'
    ];

    return options;
  },

  optionForKey(key: string, keysByOption: Record<string, string[]>) {
    for (const name in keysByOption) {
      if (keysByOption[name].includes(key)) return name;
    }
    return 'General';
  },

  optionsPresentIn(conf: Record<string, any>) {
    const keysByOption = Settings.exportOptionKeys();
    const present: Record<string, boolean> = dict();
    for (const key in conf) {
      present[Settings.optionForKey(key, keysByOption)] = true;
    }
    return present;
  },

  groupFilenameTag(groups: string[]) {
    if (!groups?.length || groups.length === Settings.exportOptionOrder.length) return '';
    return '-' + groups.map(group => group.toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('-');
  },

  export() {
    // Make sure to export the most recent data, but don't overwrite existing `Conf` object.
    const Conf2 = dict();
    $.extend(Conf2, Conf);
    $.get(Conf2, function(Conf2) {
      // Don't export cached JSON data.
      delete Conf2['boardConfig'];
      const defaultCheckedOptions: Record<string, boolean> = dict();
      for (const name of Settings.exportOptionOrder) {
        defaultCheckedOptions[name] = true;
      }
      Settings.openImpExpPicker({
        title: 'Export Settings',
        action: 'Export',
        conf: Conf2,
        defaultCheckedGroups: defaultCheckedOptions,
        onConfirm: checkedOptions => Settings.doExport(checkedOptions, Conf2)
      });
    });
  },

  doExport(checkedOptions: Record<string, boolean>, conf: Record<string, any>) {
    const keysByOption = Settings.exportOptionKeys();
    const out: Record<string, any> = dict();
    for (const key in conf) {
      const option = Settings.optionForKey(key, keysByOption);
      if (checkedOptions[option]) out[key] = conf[key];
    }
    const groups = Settings.exportOptionOrder.filter(name => checkedOptions[name]);
    Settings.downloadExport({version: g.VERSION, date: Date.now(), groups, Conf: out});
  },

  downloadExport(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const tag = Settings.groupFilenameTag(data.groups);
    const a = $.el('a', {
      download: `${meta.name} v${g.VERSION}-${data.date}${tag}.json`,
      href: url
    }
    );
    const p = $('.imp-exp-result', Settings.dialog);
    $.rmAll(p);
    $.add(p, a);
    a.click();
  },

  import() {
    $('input[type=file]', this.parentNode).click();
  },

  onImport() {
    if ((this as HTMLInputElement).type !== 'file') { return; }
    let file;
    if (!(file = this.files[0])) { return; }
    this.value = null;
    const output = $('.imp-exp-result', Settings.dialog);

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        let data = dict.json(e.target.result);
        // Accept older/minimal exports that store settings directly at the top level.
        if (!data?.Conf && (data?.watchedThreads || data?.watcherBackup)) {
          data = {
            version: data.version || g.VERSION,
            date: data.date || Date.now(),
            Conf: data
          };
        }
        if (!data?.Conf) {
          output.textContent = 'Import failed: file is not a valid settings export.';
          return;
        }
        Settings.openImpExpPicker({
          title: 'Import Settings',
          action: 'Import',
          conf: data.Conf,
          onConfirm: checkedOptions => Settings.doImport(data, checkedOptions)
        });
      } catch (error) {
        const err = error;
        output.textContent = 'Import failed due to an error.';
        c.error(err.stack);
      }
    };
    reader.readAsText(file);
  },

  doImport(data: Record<string, any>, checkedGroups: Record<string, boolean>) {
    const output = $('.imp-exp-result', Settings.dialog);
    if (!Object.keys(checkedGroups).length) {
      output.textContent = 'Import aborted.';
      return;
    }
    const keysByGroup = Settings.exportOptionKeys();
    const presentGroups = Settings.optionsPresentIn(data.Conf);
    // Only do full overwrite when the user explicitly includes General.
    // This prevents section-only imports (e.g. Watched Threads) from wiping unrelated settings.
    const allSelected = !!checkedGroups['General'] && Object.keys(presentGroups).every(name => checkedGroups[name]);

    if (allSelected && !confirm('Your current settings will be entirely overwritten, are you sure?')) {
      output.textContent = 'Import aborted.';
      return;
    }

    const selected: Record<string, any> = dict();
    $.extend(selected, data);
    selected.Conf = dict();

    for (const key in data.Conf) {
      const group = Settings.optionForKey(key, keysByGroup);
      if (checkedGroups[group]) {
        selected.Conf[key] = data.Conf[key];
      }
    }

    if (selected.version && selected.version !== g.VERSION) {
      Settings.upgrade(selected.Conf, selected.version);
      const upgradedAndSelected: Record<string, any> = dict();
      for (const key in selected.Conf) {
        const group = Settings.optionForKey(key, keysByGroup);
        if (checkedGroups[group]) upgradedAndSelected[key] = selected.Conf[key];
      }
      selected.Conf = upgradedAndSelected;
    }

    if (allSelected) {
      Settings.loadSettings(selected, function(err) {
        if (err) {
          output.textContent = 'Import failed due to an error.';
        } else if (confirm('Import successful. Reload now?')) {
          window.location.reload();
        }
      });
      return;
    }

    $.set(selected.Conf, function(err) {
      if (err) {
        output.textContent = 'Import failed due to an error.';
      } else if (confirm('Import successful. Reload now?')) {
        window.location.reload();
      }
    });
  },

  openImpExpPicker({
    title,
    action,
    conf,
    defaultCheckedGroups,
    onConfirm
  }: {
    title: string;
    action: string;
    conf: Record<string, any>;
    defaultCheckedGroups?: Record<string, boolean>;
    onConfirm: (checkedGroups: Record<string, boolean>) => void;
  }) {
    if (!Settings.dialog) return;
    Settings.closeImpExpPicker();

    const presentGroups = Settings.optionsPresentIn(conf);
    const overlay = $.el('div', { className: 'imp-exp-picker-overlay' }) as HTMLDivElement;
    const picker = $.el('div', { className: 'imp-exp-picker dialog' }) as HTMLDivElement;
    $.add(overlay, picker);

    $.add(picker, $.el('h3', {
      className: 'imp-exp-picker-title',
      textContent: title
    }));

    const list = $.el('div', { className: 'imp-exp-picker-list' }) as HTMLDivElement;
    const checkboxes: Record<string, HTMLInputElement> = dict();
    const syncSectionStates: (() => void)[] = [];
    let syncToggle = () => {};
    let hasAny = false;
    for (const sectionInfo of Settings.exportSectionOrder) {
      const hasSectionOption = !!presentGroups[sectionInfo.option];
      const childOptions = (sectionInfo.children || []).filter(name => presentGroups[name]);
      const sectionOptions = [
        ...(hasSectionOption ? [sectionInfo.option] : []),
        ...childOptions
      ];
      if (!sectionOptions.length) continue;
      hasAny = true;

      const sectionRow = $.el('div', { className: 'imp-exp-picker-section' });
      const sectionTitleRow = $.el('div', { className: 'imp-exp-picker-row imp-exp-picker-section-title' });
      const sectionInput = $.el('input', {
        type: 'checkbox',
        checked: sectionOptions.every(name => !defaultCheckedGroups || defaultCheckedGroups[name] !== false),
        autocomplete: 'off'
      }) as HTMLInputElement;
      const sectionLabel = $.el('label');
      $.add(sectionLabel, sectionInput);
      $.add(sectionLabel, $.tn(` ${sectionInfo.name}`));
      $.add(sectionTitleRow, sectionLabel);
      $.add(sectionRow, sectionTitleRow);
      if (hasSectionOption) {
        checkboxes[sectionInfo.option] = sectionInput;
      }

      if (childOptions.length) {
        const children = $.el('div', { className: 'imp-exp-picker-children' });
        for (const name of childOptions) {
          const input = $.el('input', {
            type: 'checkbox',
            checked: defaultCheckedGroups ? (defaultCheckedGroups[name] !== false) : true,
            name: 'fcx-impexp-group',
            autocomplete: 'off'
          }) as HTMLInputElement;
          const label = $.el('label');
          $.add(label, input);
          $.add(label, $.tn(` ${name}`));
          checkboxes[name] = input;
          const row = $.el('div', { className: 'imp-exp-picker-row imp-exp-picker-child' });
          $.add(row, label);
          $.add(children, row);
        }
        $.add(sectionRow, children);
      }

      const syncSection = () => {
        const inputs = sectionOptions.map(name => checkboxes[name]).filter(Boolean);
        const checked = inputs.filter(input => input.checked).length;
        sectionInput.checked = checked === inputs.length;
        sectionInput.indeterminate = checked > 0 && checked < inputs.length;
      };
      syncSectionStates.push(syncSection);

      $.on(sectionInput, 'change', () => {
        const target = sectionInput.checked;
        sectionInput.indeterminate = false;
        for (const name of sectionOptions) {
          checkboxes[name].checked = target;
        }
        syncToggle();
      });

      for (const name of sectionOptions) {
        if (name === sectionInfo.option) continue;
        $.on(checkboxes[name], 'change', syncSection);
      }
      syncSection();
      $.add(list, sectionRow);
    }

    if (hasAny) {
      const toggleRow = $.el('div', { className: 'imp-exp-picker-row imp-exp-picker-toggle' });
      const toggleInput = $.el('input', {
        type: 'checkbox',
        checked: true,
        name: 'fcx-impexp-toggle',
        autocomplete: 'off'
      }) as HTMLInputElement;
      const toggleLabel = $.el('label');
      $.add(toggleLabel, toggleInput);
      $.add(toggleLabel, $.tn(' Check all'));
      $.add(toggleRow, toggleLabel);
      $.prepend(list, toggleRow);

      syncToggle = () => {
        const inputs = Object.values(checkboxes);
        const checked = inputs.filter(input => input.checked).length;
        toggleInput.checked = checked === inputs.length;
        toggleInput.indeterminate = checked > 0 && checked < inputs.length;
      };

      $.on(toggleInput, 'change', () => {
        const target = toggleInput.checked;
        toggleInput.indeterminate = false;
        for (const input of Object.values(checkboxes)) {
          input.checked = target;
        }
        for (const syncSection of syncSectionStates) syncSection();
      });

      for (const input of Object.values(checkboxes)) {
        $.on(input, 'change', syncToggle);
      }
      syncToggle();
      $.add(picker, list);
    } else {
      $.add(picker, $.el('p', {
        className: 'imp-exp-picker-empty',
        textContent: 'No recognizable settings groups found.'
      }));
    }

    const buttons = $.el('div', { className: 'imp-exp-picker-buttons' }) as HTMLDivElement;
    const cancelBtn = $.el('button', { type: 'button', textContent: 'Cancel' }) as HTMLButtonElement;
    const confirmBtn = $.el('button', {
      type: 'button',
      textContent: action,
      disabled: !hasAny
    }) as HTMLButtonElement;
    $.add(buttons, [cancelBtn, confirmBtn]);
    $.add(picker, buttons);

    const close = () => Settings.closeImpExpPicker();
    $.on(cancelBtn, 'click', close);
    $.on(overlay, 'click', e => {
      if (e.target === overlay) close();
    });
    $.on(confirmBtn, 'click', () => {
      const checked: Record<string, boolean> = dict();
      for (const [name, input] of Object.entries(checkboxes)) {
        if (input.checked) checked[name] = true;
      }
      Settings.closeImpExpPicker();
      onConfirm(checked);
    });

    $.add(Settings.dialog, overlay);
    Settings.impExpPicker = overlay;
  },

  closeImpExpPicker() {
    if (!Settings.impExpPicker) return;
    $.rm(Settings.impExpPicker);
    Settings.impExpPicker = null;
  },

  upgrade(data, version) {
    let corrupted, key, val;
    const changes = dict();
    const set = (key, value) => data[key] = (changes[key] = value);
    // XXX https://github.com/greasemonkey/greasemonkey/issues/2600
    if (corrupted = (version[0] === '"')) {
      try {
        version = JSON.parse(version);
      } catch (error) {}
    }
    const compareString = version.replace(/^XT /i, '').replace(/\d+/g, x => x.padStart(5, '0'));
    if (corrupted) {
      for (key in data) {
        val = data[key];
        if (typeof val === 'string') {
          try {
            var val2 = JSON.parse(val);
            set(key, val2);
          } catch (error1) {}
        }
      }
    }
    if (compareString < '00001.00014.00016.00001') {
      if (data['archiveLists'] != null) {
        set('archiveLists', data['archiveLists'].replace('https://mayhemydg.github.io/archives.json/archives.json', 'https://nstepien.github.io/archives.json/archives.json'));
      }
    }
    if (compareString < '00001.00014.00016.00007') {
      if (data['sauces'] != null) {
        set('sauces', data['sauces'].replace(
          /https:\/\/www\.deviantart\.com\/gallery\/#\/d%\$1%\$2;regexp:\/\^\\w\+_by_\\w\+\[_-\]d\(\[\\da-z\]\{6\}\)\\b\|\^d\(\[\\da-z\]\{6\}\)-\[\\da-z\]\{8\}-\//g,
          'javascript:void(open("https://www.deviantart.com/"+%$1.replace(/_/g,"-")+"/art/"+parseInt(%$2,36)));regexp:/^\\w+_by_(\\w+)[_-]d([\\da-z]{6})\\b/'
        ).replace(
          /\/\/imgops\.com\/%URL/g,
          '//imgops.com/start?url=%URL'
        )
        );
      }
    }
    if (compareString < '00001.00014.00017.00002') {
      if (data['jsWhitelist'] != null) {
        set('jsWhitelist', data['jsWhitelist'] + '\n\nhttps://hcaptcha.com\nhttps://*.hcaptcha.com');
      }
    }
    if (compareString < '00001.00014.00020.00004') {
      if (data['archiveLists'] != null) {
        set('archiveLists', data['archiveLists'].replace('https://nstepien.github.io/archives.json/archives.json', 'https://4chenz.github.io/archives.json/archives.json'));
      }
    }
    if (compareString < '00001.00014.00022.00003') {
      if (data['sauces']) {
        set('sauces', data['sauces'].replace(/^#?\s*https:\/\/www\.google\.com\/searchbyimage\?image_url=%(IMG|T?URL)&safe=off(?=$|;)/mg, 'https://www.google.com/searchbyimage?sbisrc=4chanx&image_url=%$1&safe=off'));
        if (compareString === '00001.00014.00022.00002' && !/\bsbisrc=/.test(data['sauces'])) {
          set('sauces', data['sauces'].replace(/^#?\s*https:\/\/lens\.google\.com\/uploadbyurl\?url=%(IMG|T?URL)(?=$|;)/m, 'https://www.google.com/searchbyimage?sbisrc=4chanx&image_url=%$1&safe=off'));
        }
      }
    }
    if (compareString < '00002.00003.00001.00000') {
      if (data['boardnav']) {
        set('boardnav', data['boardnav'].replace(
          '[external-text:"FAQ","4chan-neXT"]',
          `[external-text:"FAQ","${meta.faq}"]`
        ));
      }
    }
    if (compareString < '00002.00003.00006.00000') {
      set('RelativeTime', data['Relative Post Dates'] ? (data['Relative Date Title'] ? 'Hover' : 'Show') : 'No');
    }
    if (data['Spoiler Mode'] === undefined && (data['Remove Spoilers'] !== undefined || data['Reveal Spoilers'] !== undefined)) {
      set('Spoiler Mode', data['Remove Spoilers'] ? 'remove' : (data['Reveal Spoilers'] ? 'reveal' : 'default'));
    }
    if (compareString === '00002.00009.00000.00000') {
      set('XEmbedder', data['Embed Tweets inline with fxTwitter'] ? 'fxt' : 'tf');
      set('fxtMaxReplies', data['Resolve Tweet Replies'] ? (data['Resolve all Tweet Replies'] ? 100 : 1) : 0);
      set('fxtLang', data['Translate non-English Tweets to English'] ? 'en' : '');
    }
    // Seed SFW/NSFW siblings from each legacy styling value, once. Idempotent:
    // skipped per-key as soon as a sibling already exists.
    for (const k of styleVariantKeys) {
      const legacy = data[k];
      if (legacy === undefined) continue;
      if (data[`${k} SFW`] === undefined) set(`${k} SFW`, legacy);
      if (data[`${k} NSFW`] === undefined) set(`${k} NSFW`, legacy);
    }
    return changes;
  },

  loadSettings(data, cb) {
    if (data.version !== g.VERSION) {
      Settings.upgrade(data.Conf, data.version);
    }
    $.clear(function(err) {
      if (err) { return cb(err); }
      $.set(data.Conf, cb);
    });
  },

  reset() {
    if (confirm('Your current settings will be entirely wiped, are you sure?')) {
      $.clear(function(err) {
        if (err) {
          $('.imp-exp-result').textContent = 'Import failed due to an error.';
        } else if (confirm('Reset successful. Reload now?')) {
          window.location.reload();
        }
      });
    }
  },

  filtersPreviewState: null as null | {
    panel: HTMLDivElement | null;
    simpleTbody: HTMLTableSectionElement | null;
    advancedType: string | null;
    advancedTextarea: HTMLTextAreaElement | null;
  },
  forcedFiltersMode: null as null | string,
  forcedFilterType: null as null | string,

  filter(section) {
    const simplePanel = $.el('div') as HTMLDivElement;
    const advancedPanel = $.el('div') as HTMLDivElement;
    const previewState = {
      panel: null,
      simpleTbody: null as HTMLTableSectionElement | null,
      advancedType: null as string | null,
      advancedTextarea: null as HTMLTextAreaElement | null,
    };
    Settings.filtersPreviewState = previewState;
    Settings.advancedFilter(advancedPanel, previewState);
    Settings.easyFilters(simplePanel, previewState);
    const details = $.el('details',
      { open: true },
      { innerHTML: '<summary>Filtering Rules</summary>' }) as HTMLDetailsElement;
    const subnav = $.el('div', { className: 'settings-subnav' }) as HTMLDivElement;
    const simpleModePanel = $.el('div', { className: 'filter-mode-panel filter-mode-simple' }) as HTMLDivElement;
    const advancedModePanel = $.el('div', { className: 'filter-mode-panel filter-mode-advanced', hidden: true }) as HTMLDivElement;
    $.add(simpleModePanel, simplePanel);
    $.add(advancedModePanel, advancedPanel);
    $.add(details, [subnav, simpleModePanel, advancedModePanel]);
    $.add(section, details);

    const panelByMode = {
      simple: simpleModePanel,
      advanced: advancedModePanel,
    } as Record<string, HTMLDivElement>;
    const tabByMode = {} as Record<string, HTMLButtonElement>;
    const applyForcedFilterType = () => {
      if (!Settings.forcedFilterType) return;
      const select = $('select[name=filter]', advancedPanel) as (HTMLSelectElement & { filterPreviewState?: any }) | null;
      if (!select) return;
      const forceType = Settings.forcedFilterType;
      Settings.forcedFilterType = null;
      select.value = forceType;
      Settings.selectFilter.call(select);
    };
    const setMode = (mode: string) => {
      if (!panelByMode[mode]) mode = 'simple';
      for (const key in panelByMode) {
        panelByMode[key].hidden = key !== mode;
        if (tabByMode[key]) {
          tabByMode[key].classList.toggle('settings-subnav-tab-selected', key === mode);
          tabByMode[key].setAttribute('aria-pressed', key === mode ? 'true' : 'false');
        }
      }
      if (mode === 'advanced') applyForcedFilterType();
      $.set('settings.filtersMode', mode);
      Settings.refreshCombinedFilterPreview(previewState);
    };
    const addModeTab = (mode: string, label: string) => {
      const tab = $.el('button', {
        type: 'button',
        className: 'settings-subnav-tab',
        textContent: label,
      }) as HTMLButtonElement;
      tabByMode[mode] = tab;
      $.on(tab, 'click', () => setMode(mode));
      $.add(subnav, tab);
    };
    addModeTab('simple', 'Simple');
    addModeTab('advanced', 'Advanced');

    $.get('settings.filtersMode', 'simple', (item) => {
      let mode = Settings.forcedFiltersMode || item['settings.filtersMode'];
      Settings.forcedFiltersMode = null;
      if (!['simple', 'advanced'].includes(mode)) mode = 'simple';
      if (mode === 'advanced') details.open = true;
      setMode(mode);
    });
  },

  advancedFilter(section, previewState) {
    $.extend(section, { innerHTML: FilterSelectPage });
    const select = $('select', section) as HTMLSelectElement & { filterPreviewState?: any };
    select.filterPreviewState = previewState;
    $.on(select, 'change', Settings.selectFilter);
    Settings.selectFilter.call(select);
  },

  selectFilter(this: HTMLSelectElement & { filterPreviewState?: any }) {
    let name: string;
    const div = this.nextElementSibling as HTMLElement;
    const previewState = this.filterPreviewState;
    if ((name = this.value) !== 'guide') {
      if (!$.hasOwn(Config.filter, name)) { return; }
      $.rmAll(div);
      const ta = $.el('textarea', {
        name,
        className: 'field',
        spellcheck: false
      }) as HTMLTextAreaElement;
      $.on(ta, 'change', $.cb.value);
      $.get(name, Conf[name], function(item) {
        ta.value = item[name];
        $.add(div, ta);
        Settings.addFilterStats(name, ta, div, previewState);
      });
      return;
    }
    const filterTypes = Object.keys(Config.filter)
      .filter(x => x !== 'general')
      .join(',\u200B'); // \u200B is zero width space, to control where line breaks happen on a narrow screen
    $.extend(div, { innerHTML: FilterGuidePage });
    $('#filterTypes', div).textContent = `type:\u200B${filterTypes};`;
    $('.warning', div).hidden = Conf['Filter'];
  },

  easyFilterTypes: [
    ['General', 'general'],
    ['Post Number', 'postID'],
    ['Name', 'name'],
    ['Unique ID', 'uniqueID'],
    ['Tripcode', 'tripcode'],
    ['Capcode', 'capcode'],
    ['Pass Date', 'pass'],
    ['Email', 'email'],
    ['Subject', 'subject'],
    ['Comment', 'comment'],
    ['Flag', 'flag'],
    ['Filename', 'filename'],
    ['Dimensions', 'dimensions'],
    ['Filesize', 'filesize'],
    ['Image MD5', 'MD5'],
  ] as [string, string][],

  easyFilters(section: HTMLElement, previewState: any) {
    $.extend(section, { innerHTML: SimpleFiltersPage });
    const tbody = $('tbody', section) as HTMLTableSectionElement;
    const addButton = $('.easy-filter-add', section);
    const saveButton = $('.easy-filter-save', section);
    const status = $('.easy-filter-status', section);
    if (previewState) previewState.simpleTbody = tbody;

    const markDirty = () => {
      status.textContent = 'Unsaved changes.';
      Settings.refreshCombinedFilterPreview(previewState);
    };

    const save = () => {
      const rules = Settings.collectEasyFilters(tbody);
      const serialized = JSON.stringify(rules);
      $.set('easyFilters', serialized);
      Conf['easyFilters'] = serialized;
      status.textContent = `Saved ${rules.length} rule${rules.length === 1 ? '' : 's'}.`;
      Settings.refreshCombinedFilterPreview(previewState);
    };

    const addRow = (rule: any = {}) => {
      const row = Settings.easyFilterRow(rule, markDirty);
      $.add(tbody, row);
      return row;
    };

    const rules = Settings.parseEasyFilters();
    if (rules.length) {
      for (const rule of rules) addRow(rule);
    } else {
      addRow({ enabled: true, hide: true, type: 'tripcode' });
    }

    $.on(addButton, 'click', () => {
      const row = addRow({ enabled: true, hide: true, type: 'tripcode' });
      const patternInput = $('.easy-filter-pattern', row) as HTMLInputElement;
      if (patternInput) {
        patternInput.focus();
        patternInput.select();
      }
      markDirty();
    });

    $.on(saveButton, 'click', save);

    status.textContent = `Loaded ${rules.length} rule${rules.length === 1 ? '' : 's'}.`;
    Settings.refreshCombinedFilterPreview(previewState);
  },

  parseEasyFilters(): any[] {
    const raw = Conf['easyFilters'];
    let rules: any[] = [];
    if (Array.isArray(raw)) {
      rules = raw;
    } else if (typeof raw === 'string' && raw.trim()) {
      try { rules = JSON.parse(raw); } catch { rules = []; }
    }
    if (!Array.isArray(rules)) return [];

    return rules.map((rule) => {
      if (!rule || typeof rule !== 'object') return {};
      const type = (rule.type in Config.filter) ? rule.type : ({
        title: 'subject', body: 'comment', name: 'name',
      } as Record<string, string>)[rule.field] || 'general';
      const hide = (rule.hide != null)
        ? !!rule.hide
        : !['highlight', 'notify'].includes(rule.action);
      return {
        enabled: rule.enabled != null ? !!rule.enabled : true,
        pattern: typeof rule.pattern === 'string' ? rule.pattern
          : typeof rule.match === 'string' ? rule.match : '',
        boards: typeof rule.boards === 'string' ? rule.boards : '',
        type,
        color: typeof rule.color === 'string' ? rule.color : '',
        auto: !!rule.auto,
        hide,
        override: !!rule.override,
      };
    });
  },

  easyFilterRow(rule: any, markDirty: () => void): HTMLTableRowElement {
    const tr = $.el('tr', {
      innerHTML: `
        <td><input class="easy-filter-enabled" type="checkbox"></td>
        <td><input class="field easy-filter-pattern" type="text"></td>
        <td><input class="field easy-filter-boards" type="text" placeholder="all or g,v"></td>
        <td><select class="easy-filter-type"></select></td>
        <td><input class="field easy-filter-color" type="text" placeholder="highlight class"></td>
        <td><input class="easy-filter-auto" type="checkbox" title="Move highlighted OPs to top"></td>
        <td><input class="easy-filter-hide" type="checkbox"></td>
        <td><input class="easy-filter-override" type="checkbox" title="Whitelist: matching highlight prevents this thread from being hidden by other rules"></td>
        <td><button class="easy-filter-remove" type="button" title="Remove">\u00D7</button></td>
      `,
    }) as HTMLTableRowElement;

    const typeSelect = $('.easy-filter-type', tr) as HTMLSelectElement;
    for (const [label, value] of Settings.easyFilterTypes) {
      $.add(typeSelect, $.el('option', { textContent: label, value }));
    }

    const enabledInput = $('.easy-filter-enabled', tr) as HTMLInputElement;
    const patternInput = $('.easy-filter-pattern', tr) as HTMLInputElement;
    const boardsInput = $('.easy-filter-boards', tr) as HTMLInputElement;
    const colorInput = $('.easy-filter-color', tr) as HTMLInputElement;
    const autoInput = $('.easy-filter-auto', tr) as HTMLInputElement;
    const hideInput = $('.easy-filter-hide', tr) as HTMLInputElement;
    const overrideInput = $('.easy-filter-override', tr) as HTMLInputElement;
    const removeButton = $('.easy-filter-remove', tr);

    enabledInput.checked = rule.enabled != null ? !!rule.enabled : true;
    patternInput.value = rule.pattern || '';
    boardsInput.value = rule.boards || '';
    typeSelect.value = (rule.type in Config.filter) ? rule.type : 'general';
    colorInput.value = rule.color || '';
    autoInput.checked = !!rule.auto;
    hideInput.checked = rule.hide != null ? !!rule.hide : true;
    overrideInput.checked = !!rule.override;

    // Override only applies to highlight rules. Grey it out when this row is set
    // to hide, since "hide + override" has no meaning.
    const syncOverrideState = () => {
      const disabled = hideInput.checked;
      overrideInput.disabled = disabled;
      if (disabled) overrideInput.checked = false;
    };
    syncOverrideState();
    $.on(hideInput, 'change', syncOverrideState);

    for (const input of $$('input, select', tr)) {
      $.on(input, 'change', markDirty);
      if ((input as HTMLInputElement).type === 'text') {
        $.on(input, 'input', markDirty);
      }
    }

    $.on(removeButton, 'click', () => {
      $.rm(tr);
      markDirty();
    });

    return tr;
  },

  collectEasyFilters(tbody: HTMLTableSectionElement): any[] {
    const rules: any[] = [];
    for (const tr of $$('tr', tbody)) {
      const pattern = ($('.easy-filter-pattern', tr) as HTMLInputElement).value.trim();
      if (!pattern) continue;
      const type = ($('.easy-filter-type', tr) as HTMLSelectElement).value;
      const hide = ($('.easy-filter-hide', tr) as HTMLInputElement).checked;
      rules.push({
        enabled: ($('.easy-filter-enabled', tr) as HTMLInputElement).checked,
        pattern,
        boards: ($('.easy-filter-boards', tr) as HTMLInputElement).value.trim(),
        type: (type in Config.filter) ? type : 'general',
        color: ($('.easy-filter-color', tr) as HTMLInputElement).value.trim(),
        auto: ($('.easy-filter-auto', tr) as HTMLInputElement).checked,
        hide,
        override: !hide && ($('.easy-filter-override', tr) as HTMLInputElement).checked,
      });
    }
    return rules;
  },

  easyFilterRuleFromRow(tr: HTMLTableRowElement) {
    const pattern = ($('.easy-filter-pattern', tr) as HTMLInputElement).value.trim();
    if (!pattern) return null;
    const type = ($('.easy-filter-type', tr) as HTMLSelectElement).value;
    const hide = ($('.easy-filter-hide', tr) as HTMLInputElement).checked;
    return {
      enabled: ($('.easy-filter-enabled', tr) as HTMLInputElement).checked,
      pattern,
      boards: ($('.easy-filter-boards', tr) as HTMLInputElement).value.trim(),
      type: (type in Config.filter) ? type : 'general',
      color: ($('.easy-filter-color', tr) as HTMLInputElement).value.trim(),
      auto: ($('.easy-filter-auto', tr) as HTMLInputElement).checked,
      hide,
      override: !hide && ($('.easy-filter-override', tr) as HTMLInputElement).checked,
    };
  },

  easyFilterRuleToLine(rule: any): string | null {
    if (!rule?.enabled) return null;
    const match = (rule.pattern || '').trim();
    if (!match) return null;

    const flags = rule.caseSensitive ? '' : 'i';
    let line = `/${Filter.escape(match)}/${flags}`;

    const options: string[] = [];
    if (typeof rule.boards === 'string' && rule.boards.trim()) {
      options.push(`boards:${rule.boards.trim()}`);
    }

    const type = (rule.type in Config.filter) ? rule.type : 'general';
    options.push(`type:${type === 'general' ? 'subject,name,comment' : type}`);

    const hide = (rule.hide != null) ? !!rule.hide : !['highlight', 'notify'].includes(rule.action);
    if (!hide) {
      const color = (rule.color || '').trim();
      options.push(color ? `highlight:${color}` : 'highlight');
      options.push(`top:${rule.auto ? 'yes' : 'no'}`);
      if (rule.override) options.push('override');
    }
    if (rule.action === 'notify') options.push('notify');

    if (options.length) line += `;${options.join(';')}`;
    return line;
  },

  addFilterStats(type: string, textarea: HTMLTextAreaElement, container: HTMLElement, previewState: any) {
    if (previewState) {
      previewState.advancedType = type;
      previewState.advancedTextarea = textarea;
      const refresh = () => Settings.refreshCombinedFilterPreview(previewState);
      $.on(textarea, 'input', refresh);
      $.on(textarea, 'change', refresh);
      refresh();
      return;
    }
  },

  refreshCombinedFilterPreview(previewState = Settings.filtersPreviewState) {
    const panel = previewState?.panel;
    if (!panel) return;
    $.rmAll(panel);

    if (!previewState.simpleTbody && !previewState.advancedTextarea) {
      $.add(panel, $.el('div', {
        className: 'filter-stats-empty',
        textContent: 'No filters loaded yet.',
      }));
      return;
    }

    if (previewState.simpleTbody) {
      const simpleGroup = $.el('div', { className: 'filter-preview-group' });
      $.add(simpleGroup, $.el('div', { className: 'filter-preview-heading', textContent: 'Simple Filters' }));
      const simplePanel = $.el('div', { className: 'filter-stats' });
      $.add(simpleGroup, simplePanel);
      Settings.renderEasyFilterPreview(previewState.simpleTbody, simplePanel);
      $.add(panel, simpleGroup);
    }

    if (previewState.advancedTextarea) {
      const advancedGroup = $.el('div', { className: 'filter-preview-group' });
      const advancedLabel = previewState.advancedType
        ? `Advanced Filters (${previewState.advancedType})` : 'Advanced Filters';
      $.add(advancedGroup, $.el('div', { className: 'filter-preview-heading', textContent: advancedLabel }));
      const advancedPanel = $.el('div', { className: 'filter-stats' });
      $.add(advancedGroup, advancedPanel);
      Settings.renderFilterStats(previewState.advancedType, previewState.advancedTextarea, advancedPanel);
      $.add(panel, advancedGroup);
    }
  },

  renderEasyFilterPreview(tbody: HTMLTableSectionElement, panel: HTMLElement) {
    $.rmAll(panel);
    if (!g.BOARD?.threads || !['index', 'thread', 'catalog'].includes(g.VIEW)) {
      $.add(panel, $.el('div', {
        className: 'filter-stats-empty',
        textContent: 'Thread match preview is available on board and catalog pages.',
      }));
      return;
    }

    const entries = Settings.filterPreviewEntries();
    if (!entries.length) {
      $.add(panel, $.el('div', {
        className: 'filter-stats-empty',
        textContent: 'No loaded thread data to preview.',
      }));
      return;
    }

    const stats: any[] = [];
    let totalMatches = 0;
    let totalHidden = 0;
    let activeRules = 0;
    let rowNo = 0;
    for (const tr of $$('tr', tbody)) {
      rowNo++;
      const rule = Settings.easyFilterRuleFromRow(tr);
      if (!rule) continue;
      const lineText = Settings.easyFilterRuleToLine(rule);
      if (!lineText) {
        stats.push({ rowNo, rule, disabled: true });
        continue;
      }

      activeRules++;
      const parsed = Settings.parseFilterPreviewLine('general', lineText);
      if (parsed?.invalid) {
        stats.push({ rowNo, rule, invalid: parsed.invalid });
        continue;
      }
      if (parsed?.skip) continue;

      const result = Settings.collectFilterPreviewMatches(parsed, entries);
      totalMatches += result.matches.length;
      totalHidden += result.hiddenThreadCount;
      stats.push({ rowNo, rule, matches: result.matches, hiddenThreadCount: result.hiddenThreadCount });
    }

    if (!stats.length) {
      $.add(panel, $.el('div', {
        className: 'filter-stats-empty',
        textContent: 'Add a pattern to preview thread matches.',
      }));
      return;
    }

    $.add(panel, $.el('div', {
      className: 'filter-stats-summary',
      textContent: `${activeRules} active rule${activeRules === 1 ? '' : 's'}, ${totalMatches} matching thread${totalMatches === 1 ? '' : 's'}, ${totalHidden} hidden thread${totalHidden === 1 ? '' : 's'}.`,
    }));

    const maxThreads = 50;
    for (const stat of stats) {
      const row = $.el('div', { className: 'filter-stat-row' });
      let ruleText = `${stat.rule.type}: ${stat.rule.pattern}`;
      if (ruleText.length > 120) ruleText = `${ruleText.slice(0, 117)}...`;

      if (stat.disabled) {
        $.add(row, [
          $.el('span', { className: 'filter-stat-count', textContent: `Rule ${stat.rowNo}: disabled` }),
          $.tn(' '),
          $.el('code', { textContent: ruleText }),
        ]);
        $.add(panel, row);
        continue;
      }
      if (stat.invalid) {
        $.add(row, $.el('div', {
          className: 'filter-stat-invalid',
          textContent: `Rule ${stat.rowNo}: invalid regex (${stat.invalid})`,
        }));
        $.add(panel, row);
        continue;
      }

      const matchCount = stat.matches.length;
      let summaryText = `Rule ${stat.rowNo}: ${matchCount} matching thread${matchCount === 1 ? '' : 's'}`;
      if (stat.hiddenThreadCount) summaryText += `, ${stat.hiddenThreadCount} hidden`;

      if (matchCount) {
        const details = $.el('details', { className: 'filter-stat' }) as HTMLDetailsElement;
        const summaryEl = $.el('summary');
        $.add(summaryEl, [
          $.el('span', { className: 'filter-stat-count', textContent: summaryText }),
          $.tn(' '),
          $.el('code', { textContent: ruleText }),
        ]);
        $.add(details, summaryEl);

        const list = $.el('ul', { className: 'filter-stat-threads' });
        stat.matches.slice(0, maxThreads).forEach((m: any) => {
          const { entry, hidesThread } = m;
          const { href, text } = Settings.filterPreviewThreadLink(entry);
          const li = $.el('li');
          $.add(li, $.el('a', { href, textContent: text }));
          if (hidesThread) $.add(li, $.tn(' (hidden)'));
          $.add(list, li);
        });
        if (stat.matches.length > maxThreads) {
          $.add(list, $.el('li', {
            className: 'filter-stat-more',
            textContent: `...and ${stat.matches.length - maxThreads} more.`,
          }));
        }
        $.add(details, list);
        $.add(row, details);
      } else {
        $.add(row, [
          $.el('span', { className: 'filter-stat-count', textContent: summaryText }),
          $.tn(' '),
          $.el('code', { textContent: ruleText }),
        ]);
      }
      $.add(panel, row);
    }
  },

  renderFilterStats(type: string, textarea: HTMLTextAreaElement, panel: HTMLElement) {
    $.rmAll(panel);
    if (!g.BOARD?.threads || !['index', 'thread', 'catalog'].includes(g.VIEW)) {
      $.add(panel, $.el('div', {
        className: 'filter-stats-empty',
        textContent: 'Thread match preview is available on board and catalog pages.',
      }));
      return;
    }
    const entries = Settings.filterPreviewEntries();
    if (!entries.length) {
      $.add(panel, $.el('div', {
        className: 'filter-stats-empty',
        textContent: 'No loaded thread data to preview.',
      }));
      return;
    }

    const lines = textarea.value.split('\n');

    if (type === 'MD5') {
      let activeLines = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed[0] !== '#') activeLines++;
      }
      if (activeLines > 250) {
        $.add(panel, $.el('div', {
          className: 'filter-stats-empty',
          textContent: `Preview disabled for MD5 while ${activeLines} lines are loaded.`,
        }));
        return;
      }
    }

    const stats: any[] = [];
    let totalMatches = 0;
    let totalHidden = 0;
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const parsed = Settings.parseFilterPreviewLine(type, line);
      if (parsed?.skip) return;
      if (parsed?.invalid) {
        stats.push({ lineNo: i + 1, line, invalid: parsed.invalid });
        return;
      }
      const result = Settings.collectFilterPreviewMatches(parsed, entries);
      totalMatches += result.matches.length;
      totalHidden += result.hiddenThreadCount;
      stats.push({ lineNo: i + 1, line, matches: result.matches, hiddenThreadCount: result.hiddenThreadCount });
    });

    if (!stats.length) {
      $.add(panel, $.el('div', {
        className: 'filter-stats-empty',
        textContent: 'No filter lines to preview.',
      }));
      return;
    }

    $.add(panel, $.el('div', {
      className: 'filter-stats-summary',
      textContent: `${stats.length} line${stats.length === 1 ? '' : 's'}, ${totalMatches} matching thread${totalMatches === 1 ? '' : 's'}, ${totalHidden} hidden thread${totalHidden === 1 ? '' : 's'}.`,
    }));

    const maxThreads = 50;
    for (const stat of stats) {
      const row = $.el('div', { className: 'filter-stat-row' });
      if (stat.invalid) {
        $.add(row, $.el('div', {
          className: 'filter-stat-invalid',
          textContent: `Line ${stat.lineNo}: invalid regex (${stat.invalid})`,
        }));
        $.add(panel, row);
        continue;
      }
      let lineText = stat.line.trim();
      if (lineText.length > 120) lineText = `${lineText.slice(0, 117)}...`;
      const matchCount = stat.matches.length;
      let summaryText = `Line ${stat.lineNo}: ${matchCount} matching thread${matchCount === 1 ? '' : 's'}`;
      if (stat.hiddenThreadCount) summaryText += `, ${stat.hiddenThreadCount} hidden`;

      if (matchCount) {
        const details = $.el('details', { className: 'filter-stat' }) as HTMLDetailsElement;
        const summaryEl = $.el('summary');
        $.add(summaryEl, [
          $.el('span', { className: 'filter-stat-count', textContent: summaryText }),
          $.tn(' '),
          $.el('code', { textContent: lineText }),
        ]);
        $.add(details, summaryEl);
        const list = $.el('ul', { className: 'filter-stat-threads' });
        stat.matches.slice(0, maxThreads).forEach((m: any) => {
          const { entry, hidesThread } = m;
          const { href, text } = Settings.filterPreviewThreadLink(entry);
          const li = $.el('li');
          $.add(li, $.el('a', { href, textContent: text }));
          if (hidesThread) $.add(li, $.tn(' (hidden)'));
          $.add(list, li);
        });
        if (stat.matches.length > maxThreads) {
          $.add(list, $.el('li', {
            className: 'filter-stat-more',
            textContent: `...and ${stat.matches.length - maxThreads} more.`,
          }));
        }
        $.add(details, list);
        $.add(row, details);
      } else {
        $.add(row, [
          $.el('span', { className: 'filter-stat-count', textContent: summaryText }),
          $.tn(' '),
          $.el('code', { textContent: lineText }),
        ]);
      }
      $.add(panel, row);
    }
  },

  parseFilterPreviewLine(key: string, line: string): any {
    if (line[0] === '#') return { skip: true };
    const regexpMatch = line.match(/\/(.*)\/(\w*)/);
    if (!regexpMatch) return { skip: true };

    const isstring = key === 'uniqueID' || key === 'MD5';
    let regexp: any = regexpMatch[1];
    if (!isstring) {
      try {
        regexp = RegExp(regexpMatch[1], regexpMatch[2]);
      } catch (err) {
        return { invalid: err.message };
      }
    }
    const filter = line.replace(regexpMatch[0], '');

    const boards = Filter.parseBoards(filter.match(/(?:^|;)\s*boards:([^;]+)/)?.[1]);
    const excludes = Filter.parseBoards(filter.match(/(?:^|;)\s*exclude:([^;]+)/)?.[1]);

    const op = filter.match(/(?:^|;)\s*op:(no|only)/)?.[1] || '';
    let mask = ({ no: 1, only: 2 } as Record<string, number>)[op] || 0;
    const file = filter.match(/(?:^|;)\s*file:(no|only)/)?.[1] || '';
    mask = mask | (({ no: 4, only: 8 } as Record<string, number>)[file] || 0);

    const noti = /(?:^|;)\s*notify/.test(filter);
    const hl = /(?:^|;)\s*highlight/.test(filter);
    const hide = !(hl || noti);

    const keys = (key === 'general')
      ? (filter.match(/(?:^|;)\s*type:([^;]*)/)?.[1].split(',') || ['subject', 'name', 'filename', 'comment'])
      : [key];

    return { regexp, isstring, boards, excludes, mask, hide, keys };
  },

  collectFilterPreviewMatches(parsed: any, entries: any[]) {
    const matches: any[] = [];
    let hiddenThreadCount = 0;
    for (const entry of entries) {
      let threadMatched = false;
      let hidesThread = false;
      for (const post of entry.posts) {
        if (!Settings.filterPreviewMatchesPost(parsed, post)) continue;
        threadMatched = true;
        if (parsed.hide && !post.isReply && !QuoteYou.isYou(post)) hidesThread = true;
      }
      if (threadMatched) {
        matches.push({ entry, hidesThread });
        if (hidesThread) hiddenThreadCount++;
      }
    }
    return { matches, hiddenThreadCount };
  },

  filterPreviewMatchesPost(parsed: any, post: any): boolean {
    let mask = post.isReply ? 2 : 1;
    mask = mask | (post.file ? 4 : 8);
    const board = `${post.siteID}/${post.boardID}`;
    const site = `${post.siteID}/*`;
    if (
      (parsed.boards && !(parsed.boards[board] || parsed.boards[site])) ||
      (parsed.excludes && (parsed.excludes[board] || parsed.excludes[site])) ||
      (parsed.mask & mask)
    ) return false;

    for (const key of parsed.keys) {
      for (const value of Filter.values(key, post)) {
        if (parsed.isstring) {
          if (parsed.regexp === value) return true;
        } else {
          (parsed.regexp as RegExp).lastIndex = 0;
          if ((parsed.regexp as RegExp).test(value)) return true;
        }
      }
    }
    return false;
  },

  filterPreviewEntries(): any[] {
    const entries: any[] = [];

    if (g.VIEW === 'index' && (Index as any)?.parsedThreads) {
      for (const threadID in (Index as any).parsedThreads) {
        const parsed = (Index as any).parsedThreads[threadID];
        const thread = g.BOARD?.threads?.get?.(+threadID) || g.BOARD?.threads?.get?.(threadID as any);
        const posts: any[] = [];
        if (thread?.posts) {
          thread.posts.forEach((post: any) => {
            if (post.isClone || post.isFetchedQuote) return;
            posts.push(post);
          });
        }
        if (!posts.length) posts.push(parsed);
        entries.push({ id: +threadID, boardID: parsed.boardID, siteID: parsed.siteID, thread, op: parsed, posts });
      }
      return entries;
    }

    if (g.VIEW === 'catalog' && (Filter as any)?.catalogData) {
      for (const threadID in (Filter as any).catalogData) {
        const data = (Filter as any).catalogData[threadID];
        const parsed = g.SITE.Build.parseJSON(data, g.BOARD);
        const thread = g.BOARD?.threads?.get?.(+threadID) || g.BOARD?.threads?.get?.(threadID as any);
        const posts: any[] = [];
        if (thread?.posts) {
          thread.posts.forEach((post: any) => {
            if (post.isClone || post.isFetchedQuote) return;
            posts.push(post);
          });
        }
        if (!posts.length) posts.push(parsed);
        entries.push({ id: +threadID, boardID: parsed.boardID, siteID: parsed.siteID, thread, op: parsed, posts });
      }
      return entries;
    }

    if (g.BOARD?.threads) {
      g.BOARD.threads.forEach((thread: any) => {
        if (!thread?.OP || thread.OP.isFetchedQuote) return;
        const posts: any[] = [];
        thread.posts.forEach((post: any) => {
          if (post.isClone || post.isFetchedQuote) return;
          posts.push(post);
        });
        if (!posts.length) posts.push(thread.OP);
        entries.push({ id: thread.ID, boardID: thread.boardID, siteID: thread.siteID, thread, op: thread.OP, posts });
      });
    }
    return entries;
  },

  filterPreviewThreadLink(entry: any): { href: string; text: string } {
    const { id, boardID, op } = entry;
    let href = (g.SITE.Build as any).postURL?.(boardID, id, id) || (g.SITE.Build as any).threadURL?.(boardID, id) || '';
    if (!href) href = `#p${id}`;
    let title = op.info.subject || op.info.comment || op.info.nameBlock || '';
    if (!title && op.info.commentHTML?.innerHTML) {
      title = g.sites[op.siteID]?.Build?.parseComment?.(op.info.commentHTML.innerHTML) || '';
    }
    title = title.replace(/\s+/g, ' ').trim();
    if (title.length > 90) title = `${title.slice(0, 87)}...`;
    let text = `/${boardID}/${id}`;
    if (title) text += ` - ${title}`;
    return { href, text };
  },

  sauce(section) {
    $.extend(section, { innerHTML: SaucePage });
    $('.warning', section).hidden = Conf['Sauce'];
    const ta = $('textarea', section);
    $.get('sauces', Conf['sauces'], function(item) {
      ta.value = item['sauces'];
      ta.hidden = false;
    }); // XXX prevent Firefox from adding initialization to undo queue
    $.on(ta, 'change', $.cb.value);
  },

  advanced(section) {
    let input, name;
    $.extend(section, { innerHTML: AdvancedPage });
    for (var warning of $$('.warning', section)) { warning.hidden = Conf[warning.dataset.feature]; }

    const inputs = dict();
    for (input of $$('[name]', section)) {
      inputs[input.name] = input;
    }

    $.on(inputs['archiveLists'], 'change', function() {
      $.set('lastarchivecheck', 0);
      Conf['lastarchivecheck'] = 0;
      $.id('lastarchivecheck').textContent = 'never';
    });

    const items = dict();
    for (name in inputs) {
      input = inputs[name];
      if (!['Interval', 'Custom CSS', 'timeLocale'].includes(name)) {
        items[name] = Conf[name];
        var event = (
          (input.nodeName === 'SELECT') ||
          ['checkbox', 'radio'].includes(input.type) ||
          ((input.nodeName === 'TEXTAREA') && !(name in Settings))
        ) ? 'change' : 'input';
        $.on(input, event, $.cb[input.type === 'checkbox' ? 'checked' : 'value']);
        if (name in Settings) { $.on(input, event, Settings[name]); }
      }
    }

    $.get(items, function(items) {
      for (var key in items) {
        var val = items[key];
        input = inputs[key];
        input[input.type === 'checkbox' ? 'checked' : 'value'] = val;
        input.hidden = false; // XXX prevent Firefox from adding initialization to undo queue
        if (key in Settings) {
          Settings[key].call(input);
        }
      }
    });

    const listImageHost = $.id('list-fourchanImageHost');
    if (listImageHost) {
      for (const textContent of ImageHost.suggestions) {
        $.add(listImageHost, $.el('option', {textContent}));
      }
    }

    const interval  : HTMLInputElement  = inputs['Interval'];
    const customCSS : HTMLInputElement  = inputs['Custom CSS'];
    const timeLocale: HTMLInputElement  = inputs.timeLocale;

    if (interval) {
      interval.value = Conf['Interval'];
      $.on(interval, 'change', ThreadUpdater.cb.interval);
    }
    if (customCSS) {
      customCSS.checked = Conf['Custom CSS'];
      $.on(customCSS, 'change', Settings.togglecss);
    }
    if (inputs['usercss']) {
      inputs['usercss'].disabled = !Conf['Custom CSS'];
    }
    if (timeLocale) {
      timeLocale.value = Conf.timeLocale;
      $.on(timeLocale, 'change', Settings.setTimeLocale);
    }

    const itemsArchive = dict();
    for (name of ['archives', 'selectedArchives', 'lastarchivecheck']) { itemsArchive[name] = Conf[name]; }
    $.get(itemsArchive, function(itemsArchive) {
      $.extend(Conf, itemsArchive);
      Redirect.selectArchives();
      Settings.addArchiveTable(section);
    });

    const boardSelect    = $('#archive-board-select', section);
    const table          = $('#archive-table', section);
    const updateArchives = $('#update-archives', section);

    if (boardSelect && table) {
      $.on(boardSelect, 'change', function() {
        const active = $('tbody > :not([hidden])', table);
        if (active) active.hidden = true;
        const next = $(`tbody > .${this.value}`, table);
        if (next) next.hidden = false;
      });
    }

    if (updateArchives) {
      $.on(updateArchives, 'click', () => Redirect.update(() => Settings.addArchiveTable(section)));
    }

    if (inputs.beepVolume) {
      $.on(inputs.beepVolume, 'change', () => { ThreadUpdater.playBeep(false); });
    }

    Settings.addSoundLibrary(section);
    Settings.addBoardSoundOverrides(section);
    Settings.addPostSoundOverrides(section);
  },

  addSoundLibrary(section) {
    SoundManager.init();
    const fileInput = $('#sound-upload', section) as HTMLInputElement;
    const uploadBtn = $('#sound-upload-btn', section);
    const list = $('#sound-library-list', section);

    const render = () => {
      $.rmAll(list);
      const entries = SoundManager.library();
      if (!entries.length) {
        const empty = $.el('div', { className: 'sound-list__empty', textContent: 'No sounds yet — add one above.' });
        $.add(list, empty);
      }
      for (const lib of entries) {
        const isDefault = SoundManager.isDefault(lib.id);
        const row = $.el('div', {
          className: 'sound-list__row'
            + (lib.builtin ? ' sound-list__row--builtin' : '')
            + (isDefault ? ' sound-list__row--default' : ''),
        });

        const radioWrap = $.el('label', { className: 'sound-list__default', title: 'Use as default sound' });
        const radio = $.el('input', { type: 'radio', name: 'sound-default' }) as HTMLInputElement;
        radio.checked = isDefault;
        $.on(radio, 'change', () => {
          SoundManager.setDefaultSoundId(lib.id, render);
        });
        $.add(radioWrap, radio);

        const nameCell = $.el('div', { className: 'sound-list__name' });
        if (lib.builtin) {
          const label = $.el('span', { className: 'sound-list__name-label', textContent: lib.name });
          const badge = $.el('span', { className: 'sound-list__badge', textContent: 'built-in' });
          $.add(nameCell, [label, badge]);
        } else {
          const nameInput = $.el('input', { type: 'text', value: lib.name, className: 'field sound-list__name-input' });
          $.on(nameInput, 'change', () => SoundManager.renameLibraryEntry(lib.id, nameInput.value));
          $.add(nameCell, nameInput);
        }

        const actions = $.el('div', { className: 'sound-list__actions' });
        const playBtn = $.el('button', { type: 'button', className: 'sound-btn sound-btn--icon', title: 'Preview', textContent: '▶' });
        $.on(playBtn, 'click', () => ThreadUpdater.playSound(lib.data, false));
        $.add(actions, playBtn);

        if (!lib.builtin) {
          const del = $.el('button', { type: 'button', className: 'sound-btn sound-btn--icon sound-btn--danger', title: 'Delete', textContent: '✕' });
          $.on(del, 'click', () => SoundManager.removeFromLibrary(lib.id, render));
          $.add(actions, del);
        }

        $.add(row, [radioWrap, nameCell, actions]);
        $.add(list, row);
      }
      Settings.refreshBoardSoundsSelect(section);
    };

    $.on(uploadBtn, 'click', () => fileInput.click());
    $.on(fileInput, 'change', () => {
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;
      let remaining = files.length;
      const finish = () => { if (--remaining === 0) { fileInput.value = ''; render(); } };
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = () => {
          const data = reader.result as string;
          const name = file.name.replace(/\.[^.]+$/, '');
          SoundManager.addToLibrary(name, data, finish);
        };
        reader.onerror = finish;
        reader.readAsDataURL(file);
      }
    });

    Settings.wireSoundUrlAdd(section, render);
    Settings.wireSoundExportImport(section, render);

    render();
  },

  wireSoundUrlAdd(section, render: () => void) {
    const urlBtn = $('#sound-url-btn', section);
    const urlRow = $('#sound-url-row', section);
    const urlInput = $('#sound-url-input', section) as HTMLInputElement;
    const urlAdd = $('#sound-url-add', section);
    const urlCancel = $('#sound-url-cancel', section);
    const status = $('#sound-status', section);

    const setStatus = (msg: string, ok = false) => {
      status.textContent = msg;
      status.hidden = !msg;
      status.dataset.kind = ok ? 'ok' : 'error';
    };

    const showRow = (visible: boolean) => {
      urlRow.hidden = !visible;
      if (visible) { urlInput.focus(); setStatus(''); }
    };

    $.on(urlBtn, 'click', () => showRow(urlRow.hidden));
    $.on(urlCancel, 'click', () => { urlInput.value = ''; showRow(false); });

    $.on(urlAdd, 'click', () => {
      const url = urlInput.value.trim();
      if (!url) return;
      setStatus('Fetching…', true);
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.blob();
        })
        .then(blob => new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(blob);
        }))
        .then(dataUri => {
          const name = url.split('/').pop()?.replace(/\.[^.]+$/, '') || 'sound';
          SoundManager.addToLibrary(name, dataUri, () => {
            urlInput.value = '';
            showRow(false);
            setStatus('');
            render();
          });
        })
        .catch(err => {
          setStatus(`Could not fetch: ${err.message || err}. The host may block cross-origin requests.`);
        });
    });
  },

  wireSoundExportImport(section, render: () => void) {
    const exportBtn = $('#sound-export-btn', section);
    const importBtn = $('#sound-import-btn', section);
    const importInput = $('#sound-import', section) as HTMLInputElement;
    const status = $('#sound-status', section);

    const setStatus = (msg: string, ok = false) => {
      status.textContent = msg;
      status.hidden = !msg;
      status.dataset.kind = ok ? 'ok' : 'error';
    };

    $.on(exportBtn, 'click', () => {
      const payload = {
        kind: '4chan-neXT sound export',
        version: 1,
        date: Date.now(),
        soundLibrary: Conf.soundLibrary || [],
        boardSounds: Conf.boardSounds || {},
        defaultSoundId: Conf.defaultSoundId || '',
        sounds: Conf['sounds'] || {},
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = $.el('a', {
        href: url,
        download: `4chan-neXT-sounds-${new Date().toISOString().slice(0, 10)}.json`,
      });
      $.add(d.body, a);
      a.click();
      $.rm(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    });

    $.on(importBtn, 'click', () => importInput.click());
    $.on(importInput, 'change', () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (data.kind !== '4chan-neXT sound export') {
            setStatus('Not a recognized sound export.');
            return;
          }
          Settings.mergeSoundImport(data, () => {
            importInput.value = '';
            render();
            setStatus(`Imported.`, true);
          });
        } catch (err) {
          setStatus(`Import failed: ${err.message || err}`);
        }
      };
      reader.readAsText(file);
    });
  },

  mergeSoundImport(data: any, cb: () => void) {
    // Merge library: keep existing entries; add imported ones that don't collide on id.
    const existing: any[] = Array.isArray(Conf.soundLibrary) ? Conf.soundLibrary : [];
    const seen = new Set(existing.map((e: any) => e.id));
    const merged = [...existing];
    for (const entry of (data.soundLibrary || [])) {
      if (entry?.id && !seen.has(entry.id)) {
        merged.push(entry);
        seen.add(entry.id);
      }
    }
    Conf.soundLibrary = merged;

    // Merge board overrides: imported wins per key.
    Conf.boardSounds = { ...(Conf.boardSounds || {}), ...(data.boardSounds || {}) };

    // Default: only adopt if the imported id resolves in the merged library.
    if (data.defaultSoundId && seen.has(data.defaultSoundId)) {
      Conf.defaultSoundId = data.defaultSoundId;
    }

    // Merge DataBoard 'sounds' (post overrides) — deep-merge per site/board/thread.
    const cur = (Conf['sounds'] && typeof Conf['sounds'] === 'object') ? Conf['sounds'] : dict();
    const next = JSON.parse(JSON.stringify(cur));
    const inSounds = data.sounds || {};
    for (const siteID in inSounds) {
      const site = inSounds[siteID];
      if (!site?.boards) continue;
      if (!next[siteID]) next[siteID] = { boards: dict() };
      for (const boardID in site.boards) {
        const board = site.boards[boardID];
        if (!next[siteID].boards[boardID]) next[siteID].boards[boardID] = dict();
        for (const threadID in board) {
          const wrapper = board[threadID];
          if (!wrapper) continue;
          const cur = next[siteID].boards[boardID][threadID] || {};
          const curPosts = { ...(cur.posts || {}) };
          const inPosts = wrapper.posts || {};
          for (const postID in inPosts) {
            if (!(postID in curPosts)) curPosts[postID] = inPosts[postID];
          }
          if (Object.keys(curPosts).length) {
            next[siteID].boards[boardID][threadID] = { ...cur, posts: curPosts };
          }
        }
      }
    }
    Conf['sounds'] = next;

    $.set({
      soundLibrary: Conf.soundLibrary,
      boardSounds: Conf.boardSounds,
      defaultSoundId: Conf.defaultSoundId,
      sounds: Conf['sounds'],
    }, cb);
  },

  addBoardSoundOverrides(section) {
    const list = $('#board-sounds-list', section);
    const boardInput = $('#board-sounds-board', section) as HTMLInputElement;
    const soundSelect = $('#board-sounds-sound', section) as HTMLSelectElement;
    const addBtn = $('#board-sounds-add', section);
    Settings.populateBoardDatalist(section);

    const render = () => {
      $.rmAll(list);
      const all = SoundManager.allBoardOverrides();
      if (!all.length) {
        const empty = $.el('div', { className: 'sound-list__empty', textContent: 'No board overrides yet.' });
        $.add(list, empty);
        return;
      }
      for (const { siteID, boardID, soundId } of all) {
        const lib = SoundManager.getEntry(soundId);
        const row = $.el('div', { className: 'sound-list__row' });
        const nameCell = $.el('div', { className: 'sound-list__name' });
        const board = $.el('span', { className: 'sound-list__board', textContent: `${siteID}/${boardID}` });
        const arrow = $.el('span', { className: 'sound-list__sep', textContent: '→' });
        const sound = $.el('span', {
          className: 'sound-list__sound' + (lib ? '' : ' sound-list__sound--missing'),
          textContent: lib?.name || `(missing: ${soundId})`,
        });
        $.add(nameCell, [board, arrow, sound]);

        const actions = $.el('div', { className: 'sound-list__actions' });
        const del = $.el('button', { type: 'button', className: 'sound-btn sound-btn--icon sound-btn--danger', title: 'Remove', textContent: '✕' });
        $.on(del, 'click', () => {
          const map = { ...(Conf.boardSounds || {}) };
          delete map[`${siteID}/${boardID}`];
          Conf.boardSounds = map;
          $.set('boardSounds', map, render);
        });
        $.add(actions, del);

        $.add(row, [nameCell, actions]);
        $.add(list, row);
      }
    };

    $.on(addBtn, 'click', () => {
      const boardID = boardInput.value.trim();
      const soundId = soundSelect.value;
      if (!boardID || !soundId) return;
      SoundManager.setBoardOverride(boardID, soundId, render);
      boardInput.value = '';
    });

    Settings.refreshBoardSoundsSelect(section);
    render();
  },

  refreshBoardSoundsSelect(section) {
    const sel = $('#board-sounds-sound', section) as HTMLSelectElement;
    if (!sel) return;
    $.rmAll(sel);
    for (const lib of SoundManager.library()) {
      const opt = $.el('option', { value: lib.id, textContent: lib.name });
      $.add(sel, opt);
    }
  },

  populateBoardDatalist(section) {
    const datalist = $('#board-sounds-datalist', section);
    if (!datalist) return;
    $.rmAll(datalist);
    const boards = (Conf['boardConfig']?.boards) || {};
    const seen = new Set<string>();
    for (const id in boards) {
      if (seen.has(id)) continue;
      seen.add(id);
      const data = boards[id] || {};
      const title = data.title ? `/${id}/ - ${data.title}` : `/${id}/`;
      $.add(datalist, $.el('option', { value: id, textContent: title }));
    }
    // Also include any boards the user already has overrides for, in case BoardConfig isn't loaded.
    for (const { boardID } of SoundManager.allBoardOverrides()) {
      if (seen.has(boardID)) continue;
      seen.add(boardID);
      $.add(datalist, $.el('option', { value: boardID }));
    }
  },

  addPostSoundOverrides(section) {
    const list = $('#post-sounds-list', section);

    const render = () => {
      $.rmAll(list);
      const all = SoundManager.allPostOverrides();
      if (!all.length) {
        const empty = $.el('div', { className: 'sound-list__empty', textContent: 'No post overrides yet.' });
        $.add(list, empty);
        return;
      }
      for (const { siteID, boardID, threadID, postID, soundId } of all) {
        const lib = SoundManager.getEntry(soundId);
        const row = $.el('div', { className: 'sound-list__row' });
        const nameCell = $.el('div', { className: 'sound-list__name' });
        const ref = $.el('span', { className: 'sound-list__board', textContent: `${siteID}/${boardID}/${threadID}#${postID}` });
        const arrow = $.el('span', { className: 'sound-list__sep', textContent: '→' });
        const sound = $.el('span', {
          className: 'sound-list__sound' + (lib ? '' : ' sound-list__sound--missing'),
          textContent: lib?.name || `(missing: ${soundId})`,
        });
        $.add(nameCell, [ref, arrow, sound]);

        const actions = $.el('div', { className: 'sound-list__actions' });
        const del = $.el('button', { type: 'button', className: 'sound-btn sound-btn--icon sound-btn--danger', title: 'Remove', textContent: '✕' });
        $.on(del, 'click', () => {
          SoundManager.setPostOverride({ siteID, boardID, threadID, postID }, null, render);
        });
        $.add(actions, del);

        $.add(row, [nameCell, actions]);
        $.add(list, row);
      }
    };

    render();
  },

  addArchiveTable(section) {
    let boardID, o;
    $('#lastarchivecheck', section).textContent = Conf['lastarchivecheck'] === 0 ?
      'never'
    :
      new Date(Conf['lastarchivecheck']).toLocaleString();

    const boardSelect = $('#archive-board-select', section);
    const table       = $('#archive-table', section);
    const tbody       = $('tbody', section);

    $.rmAll(boardSelect);
    $.rmAll(tbody);

    const archBoards = dict();
    for (var {uid, name, boards, files, software} of Conf['archives']) {
      if (!['fuuka', 'foolfuuka'].includes(software)) { continue; }
      for (boardID of boards) {
        o = archBoards[boardID] || (archBoards[boardID] = {
          thread: [],
          threadJSON: [],
          post:   [],
          file:   []
        });
        if (!o.threadJSON) o.threadJSON = [];
        var archive = [uid ?? name, name];
        o.thread.push(archive);
        if (software === 'foolfuuka') {
          o.post.push(archive);
          o.threadJSON.push(archive);
        }
        if (files.includes(boardID)) { o.file.push(archive); }
      }
    }

    const rows = [];
    const boardOptions = [];
    for (boardID of Object.keys(archBoards).sort()) { // Alphabetical order
      var row = $.el('tr',
        {className: `board-${boardID}`});
      row.hidden = boardID !== g.BOARD.ID;

      boardOptions.push($.el('option', {
        textContent: `/${boardID}/`,
        value:       `board-${boardID}`,
        selected:    boardID === g.BOARD.ID
      }));

      o = archBoards[boardID];
      for (var item of ['thread', 'threadJSON', 'post', 'file']) {
        $.add(row, Settings.addArchiveCell(boardID, o, item));
      }
      rows.push(row);
    }

    if (rows.length === 0) {
      boardSelect.hidden = (table.hidden = true);
      return;
    }

    boardSelect.hidden = (table.hidden = false);

    if (!(g.BOARD.ID in archBoards)) {
      rows[0].hidden = false;
    }

    $.add(boardSelect, boardOptions);
    $.add(tbody, rows);

    for (boardID in Conf['selectedArchives']) {
      var data = Conf['selectedArchives'][boardID];
      for (var type in data) {
        var select;
        var id = data[type];
        if (select = $(`select[data-boardid='${boardID}'][data-type='${type}']`, tbody)) {
          select.value = JSON.stringify(id);
          if (!select.value) { select.value = select.firstChild.value; }
        }
      }
    }
  },

  addArchiveCell(boardID, data, type) {
    const {length} = data[type];
    const td = $.el('td',
      {className: 'archive-cell'});

    if (!length) {
      td.textContent = '--';
      return td;
    }

    const options = [];
    let i = 0;
    while (i < length) {
      var archive = data[type][i++];
      options.push($.el('option', {
        value: JSON.stringify(archive[0]),
        textContent: archive[1]
      }));
    }

    $.extend(td, {innerHTML: '<select></select>'});
    const select = td.firstElementChild;
    if (!(select.disabled = length === 1)) {
      // XXX GM can't into datasets
      select.setAttribute('data-boardid', boardID);
      select.setAttribute('data-type', type);
      $.on(select, 'change', Settings.saveSelectedArchive);
    }
    $.add(select, options);

    return td;
  },

  saveSelectedArchive() {
    $.get('selectedArchives', Conf['selectedArchives'], ({selectedArchives}) => {
      (selectedArchives[this.dataset.boardid] || (selectedArchives[this.dataset.boardid] = dict()))[this.dataset.type] = JSON.parse(this.value);
      $.set('selectedArchives', selectedArchives);
      Conf['selectedArchives'] = selectedArchives;
      Redirect.selectArchives();
    });
  },

  boardnav() {
    Header.generateBoardList(this.value);
  },

  time() {
    this.nextElementSibling.textContent = Time.format(new Date(), this.value);
  },

  timeLocale() {
    Settings.time.call($('[name=time]', Settings.dialog));
  },

  backlink() {
    this.nextElementSibling.textContent = this.value.replace(/%(?:id|%)/g, x => ({'%id': '123456789', '%%': '%'})[x]);
  },

  fileInfo() {
    const data = {
      isReply: true,
      file: {
        url: `//${ImageHost.host()}/g/1334437723720.jpg`,
        name: 'd9bb2efc98dd0df141a94399ff5880b7.jpg',
        size: '276 KB',
        sizeInBytes: 276 * 1024,
        dimensions: '1280x720',
        isImage: true,
        isVideo: false,
        isSpoiler: true,
        tag: 'Loop'
      }
    };
    FileInfo.format(this.value, data, this.nextElementSibling);
  },

  favicon() {
    Favicon.switch();
    if ((g.VIEW === 'thread') && Conf['Unread Favicon']) { Unread.update(); }
    const img = this.nextElementSibling.children;
    const f = Favicon;
    const iterable = [f.SFW, f.unreadSFW, f.unreadSFWY, f.NSFW, f.unreadNSFW, f.unreadNSFWY, f.dead, f.unreadDead, f.unreadDeadY];
    for (let i = 0; i < iterable.length; i++) {
      var icon = iterable[i];
      if (!img[i]) { $.add(this.nextElementSibling, $.el('img')); }
      img[i].src = icon;
    }
  },

  togglecss() {
    const details = $.x('ancestor::details[1]', this) as HTMLElement | null;
    const textarea = details ? ($('textarea[name^=usercss]', details) as HTMLTextAreaElement | null) : null;
    const disabled = !this.checked;
    if (textarea) textarea.disabled = disabled;
    if (disabled) {
      CustomCSS.rmStyle();
    } else {
      CustomCSS.addStyle();
    }
    $.cb.checked.call(this);
    Settings.applyStylingVars();
  },

  setTimeLocale(e: InputEvent) {
    const input = e.target as HTMLInputElement;
    try {
      if (input.value !== '') new Intl.DateTimeFormat(input.value);
      input.setCustomValidity('');
      Time.formatterCache.clear();
      $.cb.value.call(input);
      Settings.timeLocale.call(input);
    } catch (e) {
      input.setCustomValidity('Locale not recognized');
      input.reportValidity();
    }
  },

  keyBindInputs: (dict() as Record<string, HTMLInputElement>),

  keybinds(section) {
    let key;
    $.extend(section, { innerHTML: KeybindsPage });
    const warning = $('.warning', section);
    if (warning) warning.hidden = Conf['Keybinds'];

    const details = $.el('details',
      { open: true },
      { innerHTML: '<summary>Keybind Actions</summary>' }) as HTMLDetailsElement;
    const contentNodes = [...section.childNodes];
    $.rmAll(section);
    $.add(details, contentNodes);
    $.add(section, details);

    const tbody  = $('tbody', details);
    const items  = dict();
    const inputs = Settings.keyBindInputs;
    for (key in Config.hotkeys) {
      var arr = Config.hotkeys[key];
      var tr = $.el('tr',
        { innerHTML: `<td class="setting-title">${arr[1]}</td><td><input class="field"></td>` });
      tr.dataset.name = `${key} ${arr[1]}`;
      tr.dataset.settingTitle = arr[1];
      tr.dataset.settingDescription = key;
      var input = $('input', tr);
      input.name = key;
      input.spellcheck = false;
      items[key]  = Conf[key];
      inputs[key] = input;
      $.on(input, 'keydown', Settings.keybind);
      $.add(tbody, tr);
    }

    $.get(items, function (items) {
      for (key in items) {
        var val = items[key];
        inputs[key].value = val;
      }
    });
    $.on($('#reset-keys', details), 'click', Settings.resetKeybinds);
  },

  keybind(e) {
    if (e.keyCode === 9) return; // tab
    e.preventDefault();
    e.stopPropagation();
    const key = Keybinds.keyCode(e);
    if (this.name === 'Watch (catalog click)') {
      if (key === '') { // backspace clears
        this.value = '';
        $.cb.value.call(this);
        return;
      }
      const mods = Keybinds.modifierString(e);
      if (!mods) return; // ignore unmodified keys for this modifier-only field
      this.value = mods;
      $.cb.value.call(this);
      return;
    }
    if (key == null) return; // empty string is backspace
    this.value = key;
    $.cb.value.call(this);
  },

  resetKeybinds() {
    if (!confirm('Are you sure you want to reset the keybinds?')) return;

    const defaults = Object.fromEntries(Object.entries(Config.hotkeys).map(([key, value]) => [key, value[0]]));
    $.set(defaults, () => {
      Object.assign(Conf, defaults);
      for (const [key, value] of Object.entries(defaults)) {
        Settings.keyBindInputs[key].value = value;
      }
    });
  },
};
export default Settings;
