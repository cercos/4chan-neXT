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
import ThreadWatcher from '../Monitoring/ThreadWatcher';
import SoundManager from '../Monitoring/SoundManager';
import Unread from '../Monitoring/Unread';
import $$ from '../platform/$$';
import $ from '../platform/$';
import meta from '../../package.json';
import { c, Conf, d, doc, E, g } from '../globals/globals';
import Header from './Header';
import { SearchHighlight } from './SearchHighlight';
import h, { hFragment } from '../globals/jsx';
import { dict } from '../platform/helpers';
import Icon, { ICON_SETS } from '../Icons/icon';
import { dragstart } from './UI';
import Filter from '../Filtering/Filter';
import QuoteYou from '../Quotelinks/QuoteYou';
import Index from './Index';
import BoardConfig from './BoardConfig';
import nextSettingsDiff from '../config/nextSettingsDiff.json';

export type StyleVariant = 'sfw' | 'nsfw';

// Shape of an entry in Settings.sections (created by Settings.addSection).
type SectionInfo = { title: string; hyphenatedTitle: string; open: (section: HTMLElement, globals?: typeof g) => void };

// A row in a settings <select> fieldset (see Settings.addSelectRows).
type SelectRow = { name: string; label: string; description?: string; options: [string, string][] };

// Keys of Settings.stylingSectionKeys. Declared standalone (rather than as
// `keyof typeof Settings.stylingSectionKeys` in a method parameter type) so the
// Settings object literal's type does not reference itself during inference.
type StylingSectionId = 'siteStyle' | 'highlights' | 'scrollbarMarkers' | 'textColors' | 'customCSS';

// Name of the CSS Custom Highlight that paints settings-search term matches.
const SETTINGS_SEARCH_HL = 'fourchanx-settings-search';

// The visible text elements a search term can be highlighted within. Kept in
// sync between highlightSettingRow (what gets painted) and applySearch (deciding
// whether a row's match is visible or only on a hidden data-name field).
const SEARCH_HIGHLIGHT_SELECTOR =
  '.setting-title, .setting-description, .settings-section-header, .styling-section-summary-text, .next-summary-title, summary, th, h4';

const SETTINGS_COMPACT_CONTENT_WIDTH = 760;
const SETTINGS_COLLAPSED_NAV_WIDTH = 640;

// Settings neXT added or changed vs upstream 4chan-X (see
// tools/gen-next-settings-diff.js). Powers the "Highlight neXT" toggle.
const NEXT_ADDED = new Set<string>(nextSettingsDiff.added);
const NEXT_CHANGED = new Set<string>(nextSettingsDiff.changed);

// Classify a single setting key against the neXT diff.
function nextStatusOf(key: string): '' | 'added' | 'changed' {
  if (!key) return '';
  if (NEXT_ADDED.has(key)) return 'added';
  if (NEXT_CHANGED.has(key)) return 'changed';
  return '';
}

// loose: `Settings` is a large self-referential singleton object literal whose
// members reference `Settings` in their own signatures/defaults, so under
// --noImplicitAny TS cannot infer the literal's type and reports TS7022. Its
// full structural type is not practical to hand-author, and external modules
// read late-assigned properties off this value, so an explicit `any` keeps both
// this module and its consumers compiling without narrowing anything away.
var Settings: any = {
  dialog: undefined as HTMLDivElement | undefined,
  searchQuery: '',
  searchTerms: [] as string[],
  activeSection: null as any,
  renderedSection: null as any,
  // Keybinds that are modifier-only and applied with a mouse click (e.g. hold
  // Shift and click a catalog thread to hide it), not a keypress. They share the
  // modifier-only input handling in Settings.keybind and get a "hold + click"
  // badge so they aren't mistaken for ordinary keyboard shortcuts.
  clickKeybinds: ['Watch (catalog click)', 'Hide thread (catalog click)'],
  isClickKeybind(name: string): boolean {
    return Settings.clickKeybinds.includes(name);
  },
  rememberLayout: false,
  highlightNext: false,
  accordionMode: false,
  settingsNavResizeObserver: null as ResizeObserver | null,
  settingsNavResizeFallback: null as (() => void) | null,
  descriptionTooltipAutoPrevious: null as boolean | null,
  descriptionTooltipAutoActive: false,
  savedWindowLayout: '',
  detailsState: dict() as Record<string, boolean>,
  pointerDownInsideDialog: false,
  customCSSEditorThemeObserver: null as MutationObserver | null,
  activeSiteStylePicker: null as HTMLElement | null,
  siteStylePickerOutsideHandler: null as ((e: Event) => void) | null,
  textareaSavedFlashTimers: new WeakMap<HTMLTextAreaElement, number>(),
  stylingEditingVariant: null as StyleVariant | null,
  styleVariantKeySet: new Set<string>(styleVariantKeys),
  resolvedStyleColorCache: null as Record<string, string> | null,
  THEME_BORDER_HIGHLIGHT: '__theme_border_highlight__',

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

  // Text-color mode for the global Text Colors picker and each highlight row.
  // Anything that isn't an explicit 'auto'/'manual' means "use theme defaults"
  // (no override) — that's the new default and the migration target.
  resolveTextMode(value: any): 'default' | 'auto' | 'manual' {
    return value === 'auto' || value === 'manual' ? value : 'default';
  },

  styleKeyBase(key: string): string {
    return key.replace(/ (SFW|NSFW)$/, '');
  },
  prepareDrag(this: HTMLElement, e: Event) {
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
    add('Filters',         this.filter);
    add('Keybinds',        this.keybinds);
    add('Advanced',        this.advanced);
    add('All Settings',    this.allSettings);

    $.on(d, 'AddSettingsSection',   Settings.addSection);
    $.on(d, 'OpenSettings', e => Settings.open(e.detail));

    if ((g.SITE!.software === 'yotsuba') && Conf['Disable Native Extension']) {
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

  // Maps a Styling subsection id to its master-switch Conf key. The title
  // checkbox for each section (shown only when StyleChan is installed) flips
  // the corresponding flag; runtime apply paths read it via
  // stylingSectionEnabled to gate the section's effect on the page.
  stylingSectionKeys: {
    siteStyle: 'stylingSectionSiteStyle',
    highlights: 'stylingSectionHighlights',
    scrollbarMarkers: 'stylingSectionScrollbarMarkers',
    textColors: 'stylingSectionTextColors',
    customCSS: 'stylingSectionCustomCSS',
  } as const,

  // Whether a Styling subsection is active. A pure flag read: works on board
  // pages, the home page, and the scroll-marker renderer alike. Correctness
  // after a StyleChan *uninstall* is guaranteed by initStylingSectionDefaults,
  // which resets every flag to true on board pages when StyleChan is absent —
  // so a section can never get stuck off with no checkbox to re-enable it.
  stylingSectionEnabled(id: StylingSectionId): boolean {
    return Conf[Settings.stylingSectionKeys[id]] !== false;
  },

  // The StyleChan recommendation: hand the sections StyleChan owns (site theme,
  // text colors, custom CSS) over to it, keep the ones it doesn't (highlight +
  // scrollbar marker colors) on. Used by the one-time init and the "Apply
  // recommended settings" button. Does NOT touch any inner section settings.
  applyRecommendedStylingSections() {
    const recommended: Record<string, boolean> = {
      stylingSectionSiteStyle: false,
      stylingSectionTextColors: false,
      stylingSectionCustomCSS: false,
      stylingSectionHighlights: true,
      stylingSectionScrollbarMarkers: true,
    };
    for (const [key, val] of Object.entries(recommended)) {
      Conf[key] = val;
      $.set(key, val);
    }
  },

  // One-time recommendation + uninstall reset, run from Main.initStyle on board
  // pages (where StyleChan detection is reliable). On first detection of
  // StyleChan, hand its owned sections over; never re-applied automatically so
  // the user's later choices stick. When StyleChan is absent, clear any stale
  // StyleChan-era state so all sections come back on.
  initStylingSectionDefaults() {
    if (Settings.isStylechanInstalled()) {
      if (!Conf['stylingSectionsInitialized']) {
        Settings.applyRecommendedStylingSections();
        Conf['stylingSectionsInitialized'] = true;
        $.set('stylingSectionsInitialized', true);
      }
      return;
    }
    const keys = Object.values(Settings.stylingSectionKeys) as string[];
    const dirty = Conf['stylingSectionsInitialized'] || keys.some(k => Conf[k] === false);
    if (!dirty) return;
    for (const k of keys) {
      if (Conf[k] !== true) { Conf[k] = true; $.set(k, true); }
    }
    Conf['stylingSectionsInitialized'] = false;
    $.set('stylingSectionsInitialized', false);
  },

  // Inject a master-switch checkbox into each Styling subsection's <summary>.
  // Toggling it persists the section flag, grays the section out
  // (`styling-section-off`), and re-applies the runtime gates — all without
  // touching the inner settings. Returns a function that re-syncs every
  // checkbox + gray state from Conf (used by "Apply recommended settings").
  setupStylingSectionToggles(section: HTMLElement): () => void {
    const details = $$('details[data-styling-section]', section) as HTMLElement[];
    const entries: { detail: HTMLElement; id: StylingSectionId; cb: HTMLInputElement }[] = [];
    const syncOne = (detail: HTMLElement, id: StylingSectionId, cb: HTMLInputElement) => {
      const on = Settings.stylingSectionEnabled(id);
      cb.checked = on;
      detail.classList.toggle('styling-section-off', !on);
    };
    for (const detail of details) {
      const id = detail.dataset.stylingSection as StylingSectionId;
      if (!id || !(id in Settings.stylingSectionKeys)) continue;
      const summary = $('summary', detail) as HTMLElement | null;
      if (!summary) continue;
      // Wrap the toggle in a <label> with an explicit visual box. Bare native
      // checkboxes are zeroed out by some host/StyleChan themes; the label's
      // `.styling-section-toggle-box` is a plain styled element that always
      // shows the on/off state regardless of native `appearance`.
      const label = $.el('label', {
        className: 'styling-section-toggle',
        title: 'Enable this styling section (off hands it to StyleChan)',
      });
      const cb = $.el('input', { type: 'checkbox' }) as HTMLInputElement;
      const boxIcon = $.el('span', { className: 'styling-section-toggle-box', 'aria-hidden': 'true' } as any);
      $.add(label, [cb, boxIcon]);
      // Stop the click from reaching the <summary>, whose activation behavior
      // would otherwise expand/collapse the <details> when toggling the box.
      $.on(label, 'click', e => e.stopPropagation());
      $.on(cb, 'change', () => {
        const key = Settings.stylingSectionKeys[id];
        Conf[key] = cb.checked;
        $.set(key, cb.checked);
        detail.classList.toggle('styling-section-off', !cb.checked);
        Settings.applyStylingSectionRuntime();
      });
      // The summary is a `display:flex; justify-content:space-between` row whose
      // only other items are the title text and the disclosure caret (::after).
      // Wrap the toggle + title together so they stay grouped at the left and
      // the caret stays at the right, instead of being scattered three ways.
      // The title text goes in its own `.styling-section-summary-text` span:
      // the search highlighter (highlightSettingRow) resets that span's text
      // instead of the whole summary, so it can't wipe the injected toggle.
      const titleWrap = $.el('span', { className: 'styling-section-summary-label' });
      const titleText = $.el('span', { className: 'styling-section-summary-text' });
      const summaryActions: ChildNode[] = [];
      while (summary.firstChild) {
        const child = summary.firstChild;
        if (
          child instanceof HTMLElement
          && child.matches('button, input, select, textarea, label, [data-summary-action]')
        ) {
          summaryActions.push(child);
          summary.removeChild(child);
        } else {
          titleText.appendChild(child);
        }
      }
      $.add(titleWrap, [label, titleText]);
      summary.appendChild(titleWrap);
      for (const action of summaryActions) summary.appendChild(action);
      syncOne(detail, id, cb);
      entries.push({ detail, id, cb });
    }
    return () => { for (const e of entries) syncOne(e.detail, e.id, e.cb); };
  },

  // Re-apply every section gate to the live page + dialog after a toggle. Cheap
  // and idempotent, so we just refresh all paths rather than tracking which
  // section changed: CSS vars/classes (highlights, markers, text colors),
  // the scroll-marker renderer, custom CSS injection, and the site theme.
  applyStylingSectionRuntime() {
    Settings.applyStylingVars();
    $.event('RefreshScrollMarkers');
    CustomCSS.update();
    $.event('CustomSiteThemeChanged');
  },

  open(openSection: string) {
    let dialog, sectionToOpen;
    if (Settings.dialog) { return; }
    $.event('CloseMenu');

    // id `xt-settings-overlay` avoids a collision with StyleChan, which also
    // injects an `<div id="overlay">` and would otherwise tear our dialog out
    // of the DOM when its show()/close() called `document.getElementById`.
    Settings.dialog = (dialog = $.el('div',
      { id: 'xt-settings-overlay' }
      , SettingsPage()));
    const settingsWindow = $('#fourchanx-settings', dialog) as HTMLDivElement;

    $.on($('.export', dialog), 'click', e => { e.preventDefault(); Settings.export(); Settings.closeFooterActions(); });
    $.on($('.import', dialog), 'click', e => { e.preventDefault(); Settings.import.call(e.currentTarget); Settings.closeFooterActions(); });
    $.on($('.reset',  dialog), 'click', e => { e.preventDefault(); Settings.reset(); Settings.closeFooterActions(); });
    $.on($('input[type=file]', dialog), 'change', Settings.onImport);
    $.on($('.settings-search input', dialog), 'input', Settings.onSearchInput);
    $.on($('.expand-all',   dialog), 'click', e => { e.preventDefault(); Settings.toggleAllDetails(true); });
    $.on($('.collapse-all', dialog), 'click', e => { e.preventDefault(); Settings.toggleAllDetails(false); });
    $.on($('.accordion-toggle', dialog), 'click', e => { e.preventDefault(); Settings.toggleAccordion(); });
    for (const btn of $$('.settings-nav-scroll', dialog) as HTMLElement[]) {
      $.on(btn, 'click', e => {
        e.preventDefault();
        e.stopPropagation();
        Settings.scrollHorizontalNav(settingsWindow, btn.classList.contains('settings-nav-scroll-left') ? -1 : 1);
      });
      $.on(btn, 'touchstart mousedown', e => e.stopPropagation());
    }
    $.on($('.settings-nav-toggle', dialog), 'click', e => {
      e.preventDefault();
      e.stopPropagation();
      Settings.toggleCollapsedNav();
    });
    $.on($('.settings-footer-menu-toggle', dialog), 'click', e => {
      e.preventDefault();
      e.stopPropagation();
      Settings.toggleFooterActions();
    });
    $.on($('.move', settingsWindow), 'touchstart mousedown', Settings.prepareDrag);
    // Window-manager z-order: clicking the settings window raises it above any
    // detached panels (its siblings in the overlay).
    $.on(settingsWindow, 'mousedown', () => Settings.raiseToFront(settingsWindow));
    $.on($('#settings-remember-layout', dialog), 'change', Settings.onRememberLayoutChange);
    $.on($('#settings-highlight-next', dialog), 'change', Settings.onHighlightNextChange);
    for (const actionEl of $$('.settings-titlebar-actions > *', settingsWindow)) {
      $.on(actionEl, 'touchstart mousedown', e => e.stopPropagation());
    }

    const links: HTMLAnchorElement[] = [];
    let defaultLink;
    for (const section of Settings.sections) {
      const link = $.el('a', {
        className: `tab-${section.hyphenatedTitle}`,
        textContent: section.title,
        href: '#'
      }
      );
      // Links live in the draggable titlebar (horizontal layout), so a drag
      // that starts on a link moves the window. Track the pointer-down position
      // and treat the click as a drag (don't navigate) if it moved past a few px.
      let downX: number | null = null, downY: number | null = null;
      $.on(link, 'mousedown', e => { downX = e.clientX; downY = e.clientY; });
      $.on(link, 'click', e => {
        e.preventDefault();
        if (downX !== null && downY !== null && (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4)) {
          downX = downY = null;
          return;
        }
        downX = downY = null;
        Settings.openSection.call(section);
        Settings.closeCollapsedNav();
      });
      links.push(link);
      if (!defaultLink && section.title === 'General') defaultLink = link;
      if (
        section.title === openSection
        || (['Filter', 'Filters', 'Simple Filters', 'Filtering'].includes(openSection) && section.title === 'Filters')
        || (openSection === 'Main' && section.title === 'General')
      ) { sectionToOpen = link; }
    }
    $.add($('.sections-list', dialog), links);
    // Search and section tabs can live in the draggable titlebar; stop their
    // pointer starts so text selection and horizontal tab scrolling work.
    $.on($('.settings-search', dialog), 'touchstart mousedown', e => e.stopPropagation());
    $.on($('.sections-list', dialog), 'touchstart mousedown', e => e.stopPropagation());
    $.on($('.sections-list', dialog), 'scroll', () => Settings.updateHorizontalNavOverflow(settingsWindow));
    Settings.enableHorizontalNavDrag($('.sections-list', dialog) as HTMLElement);
    Settings.setNavLayout(settingsWindow, Conf['Settings Menu Layout']);
    // Opening on "All Settings" eagerly renders every section, which is
    // noticeably slower in Firefox. Default to the lightweight General view
    // unless the caller explicitly requested another section.
    const initialLink = sectionToOpen || defaultLink || links[0];
    if (openSection !== 'none') { initialLink.click(); }

    Icon.set($('.close', dialog), 'xmark');
    $.on($('.close', dialog), 'click', e => { e.preventDefault(); Settings.close(); });
    $.on(window, 'beforeunload', Settings.close);
    $.on(dialog, 'mousedown touchstart', e => {
      const target = e.target as Node;
      Settings.pointerDownInsideDialog = settingsWindow.contains(target);
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
    $.on(settingsWindow, 'click', e => {
      if (Settings.onDescriptionLabelTap(e)) return;
      Settings.closeMobileDescription();
      Settings.closeCollapsedNavForClick(e);
      Settings.closeFooterActionsForClick(e);
      e.stopPropagation();
    });

    $.add(d.body, dialog);
    Settings.restoreWindowLayout(settingsWindow);
    Settings.watchSettingsNavWidth(settingsWindow);
    Settings.applyResponsiveNavLayout(settingsWindow);
    initialLink?.focus();
    Settings.loadLayoutPrefs();

    $.event('OpenSettings', null, dialog);
  },

  close() {
    if (!Settings.dialog) { return; }
    // Unfocus current field to trigger change event.
    (d.activeElement as HTMLElement)?.blur();
    // Persist any pending Simple Filters auto-save before the panel is torn down.
    Settings.easyFiltersFlush?.();
    Settings.easyFiltersFlush = null;
    if (Settings.rememberLayout) {
      Settings.persistCurrentDetailsState();
      const settingsWindow = $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null;
      if (settingsWindow) Settings.saveWindowLayout(settingsWindow);
    }
    Settings.closeImpExpPicker();
    Settings.restoreAutoDescriptionTooltips();
    Settings.closeFooterActions();
    // The settings page node is a reused singleton, so the search field keeps
    // its value across opens. Clear it (and the derived search state) so a
    // stale query doesn't re-highlight matches on the next open.
    const searchInput = $('.settings-search input', Settings.dialog) as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';
    SearchHighlight.clear(SETTINGS_SEARCH_HL);
    Settings.settingsNavResizeObserver?.disconnect();
    Settings.settingsNavResizeObserver = null;
    if (Settings.settingsNavResizeFallback) {
      $.off(window, 'resize', Settings.settingsNavResizeFallback);
      Settings.settingsNavResizeFallback = null;
    }
    $.rm(Settings.dialog);
    // The overlay (and every detached panel inside it) is gone now; drop the
    // registry so the next open starts with no stale detach controllers.
    Settings.detached = Object.create(null);
    Settings.searchQuery = '';
    Settings.searchTerms = [];
    Settings.activeSection = null;
    Settings.renderedSection = null;
    Settings.rememberLayout = false;
    Settings.savedWindowLayout = '';
    Settings.detailsState = dict();
    Settings.customCSSEditorThemeObserver?.disconnect();
    Settings.customCSSEditorThemeObserver = null;
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

  toggleAllDetails(open: boolean) {
    if (!Settings.dialog) return;
    // Accordion mode is, by definition, one-open-at-a-time, so an "expand all"
    // is a contradiction the browser would override anyway. Ignore it loudly
    // (the button is dimmed in CSS) rather than flashing every panel open.
    if (open && Settings.accordionMode) return;
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

  toggleAccordion() {
    Settings.setAccordionMode(!Settings.accordionMode);
  },

  setAccordionMode(on: boolean) {
    Settings.accordionMode = on;
    $.set('settings.accordionMode', on);
    Settings.syncAccordionButton();
    const section = Settings.dialog && $('section', Settings.dialog);
    if (section) {
      Settings.applyAccordionMode(section as HTMLElement);
      // Turning accordion off opens every top-level panel so the change is
      // immediately visible: the lone-open constraint is gone and everything
      // is now expandable at once.
      if (!on) Settings.expandTopLevelPanels(section as HTMLElement);
    }
  },

  // Open every top-level <details> panel in each container (the lone section,
  // or every block in "All Settings"), mirroring the scope the accordion groups.
  // Nested <details> are left as-is. Persists the resulting layout when needed.
  expandTopLevelPanels(section: HTMLElement) {
    const blocks = $$('.settings-section-content', section) as HTMLElement[];
    const containers = blocks.length ? blocks : [section];
    for (const container of containers) {
      for (const el of [...container.children] as HTMLElement[]) {
        if (el.tagName === 'DETAILS') (el as HTMLDetailsElement).open = true;
      }
    }
    if (Settings.rememberLayout) {
      Settings.persistCurrentDetailsState();
      $.set('settings.detailsState', Settings.detailsState);
    }
  },

  syncAccordionButton() {
    if (!Settings.dialog) return;
    const btn = $('.accordion-toggle', Settings.dialog) as HTMLElement | null;
    if (!btn) return;
    btn.classList.toggle('accordion-active', Settings.accordionMode);
    btn.setAttribute('aria-pressed', Settings.accordionMode ? 'true' : 'false');
    const actions = $('.settings-titlebar-actions', Settings.dialog) as HTMLElement | null;
    if (actions) actions.classList.toggle('accordion-on', Settings.accordionMode);
  },

  // Accordion = native exclusive <details>. Giving each top-level panel in a
  // container a shared `name` makes the browser keep at most one open. Nested
  // <details> (filters, sub-groups) are left alone so they collapse normally
  // inside whichever panel is open. Each container (the lone section, or every
  // block in "All Settings") gets its own group so blocks stay independent.
  applyAccordionMode(section: HTMLElement) {
    if (!section) return;
    // While searching, panels are revealed/hidden by class; exclusive grouping
    // would fight that by force-collapsing a panel that holds a match. Suspend
    // grouping for the duration of the query (re-applied on the post-search
    // re-render). The mode flag itself is untouched.
    const active = Settings.accordionMode && !Settings.searchQuery;
    // All top-level <details> in the rendered view: a section's own panels, or
    // every section block on the All Settings page. They form ONE exclusive
    // group, so accordion keeps a single panel open per individual section and a
    // single panel open across the whole All Settings page.
    const blocks = $$('.settings-section-content', section) as HTMLElement[];
    const containers = blocks.length ? blocks : [section];
    const allDetails: HTMLDetailsElement[] = [];
    for (const container of containers) {
      for (const el of [...container.children] as HTMLElement[]) {
        if (el.tagName === 'DETAILS') allDetails.push(el as HTMLDetailsElement);
      }
    }
    if (!active) {
      for (const panel of allDetails) panel.removeAttribute('name');
      return;
    }
    // Hidden panels (e.g. General's normally-empty Warnings box, which is
    // `hidden` + `open`) are excluded: letting one occupy the single "open" slot
    // would leave the page looking collapsed with nothing visible.
    const panels = allDetails.filter(p => !p.hidden);
    // Collapse to one open panel before grouping so the browser doesn't pick
    // arbitrarily; if none are open (e.g. General), open the first so the view
    // always shows one panel instead of a wall of collapsed summaries.
    let kept = false;
    for (const panel of panels) {
      if (panel.open && !kept) { kept = true; }
      else if (panel.open) { panel.open = false; }
    }
    if (!kept && panels.length) panels[0].open = true;
    for (const panel of panels) panel.setAttribute('name', 'xt-accordion');
    // Hidden panels stay out of the group so they don't silently steal the slot.
    for (const panel of allDetails) if (panel.hidden) panel.removeAttribute('name');
  },

  loadLayoutPrefs() {
    if (!Settings.dialog) return;
    $.get({
      'settings.rememberLayout': false,
      'settings.highlightNext': false,
      'settings.accordionMode': false,
      'settings.windowLayout': '',
      'settings.detailsState': dict(),
    }, (prefs: Record<string, any>) => {
      if (!Settings.dialog) return;
      Settings.rememberLayout = !!prefs['settings.rememberLayout'];
      Settings.highlightNext = !!prefs['settings.highlightNext'];
      Settings.accordionMode = !!prefs['settings.accordionMode'];
      Settings.syncAccordionButton();
      const highlightToggle = $('#settings-highlight-next', Settings.dialog) as HTMLInputElement | null;
      if (highlightToggle) highlightToggle.checked = Settings.highlightNext;
      Settings.applyNextHighlight();
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
          Settings.applyAccordionMode(section);
        }
      }
    });
  },

  // Mark each setting row neXT added/changed vs upstream 4chan-X. Runs on every
  // section render so the CSS-driven highlight is ready the moment it's toggled.
  // Pick which element to highlight for a setting field. Standard rows wrap the
  // field in a `[data-name]` div that IS the key — use that (so the badge lands
  // on its .setting-title). Custom-template controls (Styling/Advanced) and
  // composite rows have no per-key wrapper; their nearest `[data-name]` is a
  // group/section, so highlight the field's own `<label>` row instead.
  nextRowForField(field: HTMLElement): HTMLElement | null {
    const named = field.closest('[data-name]') as HTMLElement | null;
    if (named && nextStatusOf(named.dataset.name || '')) return named;
    return (field.closest('label') as HTMLElement | null) || named;
  },

  // The title-text element a collapsed-section badge should hang off. Styling
  // summaries already isolate their title in a `.styling-section-summary-text`
  // span; plain summaries hold a bare text node, so wrap it once in a
  // `.next-summary-title` span (find-or-create, idempotent) that the badge and
  // the search highlighter can both target without touching the caret.
  nextBadgeTitle(summary: HTMLElement): HTMLElement {
    const existing = summary.querySelector(
      ':scope .styling-section-summary-text, :scope > .next-summary-title') as HTMLElement | null;
    if (existing) return existing;
    const title = $.el('span', { className: 'next-summary-title' });
    // Wrap only the title text. Action elements and the SFW/NSFW variant badge
    // (.styling-variant-badge, inserted earlier by updateVariantDecoration) must
    // stay as direct children of the flex <summary>: their CSS targets
    // `summary > …`, so sweeping them into this span would strip the variant
    // badge of its box and glue its text onto the title (e.g. "HighlightsNSFW").
    const isAside = (node: ChildNode) =>
      node instanceof HTMLElement
      && node.matches('button, input, select, textarea, label, .styling-variant-badge, [data-summary-action]');
    const anchor = ([...summary.childNodes].find(isAside) as ChildNode | undefined) || null;
    for (const node of [...summary.childNodes]) {
      if (!isAside(node)) title.appendChild(node);
    }
    summary.insertBefore(title, anchor);
    return title;
  },

  tagNextSettings(root: HTMLElement | null) {
    if (!root) return;
    for (const el of $$('[data-next-status]', root) as HTMLElement[]) delete el.dataset.nextStatus;
    // Standard rows: the wrapper's data-name is exactly one setting key.
    for (const el of $$('[data-name]', root) as HTMLElement[]) {
      const status = nextStatusOf(el.dataset.name || '');
      if (status) el.dataset.nextStatus = status;
    }
    // Match each field by its exact `name` attribute, then highlight its row.
    // Exact matching avoids ambiguity when one key is a word-prefix of another
    // (e.g. "Comment Preview" vs "Comment Preview Position"). "added" outranks
    // "changed" when a row mixes both.
    for (const field of $$('[name]', root) as HTMLElement[]) {
      const status = nextStatusOf(field.getAttribute('name') || '');
      if (!status) continue;
      const row = Settings.nextRowForField(field);
      if (row && row.dataset.nextStatus !== 'added') row.dataset.nextStatus = status;
    }
    // Custom template-only UI that does not map cleanly to a single persisted
    // setting key can opt into the same visual treatment. A manually-tagged
    // <summary> (e.g. Advanced's "Thread updater sound", same upstream name but
    // rewritten) routes through nextBadgeTitle for the same reason the collapse
    // path does: the badge must sit on the title span, not the bare summary,
    // or it lands at the far edge atop the disclosure caret.
    for (const el of $$('[data-next-manual-status]', root) as HTMLElement[]) {
      const status = el.dataset.nextManualStatus;
      if (status !== 'added' && status !== 'changed') continue;
      const target = el.tagName === 'SUMMARY' ? Settings.nextBadgeTitle(el) : el;
      target.dataset.nextStatus = status;
    }
    // Collapse a fully-neXT <details> section to one header badge: when every
    // setting row inside is neXT-added, badge the <summary> and drop the per-row
    // statuses so a whole new section (e.g. "Comment Preview") reads as a single
    // badge instead of a wall of them. Parent-before-child document order means an
    // outer section clears its descendants first, so nested sections don't double-
    // badge. Mixed sections keep their per-row badges (every() is false).
    for (const details of $$('details', root) as HTMLElement[]) {
      const summary = details.querySelector(':scope > summary') as HTMLElement | null;
      if (!summary) continue;
      // A section explicitly declared fully-neXT (e.g. Highlights, where some
      // rows are upstream-changed rather than neXT-added so the every()-added
      // check below never fires) collapses to one header badge regardless of
      // per-row status: badge the title span and clear every descendant status.
      const manualSection = details.dataset.nextSection;
      if (manualSection === 'added' || manualSection === 'changed') {
        for (const r of $$('[data-next-status]', details) as HTMLElement[]) delete r.dataset.nextStatus;
        Settings.nextBadgeTitle(summary).dataset.nextStatus = manualSection;
        continue;
      }
      const rows = ($$('[data-name]', details) as HTMLElement[]).filter(r => r.dataset.name);
      if (rows.length && rows.every(r => r.dataset.nextStatus === 'added')) {
        // Anchor the badge on the title-text span, not the bare <summary>: the
        // summary is a justify-content:space-between flex row and its ::after is
        // already the disclosure caret, so a summary-level badge would land at
        // the far edge and collide with the caret. Sitting on the title span
        // keeps it right beside the section name. See nextBadgeTitle().
        Settings.nextBadgeTitle(summary).dataset.nextStatus = 'added';
        for (const r of rows) delete r.dataset.nextStatus;
      }
    }
  },

  applyNextHighlight() {
    const settingsWindow = $('#fourchanx-settings', Settings.dialog || d) as HTMLElement | null;
    if (settingsWindow) settingsWindow.classList.toggle('highlight-next-settings', Settings.highlightNext);
  },

  onHighlightNextChange(this: HTMLInputElement) {
    const enabled = (this as HTMLInputElement).checked;
    Settings.highlightNext = enabled;
    $.set('settings.highlightNext', enabled);
    Settings.applyNextHighlight();
  },

  onRememberLayoutChange(this: HTMLInputElement) {
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

  // Reposition the search box and section links between the left sidebar,
  // titlebar, and narrow-width hamburger dropdown. The saved layout remains a
  // desktop preference; collapsed nav is an automatic presentation override.
  setNavLayout(settingsWindow: HTMLDivElement, layout: string) {
    settingsWindow.dataset.navLayout = layout || 'vertical';
    Settings.applyResponsiveNavLayout(settingsWindow);
  },

  applyResponsiveNavLayout(settingsWindow: HTMLDivElement) {
    const titlebar = $('.settings-titlebar', settingsWindow);
    const actions = $('.settings-titlebar-actions', settingsWindow);
    const navToggle = $('.settings-nav-toggle', settingsWindow);
    const navScrollLeft = $('.settings-nav-scroll-left', settingsWindow);
    const navScrollRight = $('.settings-nav-scroll-right', settingsWindow);
    const nav = $('.settings-body > nav', settingsWindow);
    const search = $('.settings-search', settingsWindow);
    const sectionsList = $('.sections-list', settingsWindow);
    if (!titlebar || !actions || !navToggle || !navScrollLeft || !navScrollRight || !nav || !search || !sectionsList) return;
    const layout = settingsWindow.dataset.navLayout || 'vertical';
    const width = settingsWindow.getBoundingClientRect().width || doc.clientWidth;
    const collapsed = width <= SETTINGS_COLLAPSED_NAV_WIDTH;
    const compact = width <= SETTINGS_COMPACT_CONTENT_WIDTH;
    const wasCollapsed = settingsWindow.classList.contains('settings-nav-collapsed');
    settingsWindow.classList.toggle('settings-compact-content', compact);
    settingsWindow.classList.toggle('settings-nav-collapsed', collapsed);
    if (collapsed && !wasCollapsed) Settings.autoEnableDescriptionTooltips();
    if (!collapsed && wasCollapsed) Settings.restoreAutoDescriptionTooltips();
    if (collapsed) {
      actions.insertBefore(search, navToggle.nextSibling);
      nav.appendChild(sectionsList);
      $.rmClass(settingsWindow, 'settings-nav-horizontal');
    } else if (layout === 'horizontal') {
      titlebar.insertBefore(search, actions);
      titlebar.insertBefore(navScrollLeft, actions);
      titlebar.insertBefore(sectionsList, actions);
      titlebar.insertBefore(navScrollRight, actions);
      $.addClass(settingsWindow, 'settings-nav-horizontal');
    } else {
      titlebar.insertBefore(search, actions);
      nav.appendChild(sectionsList);
      $.rmClass(settingsWindow, 'settings-nav-horizontal');
    }
    if (!collapsed) Settings.closeCollapsedNav(settingsWindow);
    if (!compact) Settings.closeFooterActions(settingsWindow);
    Settings.syncCollapsedNavButton(settingsWindow);
    Settings.syncFooterActionsButton(settingsWindow);
    Settings.updateHorizontalNavOverflow(settingsWindow);
    Settings.applyDescriptionMode();
  },

  watchSettingsNavWidth(settingsWindow: HTMLDivElement) {
    Settings.settingsNavResizeObserver?.disconnect();
    if (Settings.settingsNavResizeFallback) {
      $.off(window, 'resize', Settings.settingsNavResizeFallback);
      Settings.settingsNavResizeFallback = null;
    }
    const update = () => Settings.applyResponsiveNavLayout(settingsWindow);
    if (typeof ResizeObserver !== 'undefined') {
      Settings.settingsNavResizeObserver = new ResizeObserver(update);
      Settings.settingsNavResizeObserver.observe(settingsWindow);
      return;
    }
    Settings.settingsNavResizeFallback = update;
    $.on(window, 'resize', update);
  },

  toggleCollapsedNav() {
    const settingsWindow = Settings.dialog && $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null;
    if (!settingsWindow || !settingsWindow.classList.contains('settings-nav-collapsed')) return;
    settingsWindow.classList.toggle('settings-nav-open');
    Settings.syncCollapsedNavButton(settingsWindow);
  },

  closeCollapsedNav(settingsWindow?: HTMLDivElement | null) {
    settingsWindow = settingsWindow || (Settings.dialog && $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null);
    if (!settingsWindow) return;
    settingsWindow.classList.remove('settings-nav-open');
    Settings.syncCollapsedNavButton(settingsWindow);
  },

  closeCollapsedNavForClick(e: Event) {
    const settingsWindow = Settings.dialog && $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null;
    const target = e.target as Element | null;
    if (!settingsWindow || !target || !settingsWindow.classList.contains('settings-nav-collapsed')) return;
    if (target.closest('.settings-nav-toggle') || target.closest('.settings-body > nav')) return;
    Settings.closeCollapsedNav(settingsWindow);
  },

  syncCollapsedNavButton(settingsWindow: HTMLDivElement) {
    const toggle = $('.settings-nav-toggle', settingsWindow) as HTMLElement | null;
    if (!toggle) return;
    const expanded = settingsWindow.classList.contains('settings-nav-open');
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  },

  toggleFooterActions() {
    const settingsWindow = Settings.dialog && $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null;
    if (!settingsWindow || !settingsWindow.classList.contains('settings-compact-content')) return;
    const menu = $('.settings-footer-menu', settingsWindow) as HTMLElement | null;
    if (!menu) return;
    menu.classList.toggle('settings-footer-menu-open');
    Settings.syncFooterActionsButton(settingsWindow);
  },

  closeFooterActions(settingsWindow?: HTMLElement | null) {
    settingsWindow = settingsWindow || (Settings.dialog && $('#fourchanx-settings', Settings.dialog) as HTMLElement | null);
    if (!settingsWindow) return;
    $('.settings-footer-menu', settingsWindow)?.classList.remove('settings-footer-menu-open');
    Settings.syncFooterActionsButton(settingsWindow as HTMLDivElement);
  },

  closeFooterActionsForClick(e: Event) {
    const settingsWindow = Settings.dialog && $('#fourchanx-settings', Settings.dialog) as HTMLElement | null;
    const target = e.target as Element | null;
    if (!settingsWindow || !target) return;
    if (target.closest('.settings-footer-menu')) return;
    Settings.closeFooterActions(settingsWindow);
  },

  syncFooterActionsButton(settingsWindow: HTMLDivElement) {
    const menu = $('.settings-footer-menu', settingsWindow) as HTMLElement | null;
    const toggle = $('.settings-footer-menu-toggle', settingsWindow) as HTMLButtonElement | null;
    if (!menu || !toggle) return;
    const expanded = menu.classList.contains('settings-footer-menu-open');
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  },

  updateHorizontalNavOverflow(settingsWindow: HTMLDivElement) {
    const sectionsList = $('.settings-titlebar > .sections-list', settingsWindow) as HTMLElement | null;
    if (!sectionsList || !settingsWindow.classList.contains('settings-nav-horizontal')) {
      settingsWindow.classList.remove('settings-nav-overflow-left', 'settings-nav-overflow-right');
      return;
    }
    settingsWindow.classList.remove('settings-nav-overflow-left', 'settings-nav-overflow-right');
    const maxScroll = sectionsList.scrollWidth - sectionsList.clientWidth;
    settingsWindow.classList.toggle('settings-nav-overflow-left', sectionsList.scrollLeft > 1);
    settingsWindow.classList.toggle('settings-nav-overflow-right', maxScroll > 1 && sectionsList.scrollLeft < maxScroll - 1);
  },

  scrollHorizontalNav(settingsWindow: HTMLDivElement, direction = 1) {
    const sectionsList = $('.settings-titlebar > .sections-list', settingsWindow) as HTMLElement | null;
    if (!sectionsList) return;
    sectionsList.scrollBy({
      left: direction * Math.max(120, Math.round(sectionsList.clientWidth * 0.7)),
      behavior: 'smooth',
    });
    window.setTimeout(() => Settings.updateHorizontalNavOverflow(settingsWindow), 250);
  },

  enableHorizontalNavDrag(sectionsList: HTMLElement) {
    let pointerId: number | null = null;
    let startX = 0;
    let startScrollLeft = 0;
    let moved = false;
    let captured = false;

    sectionsList.addEventListener('click', e => {
      if (sectionsList.dataset.suppressClick !== 'true') return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    $.on(sectionsList, 'pointerdown', e => {
      const pe = e as PointerEvent;
      const settingsWindow = Settings.dialog && $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null;
      if (!settingsWindow?.classList.contains('settings-nav-horizontal')) return;
      pointerId = pe.pointerId;
      startX = pe.clientX;
      startScrollLeft = sectionsList.scrollLeft;
      moved = false;
      captured = false;
    });

    $.on(sectionsList, 'pointermove', e => {
      const pe = e as PointerEvent;
      if (pointerId !== pe.pointerId) return;
      const dx = pe.clientX - startX;
      if (!moved && Math.abs(dx) > 3) {
        moved = true;
        captured = true;
        sectionsList.classList.add('sections-list-dragging');
        sectionsList.setPointerCapture?.(pe.pointerId);
      }
      if (!moved) return;
      pe.preventDefault();
      sectionsList.scrollLeft = startScrollLeft - dx;
      const settingsWindow = Settings.dialog && $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null;
      if (settingsWindow) Settings.updateHorizontalNavOverflow(settingsWindow);
    });

    const endDrag = (e: Event) => {
      const pe = e as PointerEvent;
      if (pointerId !== pe.pointerId) return;
      if (captured) sectionsList.releasePointerCapture?.(pe.pointerId);
      pointerId = null;
      captured = false;
      sectionsList.classList.remove('sections-list-dragging');
      if (!moved) return;
      sectionsList.dataset.suppressClick = 'true';
      window.setTimeout(() => { delete sectionsList.dataset.suppressClick; }, 0);
    };
    $.on(sectionsList, 'pointerup pointercancel', endDrag);
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

  detailStateScope(root: HTMLElement, sectionInfo: SectionInfo | null) {
    let sectionTitle = sectionInfo?.title || '';
    if (sectionTitle === 'All Settings') {
      const block = root.closest('.settings-section-block') as HTMLElement | null;
      sectionTitle = block ? $('.settings-section-header', block)?.textContent?.trim() || '' : '';
    }
    // Use the same scope key for both "All Settings" and single-section views
    // so collapse state stays in sync across both places.
    return `section:${sectionTitle}`;
  },

  detailsStateKey(details: HTMLDetailsElement, sectionInfo: SectionInfo | null) {
    const root = details.parentElement as HTMLElement | null;
    if (!root) return '';
    const scope = Settings.detailStateScope(root, sectionInfo);
    const summary = details.querySelector('summary')?.textContent?.trim() || '';
    const peers = $$('details', root)
      .filter(peer => (peer.querySelector('summary')?.textContent?.trim() || '') === summary);
    const index = Math.max(0, peers.indexOf(details));
    return `${scope}|${summary}|${index}`;
  },

  decorateDetailsWithKeys(sectionRoot: HTMLElement, sectionInfo: SectionInfo | null, applyRememberedState = true) {
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
      $.on(details, 'toggle', function(this: HTMLDetailsElement) {
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

  getActiveSection(): SectionInfo | null {
    const selectedTab = $('.tab-selected', Settings.dialog);
    if (!selectedTab) return null;
    for (const section of Settings.sections) {
      if (selectedTab.classList.contains(`tab-${section.hyphenatedTitle}`)) return section;
    }
    return null;
  },

  onSearchInput(this: HTMLInputElement) {
    Settings.searchQuery = (this as HTMLInputElement).value.toLowerCase().trim();
    Settings.searchTerms = Settings.searchQuery ? Settings.searchQuery.split(/\s+/) : [];
    if (Settings.searchQuery) {
      Settings.ensureAllSettingsRendered();
    } else {
      Settings.renderActiveSection();
    }
    Settings.applySearch();
  },

  // A haystack matches when every search term is found somewhere in it
  // (order-independent), so multi-word queries no longer need the words to
  // appear as one contiguous phrase. No terms means no match.
  matchesQuery(haystack: string): boolean {
    if (!Settings.searchTerms.length) return false;
    const text = haystack.toLowerCase();
    return Settings.searchTerms.every((term: string) => text.indexOf(term) >= 0);
  },

  applySearch() {
    if (!Settings.dialog) return;
    const query = Settings.searchQuery;
    const win = $('#fourchanx-settings', Settings.dialog);
    win.classList.toggle('settings-searching', !!query);
    if (query) Settings.closeMobileDescription();
    const section = $('section', Settings.dialog);
    if (!section) return;

    for (const el of $$('.settings-search-hidden', section)) {
      $.rmClass(el, 'settings-search-hidden');
    }
    for (const el of $$('.settings-search-keyword-match', section)) {
      $.rmClass(el, 'settings-search-keyword-match');
    }
    Settings.highlightSettingRow(section, query);

    if (!query) return;

    for (const el of $$('div[data-name], tr[data-name], details, .settings-group-heading, table, thead, tbody, summary, h4, .settings-section-block', section)) {
      $.addClass(el, 'settings-search-hidden');
    }

    for (const row of $$('div[data-name], tr[data-name]', section)) {
      const settingTitle = `${row.dataset.settingTitle || ''}`;
      const settingName = `${row.dataset.name || ''}`;
      const fullText = `${settingName} ${settingTitle} ${row.dataset.settingDescription || ''} ${row.textContent || ''}`;
      if (!Settings.matchesQuery(fullText)) continue;

      const rowEl = row as HTMLElement;
      Settings.revealSearchMatch(rowEl, section);
      // The row matched, but the match may be on a hidden field (data-name)
      // with nothing visible highlighted; flag it so the match isn't a mystery.
      // (The highlight is painted ranges now, not <mark> nodes, so probe the
      // visible text directly rather than looking for a marker element.)
      rowEl.classList.toggle('settings-search-keyword-match', !Settings.hasVisibleMatch(rowEl));

      // Only reveal descendant rider settings when the setting's title itself
      // matched, to avoid broad description matches expanding unrelated rows.
      const titleMatched = Settings.matchesQuery(`${settingName} ${settingTitle}`);
      if (!titleMatched) continue;
      for (const sublist of $$('.suboption-list', rowEl)) {
        for (const rider of $$('div[data-name], tr[data-name]', sublist)) {
          Settings.revealSearchMatch(rider as HTMLElement, section);
        }
      }
    }

    for (const el of $$('summary, th, h4', section)) {
      if (!Settings.matchesQuery(el.textContent || '')) continue;
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

  matchesSectionTitle(text: string, _query?: string): boolean {
    if (!text || !Settings.searchTerms.length) return false;
    // Every term must hit the title as a whole word (order-independent), so a
    // multi-word query matches regardless of word order.
    return Settings.searchTerms.every((term: string) =>
      RegExp(`\\b${Settings.escapeRegExp(term)}\\b`, 'i').test(text));
  },

  revealSearchMatch(node: Element | null, root: Element) {
    let cur: Element | null = node;
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

  // Visible text elements within `root` that a search term can be highlighted in.
  // Styling summaries carry an injected section toggle plus a dedicated
  // `.styling-section-summary-text` span for their title; highlight that span,
  // not the bare summary, so the two don't paint the same text twice.
  highlightableEls(root: ParentNode) {
    return $$(SEARCH_HIGHLIGHT_SELECTOR, root as HTMLElement).filter(el =>
      !((el as HTMLElement).tagName === 'SUMMARY'
        && el.querySelector('.styling-section-summary-text, .next-summary-title')));
  },

  // True when any search term appears in the row's visible text (as opposed to
  // matching only a hidden data-name field), so the row's match is self-evident.
  hasVisibleMatch(rowEl: HTMLElement) {
    if (!Settings.searchTerms.length) return false;
    return Settings.highlightableEls(rowEl).some((el: Element) => {
      const text = (el.textContent || '').toLowerCase();
      return Settings.searchTerms.some((term: string) => text.indexOf(term) >= 0);
    });
  },

  highlightSettingRow(root: ParentNode, _query?: string) {
    const els = Settings.highlightableEls(root);
    // Preferred path: paint matches with the CSS Custom Highlight API, which
    // covers every matching term (order-independent) without touching the DOM —
    // no <mark> nodes, no flex-layout span wrappers, no text save/restore.
    if (SearchHighlight.supported) {
      SearchHighlight.apply(SETTINGS_SEARCH_HL, els, Settings.searchTerms);
      return;
    }
    // Legacy fallback for browsers without the Highlight API: wrap matches in
    // <mark>, stashing the original text so an empty query can restore it.
    const rx = Settings.searchTerms.length
      ? RegExp(`(${Settings.searchTerms.map((t: string) => Settings.escapeRegExp(t)).join('|')})`, 'ig')
      : null;
    for (const el of els) {
      const source = (el as HTMLElement).dataset.rawText ?? el.textContent ?? '';
      (el as HTMLElement).dataset.rawText = source;
      if (rx) {
        // Summaries (and other headers) are `display:flex` rows; injecting the
        // bare marked text would split the title into several flex items that
        // `justify-content:space-between` spreads apart. Keep it as one inline
        // unit by wrapping the highlighted text in a single span.
        el.innerHTML = `<span class="settings-search-text">${source.replace(rx, '<mark>$1</mark>')}</span>`;
      } else {
        el.textContent = source;
      }
    }
  },

  escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  sections: [] as SectionInfo[],

  addSection(title: string | { detail: { title: string; open: SectionInfo['open'] } }, open?: SectionInfo['open']) {
    if (typeof title !== 'string') {
      ({title, open} = title.detail);
    }
    const hyphenatedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    Settings.sections.push({title, hyphenatedTitle, open});
  },

  openSection(this: { title: string }) {
    Settings.activeSection = this;
    Settings.selectSectionTab(this);
    if (Settings.searchQuery && this.title !== 'All Settings') {
      Settings.ensureAllSettingsRendered();
      Settings.applySearch();
      return;
    }
    Settings.renderSection(this);
  },

  selectSectionTab(sectionInfo: SectionInfo) {
    let selected;
    if (selected = $('.tab-selected', Settings.dialog)) {
      $.rmClass(selected, 'tab-selected');
    }
    $.addClass($(`.tab-${sectionInfo.hyphenatedTitle}`, Settings.dialog), 'tab-selected');
  },

  getAllSettingsSection() {
    return Settings.sections.find((section: SectionInfo) => section.title === 'All Settings') || null;
  },

  ensureAllSettingsRendered() {
    const allSettingsSection = Settings.getAllSettingsSection();
    if (!allSettingsSection) return;
    if (Settings.renderedSection === allSettingsSection) return;
    Settings.renderSection(allSettingsSection);
  },

  ensureAutosaveTextareaShell(textarea: HTMLTextAreaElement) {
    let shell = textarea.parentElement as HTMLElement | null;
    if (!shell || !shell.classList.contains('settings-textarea-shell')) {
      shell = $.el('div', { className: 'settings-textarea-shell' }) as HTMLElement;
      textarea.parentNode!.insertBefore(shell, textarea);
      $.add(shell, textarea);
    }
    if (!$('.settings-textarea-saved', shell)) {
      const badge = $.el('div', { className: 'settings-textarea-saved', textContent: 'Saved' }) as HTMLElement;
      badge.setAttribute('aria-hidden', 'true');
      $.add(shell, badge);
    }
    return shell;
  },

  flashAutosaveTextareaSaved(textarea: HTMLTextAreaElement) {
    const shell = textarea.parentElement as HTMLElement | null;
    const badge = shell?.classList.contains('settings-textarea-shell')
      ? $('.settings-textarea-saved', shell) as HTMLElement | null
      : null;
    if (!badge) return;
    badge.dataset.show = 'true';
    const timer = Settings.textareaSavedFlashTimers.get(textarea);
    if (timer) clearTimeout(timer);
    Settings.textareaSavedFlashTimers.set(textarea, window.setTimeout(() => {
      badge.dataset.show = 'false';
      Settings.textareaSavedFlashTimers.delete(textarea);
    }, 900));
  },

  bindAutosaveTextareaSaveKey(textarea: HTMLTextAreaElement) {
    if (textarea.dataset.autosaveSaveKeyBound === 'true') return;
    textarea.dataset.autosaveSaveKeyBound = 'true';
    $.on(textarea, 'keydown', (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || (e.key !== 's' && e.key !== 'S')) return;
      e.preventDefault();
      e.stopPropagation();
      $.event('change', null, textarea);
    });
  },

  bindAutosaveTextareaSavedFlash(textarea: HTMLTextAreaElement) {
    if (textarea.dataset.autosaveSavedFlashBound === 'true') return;
    textarea.dataset.autosaveSavedFlashBound = 'true';
    $.on(textarea, 'change', () => Settings.flashAutosaveTextareaSaved(textarea));
  },

  // Settings textareas already save on `change`. Add the same "Saved" flash and
  // Ctrl/Cmd+S save shortcut Custom CSS has, plus the full-width resize handle.
  // Custom CSS is excluded because it has its own editor chrome.
  prepareAutosaveTextarea(textarea: HTMLTextAreaElement | null) {
    if (!textarea || textarea.classList.contains('custom-css-textarea')) return;
    const shell = Settings.ensureAutosaveTextareaShell(textarea);
    Settings.bindAutosaveTextareaSaveKey(textarea);
    Settings.bindAutosaveTextareaSavedFlash(textarea);

    const existing = shell.nextElementSibling as HTMLElement | null;
    if (existing && existing.classList.contains('settings-textarea-resizer')) return;

    $.addClass(textarea, 'has-custom-resizer');
    const handle = $.el('div', {
      className: 'settings-textarea-resizer',
      title: 'Drag to resize'
    });

    $.on(handle, 'pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = textarea.offsetHeight;
      $.addClass(handle, 'dragging');

      const onMove = (ev: PointerEvent) => {
        textarea.style.height = `${Math.max(28, startHeight + (ev.clientY - startY))}px`;
      };
      const onUp = () => {
        $.rmClass(handle, 'dragging');
        $.off(d, 'pointermove', onMove);
        $.off(d, 'pointerup', onUp);
      };
      $.on(d, 'pointermove', onMove);
      $.on(d, 'pointerup', onUp);
    });

    $.after(shell, handle);
  },

  attachTextareaResizers(section: HTMLElement) {
    for (const ta of $$('textarea:not(.custom-css-textarea)', section) as HTMLTextAreaElement[]) {
      if (ta.hidden) continue;
      Settings.prepareAutosaveTextarea(ta);
    }
  },

  renderActiveSection() {
    const section = Settings.activeSection || Settings.getActiveSection() || Settings.sections[0];
    if (!section) return;
    Settings.renderSection(section);
  },

  renderSection(sectionInfo: SectionInfo) {
    const section = $('section', Settings.dialog);
    if (!section) return;
    const leavingStyling = Settings.renderedSection
      && Settings.renderedSection.hyphenatedTitle === 'styling'
      && sectionInfo.hyphenatedTitle !== 'styling';
    $.rmAll(section);
    section.className = `section-${sectionInfo.hyphenatedTitle}`;
    sectionInfo.open(section, g);
    Settings.attachTextareaResizers(section);
    Settings.decorateDetailsWithKeys(section, sectionInfo);
    Settings.applyAccordionMode(section);
    Settings.tagNextSettings(section);
    section.scrollTop = 0;
    Settings.renderedSection = sectionInfo;
    Settings.applyDescriptionMode(section);
    Settings.applySearch();
    $.event('OpenSettings', null, section);
    if (leavingStyling) Settings.stylingEditingVariant = null;
  },

  allSettings(section: HTMLElement) {
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
    localStorage(cb: (el: HTMLElement) => void) {
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
    ads(cb: (el: HTMLElement) => void) {
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
      const obj = Config.main[keyFS as keyof typeof Config.main];
      for (const key in obj) {
        const arr = obj[key as keyof typeof obj];
        if (Array.isArray(arr)) lookup[key] = arr;
      }
    }
    return lookup;
  },

  descriptionsAsTooltips(): boolean {
    return Conf['Settings Descriptions as Tooltips'] === true;
  },

  useDescriptionTooltips(_settingsWindow?: HTMLElement | null): boolean {
    return Settings.descriptionsAsTooltips();
  },

  autoEnableDescriptionTooltips() {
    if (!Settings.descriptionTooltipAutoActive) {
      Settings.descriptionTooltipAutoPrevious = Settings.descriptionsAsTooltips();
    }
    Settings.descriptionTooltipAutoActive = true;
    Conf['Settings Descriptions as Tooltips'] = true;
    Settings.syncDescriptionTooltipInputs(true);
  },

  restoreAutoDescriptionTooltips() {
    if (!Settings.descriptionTooltipAutoActive) return;
    const previous = Settings.descriptionTooltipAutoPrevious === true;
    Conf['Settings Descriptions as Tooltips'] = previous;
    Settings.descriptionTooltipAutoActive = false;
    Settings.descriptionTooltipAutoPrevious = null;
    Settings.syncDescriptionTooltipInputs(previous);
  },

  onDescriptionTooltipSettingChange(input: HTMLInputElement) {
    Settings.descriptionTooltipAutoActive = false;
    Settings.descriptionTooltipAutoPrevious = null;
    Settings.syncDescriptionTooltipInputs(input.checked);
    Settings.applyDescriptionMode();
  },

  syncDescriptionTooltipInputs(enabled = Settings.descriptionsAsTooltips()) {
    if (!Settings.dialog) return;
    for (const input of $$('input[name="Settings Descriptions as Tooltips"]', Settings.dialog) as HTMLInputElement[]) {
      input.checked = enabled;
      const row = input.closest('[data-name="Settings Descriptions as Tooltips"]') as HTMLElement | null;
      if (row) row.dataset.checked = String(enabled);
    }
  },

  hasTouchDescriptionPointer(): boolean {
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  },

  isTouchDescriptionMode(settingsWindowArg?: HTMLElement | null): boolean {
    const settingsWindow = arguments.length === 0
      ? (Settings.dialog && $('#fourchanx-settings', Settings.dialog) as HTMLElement | null)
      : settingsWindowArg;
    return !!settingsWindow?.classList.contains('settings-nav-collapsed') && Settings.hasTouchDescriptionPointer();
  },

  applyDescriptionMode(rootArg?: HTMLElement | Document) {
    const root: HTMLElement | Document = arguments.length === 0 ? (Settings.dialog || d) : rootArg!;
    const settingsWindow = $('#fourchanx-settings', Settings.dialog || d) as HTMLElement | null;
    const useTooltips = Settings.useDescriptionTooltips(settingsWindow);
    const touchDescriptions = Settings.isTouchDescriptionMode(settingsWindow);
    if (settingsWindow) {
      settingsWindow.classList.toggle('settings-description-tooltips', useTooltips);
      settingsWindow.classList.toggle('settings-touch-descriptions', touchDescriptions);
    }
    Settings.syncDescriptionTooltipInputs();
    if (!useTooltips || !touchDescriptions) Settings.closeMobileDescription();
    for (const row of $$('[data-setting-description]', root as HTMLElement)) {
      const el = row as HTMLElement;
      const description = el.dataset.settingDescription || '';
      if (useTooltips && description) {
        el.title = description;
      } else {
        el.removeAttribute('title');
      }
    }
  },

  registerSettingDescription(row: HTMLElement, description: string) {
    row.dataset.settingDescription = description;
    if (Settings.useDescriptionTooltips() && description) {
      row.title = description;
    } else {
      row.removeAttribute('title');
    }
  },

  onDescriptionLabelTap(e: Event) {
    const settingsWindow = Settings.dialog && $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null;
    const target = e.target as Element | null;
    if (!settingsWindow
      || !target
      || !Settings.isTouchDescriptionMode(settingsWindow)
      || !settingsWindow.classList.contains('settings-description-tooltips')
      || settingsWindow.classList.contains('settings-searching')) {
      return false;
    }
    if (target.closest('input, select, textarea, button, a, .settings-mobile-description')) return false;
    const row = target.closest('[data-setting-description]') as HTMLElement | null;
    if (!row || !row.dataset.settingDescription) return false;
    const trigger = target.closest('.setting-title, label');
    if (!trigger || !row.contains(trigger)) return false;

    e.preventDefault();
    e.stopPropagation();
    Settings.toggleMobileDescription(row);
    return true;
  },

  toggleMobileDescription(row: HTMLElement) {
    const wasOpen = row.classList.contains('settings-mobile-description-open');
    Settings.closeMobileDescription(row);
    if (wasOpen) return;

    const description = row.dataset.settingDescription || '';
    if (!description) return;

    const bubble = $.el('div', {
      className: 'settings-mobile-description',
      textContent: description,
    });
    const label = $('label', row) as HTMLElement | null;
    if (label?.parentElement === row) {
      label.insertAdjacentElement('afterend', bubble);
    } else {
      $.add(row, bubble);
    }
    row.classList.add('settings-mobile-description-open');
  },

  closeMobileDescription(except?: HTMLElement | null) {
    if (!Settings.dialog) return;
    for (const bubble of $$('.settings-mobile-description', Settings.dialog)) {
      if (except && except.contains(bubble)) continue;
      $.rm(bubble);
    }
    for (const row of $$('.settings-mobile-description-open', Settings.dialog)) {
      if (row !== except) row.classList.remove('settings-mobile-description-open');
    }
  },

  // Build the standard `<span class="description">: <span class="setting-description">…</span></span>`
  // wrapper. Settings search only paints matches inside `.setting-title` /
  // `.setting-description`, so description text dropped straight into a bare
  // `.description` span never gets highlighted — and the row then falls back to
  // the confusing whole-row keyword bar instead of marking the matched word.
  // Pass `text` without a leading ": "; the colon is added here.
  descriptionSpan(text: string) {
    const outer = $.el('span', { className: 'description' });
    if (text) {
      $.add(outer, [
        $.tn(': '),
        $.el('span', { className: 'setting-description', textContent: text }),
      ]);
    }
    return outer;
  },

  addCheckboxes(root: HTMLElement, obj: Record<string, any>, items: Record<string, any>, inputs: Record<string, any>, includeSetting = (_key: string) => true) {
    const containers = [root];
    let count = 0;
    for (const key in obj) {
      const arr = obj[key];
      if (!(arr instanceof Array)) continue;
      if (!includeSetting(key)) continue;
      const description = arr[1] || '';
      const settingTitle = ({
        'Thread Watcher Attach Controls': 'Attachment Controls',
      } as Record<string, string>)[key] || key;
      const div = $.el('div',
        { innerHTML: `<label><input type="checkbox" name="${key}"><span class="setting-title">${settingTitle}</span></label><span class="description">: <span class="setting-description">${description}</span></span>` });
      div.dataset.name = key;
      div.dataset.settingTitle = settingTitle;
      Settings.registerSettingDescription(div, description);
      const input = $('input', div) as HTMLInputElement;
      $.on(input, 'change', $.cb.checked);
      $.on(input, 'change', function(this: HTMLInputElement) { (this.parentNode!.parentNode as HTMLElement).dataset.checked = this.checked as any; });
      if (key === 'Settings Descriptions as Tooltips') {
        $.on(input, 'change', () => Settings.onDescriptionTooltipSettingChange(input));
      }
      if (key === 'Comment Preview') {
        $.on(input, 'change', () => $.event('QRCommentPreviewChanged'));
      }
      if (key === 'Thread Watcher Attach Controls') {
        $.on(input, 'change', () => {
          const TW: any = ThreadWatcher;
          if (TW && TW.applyAttachControlsSetting) {
            TW.applyAttachControlsSetting(input.checked);
          }
        });
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

  selectGroup(obj: Record<string, any>, keys: string[], baseLevel = 0) {
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

  renderMainGroups(section: HTMLElement, options: {
    categories: any[];
    includeWarnings?: boolean;
    includeJSONIndex?: boolean;
    includeHiddenCount?: boolean;
    hideLegendFor?: string[];
    includeSetting?: (key: string) => boolean;
  }) {
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
      const addWarning = function(item: HTMLElement) {
        $.add($('ul', warnings), item);
        warnings.hidden = false;
      };
      for (const key in Settings.warnings) {
        Settings.warnings[key as keyof typeof Settings.warnings](addWarning);
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
      const obj = Config.main[keyFS as keyof typeof Config.main];
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

    $.get(items, function(items: Record<string, any>) {
      for (const key in items) {
        const val = items[key];
        if (!inputs[key]) continue;
        inputs[key].checked = val;
        inputs[key].parentNode.parentNode.dataset.checked = val;
      }
      if (inputs['Settings Descriptions as Tooltips']) Settings.syncDescriptionTooltipInputs();
    });

    if (!includeHiddenCount) return;

    const div = $.el('div',
      { innerHTML: '<button></button><span class="description">: Clear manually-hidden threads and posts on all boards. Reload the page to apply.' });
    const button = $('button', div);
    $.get({ hiddenThreads: dict(), hiddenPosts: dict() }, function({ hiddenThreads, hiddenPosts }: { hiddenThreads: any; hiddenPosts: any }) {
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
    $.on(button, 'click', function(this: HTMLElement) {
      this.textContent = 'Hidden: 0';
      $.get('hiddenThreads', dict(), function({ hiddenThreads }) {
        if ($.hasStorage && (g.SITE!.software === 'yotsuba')) {
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

  addSelectFieldset(section: HTMLElement, title: string, rows: SelectRow[]) {
    const fs = $.el('details',
      { open: true },
      { innerHTML: `<summary>${title}</summary>` });
    const inputs = Settings.addSelectRows(fs, rows);
    $.add(section, fs);
    return inputs;
  },

  addSelectRows(root: HTMLElement, rows: SelectRow[]) {
    const items = dict();
    const inputs = dict();
    for (const row of rows) {
      const div = $.el('div');
      div.dataset.name = row.name;
      div.dataset.settingTitle = row.label;
      Settings.registerSettingDescription(div, row.description || '');
      const label = $.el('label');
      const select = $.el('select', { name: row.name }) as HTMLSelectElement;
      for (const option of row.options) {
        select.appendChild($.el('option', { value: option[0], textContent: option[1] }));
      }
      $.add(label, [
        $.el('span', { className: 'setting-title', textContent: `${row.label}: ` }),
        select
      ]);
      $.add(div, [
        label,
        Settings.descriptionSpan(row.description || '')
      ]);
      $.on(select, 'change', $.cb.value);
      if (row.name === 'Comment Preview Position' || row.name === 'Comment Preview Inline Behavior') {
        $.on(select, 'change', () => $.event('QRCommentPreviewChanged', null));
      }
      if (row.name === 'RelativeTime') {
        $.on(select, 'change', () => $.event('RelativePostDatesChanged', null));
      }
      items[row.name] = Conf[row.name];
      inputs[row.name] = select;
      $.add(root, div);
    }
    $.get(items, function(items: Record<string, any>) {
      for (const key in items) {
        inputs[key].value = items[key];
      }
    });
    return inputs;
  },

  general(section: HTMLElement) {
    Settings.renderMainGroups(section, {
      categories: [{
        name: 'Miscellaneous',
        subgroups: [
          ['System', ['JSON Index', `Use ${meta.name} Catalog`, 'Index Refresh Notifications', 'Open Threads in New Tab', 'External Catalog', '404 Redirect', 'Archive Report', 'Exempt Archives from Encryption', 'Show Updated Notifications']],
          ['Compatibility', ['Disable Native Extension', 'Enable Native Flash Embedding']]
        ]
      }],
      includeWarnings: true,
      includeJSONIndex: true
    });
  },

  interface(section: HTMLElement) {
    const items = dict();
    const inputs = dict();

    const fsNav = $.el('details',
      { open: true },
      { innerHTML: '<summary>Custom Board Navigation<button type="button" id="boardnav-detach" data-open="false" class="xt-detach-btn xt-detach-summary-btn" title="Detach into a floating window">Detach</button></summary>' });
    const navContent = $.el('div', {
      className: 'boardnav-detachable',
      innerHTML:
        '<div class="boardnav-field-wrap"><textarea name="boardnav" class="field boardnav-field" spellcheck="false"></textarea></div>' +
        '<span class="note">New lines will be converted into spaces.</span><br><br>' +
        '<details class="settings-guide" data-remember-layout="false">' +
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
    // Detach button lives in the section's <summary> (mirrors Sauce/Personas);
    // relocate the inner content so the summary stays put with the re-attach note.
    Settings.makeDetachable(
      navContent,
      $('#boardnav-detach', fsNav),
      { storageKey: 'settings.detachPanel.boardnav', title: 'Custom Board Navigation' },
    );

    Settings.renderMainGroups(section, {
      categories: [
        {
          name: 'Miscellaneous',
          subgroups: [
            ['UI', ['Announcement Hiding', 'Follow Cursor', 'Catalog Links']],
            ['Settings UI', ['Settings Descriptions as Tooltips']],
            ['Notifications', ['Desktop Notifications', 'Posting Success Notifications']],
            ['Keyboard and Navigation', ['Keybinds', 'Comment Expansion', 'Thread Expansion', 'Index Navigation', 'Reply Navigation', 'Unique ID and Capcode Navigation', 'Normalize URL', 'Disable Autoplaying Sounds']]
          ]
        },
        'Menu'
      ]
    });

    const settingsUI = $$('details', section)
      .find(details => $('summary', details)?.textContent === 'Settings UI') as HTMLElement | undefined;
    const selectInputs = settingsUI ? Settings.addSelectRows(settingsUI, [
      {
        name: 'Settings Menu Layout',
        label: 'Navigation menu',
        description: 'Position of menu links.',
        options: [
          ['vertical', 'Vertical'],
          ['horizontal', 'Horizontal']
        ]
      }
    ]) : dict();
    const navLayoutSelect = selectInputs['Settings Menu Layout'] as HTMLSelectElement | undefined;
    if (navLayoutSelect) {
      $.on(navLayoutSelect, 'change', function(this: HTMLSelectElement) {
        const win = Settings.dialog && $('#fourchanx-settings', Settings.dialog) as HTMLDivElement | null;
        if (win) Settings.setNavLayout(win, this.value);
      });
    }

    const iconInputs = Settings.addSelectFieldset(section, 'Icons', [
      {
        name: 'Icon Set',
        label: 'Icon style',
        description: 'Which icon set the script uses for its buttons and UI. Reload the page to apply.',
        options: ICON_SETS.map(({ id, name }) => [id, name] as [string, string])
      }
    ]);
    const iconSetSelect = iconInputs['Icon Set'] as HTMLSelectElement | undefined;
    if (iconSetSelect) {
      $.on(iconSetSelect, 'change', function(this: HTMLSelectElement) {
        Icon.setIconSet(this.value);
        if (confirm('Icon set changed. Reload the page to apply it everywhere?')) {
          window.location.reload();
        }
      });
    }

    $.add(section, fsNav);

    $.get(items, function(items: Record<string, any>) {
      for (const key in items) {
        const input = inputs[key];
        if (input.type === 'checkbox') {
          input.checked = items[key];
          input.parentNode.parentNode.dataset.checked = items[key];
        } else {
          input.value = items[key];
        }
      }
      if (inputs['Settings Descriptions as Tooltips']) Settings.syncDescriptionTooltipInputs();
    });
  },

  threadsAndPosts(section: HTMLElement) {
    const items = dict();
    const inputs = dict();

    const fsFmt = $.el('details',
      { open: true },
      { innerHTML: '<summary>Formatting</summary>' });
    const lookup = Settings.getMainSettingLookup();
    const collectGroup = (keys: string[]) => {
      const g = dict();
      for (const key of keys) if (lookup[key]) g[key] = lookup[key];
      return g;
    };
    Settings.addCheckboxes(fsFmt, collectGroup([
      'Custom Board Titles',
      'Persistent Custom Board Titles',
      'Color User IDs',
      'Count Posts by ID',
      'Remove Spoilers',
      'Reveal Spoilers',
      'Time Formatting',
    ]), items, inputs);
    // Relative dates as a single dropdown. The earlier two-checkbox form could
    // only reach No / Show / Hover; the renderer (RelativeDates.ts) also supports
    // the two "Both" orderings, so a select exposes the full set. RelativeTime is
    // the canonical value (legacy checkbox imports migrate to it at load).
    Settings.addSelectRows(fsFmt, [{
      name: 'RelativeTime',
      label: 'Relative Post Dates',
      description: 'Display dates like "3 minutes ago" inline, on hover, or both.',
      options: [
        ['No', 'Off'],
        ['Hover', 'Show on hover'],
        ['Show', 'Show inline (full date on hover)'],
        ['Both', 'Show timestamp, then relative'],
        ['BothRelativeFirst', 'Show relative, then timestamp'],
      ],
    }]);
    Settings.addCheckboxes(fsFmt, collectGroup([
      'File Info Formatting',
      'Quote Backlinks',
    ]), items, inputs);
    $.add(section, fsFmt);

    const stylingOnlyKeys = new Set([
      'Scrollbar Markers',
      'Scrollbar Mark Own Posts',
      'Scrollbar Mark Quotes You',
      'Scrollbar Mark Ghost Posts',
      'Scrollbar Mark Unread Line',
      'Scrollbar Marker Position',
      'Scrollbar Marker Hover Preview',
      'Highlight Posts Quoting You',
      'Highlight Own Posts',
      'Highlight Ghost Posts',
      'Highlight Own Background',
      'Highlight You Background',
      'Highlight Ghost Background'
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
      { open: true, id: 'xt-updater-settings' },
      { innerHTML: '<summary>Updater & Cooldown</summary>' });
    Settings.addCheckboxes(fsUC, Config.updater.checkbox, items, inputs);
    if (inputs['Scroll BG']) {
      $.on(inputs['Scroll BG'], 'change', ThreadUpdater.cb.scrollBG);
      ThreadUpdater.cb.scrollBG();
    }
    if (inputs['Auto Update']) {
      $.on(inputs['Auto Update'], 'change', ThreadUpdater.setInterval);
    }
    const divInterval = $.el('div',
      { innerHTML: '<label>Update Interval: <input type="number" name="Interval" class="field" min="1"></label><span class="description">: Seconds between updates.</span>' });
    divInterval.dataset.name = 'Interval';
    const intervalInput = $('input', divInterval) as HTMLInputElement;
    $.on(intervalInput, 'change', ThreadUpdater.cb.interval);
    items['Interval'] = Conf['Interval'];
    inputs['Interval'] = intervalInput;
    $.add(fsUC, divInterval);
    const divCooldown = $.el('div',
      { innerHTML: '<label><span class="setting-title">Custom Cooldown: </span><input type="number" name="customCooldown" class="field" min="0"></label><span class="description">: <span class="setting-description">Seconds to wait after posting.</span></span>' });
    divCooldown.dataset.name = 'customCooldown';
    const cooldownInput = $('input', divCooldown) as HTMLInputElement;
    $.on(cooldownInput, 'change', $.cb.value);
    items['customCooldown'] = Conf['customCooldown'];
    inputs['customCooldown'] = cooldownInput;
    $.add(fsUC, divCooldown);
    Settings.addUpdaterBoardSound(fsUC);
    const soundHint = $.el('div', {
      className: 'description',
      innerHTML: 'Sound library, volume, and per-board overrides: <b>Advanced → Thread updater sound</b>.',
    });
    $.add(fsUC, soundHint);
    $.add(section, fsUC);

    $.get(items, function(items: Record<string, any>) {
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

  addThreadWatcherFieldset(section: HTMLElement) {
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
      if (!Config.threadWatcher[name as keyof typeof Config.threadWatcher]) continue;
      const arr = Config.threadWatcher[name as keyof typeof Config.threadWatcher] as any[];
      const description = arr[1] || '';
      const hoverDescription = Config.threadWatcher['Thread Watcher Thumbnail Hover']?.[1] || '';
      let div: HTMLDivElement;

      if (name === 'Show OP Thumbnails') {
        div = $.el('div',
          { innerHTML: `<label><input type="checkbox" name="${name}">${displayName(name)}</label><span class="thread-watcher-inline-number"><input type="number" name="Thread Watcher Thumbnail Size" min="16" max="160" step="1" class="field thread-watcher-size-input" title="Thumbnail size in pixels"></span><span class="description">: <span class="setting-description">${description}</span></span><span class="thread-watcher-inline-subsetting"><label><input type="checkbox" name="Thread Watcher Thumbnail Hover">Hover Preview</label><span class="thread-watcher-inline-number"><input type="number" name="Thread Watcher Thumbnail Preview Size" min="10" max="99" step="1" class="field thread-watcher-preview-size-input" title="Hover preview size as a percentage">%</span><span class="description">: <span class="setting-description">${hoverDescription}</span></span></span>` });
        div.dataset.name = `${name} Thread Watcher Thumbnail Size Thread Watcher Thumbnail Hover Thread Watcher Thumbnail Preview Size`;
        div.dataset.settingTitle = displayName(name);
        Settings.registerSettingDescription(div, `${description} ${hoverDescription} Thread Watcher Thumbnail Size Thread Watcher Thumbnail Hover Thread Watcher Thumbnail Preview Size`);

        const sizeInput = $('input[name="Thread Watcher Thumbnail Size"]', div) as HTMLInputElement;
        const previewToggle = $('input[name="Thread Watcher Thumbnail Hover"]', div) as HTMLInputElement;
        const previewSizeInput = $('input[name="Thread Watcher Thumbnail Preview Size"]', div) as HTMLInputElement;
        $.on(sizeInput, 'change', function(this: HTMLInputElement) {
          let size = parseInt(this.value, 10);
          if (isNaN(size)) size = 40;
          size = Math.max(16, Math.min(160, size));
          this.value = `${size}`;
          $.set(this.name, size);
          Conf[this.name] = size;
          syncThumbSizeToDialog(size);
        });
        $.on(previewToggle, 'change', $.cb.checked);
        $.on(previewToggle, 'change', function(this: HTMLInputElement) {
          if (!this.checked) {
            const hover = $.id('tw-ihover');
            if (hover) {
              hover.hidden = true;
              hover.removeAttribute('src');
              hover.removeAttribute('style');
            }
          }
        });
        $.on(previewSizeInput, 'change', function(this: HTMLInputElement) {
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
        Settings.registerSettingDescription(div, description);
      }

      const level = arr[2] || 0;
      if (level > 0) div.classList.add('thread-watcher-subsetting');
      const input = $('input', div) as HTMLInputElement;
      $.on(input, 'change', $.cb.checked);
      $.on(input, 'change', function(this: HTMLInputElement) { (this.parentNode!.parentNode as HTMLElement).dataset.checked = this.checked as any; });
      items[name] = Conf[name];
      inputs[name] = input;
      $.add(fs, div);
    }

    const heightDiv = $.el('div',
      { innerHTML: '<label>TW Max H <input type="number" name="Thread Watcher Max Height" min="120" max="999" step="1" class="field thread-watcher-height-input"></label><label class="thread-watcher-inline-number">W <input type="number" name="Thread Watcher Max Width" min="120" max="999" step="1" class="field thread-watcher-width-input"></label><span class="description">: <span class="setting-description">Maximum watched-thread list height and width in pixels.</span></span>' });
    heightDiv.dataset.name = 'Thread Watcher Max Height Thread Watcher Max Width';
    heightDiv.dataset.settingTitle = 'TW Max H/W';
    Settings.registerSettingDescription(heightDiv, 'Maximum watched-thread list height and width in pixels.');
    const heightInput = $('input[name="Thread Watcher Max Height"]', heightDiv) as HTMLInputElement;
    const widthInput = $('input[name="Thread Watcher Max Width"]', heightDiv) as HTMLInputElement;
    $.on(heightInput, 'change', function(this: HTMLInputElement) {
      let height = parseInt(this.value, 10);
      if (isNaN(height)) height = 210;
      height = Math.max(120, Math.min(999, height));
      this.value = `${height}`;
      $.set(this.name, height);
      Conf[this.name] = height;
      syncWatcherHeightToDialog(height);
    });
    $.on(widthInput, 'change', function(this: HTMLInputElement) {
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
    $.get(items, function(items: Record<string, any>) {
      for (const key in items) {
        const input = inputs[key];
        if (input.type === 'checkbox') {
          input.checked = items[key];
          input.parentNode.parentNode.dataset.checked = items[key];
        } else if (input.tagName === 'SELECT') {
          input.value = items[key] || 'bottom';
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

  media(section: HTMLElement) {
    const items = dict();
    const inputs = dict();
    const lookup = Settings.getMainSettingLookup();

    const groups: [string, string[]][] = [
      ['Image Behavior', ['Image Expansion', 'Image Hover', 'Image Hover in Catalog', 'Replace Thumbnails', 'Replace GIF', 'Replace JPG', 'Replace PNG', 'Replace WEBM', 'Restart when Opened']],
      ['Images', ['Gallery', 'Fullscreen Gallery', 'PDF in Gallery', 'Sauce', 'Reveal Spoiler Thumbnails', 'Image Prefetching', 'Fappe Tyme', 'Werk Tyme']],
      ['Videos', ['WEBM Metadata', 'Autoplay', 'Show Controls', 'Click Passthrough', 'Allow Sound', 'Mouse Wheel Volume', 'Loop in New Tab', 'Volume in New Tab', 'Enable sound posts']]
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

    $.get(items, function(items: Record<string, any>) {
      for (const key in items) {
        const input = inputs[key];
        if (!input) continue;
        input.checked = items[key];
        input.parentNode.parentNode.dataset.checked = items[key];
      }
    });

    const sauceFS = $.el('details',
      { open: true },
      { innerHTML: '<summary>Sauce<button type="button" id="sauce-detach" data-open="false" class="xt-detach-btn xt-detach-summary-btn" title="Detach into a floating window">Detach</button></summary>' });
    const sauceWrap = $.el('div');
    Settings.sauce(sauceWrap);
    $.add(sauceFS, sauceWrap);
    $.add(section, sauceFS);
    // Detach button lives in the section's <summary> (mirrors Personas); wire it
    // here where both the summary and the relocatable .sauce-section are in scope.
    Settings.makeDetachable(
      $('.sauce-section', sauceWrap) as HTMLElement | null,
      $('#sauce-detach', sauceFS),
      { storageKey: 'settings.detachPanel.sauce', title: 'Sauce' },
    );
  },

  posting(section: HTMLElement) {
      Settings.renderMainGroups(section, {
        categories: ['Posting and Captchas'],
        includeSetting: (key: string) => ![
          'Comment Preview',
          'Comment Preview Default Mode',
          'Comment Preview Attach Location',
          'Comment Preview Remember Float Position',
          'Comment Preview Thread Behavior',
          'Comment Preview Catalog Behavior',
          'Show Comment Preview Header Icon',
        ].includes(key),
      });

    // Let the Quick Reply react live (same tab) when the draft feature is
    // toggled, so turning it off can wipe saved drafts/attachments immediately.
    const rememberQRState = $('input[name="QR Drafts"]', section) as HTMLInputElement | null;
    if (rememberQRState) {
      $.on(rememberQRState, 'change', () => $.event('QRStateChanged', null));
    }

    const fs = $.el('details',
      { open: true },
      { innerHTML: '<summary>Comment Preview</summary>' }) as HTMLDetailsElement;
    const row = $.el('div', {
      innerHTML: `<label><input type="checkbox" name="Comment Preview"><span class="setting-title">Comment Preview</span></label><span class="description">: <span class="setting-description">${Config.main['Posting and Captchas']['Comment Preview'][1]}</span></span>`,
    }) as HTMLDivElement;
    row.dataset.name = 'Comment Preview';
    row.dataset.settingTitle = 'Comment Preview';
    Settings.registerSettingDescription(row, String(Config.main['Posting and Captchas']['Comment Preview'][1]));
    const toggle = $('input[name="Comment Preview"]', row) as HTMLInputElement;
    $.on(toggle, 'change', $.cb.checked);
    $.on(toggle, 'change', function(this: HTMLInputElement) { (this.parentNode!.parentNode as HTMLElement).dataset.checked = this.checked as any; });
    $.on(toggle, 'change', () => $.event('QRCommentPreviewChanged'));

      const sub = $.el('div', { className: 'suboption-list' });

      const defaultModeDescription = String(Config.main['Posting and Captchas']['Comment Preview Default Mode'][1]);
      const defaultModeRow = $.el('div') as HTMLDivElement;
      defaultModeRow.dataset.name = 'Comment Preview Default Mode';
      defaultModeRow.dataset.settingTitle = 'Default Preview Mode';
      Settings.registerSettingDescription(defaultModeRow, defaultModeDescription);
      const defaultModeLabel = $.el('label');
      const defaultModeSelect = $.el('select', { name: 'Comment Preview Default Mode' }) as HTMLSelectElement;
      for (const [value, text] of [
        ['attached', 'Attached to QR'],
        ['inline', 'Docked inline'],
        ['remember', 'Remember last mode'],
      ] as const) {
        $.add(defaultModeSelect, $.el('option', { value, textContent: text }));
      }
      $.on(defaultModeSelect, 'change', $.cb.value);
      $.on(defaultModeSelect, 'change', () => $.event('QRCommentPreviewChanged'));
      $.add(defaultModeLabel, [$.el('span', { className: 'setting-title', textContent: 'Default Preview Mode: ' }), defaultModeSelect]);
      $.add(defaultModeRow, [
        defaultModeLabel,
        Settings.descriptionSpan(defaultModeDescription),
      ]);

      const attachLocationDescription = String(Config.main['Posting and Captchas']['Comment Preview Attach Location'][1]);
      const attachLocationRow = $.el('div') as HTMLDivElement;
      attachLocationRow.dataset.name = 'Comment Preview Attach Location';
      attachLocationRow.dataset.settingTitle = 'Attach to QR Location';
      Settings.registerSettingDescription(attachLocationRow, attachLocationDescription);
      const attachLocationLabel = $.el('label');
      const attachLocationSelect = $.el('select', { name: 'Comment Preview Attach Location' }) as HTMLSelectElement;
      for (const [value, text] of [
        ['auto', 'Auto (prefer bottom)'],
        ['bottom', 'Bottom'],
        ['top', 'Top'],
        ['right', 'Right'],
        ['left', 'Left'],
      ] as const) {
        $.add(attachLocationSelect, $.el('option', { value, textContent: text }));
      }
      $.on(attachLocationSelect, 'change', $.cb.value);
      $.on(attachLocationSelect, 'change', () => $.event('QRCommentPreviewChanged'));
      $.add(attachLocationLabel, [$.el('span', { className: 'setting-title', textContent: 'Attach to QR Location: ' }), attachLocationSelect]);
      $.add(attachLocationRow, [
        attachLocationLabel,
        Settings.descriptionSpan(attachLocationDescription),
      ]);

      const positionRow = $.el('div') as HTMLDivElement;
      positionRow.dataset.name = 'Comment Preview Inline Behavior';
      positionRow.dataset.settingTitle = 'Inline Behavior';
    Settings.registerSettingDescription(positionRow, 'When you dock the floating preview into the thread (the arrow icon in the preview header), how it is inserted: "Scroll to bottom" stitches the preview at the very end of the thread and scrolls there so you see the literal end result; "Insert in place" drops it after the post nearest the bottom of your screen and keeps it there as you scroll (no page jump).');
    const label = $.el('label');
    const select = $.el('select', { name: 'Comment Preview Inline Behavior' }) as HTMLSelectElement;
    for (const [value, text] of [
      ['scroll', 'Scroll to bottom and dock at thread end'],
      ['inplace', 'Insert in place near viewport (follow scroll)'],
    ] as const) {
      $.add(select, $.el('option', { value, textContent: text }));
    }
    $.on(select, 'change', $.cb.value);
    $.on(select, 'change', () => $.event('QRCommentPreviewChanged'));
    $.add(label, [$.el('span', { className: 'setting-title', textContent: 'Inline Behavior: ' }), select]);
    $.add(positionRow, [
      label,
      Settings.descriptionSpan('How the preview is inserted when you dock it into the thread.'),
      ]);
      const rememberFloatDescription = String(Config.main['Posting and Captchas']['Comment Preview Remember Float Position'][1]);
      const rememberFloatRow = $.el('div', {
        innerHTML: `<label><input type="checkbox" name="Comment Preview Remember Float Position"><span class="setting-title">Remember Floating Position</span></label><span class="description">: <span class="setting-description">${rememberFloatDescription}</span></span>`,
      }) as HTMLDivElement;
      rememberFloatRow.dataset.name = 'Comment Preview Remember Float Position';
      rememberFloatRow.dataset.settingTitle = 'Remember Floating Position';
      Settings.registerSettingDescription(rememberFloatRow, rememberFloatDescription);
      const rememberFloatToggle = $('input[name="Comment Preview Remember Float Position"]', rememberFloatRow) as HTMLInputElement;
      $.on(rememberFloatToggle, 'change', $.cb.checked);
      $.on(rememberFloatToggle, 'change', function(this: HTMLInputElement) { (this.parentNode!.parentNode as HTMLElement).dataset.checked = this.checked as any; });
      $.on(rememberFloatToggle, 'change', () => $.event('QRCommentPreviewChanged'));

      const threadBehaviorDescription = String(Config.main['Posting and Captchas']['Comment Preview Thread Behavior'][1]);
      const threadBehaviorRow = $.el('div') as HTMLDivElement;
      threadBehaviorRow.dataset.name = 'Comment Preview Thread Behavior';
      threadBehaviorRow.dataset.settingTitle = 'Thread Behavior';
      Settings.registerSettingDescription(threadBehaviorRow, threadBehaviorDescription);
      const threadBehaviorLabel = $.el('label');
      const threadBehaviorSelect = $.el('select', { name: 'Comment Preview Thread Behavior' }) as HTMLSelectElement;
      for (const [value, text] of [
        ['normal', 'Normal (show as usual)'],
        ['until-content', 'Hide until comment/file added'],
        ['manual', 'Hide until revealed via titlebar icon'],
      ] as const) {
        $.add(threadBehaviorSelect, $.el('option', { value, textContent: text }));
      }
      $.on(threadBehaviorSelect, 'change', $.cb.value);
      $.on(threadBehaviorSelect, 'change', () => $.event('QRCommentPreviewChanged', null));
      $.add(threadBehaviorLabel, [$.el('span', { className: 'setting-title', textContent: 'Thread Behavior: ' }), threadBehaviorSelect]);
      $.add(threadBehaviorRow, [
        threadBehaviorLabel,
        Settings.descriptionSpan(threadBehaviorDescription),
      ]);

      const catalogBehaviorDescription = String(Config.main['Posting and Captchas']['Comment Preview Catalog Behavior'][1]);
      const catalogBehaviorRow = $.el('div') as HTMLDivElement;
      catalogBehaviorRow.dataset.name = 'Comment Preview Catalog Behavior';
      catalogBehaviorRow.dataset.settingTitle = 'Catalog/Index Behavior';
      Settings.registerSettingDescription(catalogBehaviorRow, catalogBehaviorDescription);
      const catalogBehaviorLabel = $.el('label');
      const catalogBehaviorSelect = $.el('select', { name: 'Comment Preview Catalog Behavior' }) as HTMLSelectElement;
      for (const [value, text] of [
        ['normal', 'Normal (float as usual)'],
        ['until-content', 'Hide until comment/file added'],
        ['manual', 'Hide until revealed via titlebar icon'],
      ] as const) {
        $.add(catalogBehaviorSelect, $.el('option', { value, textContent: text }));
      }
      $.on(catalogBehaviorSelect, 'change', $.cb.value);
      $.on(catalogBehaviorSelect, 'change', () => $.event('QRCommentPreviewChanged', null));
      $.add(catalogBehaviorLabel, [$.el('span', { className: 'setting-title', textContent: 'Catalog/Index Behavior: ' }), catalogBehaviorSelect]);
      $.add(catalogBehaviorRow, [
        catalogBehaviorLabel,
        Settings.descriptionSpan(catalogBehaviorDescription),
      ]);

      const iconDescription = String(Config.main['Posting and Captchas']['Show Comment Preview Header Icon'][1]);
      const iconRow = $.el('div', {
        innerHTML: `<label><input type="checkbox" name="Show Comment Preview Header Icon"><span class="setting-title">Show QR Titlebar Toggle</span></label><span class="description">: <span class="setting-description">${iconDescription}</span></span>`,
      }) as HTMLDivElement;
      iconRow.dataset.name = 'Show Comment Preview Header Icon';
      iconRow.dataset.settingTitle = 'Show QR Titlebar Toggle';
      Settings.registerSettingDescription(iconRow, iconDescription);
      const iconToggle = $('input[name="Show Comment Preview Header Icon"]', iconRow) as HTMLInputElement;
    $.on(iconToggle, 'change', $.cb.checked);
    $.on(iconToggle, 'change', function(this: HTMLInputElement) { (this.parentNode!.parentNode as HTMLElement).dataset.checked = this.checked as any; });
    $.on(iconToggle, 'change', () => $.event('QRCommentPreviewChanged', null));
      // Only show the sub-settings that actually apply to the chosen Default Preview Mode:
      //   inline   -> Inline Behavior only
      //   attached -> Attach to QR Location + Remember Floating Position only
      //   remember -> all (last mode could be either)
      const updateCommentPreviewModeRows = (mode: string) => {
        const m = ['inline', 'remember'].includes(mode) ? mode : 'attached';
        const showInline = m === 'inline' || m === 'remember';      // Inline Behavior
        const showAttachLoc = m === 'attached' || m === 'remember'; // Attach to QR Location
        // "Remember last mode" already remembers a floated preview's position, so the
        // explicit toggle is redundant there — show it only for plain "Attached to QR".
        const showRememberFloat = m === 'attached';
        positionRow.hidden = !showInline;
        attachLocationRow.hidden = !showAttachLoc;
        rememberFloatRow.hidden = !showRememberFloat;
      };
      $.on(defaultModeSelect, 'change', () => updateCommentPreviewModeRows(defaultModeSelect.value));
      updateCommentPreviewModeRows(defaultModeSelect.value);

      $.add(sub, defaultModeRow);
      $.add(sub, attachLocationRow);
      $.add(sub, positionRow);
      $.add(sub, rememberFloatRow);
      $.add(sub, threadBehaviorRow);
      $.add(sub, catalogBehaviorRow);
      $.add(row, sub);
    $.add(fs, row);
    $.add(fs, iconRow);
    $.add(section, fs);

    const updateCommentPreviewSettings = (items: Record<string, any>) => {
        toggle.checked = !!items['Comment Preview'];
        row.dataset.checked = toggle.checked ? 'true' : 'false';
        defaultModeSelect.value = ['inline', 'remember'].includes(items['Comment Preview Default Mode'])
          ? items['Comment Preview Default Mode']
          : 'attached';
        updateCommentPreviewModeRows(defaultModeSelect.value);
        attachLocationSelect.value = ['bottom', 'top', 'right', 'left'].includes(items['Comment Preview Attach Location'])
          ? items['Comment Preview Attach Location']
          : 'auto';
        select.value = items['Comment Preview Inline Behavior'] === 'inplace' ? 'inplace' : 'scroll';
        threadBehaviorSelect.value = ['until-content', 'manual'].includes(items['Comment Preview Thread Behavior'])
          ? items['Comment Preview Thread Behavior']
          : 'normal';
        catalogBehaviorSelect.value = ['until-content', 'manual'].includes(items['Comment Preview Catalog Behavior'])
          ? items['Comment Preview Catalog Behavior']
          : 'normal';
        rememberFloatToggle.checked = !!items['Comment Preview Remember Float Position'];
        rememberFloatRow.dataset.checked = rememberFloatToggle.checked ? 'true' : 'false';
        iconToggle.checked = items['Show Comment Preview Header Icon'] !== false;
        iconRow.dataset.checked = iconToggle.checked ? 'true' : 'false';
      };
      $.get({
        'Comment Preview': Conf['Comment Preview'],
        'Comment Preview Default Mode': Conf['Comment Preview Default Mode'],
        'Comment Preview Attach Location': Conf['Comment Preview Attach Location'],
        'Comment Preview Inline Behavior': Conf['Comment Preview Inline Behavior'],
        'Comment Preview Remember Float Position': Conf['Comment Preview Remember Float Position'],
        'Comment Preview Thread Behavior': Conf['Comment Preview Thread Behavior'],
        'Comment Preview Catalog Behavior': Conf['Comment Preview Catalog Behavior'],
        'Show Comment Preview Header Icon': Conf['Show Comment Preview Header Icon'],
      }, updateCommentPreviewSettings as any);

  },

  styling(section: HTMLElement) {
    let input: HTMLInputElement, name: string;
    $.extend(section, { innerHTML: StylingPage });

    // When StyleChan is present, each Styling subsection gets a master-switch
    // checkbox in its title (see setupStylingSectionToggles) so the user can
    // hand individual sections over to StyleChan. We surface a small info box at
    // the top with shortcuts. Sections are no longer hidden — the per-section
    // gates remove their effect when toggled off.
    if (Settings.isStylechanInstalled()) {
      const refreshToggles = Settings.setupStylingSectionToggles(section);

      const box = $.el('div', { className: 'styling-stylechan-box' });
      const text = $.el('div', {
        className: 'styling-stylechan-text',
        innerHTML:
          '<b>StyleChan is detected.</b> '
          + 'Use the checkbox in each section title below to choose what 4chan-neXT styles and what StyleChan owns. '
          + 'Turning a section off removes its effect from the page without changing the settings inside it.'
      });
      const buttons = $.el('div', { className: 'styling-stylechan-buttons' });
      const openButton = $.el('button', {
        type: 'button',
        className: 'styling-stylechan-open',
        textContent: 'Open StyleChan Settings',
      }) as HTMLButtonElement;
      $.on(openButton, 'click', e => {
        e.preventDefault();
        Settings.openStylechanSettings();
      });
      const recommendButton = $.el('button', {
        type: 'button',
        className: 'styling-stylechan-recommend',
        title: 'Turn off the sections StyleChan owns (Site Style, Text Colors, Custom CSS) and keep the others on. Does not change the settings inside any section.',
        textContent: 'Apply recommended settings',
      }) as HTMLButtonElement;
      $.on(recommendButton, 'click', e => {
        e.preventDefault();
        Settings.applyRecommendedStylingSections();
        refreshToggles();
        Settings.applyStylingSectionRuntime();
      });
      $.add(buttons, [openButton, recommendButton]);
      $.add(box, [text, buttons]);
      section.insertBefore(box, section.firstChild);
    }

    // loose: values are a mix of <input>/<select>/<textarea>; typed `any` so the
    // various `as HTMLSelectElement` reads below don't trip the input/select divide.
    const inputs: Record<string, any> = dict();
    for (input of $$('[name]', section)) {
      inputs[input.name] = input;
    }

    // Mark the enclosing <details> for every variant-aware input so CSS can
    // label the whole section (Highlight Colors, Scrollbar Markers, Text
    // Colors, Custom CSS, etc.) without decorating each input individually.
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
    // Scrollbar markers now live folded into each thread highlight row. Each
    // entry pairs a marker's enable checkbox with its colour/opacity/match
    // controls so we can disable + dim them as a unit under the master switch.
    const markerControlRows = [
      { type: 'own', onKey: 'Scrollbar Mark Own Posts', colorKey: 'Scroll Marker Own Color', opacityKey: 'Scroll Marker Own Opacity', matchKey: 'Scroll Marker Own Match Highlight', highlightKey: 'Highlight Own Color' },
      { type: 'you', onKey: 'Scrollbar Mark Quotes You', colorKey: 'Scroll Marker You Color', opacityKey: 'Scroll Marker You Opacity', matchKey: 'Scroll Marker You Match Highlight', highlightKey: 'Highlight You Color' },
      { type: 'ghost', onKey: 'Scrollbar Mark Ghost Posts', colorKey: 'Scroll Marker Ghost Color', opacityKey: 'Scroll Marker Ghost Opacity', matchKey: 'Scroll Marker Ghost Match Highlight', highlightKey: 'Highlight Ghost Color' },
      { type: 'unread', onKey: 'Scrollbar Mark Unread Line', colorKey: 'Scroll Marker Unread Color', opacityKey: 'Scroll Marker Unread Opacity', matchKey: null, highlightKey: null },
    ] as const;
    // Changing any of these re-runs syncMarkerColorControls (master, per-row
    // enable, and match toggles all change which marker controls are live).
    const markerToggleKeys = new Set<string>([
      'Scrollbar Markers',
      ...markerControlRows.map(r => r.onKey),
      ...(markerControlRows.map(r => r.matchKey).filter(Boolean) as string[]),
    ]);
    // Thread highlight rows: each enable checkbox gates its own detail controls,
    // mirroring syncCatalogHighlightControls for the catalog group.
    const threadHighlightControlRows = [
      { onKey: 'Highlight Own Posts', controls: ['Highlight Own Color', 'Highlight Own Opacity', 'Highlight Own Background', 'Highlight Own Edge Width', 'Highlight Own Border Style', 'Highlight Own Text Mode', 'Highlight Own Text Color', 'Highlight Own Link Color', 'Highlight Own Quote Color', 'Highlight Own Dead Link Color'] },
      { onKey: 'Highlight Posts Quoting You', controls: ['Highlight You Color', 'Highlight You Opacity', 'Highlight You Background', 'Highlight You Edge Width', 'Highlight You Border Style', 'Highlight You Text Mode', 'Highlight You Text Color', 'Highlight You Link Color', 'Highlight You Quote Color', 'Highlight You Dead Link Color'] },
      { onKey: 'Highlight Ghost Posts', controls: ['Highlight Ghost Color', 'Highlight Ghost Opacity', 'Highlight Ghost Background', 'Highlight Ghost Edge Width', 'Highlight Ghost Border Style', 'Highlight Ghost Text Mode', 'Highlight Ghost Text Color', 'Highlight Ghost Link Color', 'Highlight Ghost Quote Color', 'Highlight Ghost Dead Link Color'] },
    ] as const;
    const themeDefaultSettings = [
      ['Enable Thread Highlights', true],
      ['Highlight Own Posts', true],
      ['Highlight Posts Quoting You', true],
      ['Highlight Ghost Posts', true],
      ['Highlight Own Color', Settings.THEME_BORDER_HIGHLIGHT],
      ['Highlight You Color', Settings.THEME_BORDER_HIGHLIGHT],
      ['Highlight Ghost Color', ''],
      ['Highlight Own Opacity', ''],
      ['Highlight You Opacity', ''],
      ['Highlight Ghost Opacity', ''],
      ['Thread Highlight Edge Width', 3],
      ['Highlight Own Edge Width', 3],
      ['Highlight You Edge Width', 3],
      ['Highlight Ghost Edge Width', 3],
      ['Highlight Own Background', false],
      ['Highlight You Background', false],
      ['Highlight Ghost Background', false],
      ['Highlight Own Text Mode', 'default'],
      ['Highlight You Text Mode', 'default'],
      ['Highlight Ghost Text Mode', 'default'],
      ['Highlight Own Text Color', ''],
      ['Highlight Own Link Color', ''],
      ['Highlight Own Quote Color', ''],
      ['Highlight Own Dead Link Color', ''],
      ['Highlight You Text Color', ''],
      ['Highlight You Link Color', ''],
      ['Highlight You Quote Color', ''],
      ['Highlight You Dead Link Color', ''],
      ['Highlight Ghost Text Color', ''],
      ['Highlight Ghost Link Color', ''],
      ['Highlight Ghost Quote Color', ''],
      ['Highlight Ghost Dead Link Color', ''],
      // Catalog highlights are neXT-specific; keep them available but off for the vanilla baseline.
      ['Enable Catalog Highlights', false],
      ['Catalog Highlight Own Posts', true],
      ['Catalog Highlight Watched Threads', true],
      ['Catalog Highlight Own Color', ''],
      ['Catalog Highlight Own Opacity', ''],
      ['Catalog Highlight Own Background', false],
      ['Catalog Highlight Watched Color', ''],
      ['Catalog Highlight Watched Opacity', ''],
      ['Catalog Highlight Watched Background', false],
      ['Catalog Highlight Border Width', 3],
      ['Catalog Highlight Own Border Width', 3],
      ['Catalog Highlight Watched Border Width', 3],
      ['Catalog Highlight Own Text Mode', 'default'],
      ['Catalog Highlight Own Text Color', ''],
      ['Catalog Highlight Own Subject Color', ''],
      ['Catalog Highlight Own Link Color', ''],
      ['Catalog Highlight Own Quote Color', ''],
      ['Catalog Highlight Own Dead Link Color', ''],
      ['Catalog Highlight Watched Text Mode', 'default'],
      ['Catalog Highlight Watched Text Color', ''],
      ['Catalog Highlight Watched Subject Color', ''],
      ['Catalog Highlight Watched Link Color', ''],
      ['Catalog Highlight Watched Quote Color', ''],
      ['Catalog Highlight Watched Dead Link Color', ''],
    ] as const;
    const threadHighlightToggleKeys = new Set<string>([
      'Enable Thread Highlights',
      ...threadHighlightControlRows.map(r => r.onKey),
    ]);
    const highlightTextControlGroups = [
      {
        manualGroup: 'own',
        modeKey: 'Highlight Own Text Mode',
        colorKey: 'Highlight Own Color',
        opacityKey: 'Highlight Own Opacity',
        bgKey: 'Highlight Own Background',
        keys: ['Highlight Own Text Color', 'Highlight Own Link Color', 'Highlight Own Quote Color', 'Highlight Own Dead Link Color'] as const,
      },
      {
        manualGroup: 'you',
        modeKey: 'Highlight You Text Mode',
        colorKey: 'Highlight You Color',
        opacityKey: 'Highlight You Opacity',
        bgKey: 'Highlight You Background',
        keys: ['Highlight You Text Color', 'Highlight You Link Color', 'Highlight You Quote Color', 'Highlight You Dead Link Color'] as const,
      },
      {
        manualGroup: 'ghost',
        modeKey: 'Highlight Ghost Text Mode',
        colorKey: 'Highlight Ghost Color',
        opacityKey: 'Highlight Ghost Opacity',
        bgKey: 'Highlight Ghost Background',
        keys: ['Highlight Ghost Text Color', 'Highlight Ghost Link Color', 'Highlight Ghost Quote Color', 'Highlight Ghost Dead Link Color'] as const,
      },
      {
        manualGroup: 'catalog-own',
        modeKey: 'Catalog Highlight Own Text Mode',
        colorKey: 'Catalog Highlight Own Color',
        opacityKey: 'Catalog Highlight Own Opacity',
        bgKey: 'Catalog Highlight Own Background',
        keys: ['Catalog Highlight Own Text Color', 'Catalog Highlight Own Subject Color', 'Catalog Highlight Own Link Color', 'Catalog Highlight Own Quote Color', 'Catalog Highlight Own Dead Link Color'] as const,
      },
      {
        manualGroup: 'catalog-watched',
        modeKey: 'Catalog Highlight Watched Text Mode',
        colorKey: 'Catalog Highlight Watched Color',
        opacityKey: 'Catalog Highlight Watched Opacity',
        bgKey: 'Catalog Highlight Watched Background',
        keys: ['Catalog Highlight Watched Text Color', 'Catalog Highlight Watched Subject Color', 'Catalog Highlight Watched Link Color', 'Catalog Highlight Watched Quote Color', 'Catalog Highlight Watched Dead Link Color'] as const,
      },
      {
        manualGroup: 'catalog-filter',
        modeKey: 'Catalog Highlight Filter Text Mode',
        colorKey: 'Catalog Highlight Filter Color',
        opacityKey: 'Catalog Highlight Filter Opacity',
        bgKey: 'Catalog Highlight Filter Background',
        keys: ['Catalog Highlight Filter Text Color', 'Catalog Highlight Filter Subject Color', 'Catalog Highlight Filter Link Color', 'Catalog Highlight Filter Quote Color', 'Catalog Highlight Filter Dead Link Color'] as const,
      },
    ] as const;
    const textColorKeys = [
      'Text Color',
      'Link Text Color',
      'Quote Text Color',
      'Dead Link Text Color',
    ] as const;
    const hexEditableColorKeys = new Set([
      'Highlight Own Color',
      'Highlight You Color',
      'Highlight Ghost Color',
      'Catalog Highlight Own Color',
      'Catalog Highlight Watched Color',
      'Catalog Highlight Filter Color',
      'Scroll Marker Own Color',
      'Scroll Marker You Color',
      'Scroll Marker Ghost Color',
      'Scroll Marker Unread Color',
    ]);
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
    // loose: Settings.styleConf is seen as untyped here (TS2347 on explicit type args),
    // so drop the type arg and cast the (any) result; identical at runtime.
    const editConf = <T = any>(baseKey: string): T => Settings.styleConf(baseKey, editVariant()) as T;
    const writeEditConf = (baseKey: string, value: any) => {
      const storageKey = Settings.styleVariantKeySet.has(baseKey)
        ? Settings.variantKey(baseKey, editVariant())
        : baseKey;
      Conf[storageKey] = value;
      $.set(storageKey, value);
    };
    // Resolve a highlight row's text mode, preferring the live <select> value
    // so the preview reacts before the change is persisted.
    const groupTextMode = (group: typeof highlightTextControlGroups[number]) => {
      const el = inputs[group.modeKey] as HTMLSelectElement | null;
      return Settings.resolveTextMode(el ? el.value : editConf<string>(group.modeKey));
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
      const postBackground = Settings.getPostBaseBackground();
      const basePalette = baseTextPalette(baseBackground);
      const v = editVariant();
      for (const group of highlightTextControlGroups) {
        if (groupTextMode(group) !== 'auto') continue;
        const groupBackground = group.manualGroup.startsWith('catalog-') ? baseBackground : postBackground;
        const groupBasePalette = group.manualGroup.startsWith('catalog-')
          ? basePalette
          : baseTextPalette(postBackground);
        // Edge/border-only highlights leave the post on its base background, so
        // the auto color is derived from that, not the highlight-tinted background.
        const palette = !editConf<boolean>(group.bgKey)
          ? groupBasePalette
          : (Settings.autoHighlightTextPalette(group.colorKey, group.opacityKey, groupBackground, v) || groupBasePalette);
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
      const postBackground = Settings.getPostBaseBackground();
      const basePalette = baseTextPalette(baseBackground);
      const groups = targetGroup ? [targetGroup] : highlightTextControlGroups;
      const v = editVariant();
      for (const group of groups) {
        if (groupTextMode(group) !== 'manual') continue;
        const groupBackground = group.manualGroup.startsWith('catalog-') ? baseBackground : postBackground;
        const groupBasePalette = group.manualGroup.startsWith('catalog-')
          ? basePalette
          : baseTextPalette(postBackground);
        const autoPalette = !editConf<boolean>(group.bgKey)
          ? groupBasePalette
          : (Settings.autoHighlightTextPalette(group.colorKey, group.opacityKey, groupBackground, v) || groupBasePalette);
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
    const colorHexInputs: Record<string, HTMLInputElement> = dict();
    // Paint the merged control: the hex field carries the chosen color as its
    // own background, with text flipped to black/white for whichever reads
    // better against it.
    const applyMergedSwatch = (hexInput: HTMLInputElement, value: string) => {
      // Paint the whole wrapper (hex field + picker strip share it) so the
      // control reads as one seamless color-filled input.
      const merged = hexInput.parentElement as HTMLElement | null;
      const rgb = value ? Settings.hexToRgb(value) : null;
      if (!rgb) {
        if (merged) merged.style.background = '';
        hexInput.style.removeProperty('color');
        hexInput.style.removeProperty('-webkit-text-fill-color');
        return;
      }
      if (merged) merged.style.background = value;
      const onWhite = Settings.contrastRatio([255, 255, 255], rgb);
      const onBlack = Settings.contrastRatio([17, 17, 17], rgb);
      const textColor = onWhite >= onBlack ? '#fff' : '#111';
      hexInput.style.setProperty('color', textColor, 'important');
      hexInput.style.setProperty('-webkit-text-fill-color', textColor, 'important');
    };
    const syncColorHexInput = (baseKey: string) => {
      const colorInput = inputs[baseKey];
      const hexInput = colorHexInputs[baseKey];
      if (!colorInput || !hexInput) return;
      hexInput.value = colorInput.value || '';
      hexInput.disabled = colorInput.disabled;
      hexInput.classList.remove('styling-color-hex-invalid');
      applyMergedSwatch(hexInput, hexInput.value);
    };
    const syncColorHexInputs = () => {
      for (const baseKey in colorHexInputs) syncColorHexInput(baseKey);
    };
    for (const baseKey of hexEditableColorKeys) {
      const colorInput = inputs[baseKey];
      if (!colorInput || colorInput.type !== 'color') continue;
      // The swatch's own title (e.g. "Highlight background color" vs
      // "Scrollbar marker color") names which colour this is — carry it onto
      // the merged parts so the tooltip stays clear when both swatches share
      // the collapsed header (e.g. with "match highlight colour" off).
      const label = colorInput.title || '';
      const hexInput = $.el('input', {
        type: 'text',
        className: 'field styling-color-hex',
        placeholder: '#rrggbb',
        title: label ? `${label}: type a hex value` : 'Hex color, e.g. #ff5050',
      }) as HTMLInputElement;
      hexInput.maxLength = 7;
      hexInput.setAttribute('spellcheck', 'false');
      // Fuse the swatch and hex field into one control: the hex field shows the
      // colour as its own background, and the native picker collapses into a
      // small blank strip on the right (divider-separated) that opens on click.
      const merged = $.el('span', {
        className: 'styling-color-merged',
        title: label,
      }) as HTMLElement;
      const trigger = $.el('span', {
        className: 'styling-color-trigger',
        title: label ? `${label}: open picker` : 'Pick a color',
      }) as HTMLElement;
      colorInput.replaceWith(merged);
      trigger.appendChild(colorInput);
      merged.appendChild(hexInput);
      merged.appendChild(trigger);
      colorHexInputs[baseKey] = hexInput;
      $.on(hexInput, 'input', () => {
        const raw = hexInput.value.trim();
        const validPartial = /^#?[0-9a-f]{0,6}$/i.test(raw);
        const normalized = /^#?[0-9a-f]{6}$/i.test(raw)
          ? Settings.normalizeHexColorInput(raw)
          : null;
        hexInput.classList.toggle('styling-color-hex-invalid', !!raw && !validPartial);
        if (!normalized) return;
        colorInput.value = normalized;
        delete colorInput.dataset.unset;
        hexInput.value = normalized;
        colorInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      $.on(hexInput, 'change', () => {
        const normalized = Settings.normalizeHexColorInput(hexInput.value);
        if (normalized) {
          colorInput.value = normalized;
          delete colorInput.dataset.unset;
          hexInput.value = normalized;
          colorInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          syncColorHexInput(baseKey);
        }
      });
      $.on(colorInput, 'input', () => syncColorHexInput(baseKey));
      $.on(colorInput, 'change', () => syncColorHexInput(baseKey));
    }
    const syncCatalogHighlightControls = () => {
      const catalogEnabled = !!inputs['Enable Catalog Highlights']?.checked;
      for (const key of catalogHighlightKeys) {
        const enabled = catalogEnabled && !!inputs[key]?.checked;
        const controls = key === 'Catalog Highlight Own Posts' ?
          [
            'Catalog Highlight Own Color', 'Catalog Highlight Own Opacity', 'Catalog Highlight Own Background', 'Catalog Highlight Own Location', 'Catalog Highlight Own Border Width', 'Catalog Highlight Own Border Style', 'Catalog Highlight Own Glow', 'Catalog Highlight Own Glow Intensity', 'Catalog Highlight Own Text Mode',
            'Catalog Highlight Own Text Color', 'Catalog Highlight Own Subject Color', 'Catalog Highlight Own Link Color', 'Catalog Highlight Own Quote Color', 'Catalog Highlight Own Dead Link Color',
          ] :
          [
            'Catalog Highlight Watched Color', 'Catalog Highlight Watched Opacity', 'Catalog Highlight Watched Background', 'Catalog Highlight Watched Location', 'Catalog Highlight Watched Border Width', 'Catalog Highlight Watched Border Style', 'Catalog Highlight Watched Glow', 'Catalog Highlight Watched Glow Intensity', 'Catalog Highlight Watched Text Mode',
            'Catalog Highlight Watched Text Color', 'Catalog Highlight Watched Subject Color', 'Catalog Highlight Watched Link Color', 'Catalog Highlight Watched Quote Color', 'Catalog Highlight Watched Dead Link Color',
          ];
        for (const controlKey of controls) {
          const control = inputs[controlKey];
          if (control) control.disabled = !enabled;
        }
      }
      // The Filtered-thread row is independent of the catalog master (filter
      // highlights work regardless of the Own/Watched feature), so it's gated by
      // its own toggle only.
      const filterRowOn = !!inputs['Catalog Highlight Filter Posts']?.checked;
      for (const controlKey of [
        'Catalog Highlight Filter Color', 'Catalog Highlight Filter Opacity', 'Catalog Highlight Filter Background', 'Catalog Highlight Filter Location', 'Catalog Highlight Filter Border Width', 'Catalog Highlight Filter Border Style', 'Catalog Highlight Filter Glow', 'Catalog Highlight Filter Glow Intensity', 'Catalog Highlight Filter Text Mode',
        'Catalog Highlight Filter Text Color', 'Catalog Highlight Filter Subject Color', 'Catalog Highlight Filter Link Color', 'Catalog Highlight Filter Quote Color', 'Catalog Highlight Filter Dead Link Color',
      ]) {
        const control = inputs[controlKey];
        if (control) control.disabled = !filterRowOn;
      }
      // Glow intensity is only live when that row's glow is switched on.
      const gateGlow = (rowOn: boolean, glowKey: string, intensityKey: string) => {
        const intensity = inputs[intensityKey];
        if (intensity) intensity.disabled = !(rowOn && !!inputs[glowKey]?.checked);
      };
      gateGlow(catalogEnabled && !!inputs['Catalog Highlight Own Posts']?.checked, 'Catalog Highlight Own Glow', 'Catalog Highlight Own Glow Intensity');
      gateGlow(catalogEnabled && !!inputs['Catalog Highlight Watched Threads']?.checked, 'Catalog Highlight Watched Glow', 'Catalog Highlight Watched Glow Intensity');
      gateGlow(filterRowOn, 'Catalog Highlight Filter Glow', 'Catalog Highlight Filter Glow Intensity');
      syncColorHexInputs();
    };
    // The editable marker colour swatch (+ hex) normally lives in the body's
    // scrollbar-marker section, but hops up into the row header while the row is
    // collapsed so it can be tweaked at a glance. It's only promoted to the
    // header when the row has an independent marker colour to set — its marker
    // is on and not slaved to the highlight (matched markers mirror the
    // highlight swatch already in the header). When open, or with nothing to
    // adjust, it stays in its body slot.
    const placeMarkerColorControls = () => {
      const markersOn = !!inputs['Scrollbar Markers']?.checked;
      for (const { type, onKey, matchKey, highlightKey } of markerControlRows) {
        if (!highlightKey) continue; // unread's marker swatch has no body/header split
        const item = $(`[data-highlight-row="${type}"]`, section) as HTMLElement | null;
        if (!item) continue;
        const wrapper = $(`[data-marker-color="${type}"]`, item) as HTMLElement | null;
        const headSlot = $(`[data-mk-headslot="${type}"]`, item) as HTMLElement | null;
        const bodySlot = $(`[data-mk-bodyslot="${type}"]`, item) as HTMLElement | null;
        if (!wrapper || !headSlot || !bodySlot) continue;
        const open = item.classList.contains('styling-hl-open');
        const rowOn = markersOn && !!inputs[onKey]?.checked;
        const matched = !!(matchKey && inputs[matchKey]?.checked);
        const target = !open && rowOn && !matched ? headSlot : bodySlot;
        if (wrapper.parentElement !== target) target.appendChild(wrapper);
      }
    };
    const syncMarkerColorControls = () => {
      Settings.syncLinkedMarkerColors(inputs, editVariant());
      const markersOn = !!inputs['Scrollbar Markers']?.checked;
      for (const { type, onKey, colorKey, opacityKey, matchKey } of markerControlRows) {
        const rowOn = markersOn && !!inputs[onKey]?.checked;
        const matched = !!(matchKey && inputs[matchKey]?.checked);
        const onInput = inputs[onKey];
        if (onInput) onInput.disabled = !markersOn;
        if (matchKey && inputs[matchKey]) inputs[matchKey].disabled = !rowOn;
        const colorInput = inputs[colorKey];
        // A matched marker mirrors its highlight colour, so its picker is inert.
        if (colorInput) colorInput.disabled = !rowOn || matched;
        const opacityInput = inputs[opacityKey];
        if (opacityInput) opacityInput.disabled = !rowOn;
        const cell = $(`[data-marker-color="${type}"]`, section) as HTMLElement | null;
        if (cell) cell.dataset.colorLinked = matched ? 'true' : 'false';
      }
      placeMarkerColorControls();
      syncColorHexInputs();
    };
    const syncThreadHighlightControls = () => {
      const masterOn = !!inputs['Enable Thread Highlights']?.checked;
      for (const { onKey, controls } of threadHighlightControlRows) {
        const enabled = masterOn && !!inputs[onKey]?.checked;
        for (const key of controls) {
          const control = inputs[key];
          if (control) control.disabled = !enabled;
        }
      }
      syncColorHexInputs();
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
        const manual = groupTextMode(group) === 'manual';
        const manualRoot = $(`[data-highlight-text-manual="${group.manualGroup}"]`, section) as HTMLElement | null;
        if (manualRoot) manualRoot.hidden = !manual;
        for (const key of group.keys) {
          const colorInput = inputs[key];
          if (colorInput) colorInput.disabled = !manual;
          const clearButton = $(`[data-clear="${key}"]`, section) as HTMLButtonElement | null;
          if (clearButton) clearButton.disabled = !manual;
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
    // Highlight rows are an accordion: one open at a time. Clicks on a row's
    // colour swatch edit in place rather than collapsing it.
    const accItems = $$('.styling-hl-acc-item', section) as HTMLElement[];
    const updatePreviewStateFromRows = refreshStylingPreview;
    for (const head of $$('.styling-hl-acc-head', section) as HTMLElement[]) {
      $.on(head, 'click', (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.closest('.styling-hl-color')) return;
        const item = head.parentElement as HTMLElement;
        const open = item.classList.contains('styling-hl-open');
        for (const it of accItems) it.classList.remove('styling-hl-open');
        if (!open) item.classList.add('styling-hl-open');
        // Opening/closing changes where each row's marker colour swatch lives
        // (body section when open, header when collapsed).
        placeMarkerColorControls();
        updatePreviewStateFromRows();
      });
    }
    // Per-state width text inputs (px). Text inputs don't get the generic
    // colour/range apply handler, so wire live apply + clamp here.
    const widthInputKeys = [
      'Highlight Own Edge Width', 'Highlight You Edge Width', 'Highlight Ghost Edge Width',
      'Catalog Highlight Own Border Width', 'Catalog Highlight Watched Border Width', 'Catalog Highlight Filter Border Width',
    ];
    // Thread edges always show (min 1), but a catalog border can be turned off (min 0).
    const zeroWidthAllowedKeys = new Set([
      'Catalog Highlight Own Border Width', 'Catalog Highlight Watched Border Width', 'Catalog Highlight Filter Border Width',
    ]);
    const borderStyleInputKeys = new Set([
      'Highlight Own Border Style', 'Highlight You Border Style', 'Highlight Ghost Border Style',
      'Catalog Highlight Own Border Style', 'Catalog Highlight Watched Border Style', 'Catalog Highlight Filter Border Style',
      // Plain variant <select>s that just need persist + re-apply on change.
      'Catalog Highlight Own Location', 'Catalog Highlight Watched Location', 'Catalog Highlight Filter Location',
    ]);
    for (const key of widthInputKeys) {
      const inp = inputs[key];
      if (!inp) continue;
      const min = zeroWidthAllowedKeys.has(key) ? 0 : 1;
      const apply = () => { Settings.applyStylingVars(); refreshStylingPreview(); };
      $.on(inp, 'input', apply);
      $.on(inp, 'change', () => {
        let n = parseInt(inp.value, 10);
        if (!Number.isFinite(n)) n = 3;
        n = Math.min(12, Math.max(min, n));
        inp.value = String(n);
        writeEditConf(key, n);
        apply();
      });
    }
    // Live value readout next to each opacity slider so the current step shows
    // while dragging (a native range gives no number).
    const opacityReadouts: Array<{ range: HTMLInputElement; out: HTMLElement }> = [];
    // Always show two decimals (the slider step is 0.05) so the readout keeps a
    // fixed width and doesn't shift the row as the value crosses 1, 0.1, 0, etc.
    const fmtOpacity = (v: string) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n.toFixed(2) : v;
    };
    const refreshOpacityReadouts = () => {
      for (const { range, out } of opacityReadouts) out.textContent = fmtOpacity(range.value);
    };
    for (const range of $$('.styling-hl-octl input[type="range"]', section) as HTMLInputElement[]) {
      const out = $.el('span', { className: 'styling-hl-valout' }) as HTMLElement;
      range.insertAdjacentElement('afterend', out);
      const upd = () => { out.textContent = fmtOpacity(range.value); };
      $.on(range, 'input', upd);
      $.on(range, 'change', upd);
      opacityReadouts.push({ range, out });
    }
    refreshOpacityReadouts();
    const refreshUnsetColorInputs = () => {
      for (const key in inputs) {
        const inp = inputs[key];
        if (inp.type !== 'color' || inp.dataset.unset !== '1') continue;
        if (highlightTextKeys.has(key as any)) {
          const group = highlightTextControlGroups.find(item => (item.keys as readonly string[]).includes(key));
          if (group && groupTextMode(group) === 'manual') continue;
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
      const modeSelect = inputs[group.modeKey] as HTMLSelectElement | null;
      if (!modeSelect) continue;
      $.on(modeSelect, 'change', () => {
        writeEditConf(group.modeKey, modeSelect.value);
        const mode = Settings.resolveTextMode(modeSelect.value);
        if (mode === 'auto') {
          syncAutoHighlightPreviewInputs();
        } else if (mode === 'manual') {
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
        $.on(input, 'change', function(this: HTMLInputElement) { setCheckedState(this as HTMLInputElement); });
        $.on(input, 'change', () => {
          syncAutoHighlightPreviewInputs();
          Settings.applyStylingVars();
          refreshStylingPreview();
        });
        if (catalogHighlightKeys.includes(name as typeof catalogHighlightKeys[number])
          || name === 'Catalog Highlight Own Glow' || name === 'Catalog Highlight Watched Glow'
          || name === 'Catalog Highlight Filter Posts' || name === 'Catalog Highlight Filter Glow') {
          $.on(input, 'change', syncCatalogHighlightControls);
        }
        if (markerToggleKeys.has(name)) {
          $.on(input, 'change', syncMarkerColorControls);
        }
        if (threadHighlightToggleKeys.has(name)) {
          $.on(input, 'change', syncThreadHighlightControls);
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
        const applyColor = function(this: HTMLInputElement) {
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
      } else if (borderStyleInputKeys.has(name)) {
        $.on(input, 'change', () => {
          writeEditConf(name, (input as unknown as HTMLSelectElement).value);
          Settings.applyStylingVars();
          refreshStylingPreview();
        });
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
        // Don't let merely opening the Styling section apply a *fallback* site
        // theme onto the live page. With no saved siteStyle for this variant the
        // picker shows its first option (e.g. Yotsuba); calling Settings.siteStyle
        // here would push that onto the page, hijacking the theme that's actually
        // rendered. Only (re-)apply when the user has an explicit saved value.
        if (baseName === 'siteStyle' && !val) continue;
        if (baseName in Settings) Settings[baseName].call(inp);
      }
      syncMarkerColorControls();
      syncCatalogHighlightControls();
      syncThreadHighlightControls();
      syncTextColorControls();
      syncHighlightTextControls();
      seedManualHighlightTextColors();
      syncAutoHighlightPreviewInputs();
      Settings.applyStylingVars();
      refreshUnsetColorInputs();
      Settings.refreshCustomCSSEditor(section);
      syncColorHexInputs();
      refreshOpacityReadouts();
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
    // Reset every highlight setting to the active theme's defaults. Exposed as
    // the pinned "Theme defaults" row in the saved-palette list (below).
    const applyThemeDefaults = () => {
      for (const [baseKey, value] of themeDefaultSettings) {
        writeEditConf(baseKey, value);
        const input = inputs[baseKey];
        if (!input) continue;
        if (input.type === 'checkbox') {
          input.checked = !!value;
          setCheckedState(input);
        } else if (input.type === 'color') {
          Settings.setColorInputValue(input, baseKey, value);
        } else if (input.type === 'range') {
          input.value = value === '' ? '1' : String(value);
        } else {
          input.value = String(value ?? '');
        }
      }
      syncMarkerColorControls();
      syncCatalogHighlightControls();
      syncThreadHighlightControls();
      syncTextColorControls();
      syncHighlightTextControls();
      syncAutoHighlightPreviewInputs();
      Settings.applyStylingVars();
      refreshUnsetColorInputs();
      syncColorHexInputs();
      refreshOpacityReadouts();
      updatePreviewStateFromRows();
      refreshSuggestedPalettesIfOpen();
      $.event('RefreshScrollMarkers');
    };
    // Resolve the theme's own default highlight colors (independent of the
    // user's current overrides) for the pinned row's swatch preview.
    const themeDefaultPaletteColors = (): Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string> => {
      const exprs: Record<string, string> = {
        own: 'var(--xt-border-highlight, #d83030)',
        you: 'var(--xt-border-highlight, #d83030)',
        ghost: '#888888',
        catalogOwn: 'var(--xt-border-highlight, #d83030)',
        catalogWatched: 'var(--xt-watched-border, rgba(255, 0, 0, .75))',
      };
      const out: any = { own: '#000000', you: '#000000', ghost: '#888888', catalogOwn: '#000000', catalogWatched: '#000000' };
      const scope = Settings.dialog || d.body;
      if (!scope) return out;
      const host = $.el('div') as HTMLDivElement;
      host.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:0;top:0';
      const probes: Record<string, HTMLSpanElement> = {};
      for (const slot in exprs) {
        const probe = $.el('span') as HTMLSpanElement;
        probe.style.color = exprs[slot];
        probes[slot] = probe;
        $.add(host, probe);
      }
      $.add(scope, host);
      for (const slot in exprs) out[slot] = Settings.toHexColor(window.getComputedStyle(probes[slot]).color) || out[slot];
      $.rm(host);
      return out;
    };

    // Per-row reset for the Filtered-thread highlight back to its shipped
    // defaults (blank color ⇒ the theme's own filter color, glow on, etc.).
    const filterDefaultsBtn = $('#styling-filter-defaults', section) as HTMLButtonElement | null;
    if (filterDefaultsBtn) {
      const filterDefaults: Array<[string, any]> = [
        ['Catalog Highlight Filter Posts', true],
        ['Catalog Highlight Filter Color', ''],
        ['Catalog Highlight Filter Opacity', ''],
        ['Catalog Highlight Filter Background', false],
        ['Catalog Highlight Filter Location', 'image'],
        ['Catalog Highlight Filter Border Width', 2],
        ['Catalog Highlight Filter Border Style', 'solid'],
        ['Catalog Highlight Filter Glow', true],
        ['Catalog Highlight Filter Glow Intensity', 0.5],
        ['Catalog Highlight Filter Text Mode', 'default'],
        ['Catalog Highlight Filter Text Color', ''],
        ['Catalog Highlight Filter Subject Color', ''],
        ['Catalog Highlight Filter Link Color', ''],
        ['Catalog Highlight Filter Quote Color', ''],
        ['Catalog Highlight Filter Dead Link Color', ''],
      ];
      $.on(filterDefaultsBtn, 'click', (e: Event) => {
        e.preventDefault();
        for (const [baseKey, value] of filterDefaults) {
          writeEditConf(baseKey, value);
          const input = inputs[baseKey];
          if (!input) continue;
          if (input.type === 'checkbox') {
            input.checked = !!value;
            setCheckedState(input);
          } else if (input.type === 'color') {
            Settings.setColorInputValue(input, baseKey, value);
          } else if (input.type === 'range') {
            input.value = value === '' ? '1' : String(value);
          } else {
            input.value = String(value ?? '');
          }
        }
        syncCatalogHighlightControls();
        syncHighlightTextControls();
        syncAutoHighlightPreviewInputs();
        Settings.applyStylingVars();
        refreshUnsetColorInputs();
        syncColorHexInputs();
        refreshOpacityReadouts();
        updatePreviewStateFromRows();
      });
    }

    const paletteSuggestionRoot = $('#styling-palette-suggestions', section) as HTMLElement | null;
    const suggestPalettesBtn = $('#styling-suggest-palettes', section) as HTMLButtonElement | null;
    const savedPaletteNameInput = $('#styling-saved-palette-name', section) as HTMLInputElement | null;
    const savePaletteBtn = $('#styling-save-palette', section) as HTMLButtonElement | null;
    const savedPalettesList = $('#styling-saved-palettes-list', section) as HTMLElement | null;
    let suggestedPaletteBatch = 0;
    let suggestedRandomMode = false;
    const paletteStateMap = [
      ['own', 'Highlight Own Color', 'Thread: your post'],
      ['you', 'Highlight You Color', 'Thread: quotes you'],
      ['ghost', 'Highlight Ghost Color', 'Thread: ghost post'],
      ['catalogOwn', 'Catalog Highlight Own Color', 'Catalog: your post'],
      ['catalogWatched', 'Catalog Highlight Watched Color', 'Catalog: watched thread'],
    ] as const;
    // Scrollbar markers ride along with palettes, but only when a marker has a
    // colour of its own (not matched to, and not equal to, its highlight) — a
    // matched marker just mirrors the highlight, so there's nothing to store.
    const markerPaletteMap = [
      ['own', 'Scroll Marker Own Color', 'Highlight Own Color', 'Scroll Marker Own Match Highlight', 'Marker: your post'],
      ['you', 'Scroll Marker You Color', 'Highlight You Color', 'Scroll Marker You Match Highlight', 'Marker: quotes you'],
      ['ghost', 'Scroll Marker Ghost Color', 'Highlight Ghost Color', 'Scroll Marker Ghost Match Highlight', 'Marker: ghost post'],
    ] as const;
    type MarkerSlot = typeof markerPaletteMap[number][0];
    const resolveSlotColor = (baseKey: string) => {
      const inputColor = inputs[baseKey]?.value || '';
      const storedColor = editConf<string>(baseKey) || '';
      return (Settings.toHexColor(inputColor)
        || Settings.toHexColor(storedColor)
        || Settings.resolvedColorForKey(baseKey)
        || '#000000').toLowerCase();
    };
    const readCurrentPaletteColors = () => {
      const out = {
        own: '#000000',
        you: '#000000',
        ghost: '#000000',
        catalogOwn: '#000000',
        catalogWatched: '#000000',
      };
      for (const [slot, baseKey] of paletteStateMap) out[slot] = resolveSlotColor(baseKey);
      return out;
    };
    const readCurrentPaletteMarkers = () => {
      const markers: Partial<Record<MarkerSlot, string>> = {};
      for (const [slot, colorKey, highlightKey, matchKey] of markerPaletteMap) {
        if (editConf<boolean>(matchKey)) continue; // matched ⇒ mirrors highlight
        const markerColor = resolveSlotColor(colorKey);
        if (markerColor && markerColor !== resolveSlotColor(highlightKey)) markers[slot] = markerColor;
      }
      return markers;
    };
    // Persist a palette into the saved list (overwriting any same-named entry),
    // shared by the Save-palette button and the per-suggestion Save button.
    const persistPalette = (
      name: string,
      colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>,
      markers: Partial<Record<MarkerSlot, string>>,
    ) => {
      const list = Settings.savedHighlightPaletteList();
      const existing = list.findIndex((p: { name: string }) => p.name.toLowerCase() === name.toLowerCase());
      const entry = { name, colors, markers };
      if (existing >= 0) list[existing] = entry;
      else list.unshift(entry);
      Settings.setSavedHighlightPalettes(list);
      renderSavedPalettes();
    };
    function applySuggestedPalette(palette: {
      colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>;
      markers?: Partial<Record<MarkerSlot, string>>;
    }) {
      for (const [slot, baseKey] of paletteStateMap) {
        const color = palette.colors[slot];
        if (!color) continue;
        writeEditConf(baseKey, color);
        const inp = inputs[baseKey];
        if (inp) Settings.setColorInputValue(inp, baseKey, color);
      }
      // Only palettes that track markers (saved ones) touch marker state;
      // suggested palettes have no `markers` field and leave markers alone.
      if (palette.markers) {
        for (const [slot, colorKey, , matchKey] of markerPaletteMap) {
          const color = palette.markers[slot];
          const matchInp = inputs[matchKey];
          if (color) {
            writeEditConf(matchKey, false);
            if (matchInp) { matchInp.checked = false; setCheckedState(matchInp); }
            writeEditConf(colorKey, color);
            const colorInp = inputs[colorKey];
            if (colorInp) Settings.setColorInputValue(colorInp, colorKey, color);
          } else {
            writeEditConf(matchKey, true);
            if (matchInp) { matchInp.checked = true; setCheckedState(matchInp); }
          }
        }
      }
      syncMarkerColorControls();
      syncAutoHighlightPreviewInputs();
      Settings.applyStylingVars();
      refreshStylingPreview();
    }
    const buildRandomPalettes = (count = 6) => {
      const out: { name: string; colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string> }[] = [];
      for (let i = 0; i < count; i++) {
        out.push({
          name: `Random ${i + 1}`,
          colors: {
            own: Settings.randomHighlightColor(),
            you: Settings.randomHighlightColor(),
            ghost: Settings.randomHighlightColor(),
            catalogOwn: Settings.randomHighlightColor(),
            catalogWatched: Settings.randomHighlightColor(),
          },
        });
      }
      return out;
    };
    function renderSuggestedPalettes() {
      if (!paletteSuggestionRoot) return;
      const suggested = suggestedRandomMode ? null : Settings.suggestedHighlightPalettes(editVariant(), suggestedPaletteBatch);
      const palettes = suggested ? suggested.palettes : buildRandomPalettes();
      paletteSuggestionRoot.textContent = '';
      const header = $.el('div', { className: 'styling-palette-header' });
      const title = $.el('div', {
        className: 'styling-palette-title',
        textContent: suggested ? `Suggested palettes for ${suggested.profile.label}` : 'Random palettes',
      });
      const note = $.el('div', {
        className: 'styling-palette-note note',
        textContent: suggested ? suggested.profile.note : 'Freshly generated random palettes. Click Randomize for another set.',
      });
      // The header button randomizes the list; once in random mode a second
      // button returns to the curated suggestions.
      const randomize = $.el('button', {
        type: 'button',
        textContent: 'Randomize',
      }) as HTMLButtonElement;
      $.on(randomize, 'click', () => { suggestedRandomMode = true; renderSuggestedPalettes(); });
      $.add(header, [title, note, randomize]);
      if (suggestedRandomMode) {
        const back = $.el('button', {
          type: 'button',
          textContent: 'Back to suggested',
        }) as HTMLButtonElement;
        $.on(back, 'click', () => { suggestedRandomMode = false; renderSuggestedPalettes(); });
        $.add(header, back);
      }
      $.add(paletteSuggestionRoot, header);

      const list = $.el('div', { className: 'styling-palette-list' });
      for (const palette of palettes) {
        const row = $.el('div', { className: 'styling-palette-row' });
        const apply = $.el('button', {
          type: 'button',
          textContent: 'Apply',
        }) as HTMLButtonElement;
        $.on(apply, 'click', () => applySuggestedPalette(palette));
        // Save the suggestion straight to the saved list (its colors + whatever
        // markers are currently set), no apply-then-save round trip needed.
        const save = $.el('button', {
          type: 'button',
          textContent: 'Save',
          title: `Save "${palette.name}" to your palettes`,
        }) as HTMLButtonElement;
        $.on(save, 'click', () => {
          persistPalette(palette.name, palette.colors, readCurrentPaletteMarkers());
          save.textContent = 'Saved';
          save.disabled = true;
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
        $.add(row, [name, apply, save, swatches]);
        $.add(list, row);
      }
      $.add(paletteSuggestionRoot, list);
    }
    function renderSavedPalettes() {
      if (!savedPalettesList) return;
      savedPalettesList.textContent = '';
      // Pinned, immutable "Theme defaults" row: looks like a saved palette but
      // shows the theme's own colors and only offers Apply (no Delete).
      {
        const row = $.el('div', { className: 'styling-saved-palette-row styling-saved-palette-row-theme' });
        const apply = $.el('button', { type: 'button', textContent: 'Apply' }) as HTMLButtonElement;
        $.on(apply, 'click', () => applyThemeDefaults());
        const name = $.el('div', { className: 'styling-palette-name', textContent: 'Theme defaults' });
        const spacer = $.el('span', { className: 'styling-palette-rowspacer' });
        const swatches = $.el('div', { className: 'styling-palette-swatches' });
        const themeColors = themeDefaultPaletteColors();
        for (const [slot, , label] of paletteStateMap) {
          const color = themeColors[slot];
          const swatch = $.el('span', { className: 'styling-palette-swatch', title: `${label}: ${color}` }) as HTMLSpanElement;
          swatch.style.backgroundColor = color;
          $.add(swatches, swatch);
        }
        $.add(row, [name, apply, spacer, swatches]);
        $.add(savedPalettesList, row);
      }
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
        // Marker swatches only appear for markers stored as distinct from their
        // highlight (round, to read apart from the square highlight swatches).
        for (const [slot, , , , label] of markerPaletteMap) {
          const color = palette.markers?.[slot];
          if (!color) continue;
          const swatch = $.el('span', {
            className: 'styling-palette-swatch styling-palette-swatch-marker',
            title: `${label}: ${color}`,
          }) as HTMLSpanElement;
          swatch.style.backgroundColor = color;
          $.add(swatches, swatch);
        }
        $.add(row, [name, apply, remove, swatches]);
        $.add(savedPalettesList, row);
      }
    }
    function refreshSuggestedPalettesIfOpen() {
      if (!paletteSuggestionRoot || paletteSuggestionRoot.hidden) return;
      suggestedPaletteBatch = 0;
      renderSuggestedPalettes();
    }
    if (suggestPalettesBtn && paletteSuggestionRoot) {
      $.on(suggestPalettesBtn, 'click', () => {
        paletteSuggestionRoot.hidden = !paletteSuggestionRoot.hidden;
        suggestPalettesBtn.textContent = paletteSuggestionRoot.hidden ? 'Suggest palettes' : 'Hide palettes';
        if (!paletteSuggestionRoot.hidden) {
          suggestedPaletteBatch = 0;
          suggestedRandomMode = false;
          renderSuggestedPalettes();
        }
      });
    }
    if (savePaletteBtn && savedPaletteNameInput) {
      const saveCurrentPalette = () => {
        const name = savedPaletteNameInput.value.trim();
        if (!name) {
          savedPaletteNameInput.focus();
          return;
        }
        persistPalette(name, readCurrentPaletteColors(), readCurrentPaletteMarkers());
      };
      $.on(savePaletteBtn, 'click', saveCurrentPalette);
      $.on(savedPaletteNameInput, 'keydown', (e: KeyboardEvent) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        saveCurrentPalette();
      });
    }
    renderSavedPalettes();
    $.get({ savedHighlightPalettes: Conf['savedHighlightPalettes'] }, ({ savedHighlightPalettes }: { savedHighlightPalettes: any }) => {
      Conf['savedHighlightPalettes'] = savedHighlightPalettes;
      renderSavedPalettes();
    });

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
      const shortLabel = variant.toUpperCase();
      if (variantBar) variantBar.dataset.editingVariant = variant;
      stylingHost.dataset.editingVariant = variant;
      for (const detail of $$('details[data-variant-aware="true"]', section) as HTMLElement[]) {
        detail.dataset.variantLabel = shortLabel;
        const summaryText = $('.styling-section-summary-text', detail) as HTMLElement | null;
        if (summaryText) {
          summaryText.dataset.variantLabel = shortLabel;
          const oldBadge = $('summary > .styling-variant-badge', detail) as HTMLElement | null;
          if (oldBadge) $.rm(oldBadge);
          continue;
        }
        const summary = $('summary', detail) as HTMLElement | null;
        if (!summary) continue;
        let badge = $(':scope > .styling-variant-badge', summary) as HTMLElement | null;
        if (!badge) {
          badge = $.el('span', { className: 'styling-variant-badge' });
          const firstAction = Array.from(summary.children).find(child =>
            child.matches('button, input, select, textarea, label, [data-summary-action]')
          );
          summary.insertBefore(badge, firstAction || null);
        }
        badge.textContent = shortLabel;
      }
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
    // Greentext first so it stays visible within the catalog's clamped height,
    // then regular text, a link, a quotelink and a dead quotelink.
    return [
      '<span class="quote">&gt;greentext sample</span><br>',
      'Regular text with a ',
      '<a href="https://example.com/thread-preview" target="_blank" rel="nofollow noopener">link</a>, ',
      '<a class="quotelink" href="#p1213499548" rel="nofollow">&gt;&gt;1213499548</a>, ',
      'and a <a class="quotelink deadlink" href="#p1213000000" rel="nofollow">&gt;&gt;1213000000</a> dead link.'
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
    extraPostClass = '',
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
    extraPostClass?: string;
    subject?: string;
    message?: string;
    messageHTML?: string;
    summary?: string;
    excerpt?: string;
  }) {
    const threadClasses = `thread catalog-thread ${extraThreadClass}`.trim();
    const containerClasses = `postContainer catalog-container ${extraContainerClass}`.trim();
    const postClasses = `post catalog-post ${extraPostClass}`.trim();
    const safeSubject = E(subject || 'Catalog subject preview');
    const renderedMessage = messageHTML || E(message || Settings.stylingPreviewSampleText());
    const safeSummary = E(summary || '4 posts and 2 image replies');
    const safeExcerpt = E(excerpt || 'recent reply preview');
    return `
      <div class="${threadClasses}" id="t${threadID}" style="--tn-w: 250; --tn-h: 196;">
        <div class="${containerClasses}" id="pc${threadID}" data-full-i-d="g.${threadID}">
          <div id="p${postID}" class="${postClasses}">
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

  stylingPreviewThreadState(state = 'default') {
    // Every thread state shares identical body content so only the highlight styling
    // (and the subject label naming the type) differs between them.
    const messageHTML = [
      'Sample post text with a ',
      '<a href="https://example.com/thread-preview" target="_blank" rel="nofollow noopener">regular link</a>, ',
      '<a class="quotelink" href="#p1213499548" rel="nofollow">&gt;&gt;1213499548</a>, ',
      'and a <a class="quotelink deadlink" href="#p1213000000" rel="nofollow">&gt;&gt;1213000000</a> dead link.',
      '<br><span class="quote">&gt;greentext sample</span>'
    ].join('');
    const states = {
      default: { subject: 'Default post', extraClass: '', messageHTML },
      own: { subject: 'Your post', extraClass: 'yourPost', messageHTML },
      you: { subject: 'Quotes you', extraClass: 'quotesYou', messageHTML },
      ghost: { subject: 'Ghost post', extraClass: 'from-archive', messageHTML },
    };
    return states[state as keyof typeof states] || states.default;
  },

  stylingPreviewCatalogState(state = 'default') {
    const sampleMessageHTML = Settings.stylingPreviewSampleMessageHTML();
    const states = {
      default: {
        subject: 'Default catalog',
        extraThreadClass: '',
        extraContainerClass: '',
        extraPostClass: '',
        messageHTML: sampleMessageHTML,
        summary: '4 posts and 2 image replies',
        excerpt: 'recent reply preview',
      },
      // Preview-only trigger classes (xtcat-*) instead of the real
      // yourPost/watched/filter-highlight, so the document-level real-board
      // catalog rules can't leak into and fight this live preview.
      'catalog-own': {
        subject: 'Your catalog post',
        extraThreadClass: 'xtcat-own',
        extraContainerClass: 'xtcat-own',
        extraPostClass: 'xtcat-own',
        messageHTML: sampleMessageHTML,
        summary: 'You replied in this thread',
        excerpt: 'your reply preview',
      },
      'catalog-watched': {
        subject: 'Watched catalog',
        extraThreadClass: 'xtcat-watched',
        extraContainerClass: '',
        extraPostClass: '',
        messageHTML: sampleMessageHTML,
        summary: 'Watched thread preview',
        excerpt: 'watched reply preview',
      },
      'catalog-filter': {
        subject: 'Filtered thread',
        extraThreadClass: 'xtcat-filter',
        extraContainerClass: 'xtcat-filter',
        extraPostClass: 'xtcat-filter',
        messageHTML: sampleMessageHTML,
        summary: 'Filtered thread preview',
        excerpt: 'filtered reply preview',
      }
    };
    return states[state as keyof typeof states] || states.default;
  },

  refreshStylingPreviewFromDialog() {
    const editVariant = Settings.stylingEditingVariant || Settings.getBoardVariant();
    const storageKeyFor = (name: string) => Settings.styleVariantKeySet.has(name)
      ? Settings.variantKey(name, editVariant)
      : name;
    const findInput = (name: string) => {
      if (!Settings.dialog) return null;
      return $(`[name="${name}"], [name="${storageKeyFor(name)}"]`, Settings.dialog) as HTMLInputElement | HTMLSelectElement | null;
    };
    const readConf = (name: string) => {
      const storageKey = storageKeyFor(name);
      return Conf[storageKey] == null ? Conf[name] : Conf[storageKey];
    };
    const readChecked = (name: string, fallback = false) => {
      const input = findInput(name) as HTMLInputElement | null;
      if (input) return !!input.checked;
      const value = readConf(name);
      return value == null ? fallback : !!value;
    };
    const readOpacity = (name: string) => {
      const input = findInput(name) as HTMLInputElement | null;
      const value = input ? input.value : readConf(name);
      if (value === '' || value == null) return 1;
      const opacity = parseFloat(String(value));
      return Number.isFinite(opacity) ? $.minmax(opacity, 0, 1) : 1;
    };
    const readValue = (name: string) => {
      const input = findInput(name);
      if (input) return input.value;
      const value = readConf(name);
      return value == null ? '' : String(value);
    };

    if (!Settings.dialog) return;

    // Each highlight row owns a permanent inline preview (data-preview-inline). The
    // preview is a pure style demonstrator: it always renders its highlight so the row
    // shows the style even when its on-page toggle is off. Edge/background and colours
    // reflect the configured style (via the shared --xt-* vars) so it stays accurate.
    const threadIDs: { [row: string]: number } = { own: 503286550, you: 503286551, ghost: 503286552 };
    const catalogIDs: { [row: string]: number } = {
      'catalog-own': 503286560, 'catalog-watched': 503286561, 'catalog-filter': 503286562,
    };
    const background = Settings.resolveCanvasBackgroundStyle();

    for (const inline of $$('[data-preview-inline]', Settings.dialog) as HTMLElement[]) {
      const row = inline.dataset.previewInline || '';
      inline.dataset.highlightOwn = 'true';
      inline.dataset.highlightYou = 'true';
      inline.dataset.highlightGhost = 'true';
      inline.dataset.highlightCatalogOwn = 'true';
      inline.dataset.highlightCatalogWatched = 'true';

      // dataset.edge* drives the preview's edge-only styling: edge-only === background off.
      inline.dataset.edgeOwn = readChecked('Highlight Own Background', false) ? 'false' : 'true';
      inline.dataset.edgeYou = readChecked('Highlight You Background', false) ? 'false' : 'true';
      inline.dataset.edgeGhost = readChecked('Highlight Ghost Background', false) ? 'false' : 'true';
      inline.dataset.edgeCatalogOwn = readChecked('Catalog Highlight Own Background', false) ? 'false' : 'true';
      inline.dataset.edgeCatalogWatched = readChecked('Catalog Highlight Watched Background', false) ? 'false' : 'true';
      inline.dataset.textCatalogOwn =
        (inline.dataset.edgeCatalogOwn !== 'true' && readOpacity('Catalog Highlight Own Opacity') > 0) ? 'true' : 'false';
      inline.dataset.textCatalogWatched =
        (inline.dataset.edgeCatalogWatched !== 'true' && readOpacity('Catalog Highlight Watched Opacity') > 0) ? 'true' : 'false';

      // dataset.loc* mirrors the "Highlight location" select: in image mode the
      // highlight sits on the thumbnail, not the whole tile.
      inline.dataset.locCatalogOwn = readValue('Catalog Highlight Own Location') === 'image' ? 'image' : 'tile';
      inline.dataset.locCatalogWatched = readValue('Catalog Highlight Watched Location') === 'image' ? 'image' : 'tile';
      inline.dataset.locCatalogFilter = readValue('Catalog Highlight Filter Location') === 'image' ? 'image' : 'tile';

      // dataset.glow* mirrors the Glow checkbox: the halo follows the location too.
      inline.dataset.glowCatalogOwn = readChecked('Catalog Highlight Own Glow', false) ? 'true' : 'false';
      inline.dataset.glowCatalogWatched = readChecked('Catalog Highlight Watched Glow', false) ? 'true' : 'false';

      const container = $('.styling-preview-container', inline) as HTMLElement | null;
      if (container && !container.firstElementChild) {
        if (threadIDs[row] != null) {
          const state = Settings.stylingPreviewThreadState(row);
          container.innerHTML =
            `<div class="board styling-preview-thread"><div class="thread">${Settings.stylingPreviewPostHTML({ postID: threadIDs[row], ...state })}</div></div>`;
        } else if (catalogIDs[row] != null) {
          const state = Settings.stylingPreviewCatalogState(row);
          const id = catalogIDs[row];
          container.innerHTML =
            `<div class="board styling-preview-catalog catalog-small">${Settings.stylingPreviewCatalogThreadHTML({ threadID: id, postID: id, ...state })}</div>`;
        }
      }

      for (const pane of $$('.styling-preview-thread, .styling-preview-catalog', inline) as HTMLElement[]) {
        Settings.applyBackgroundStyle(pane, background);
      }
    }
  },

  initCustomCSSEditor(section: HTMLElement, textarea: HTMLTextAreaElement | null) {
    if (!textarea) return;
    // Already detached and the Styling section just re-rendered: keep the live
    // panel and discard this freshly-docked editor (mirrors makeDetachable). Done
    // before any setup since the fresh editor is thrown away.
    const liveDetach = Settings.detached['settings.customCSSPanel'];
    if (liveDetach) {
      const freshDetails = $('.styling-custom-css', section) as HTMLElement | null;
      const freshButton = $('#custom-css-detach', section) as HTMLElement | null;
      if (freshDetails && freshButton) liveDetach.adopt(freshDetails, freshButton);
      return;
    }
    // Keep textarea layout deterministic so the text layer stays aligned with
    // the highlighted overlay regardless of theme or browser defaults.
    textarea.wrap = 'off';
    textarea.spellcheck = false;
    textarea.hidden = false;
    const editor = $('.custom-css-editor', section) as HTMLDivElement | null;
    const highlight = $('.custom-css-highlight', section) as HTMLPreElement | null;
    const themeSelect = $('#custom-css-theme', section) as HTMLSelectElement | null;
    const bracketToggle = $('#custom-css-bracket-highlight', section) as HTMLInputElement | null;
    const autocompleteToggle = $('#custom-css-autocomplete', section) as HTMLInputElement | null;
    // Optional: an older detached template may lack it, so don't gate init on it.
    const formatButton = $('#custom-css-format', section) as HTMLButtonElement | null;
    if (!editor || !highlight || !themeSelect || !bracketToggle || !autocompleteToggle) return;

    const gutter = $('.custom-css-gutter', editor) as HTMLElement | null;
    const gutterInner = gutter ? ($('.custom-css-gutter-inner', gutter) as HTMLElement | null) : null;
    const colorInput = $('.ccss-color-input', editor) as HTMLInputElement | null;

    const syncScroll = () => {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
      if (gutterInner) gutterInner.style.transform = `translateY(${-textarea.scrollTop}px)`;
    };

    // ── Colour swatches ────────────────────────────────────────────────────
    // A clickable swatch in the left gutter on each line that contains a colour
    // (hex / rgb(a) / hsl(a), outside comments & strings). Clicking opens the
    // native picker; the chosen colour is written back in the line's original
    // format, preserving any alpha the native picker can't edit. Lines never wrap
    // (white-space:pre) so a swatch's Y is just lineIndex × line-height — no DOM
    // measurement needed; the gutter scrolls via the transform in syncScroll.
    const highlightOffsetFromPoint = (clientX: number, clientY: number) => {
      let node: Node | null = null;
      let offset = 0;
      const caretPositionFromPoint = (d as any).caretPositionFromPoint;
      const caretRangeFromPoint = (d as any).caretRangeFromPoint;
      if (caretPositionFromPoint) {
        const pos = caretPositionFromPoint.call(d, clientX, clientY);
        node = pos?.offsetNode || null;
        offset = pos?.offset || 0;
      } else if (caretRangeFromPoint) {
        const range = caretRangeFromPoint.call(d, clientX, clientY);
        node = range?.startContainer || null;
        offset = range?.startOffset || 0;
      }
      if (!node || !highlight.contains(node)) return null;
      let count = 0;
      const walker = d.createTreeWalker(highlight, NodeFilter.SHOW_TEXT);
      for (let cur = walker.nextNode(); cur; cur = walker.nextNode()) {
        if (cur === node) return count + offset;
        count += cur.textContent?.length || 0;
      }
      return null;
    };

    const focusEditorSurface = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || target === textarea || target.closest('.ccss-swatch, .ccss-color-input')) return;
      if (textarea.disabled) return;
      const pointer = e as MouseEvent;
      const offset = highlightOffsetFromPoint(pointer.clientX, pointer.clientY);
      e.preventDefault();
      textarea.focus();
      if (offset != null) {
        const pos = Math.min(textarea.value.length, Math.max(0, offset));
        textarea.setSelectionRange(pos, pos);
        if (bracketToggle.checked) Settings.renderCustomCSSHighlight(textarea, highlight);
      }
    };
    editor.addEventListener('pointerdown', focusEditorSurface, true);
    editor.addEventListener('mousedown', focusEditorSurface, true);

    const COLOR_RE = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b|(?:rgba?|hsla?)\([^)]*\)/gi;
    const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    const toHex2 = (n: number) => clamp255(n).toString(16).padStart(2, '0');
    const rgbToHex = (r: number, g: number, b: number) => `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
    const fmtA = (a: number) => String(Math.round(a * 1000) / 1000);

    const hslToRgb = (h: number, s: number, l: number) => {
      h = (((h % 360) + 360) % 360) / 360;
      if (s === 0) { const v = l * 255; return { r: v, g: v, b: v }; }
      const hue = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      return { r: hue(p, q, h + 1 / 3) * 255, g: hue(p, q, h) * 255, b: hue(p, q, h - 1 / 3) * 255 };
    };
    const rgbToHsl = (r: number, g: number, b: number) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0; const l = (max + min) / 2;
      if (max !== min) {
        const dd = max - min;
        s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
        h = max === r ? (g - b) / dd + (g < b ? 6 : 0)
          : max === g ? (b - r) / dd + 2
          : (r - g) / dd + 4;
        h /= 6;
      }
      return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    };

    type ParsedColor = { r: number; g: number; b: number; a: number | undefined; format: string };
    const parseColor = (raw: string): ParsedColor | null => {
      const str = raw.trim();
      let m: RegExpMatchArray | null;
      if ((m = str.match(/^#([0-9a-f]{3,8})$/i))) {
        const h = m[1];
        const hx = (a: number, b: number) => parseInt(h.slice(a, b), 16);
        if (h.length === 3) return { r: hx(0, 1) * 17, g: hx(1, 2) * 17, b: hx(2, 3) * 17, a: undefined, format: 'hex' };
        if (h.length === 4) return { r: hx(0, 1) * 17, g: hx(1, 2) * 17, b: hx(2, 3) * 17, a: hx(3, 4) * 17 / 255, format: 'hexa' };
        if (h.length === 6) return { r: hx(0, 2), g: hx(2, 4), b: hx(4, 6), a: undefined, format: 'hex' };
        if (h.length === 8) return { r: hx(0, 2), g: hx(2, 4), b: hx(4, 6), a: hx(6, 8) / 255, format: 'hexa' };
        return null;
      }
      if ((m = str.match(/^rgba?\(([^)]*)\)$/i))) {
        const p = m[1].split(/[,/\s]+/).filter(Boolean);
        if (p.length < 3) return null;
        const n = (s: string) => s.endsWith('%') ? parseFloat(s) * 255 / 100 : parseFloat(s);
        const r = n(p[0]), g = n(p[1]), b = n(p[2]);
        if ([r, g, b].some(isNaN)) return null;
        const a = p[3] != null ? (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3])) : undefined;
        return { r, g, b, a, format: a == null ? 'rgb' : 'rgba' };
      }
      if ((m = str.match(/^hsla?\(([^)]*)\)$/i))) {
        const p = m[1].split(/[,/\s]+/).filter(Boolean);
        if (p.length < 3) return null;
        const h = parseFloat(p[0]), s = parseFloat(p[1]) / 100, l = parseFloat(p[2]) / 100;
        if ([h, s, l].some(isNaN)) return null;
        const a = p[3] != null ? (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3])) : undefined;
        const c = hslToRgb(h, s, l);
        return { r: c.r, g: c.g, b: c.b, a, format: a == null ? 'hsl' : 'hsla' };
      }
      return null;
    };

    const formatColor = (format: string, r: number, g: number, b: number, a: number | undefined) => {
      r = clamp255(r); g = clamp255(g); b = clamp255(b);
      switch (format) {
        case 'hexa': return rgbToHex(r, g, b) + toHex2((a ?? 1) * 255);
        case 'rgb':  return `rgb(${r}, ${g}, ${b})`;
        case 'rgba': return `rgba(${r}, ${g}, ${b}, ${fmtA(a ?? 1)})`;
        case 'hsl':  { const c = rgbToHsl(r, g, b); return `hsl(${c.h}, ${c.s}%, ${c.l}%)`; }
        case 'hsla': { const c = rgbToHsl(r, g, b); return `hsla(${c.h}, ${c.s}%, ${c.l}%, ${fmtA(a ?? 1)})`; }
        default:     return rgbToHex(r, g, b);
      }
    };

    let activeSwatch: HTMLElement | null = null;

    const openColorPicker = (sw: HTMLElement) => {
      if (!colorInput) return;
      activeSwatch = sw;
      const cur = parseColor(textarea.value.slice(+sw.dataset.start!, +sw.dataset.end!));
      colorInput.value = cur ? rgbToHex(cur.r, cur.g, cur.b) : '#000000';
      const r = sw.getBoundingClientRect();
      colorInput.style.left = `${r.left}px`;
      colorInput.style.top = `${r.bottom}px`;
      colorInput.click();
    };

    const renderSwatches = () => {
      if (!gutterInner) return;
      gutterInner.textContent = '';
      const text = textarea.value;
      const ignored = Settings.customCSSIgnoredCharMask(text);
      const cs = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(cs.lineHeight) || 17;
      const padTop = parseFloat(cs.paddingTop) || 8;
      const seen = new Set<number>();
      let line = 0, scan = 0;
      COLOR_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = COLOR_RE.exec(text))) {
        const start = m.index;
        while (scan < start) { if (text[scan] === '\n') line++; scan++; }
        if (ignored[start] || seen.has(line)) continue;
        const parsed = parseColor(m[0]);
        if (!parsed) continue;
        seen.add(line);
        const sw = $.el('button', { className: 'ccss-swatch', type: 'button' }) as HTMLButtonElement;
        sw.style.top = `${padTop + line * lineHeight + (lineHeight - 13) / 2}px`;
        sw.style.background = rgbToHex(parsed.r, parsed.g, parsed.b);
        sw.dataset.start = String(start);
        sw.dataset.end = String(start + m[0].length);
        sw.dataset.format = parsed.format;
        sw.dataset.alpha = parsed.a == null ? '' : String(parsed.a);
        sw.title = m[0];
        $.on(sw, 'mousedown', (e: Event) => e.preventDefault());
        $.on(sw, 'click', (e: Event) => { e.preventDefault(); openColorPicker(sw); });
        $.add(gutterInner, sw);
      }
    };

    if (colorInput) $.on(colorInput, 'change', () => {
      const sw = activeSwatch;
      activeSwatch = null;
      if (!sw) return;
      const start = +sw.dataset.start!, end = +sw.dataset.end!;
      if (!parseColor(textarea.value.slice(start, end))) return; // text shifted under us
      const picked = parseColor(colorInput.value);
      if (!picked) return;
      const alpha = sw.dataset.alpha ? parseFloat(sw.dataset.alpha) : undefined;
      const replacement = formatColor(sw.dataset.format || 'hex', picked.r, picked.g, picked.b, alpha);
      textarea.focus();
      textarea.setSelectionRange(start, end);
      let ok = false;
      try { ok = d.execCommand('insertText', false, replacement); } catch {}
      if (!ok) {
        textarea.value = textarea.value.slice(0, start) + replacement + textarea.value.slice(end);
        textarea.setSelectionRange(start + replacement.length, start + replacement.length);
      }
      Settings.renderCustomCSSHighlight(textarea, highlight);
      renderSwatches();
      $.event('change', null, textarea); // persist + Saved flash
    });

    // Briefly flash the "Saved" badge. Fires on every commit — autosave (the
    // textarea's change event on blur) and the Ctrl+S reflex alike, since that
    // shortcut just dispatches change (see bindCustomCSSEditorKeys).
    let savedFlashTimer = 0;
    const flashSaved = () => {
      const badge = $('.custom-css-saved', editor) as HTMLElement | null;
      if (!badge) return;
      badge.dataset.show = 'true';
      clearTimeout(savedFlashTimer);
      savedFlashTimer = window.setTimeout(() => { badge.dataset.show = 'false'; }, 900);
    };

    // ── Detach into a floating, draggable, resizable panel ─────────────────
    // "Detach" lifts the entire Custom CSS section (toggles, controls, editor)
    // out of the scrolling settings page into a free-floating window. We
    // *relocate* the live <details> node (not a clone) so every wired listener
    // keeps working, leaving a "Re-attach" note in its place. The panel is added
    // inside `section` (which carries `section-styling`) so the editor's theme
    // rules — scoped under that class — still match; position:fixed keeps it
    // viewport-anchored regardless. Closing Settings removes the panel with it,
    // and reopening renders the section docked again.
    // curButton/curDetails track the *live* (possibly-edited) editor and the
    // button currently controlling it; adopt() swaps them in on re-render.
    let curButton = $('#custom-css-detach', section) as HTMLElement | null;
    let curDetails = editor.closest('.styling-custom-css') as HTMLElement | null;
    let panel: HTMLElement | null = null;
    let detachNote: HTMLElement | null = null;
    let panelResizeObserver: ResizeObserver | null = null;
    let panelSaveTimer = 0;

    const placeDetachNote = (before: HTMLElement) => {
      detachNote = $.el('div', {
        className: 'custom-css-detached-note',
        innerHTML: 'Custom CSS is detached. <button type="button" class="custom-css-reattach">Re-attach</button>',
      }) as HTMLElement;
      before.parentNode!.insertBefore(detachNote, before);
      $.on($('.custom-css-reattach', detachNote) as HTMLElement, 'click', closeDetach);
    };

    const writePanelRect = () => {
      if (!panel) return;
      const r = panel.getBoundingClientRect();
      $.set('settings.customCSSPanel', {
        left: Math.round(r.left), top: Math.round(r.top),
        width: Math.round(r.width), height: Math.round(r.height),
      });
    };
    // Debounced so a drag-resize (which fires the observer continuously) doesn't
    // hammer storage; closeDetach flushes the final rect synchronously.
    const savePanelRect = () => {
      clearTimeout(panelSaveTimer);
      panelSaveTimer = window.setTimeout(writePanelRect, 250);
    };

    // The editor's theme vars don't inherit upward, so copy their resolved values
    // onto the panel to keep its chrome matching the active syntax theme.
    const refreshPanelTheme = () => {
      if (!panel) return;
      const ecs = window.getComputedStyle(editor);
      for (const v of ['--custom-css-bg', '--custom-css-text', '--custom-css-border']) {
        panel.style.setProperty(v, ecs.getPropertyValue(v));
      }
    };

    // Default geometry: a large, centered window sized to the viewport.
    const centerPanelDefault = () => {
      if (!panel) return;
      const maxW = window.innerWidth, maxH = window.innerHeight;
      const w = Math.min(1100, Math.round(maxW * 0.96));
      const h = Math.min(820, Math.round(maxH * 0.92));
      panel.style.width = `${w}px`;
      panel.style.height = `${h}px`;
      panel.style.left = `${Math.round((maxW - w) / 2)}px`;
      panel.style.top = `${Math.round((maxH - h) / 2)}px`;
      syncScroll();
    };
    // Reset button: recentre at the default size and persist it so it sticks.
    const resetPanel = () => {
      centerPanelDefault();
      writePanelRect();
    };

    const onBarMousedown = (e: MouseEvent) => {
      if (e.button !== 0 || !panel) return;
      if ((e.target as HTMLElement).closest('button')) return; // let the close button click
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const dy = e.clientY - rect.top;
      const onMove = (me: MouseEvent) => {
        if (!panel) return;
        const left = Math.max(0, Math.min(me.clientX - dx, window.innerWidth - panel.offsetWidth));
        const top = Math.max(0, Math.min(me.clientY - dy, window.innerHeight - panel.offsetHeight));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
      };
      const onUp = () => {
        $.off(d, 'mousemove', onMove);
        $.off(d, 'mouseup', onUp);
        writePanelRect();
      };
      $.on(d, 'mousemove', onMove);
      $.on(d, 'mouseup', onUp);
    };

    const closeDetach = () => {
      if (!panel) return;
      panelResizeObserver?.disconnect();
      panelResizeObserver = null;
      clearTimeout(panelSaveTimer);
      writePanelRect();
      if (detachNote?.parentNode && curDetails) {
        detachNote.parentNode.insertBefore(curDetails, detachNote);
        detachNote.remove();
      }
      detachNote = null;
      if (curDetails) delete curDetails.dataset.detached;
      $.rm(panel);
      panel = null;
      if (curButton) curButton.dataset.open = 'false';
      delete Settings.detached['settings.customCSSPanel'];
      // Rejoin the accordion group it left on detach (re-adds the shared name).
      const sec = $('section', Settings.dialog) as HTMLElement | null;
      if (sec) Settings.applyAccordionMode(sec);
      syncScroll();
    };

    // Re-render while detached: discard the freshly-docked editor (the live,
    // possibly-edited one stays in the panel), leave a note, rebind the button.
    const adoptDetach = (freshDetails: HTMLElement, freshButton: HTMLElement) => {
      placeDetachNote(freshDetails);
      $.rm(freshDetails);
      curButton = freshButton;
      curButton.dataset.open = 'true';
      $.on(curButton, 'click', toggleDetach);
    };

    const openDetach = () => {
      if (panel || !curDetails) return;

      // Mark the spot with a visible "Re-attach" note (also our restore anchor).
      placeDetachNote(curDetails);

      panel = $.el('div', {
        // `section-styling` so the editor's theme rules (scoped `.section-styling
        // .custom-css-editor[...]`) still match now that the panel lives in the
        // overlay rather than inside the styling section.
        className: 'custom-css-panel section-styling',
        innerHTML:
          '<div class="custom-css-panel-bar">' +
            '<span class="custom-css-panel-title">Custom CSS</span>' +
            '<span class="custom-css-panel-actions">' +
              '<button type="button" class="custom-css-panel-reset" title="Reset size and position">Reset</button>' +
              '<button type="button" class="custom-css-panel-close" title="Re-attach">×</button>' +
            '</span>' +
          '</div>' +
          '<div class="custom-css-panel-body"></div>',
      }) as HTMLElement;

      const bar = $('.custom-css-panel-bar', panel) as HTMLElement;
      const body = $('.custom-css-panel-body', panel) as HTMLElement;
      // Leave the accordion group (see makeDetachable): otherwise a same-named
      // section opening elsewhere collapses this panel into a blank box.
      curDetails.removeAttribute('name');
      (curDetails as HTMLDetailsElement).open = true;
      curDetails.dataset.detached = 'true';
      $.add(body, curDetails);

      $.on($('.custom-css-panel-close', panel) as HTMLElement, 'click', closeDetach);
      $.on($('.custom-css-panel-reset', panel) as HTMLElement, 'click', resetPanel);
      $.on(bar, 'mousedown', onBarMousedown as (e: Event) => void);
      // Clicking anywhere in the panel raises it above the settings window.
      $.on(panel, 'mousedown', () => Settings.raiseToFront(panel));

      // Sibling of the settings window in the overlay (not nested) so the
      // window's shadow casts over it and click-to-front ordering is uniform.
      $.add((Settings.dialog as HTMLElement) || section, panel);
      Settings.raiseToFront(panel);
      // Register so a later re-render of Styling adopts (keeps) this panel.
      Settings.detached['settings.customCSSPanel'] = { adopt: adoptDetach };
      refreshPanelTheme();

      // Restore saved geometry (clamped to the viewport) or centre at a default.
      $.get({ 'settings.customCSSPanel': null }, (prefs: Record<string, any>) => {
        if (!panel) return;
        const saved = prefs['settings.customCSSPanel'];
        if (saved && saved.width) {
          const maxW = window.innerWidth, maxH = window.innerHeight;
          const w = Math.min(saved.width, maxW - 20);
          const h = Math.min(saved.height, maxH - 20);
          panel.style.width = `${w}px`;
          panel.style.height = `${h}px`;
          panel.style.left = `${Math.max(0, Math.min(saved.left, maxW - w))}px`;
          panel.style.top = `${Math.max(0, Math.min(saved.top, maxH - h))}px`;
          syncScroll();
        } else {
          centerPanelDefault();
        }
        // Observe only after the initial size so we don't persist transient
        // pre-layout dimensions.
        panelResizeObserver = new ResizeObserver(savePanelRect);
        panelResizeObserver.observe(panel);
      });

      if (curButton) curButton.dataset.open = 'true';
      textarea.focus();
    };

    // Detach lives inside <summary>, whose click would otherwise toggle the
    // <details>; preventDefault/stopPropagation keep the disclosure state put.
    function toggleDetach(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      panel ? closeDetach() : openDetach();
    }
    if (curButton) $.on(curButton, 'click', toggleDetach);

    const updateTheme = (save = false) => {
      const choice = themeSelect.value || 'xt-system';
      editor.dataset.theme = Settings.resolveCustomCSSEditorTheme(choice);
      // Pin live-sampled colours when StyleChan/custom themes leave no native
      // class to drive the palette; clears the overrides for every other theme.
      Settings.applyCustomCSSEditorSystemColors(editor);
      refreshPanelTheme(); // keep the detached panel chrome in sync (no-op when docked)
      if (save) $.set('settings.customCSSEditorTheme', choice);
    };

    const updateBracketHighlight = (enabled: boolean, save = false) => {
      bracketToggle.checked = enabled;
      highlight.dataset.bracketHighlight = enabled ? 'true' : 'false';
      if (save) $.set('settings.customCSSEditorBracketHighlight', enabled);
      Settings.renderCustomCSSHighlight(textarea, highlight);
      syncScroll();
    };

    // Class-name autocomplete reads this dataset flag (see bindCustomCSSEditorKeys),
    // so toggling it here turns the popup on/off without rewiring the editor.
    const updateAutocomplete = (enabled: boolean, save = false) => {
      autocompleteToggle.checked = enabled;
      editor.dataset.autocomplete = enabled ? 'true' : 'false';
      if (save) $.set('settings.customCSSEditorAutocomplete', enabled);
    };

    const renderForCaret = () => {
      if (bracketToggle.checked) Settings.renderCustomCSSHighlight(textarea, highlight);
    };

    $.on(textarea, 'input', () => { Settings.renderCustomCSSHighlight(textarea, highlight); renderSwatches(); });
    // Re-measure swatch positions once the editor is actually on-screen (the
    // initial render can run while the Styling tab is hidden, where line-height
    // isn't resolvable and falls back to an approximation).
    $.on(textarea, 'focus', renderSwatches);
    $.on(textarea, 'keyup mouseup select focus', renderForCaret);
    $.on(textarea, 'scroll', syncScroll);
    Settings.bindCustomCSSEditorKeys(textarea, highlight);
    $.on(textarea, 'change', () => {
      Settings.renderCustomCSSHighlight(textarea, highlight);
      renderSwatches();
      if (Conf['Custom CSS']) CustomCSS.update();
      flashSaved();
    });
    $.on(themeSelect, 'change', () => updateTheme(true));
    $.on(bracketToggle, 'change', () => updateBracketHighlight(bracketToggle.checked, true));
    $.on(autocompleteToggle, 'change', () => updateAutocomplete(autocompleteToggle.checked, true));
    if (formatButton) $.on(formatButton, 'click', () => Settings.applyCustomCSSFormat(textarea, highlight));
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
      'settings.customCSSEditorBracketHighlight': false,
      'settings.customCSSEditorAutocomplete': true,
    }, (prefs: Record<string, any>) => {
      const theme = prefs['settings.customCSSEditorTheme'];
      const bracketHighlight = prefs['settings.customCSSEditorBracketHighlight'] !== false;
      const autocomplete = prefs['settings.customCSSEditorAutocomplete'] !== false;

      themeSelect.value = ['xt-system', 'xt-light', 'xt-dark', 'xt-solarized'].includes(theme) ? theme : 'xt-system';

      updateTheme(false);
      updateBracketHighlight(bracketHighlight, false);
      updateAutocomplete(autocomplete, false);
      renderSwatches();
      syncScroll();
    });
  },

  // Lightweight IDE-style editing for the Custom CSS textarea: auto-closing
  // pairs, skip-over, pair-deletion, selection-wrapping, Tab indent/dedent and
  // brace-aware Enter. All edits go through document.execCommand('insertText'/
  // 'delete') where possible so the browser's native undo stack stays intact;
  // a direct value splice is the fallback only when execCommand is unavailable.
  bindCustomCSSEditorKeys(textarea: HTMLTextAreaElement, highlight: HTMLPreElement) {
    const PAIRS: Record<string, string> = { '{': '}', '(': ')', '[': ']', '"': '"', "'": "'" };
    const CLOSERS = new Set(['}', ')', ']']);
    const isQuote = (ch: string) => ch === '"' || ch === "'";

    const refresh = () => {
      Settings.renderCustomCSSHighlight(textarea, highlight);
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    };

    // Replace the current selection with `text`, then pull the caret back
    // `caretBack` characters (so e.g. inserting "{}" can park the caret inside).
    const insert = (text: string, caretBack = 0) => {
      const start = textarea.selectionStart;
      let ok = false;
      try { ok = d.execCommand('insertText', false, text); } catch {}
      if (!ok) {
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
      }
      const caret = start + text.length - caretBack;
      textarea.selectionStart = textarea.selectionEnd = caret;
    };

    // Wrap the current selection in open/close and keep the inner text selected.
    const wrap = (open: string, close: string) => {
      const start = textarea.selectionStart;
      const inner = textarea.value.slice(start, textarea.selectionEnd);
      let ok = false;
      try { ok = d.execCommand('insertText', false, open + inner + close); } catch {}
      if (!ok) {
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.slice(0, start) + open + inner + close + textarea.value.slice(end);
      }
      textarea.selectionStart = start + open.length;
      textarea.selectionEnd = start + open.length + inner.length;
    };

    // Leading whitespace of the line the caret sits on.
    const lineIndent = (val: string, pos: number) => {
      const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
      return (val.slice(lineStart, pos).match(/^[ \t]*/) || [''])[0];
    };

    // Ctrl/Cmd+/ — toggle a CSS comment over the selection. CSS has only block
    // comments, so a single line becomes `/* line */` and a multi-line selection
    // is wrapped once (nested) rather than commenting each line individually.
    // Uncommenting also recognises the old per-line `/* */` style so existing
    // comments still toggle off. The block is replaced in one execCommand so it
    // stays a single undo step.
    const COMMENTED = /^(\s*)\/\*\s?([\s\S]*?)\s?\*\/(\s*)$/;
    // CSS can't nest comments, so when wrapping a selection that itself contains
    // `/* */`, slip a zero-width space between the two delimiter chars. The pair
    // no longer terminates the outer comment but still looks identical, and
    // unshield restores it on uncomment — making nested comments round-trip.
    const ZW = '\u200B';
    const shield = (s: string) => s.replace(/\*\//g, `*${ZW}/`).replace(/\/\*/g, `/${ZW}*`);
    const unshield = (s: string) => s.replace(/\*\u200B\//g, '*/').replace(/\/\u200B\*/g, '/*');
    const toggleComment = () => {
      const val = textarea.value;
      const selStart = textarea.selectionStart;
      let selEnd = textarea.selectionEnd;
      // A selection ending exactly at a line break shouldn't pull in the next line.
      if (selEnd > selStart && val[selEnd - 1] === '\n') selEnd--;
      const blockStart = val.lastIndexOf('\n', selStart - 1) + 1;
      let blockEnd = val.indexOf('\n', selEnd);
      if (blockEnd === -1) blockEnd = val.length;

      const block = val.slice(blockStart, blockEnd);
      const lead = (block.match(/^\s*/) || [''])[0];   // indent / blank lines before content
      const trail = (block.match(/\s*$/) || [''])[0];  // trailing whitespace after content
      const core = block.slice(lead.length, block.length - trail.length);
      if (!core.length) return; // nothing but whitespace selected

      const lines = block.split('\n');
      const nonBlank = lines.filter(l => l.trim().length);
      const wrapped = core.match(/^\/\*\s?([\s\S]*?)\s?\*\/$/); // whole selection is one comment

      let next: string;
      if (nonBlank.length > 0 && nonBlank.every(l => COMMENTED.test(l))) {
        // Uncomment: covers a single one-line comment and the old per-line style.
        next = lines.map(l => {
          if (!l.trim().length) return l;
          const m = l.match(COMMENTED);
          return m ? m[1] + unshield(m[2]) + m[3] : l;
        }).join('\n');
      } else if (wrapped) {
        // Unwrap a single block comment, restoring any shielded inner comments.
        next = lead + unshield(wrapped[1]) + trail;
      } else {
        // Comment: wrap the whole selection in one `/* */`, shielding inner
        // `/* */` so they don't prematurely close it.
        next = lead + `/* ${shield(core)} */` + trail;
      }

      textarea.selectionStart = blockStart;
      textarea.selectionEnd = blockEnd;
      let ok = false;
      try { ok = d.execCommand('insertText', false, next); } catch {}
      if (!ok) textarea.value = val.slice(0, blockStart) + next + val.slice(blockEnd);
      // Keep the transformed block selected so a repeat press toggles it back.
      textarea.selectionStart = blockStart;
      textarea.selectionEnd = blockStart + next.length;
      refresh();
    };

    // ── Live class-name autocomplete ──────────────────────────────────────
    // Typing a `.class` selector suggests class names that actually exist on the
    // page. Matching is a cheap filter over a list collected once; the popup is
    // positioned arithmetically (monospace, space-indented editor) so there's no
    // per-keystroke layout work, and it's hosted in the overlay (position:fixed)
    // so the editor's overflow:hidden can't clip it near the edges.
    const editor = textarea.closest('.custom-css-editor') as HTMLElement | null;
    const AC_MAX = 12;
    let acItems: string[] = [];
    let acActive = 0;
    let acTokenStart = 0;
    let acDropdown: HTMLElement | null = null;
    let acSuppress = false;
    let pageClasses: string[] | null = null;
    let charWidth = 0;

    const collectClasses = () => {
      if (pageClasses) return pageClasses;
      const set = new Set<string>();
      for (const el of d.querySelectorAll('[class]')) {
        if (Settings.dialog?.contains(el)) continue; // skip our own settings UI
        for (const c of (el as HTMLElement).classList) {
          if (c.length <= 40 && /^[-_a-zA-Z][-\w]*$/.test(c)) set.add(c);
        }
      }
      pageClasses = Array.from(set).sort((a, b) => a.localeCompare(b));
      return pageClasses;
    };

    const measureCharWidth = () => {
      if (charWidth) return charWidth;
      const cs = window.getComputedStyle(textarea);
      const probe = $.el('span', { textContent: 'x'.repeat(80) }) as HTMLElement;
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;top:0;left:0';
      probe.style.fontFamily = cs.fontFamily;
      probe.style.fontSize = cs.fontSize;
      probe.style.fontWeight = cs.fontWeight;
      probe.style.fontStyle = cs.fontStyle;
      probe.style.letterSpacing = cs.letterSpacing;
      $.add(d.body, probe);
      charWidth = probe.getBoundingClientRect().width / 80;
      $.rm(probe);
      return charWidth || 7;
    };

    // The `.partial` class token immediately left of the caret, or null.
    const acToken = () => {
      const pos = textarea.selectionStart;
      if (pos !== textarea.selectionEnd) return null;
      const lineStart = textarea.value.lastIndexOf('\n', pos - 1) + 1;
      const left = textarea.value.slice(lineStart, pos);
      const m = left.match(/\.([-\w]*)$/);
      if (!m) return null;
      // Skip decimals like `0.5` — a class dot is never preceded by a digit
      // (but `div.foo` legitimately is preceded by a letter, so only block digits).
      if (m.index! > 0 && /\d/.test(left[m.index! - 1])) return null;
      return { partial: m[1], start: pos - m[1].length };
    };

    const acFilter = (partial: string) => {
      const all = collectClasses();
      if (!partial) return all.slice(0, AC_MAX);
      const p = partial.toLowerCase();
      const starts: string[] = [], contains: string[] = [];
      for (const c of all) {
        const lc = c.toLowerCase();
        if (lc.startsWith(p)) starts.push(c);
        else if (lc.includes(p)) contains.push(c);
        if (starts.length >= AC_MAX) break;
      }
      return starts.concat(contains).slice(0, AC_MAX);
    };

    const acIsOpen = () => !!acDropdown && !acDropdown.hidden;

    const closeAC = () => {
      if (acDropdown) acDropdown.hidden = true;
      acItems = [];
      acActive = 0;
    };

    const positionAC = () => {
      if (!acDropdown) return;
      const cs = window.getComputedStyle(textarea);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padT = parseFloat(cs.paddingTop) || 0;
      const lineH = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.42) || 17;
      const pos = textarea.selectionStart;
      const upto = textarea.value.slice(0, pos);
      const row = (upto.match(/\n/g) || []).length;
      const col = pos - (upto.lastIndexOf('\n') + 1);
      const taRect = textarea.getBoundingClientRect();
      let x = taRect.left + padL + col * measureCharWidth() - textarea.scrollLeft;
      const y = taRect.top + padT + row * lineH - textarea.scrollTop;
      x = Math.max(taRect.left, Math.min(x, taRect.right - acDropdown.offsetWidth - 4));
      const below = y + lineH;
      const h = acDropdown.offsetHeight;
      const top = (below + h > taRect.bottom && y - h > taRect.top) ? y - h : below;
      acDropdown.style.left = `${Math.round(x)}px`;
      acDropdown.style.top = `${Math.round(top)}px`;
    };

    const acceptAC = () => {
      if (!acIsOpen() || !acItems.length) { closeAC(); return; }
      const choice = acItems[acActive];
      const pos = textarea.selectionStart;
      acSuppress = true; // the insert below fires `input`; don't reopen on it
      textarea.selectionStart = acTokenStart;
      textarea.selectionEnd = pos;
      insert(choice);
      closeAC();
      refresh();
    };

    const renderAC = () => {
      if (!acDropdown) {
        acDropdown = $.el('div', { className: 'css-autocomplete' }) as HTMLElement;
        acDropdown.hidden = true;
        $.add(Settings.dialog || d.body, acDropdown);
        // Keep textarea focus when interacting with the popup.
        $.on(acDropdown, 'mousedown', (ev: Event) => ev.preventDefault());
      }
      if (editor) {
        const ecs = window.getComputedStyle(editor);
        acDropdown.style.setProperty('--ac-bg', ecs.getPropertyValue('--custom-css-bg') || '#fff');
        acDropdown.style.setProperty('--ac-fg', ecs.getPropertyValue('--custom-css-text') || '#222');
        acDropdown.style.setProperty('--ac-border', ecs.getPropertyValue('--custom-css-border') || 'rgba(128,128,128,.4)');
      }
      acDropdown.textContent = '';
      acItems.forEach((name, i) => {
        const item = $.el('div', { className: 'css-ac-item', textContent: name }) as HTMLElement;
        if (i === acActive) item.classList.add('active');
        $.on(item, 'click', () => { acActive = i; acceptAC(); });
        $.add(acDropdown as HTMLElement, item);
      });
      acDropdown.hidden = false;
      positionAC();
    };

    const updateAC = () => {
      if (acSuppress) { acSuppress = false; closeAC(); return; }
      if (editor?.dataset.autocomplete === 'false') { closeAC(); return; } // disabled via toolbar toggle
      const tok = acToken();
      if (!tok) { closeAC(); return; }
      const matches = acFilter(tok.partial);
      if (!matches.length) { closeAC(); return; }
      acItems = matches;
      acTokenStart = tok.start;
      if (acActive >= matches.length) acActive = 0;
      renderAC();
    };

    const moveAC = (dir: number) => {
      if (!acItems.length) return;
      acActive = (acActive + dir + acItems.length) % acItems.length;
      renderAC();
      (acDropdown?.querySelector('.css-ac-item.active') as HTMLElement | null)
        ?.scrollIntoView({ block: 'nearest' });
    };

    $.on(textarea, 'input', updateAC);
    $.on(textarea, 'blur', () => setTimeout(closeAC, 120));
    $.on(textarea, 'scroll', () => { if (acIsOpen()) positionAC(); });
    $.on(textarea, 'click', () => { if (acIsOpen()) updateAC(); });

    $.on(textarea, 'keydown', (e: KeyboardEvent) => {
      // Autocomplete navigation takes over the arrow/enter/tab/escape keys while
      // the popup is open, before the editor's own handling of them.
      if (acIsOpen()) {
        if (e.key === 'ArrowDown') { e.preventDefault(); moveAC(1); return; }
        if (e.key === 'ArrowUp')   { e.preventDefault(); moveAC(-1); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acceptAC(); return; }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeAC(); return; }
      }
      // Ctrl/Cmd+/ toggles comments — handled before the modifier guard below.
      // Match on the produced character so layouts where "/" needs Shift still work.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === '/') {
        e.preventDefault();
        toggleComment();
        return;
      }
      // Ctrl/Cmd+S — the editor autosaves on change, but people reflexively press
      // save. Dispatch change to commit now (persist + live style update + the
      // "Saved" flash, all wired on the change handler), and stop the event before
      // it reaches the browser's save-page dialog and the global keybind handler,
      // which would otherwise insert a [spoiler] tag (Spoiler tags defaults to
      // Ctrl+s, scoped to any textarea).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        $.event('change', null, textarea);
        return;
      }
      // Shift+Alt+F — reformat the whole document (matches VS Code's "Format
      // Document"). Matched on e.code so it works regardless of the dead/accented
      // character Alt produces on some keyboard layouts.
      if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyF') {
        e.preventDefault();
        e.stopPropagation();
        closeAC();
        Settings.applyCustomCSSFormat(textarea, highlight);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const val = textarea.value;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const hasSel = start !== end;
      const before = val[start - 1];
      const after = val[end];

      if (e.key === 'Enter' && !e.shiftKey && !hasSel) {
        const indent = lineIndent(val, start);
        if (before === '{' && after === '}') {
          // Expand "{|}" into a 3-line block with the caret indented inside.
          insert(`\n${indent}  \n${indent}`, indent.length + 1);
        } else {
          insert(`\n${indent}${before === '{' ? '  ' : ''}`);
        }
        e.preventDefault();
        refresh();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const blockStart = val.lastIndexOf('\n', start - 1) + 1;
        const multiline = val.slice(start, end).includes('\n');
        if (multiline) {
          const block = val.slice(blockStart, end);
          const next = e.shiftKey ? block.replace(/^[ \t]{1,2}/gm, '') : block.replace(/^/gm, '  ');
          textarea.selectionStart = blockStart;
          textarea.selectionEnd = end;
          let ok = false;
          try { ok = d.execCommand('insertText', false, next); } catch {}
          if (!ok) textarea.value = val.slice(0, blockStart) + next + val.slice(end);
          textarea.selectionStart = blockStart;
          textarea.selectionEnd = blockStart + next.length;
        } else if (e.shiftKey) {
          const lead = (val.slice(blockStart).match(/^[ \t]{1,2}/) || [''])[0];
          if (lead) {
            textarea.value = val.slice(0, blockStart) + val.slice(blockStart + lead.length);
            const caret = Math.max(blockStart, start - lead.length);
            textarea.selectionStart = textarea.selectionEnd = caret;
          }
        } else {
          insert('  ');
        }
        refresh();
        return;
      }

      if (e.key === 'Backspace' && !hasSel && before && PAIRS[before] === after) {
        // Backspacing inside an empty pair removes both halves.
        textarea.selectionStart = start - 1;
        textarea.selectionEnd = start + 1;
        let ok = false;
        try { ok = d.execCommand('delete', false); } catch {}
        if (!ok) {
          textarea.value = val.slice(0, start - 1) + val.slice(start + 1);
          textarea.selectionStart = textarea.selectionEnd = start - 1;
        }
        e.preventDefault();
        refresh();
        return;
      }

      if (e.key.length !== 1) return;

      // Skip over a closer/quote already typed by auto-close.
      if (!hasSel && e.key === after && (CLOSERS.has(e.key) || isQuote(e.key))) {
        textarea.selectionStart = textarea.selectionEnd = end + 1;
        e.preventDefault();
        refresh();
        return;
      }

      if (PAIRS[e.key]) {
        if (hasSel) {
          wrap(e.key, PAIRS[e.key]);
          e.preventDefault();
          refresh();
          return;
        }
        // Don't auto-close a quote that's likely an apostrophe inside a word.
        const wordChar = before && /[\w'"]/.test(before);
        if (isQuote(e.key) && wordChar) return;
        insert(e.key + PAIRS[e.key], 1);
        e.preventDefault();
        refresh();
      }
    });
  },

  // Tab / Shift+Tab indentation and Ctrl/Cmd+/ comment toggling for the plain
  // settings textareas (Personas). These fields use a leading `#` to mark a line
  // ignored, so the comment toggle is line-based (each selected line gets `# `
  // prefixed/stripped) rather than the Custom CSS editor's `/* */` block style.
  // Edits go through execCommand insertText so they stay native undo steps and
  // persist on blur through the field's existing change handler, just like typing.
  bindPlainEditorKeys(textarea: HTMLTextAreaElement, token = '#') {
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const COMMENTED = new RegExp(`^(\\s*)${esc} ?`); // indent + token + optional space

    // Replace [start,end) with `next`, keeping the result selected.
    const replace = (start: number, end: number, next: string) => {
      textarea.selectionStart = start;
      textarea.selectionEnd = end;
      let ok = false;
      try { ok = d.execCommand('insertText', false, next); } catch {}
      if (!ok) textarea.value = textarea.value.slice(0, start) + next + textarea.value.slice(end);
      textarea.selectionStart = start;
      textarea.selectionEnd = start + next.length;
    };

    const toggleComment = () => {
      const val = textarea.value;
      const selStart = textarea.selectionStart;
      let selEnd = textarea.selectionEnd;
      // A selection ending exactly at a line break shouldn't pull in the next line.
      if (selEnd > selStart && val[selEnd - 1] === '\n') selEnd--;
      const blockStart = val.lastIndexOf('\n', selStart - 1) + 1;
      let blockEnd = val.indexOf('\n', selEnd);
      if (blockEnd === -1) blockEnd = val.length;
      const lines = val.slice(blockStart, blockEnd).split('\n');
      const nonBlank = lines.filter(l => l.trim().length);
      if (!nonBlank.length) return;
      // Uncomment only when every non-blank line is already commented; otherwise
      // comment the whole block (so a mixed selection comments uniformly).
      const allCommented = nonBlank.every(l => COMMENTED.test(l));
      const next = lines.map(l => {
        if (!l.trim().length) return l;
        if (allCommented) return l.replace(COMMENTED, '$1');
        const indent = (l.match(/^\s*/) || [''])[0];
        return `${indent}${token} ${l.slice(indent.length)}`;
      }).join('\n');
      replace(blockStart, blockEnd, next);
    };

    $.on(textarea, 'keydown', (e: KeyboardEvent) => {
      // Ctrl/Cmd+/ toggles comments. Match on the produced character so layouts
      // where "/" needs Shift still work.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === '/') {
        e.preventDefault();
        toggleComment();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const val = textarea.value;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const blockStart = val.lastIndexOf('\n', start - 1) + 1;
      const multiline = val.slice(start, end).includes('\n');
      if (multiline) {
        // Indent/dedent every line touched by the selection by two spaces.
        const block = val.slice(blockStart, end);
        const next = e.shiftKey ? block.replace(/^[ \t]{1,2}/gm, '') : block.replace(/^/gm, '  ');
        replace(blockStart, end, next);
      } else if (e.shiftKey) {
        // Dedent the current line.
        const lead = (val.slice(blockStart).match(/^[ \t]{1,2}/) || [''])[0];
        if (lead) {
          textarea.value = val.slice(0, blockStart) + val.slice(blockStart + lead.length);
          const caret = Math.max(blockStart, start - lead.length);
          textarea.selectionStart = textarea.selectionEnd = caret;
        }
      } else {
        // Plain Tab inserts two spaces at the caret.
        let ok = false;
        try { ok = d.execCommand('insertText', false, '  '); } catch {}
        if (!ok) {
          textarea.value = val.slice(0, start) + '  ' + val.slice(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }
      }
    });
  },

  // ── Z-order: the settings window and its detached panels ───────────────────
  // The settings dialog and every detached panel are siblings inside the overlay
  // (#xt-settings-overlay), so they share one stacking context. Treat them like
  // OS windows: clicking any of them raises it above the rest via an inline
  // z-index from a shared counter. Because they're siblings (not nested), the
  // raised window's drop-shadow casts over whatever is behind it, and each keeps
  // its own z-index so relative order is preserved until something is clicked.
  detachZ: 10,
  raiseToFront(el: HTMLElement | null) {
    if (el) el.style.zIndex = String(++Settings.detachZ);
  },

  // Open detached panels keyed by storageKey. A panel outlives the section it
  // came from: navigating re-renders the section (Settings.renderSection →
  // $.rmAll), which would otherwise orphan the floating panel and re-dock a
  // duplicate. While a key is registered, a re-render of that section instead
  // calls adopt() to discard the freshly-docked copy and keep the live panel.
  // Cleared wholesale when the settings dialog closes (the overlay, and every
  // panel inside it, is removed in one go).
  detached: Object.create(null) as Record<string, { adopt(node: HTMLElement, button: HTMLElement): void }>,

  // Generic "detach into a floating, draggable, resizable window" for a settings
  // block. Mirrors the Custom CSS editor's detach (Settings.initCustomCSSEditor):
  // the live `node` is *relocated* (not cloned) so its wired listeners survive, a
  // "Re-attach" note marks its spot, and the panel geometry persists under
  // `storageKey`. Theme-neutral (these fields have no syntax theme), so the panel
  // chrome follows the settings dialog. Used by the Personas and Sauce fields.
  makeDetachable(node: HTMLElement | null, button: HTMLElement | null, opts: { storageKey: string; title: string }) {
    if (!node || !button) return;
    // Already detached and this section just re-rendered: keep the live panel,
    // drop the freshly-docked duplicate, and re-point the new button at it.
    const live = Settings.detached[opts.storageKey];
    if (live) { live.adopt(node, button); return; }

    // Append to the overlay (#xt-settings-overlay), as a *sibling* of the
    // settings window — not nested inside it. Siblings share one stacking
    // context, so the window's drop-shadow casts over the panels and click-to-
    // front works uniformly (the panel CSS is scoped to the overlay to match).
    const host = (Settings.dialog as HTMLElement) || d.body;
    // `curNode`/`curButton` track the *live* relocated node and the button that
    // currently controls it; adopt() swaps in the latest button on re-render.
    let curNode = node;
    let curButton = button;
    let panel: HTMLElement | null = null;
    let note: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    let saveTimer = 0;

    // Drop the "<title> is detached / Re-attach" note into the section where the
    // relocated block used to sit; clicking Re-attach runs close().
    const placeNote = (before: HTMLElement) => {
      note = $.el('div', {
        className: 'xt-detach-note',
        innerHTML: `${opts.title} is detached. <button type="button" class="xt-detach-reattach">Re-attach</button>`,
      }) as HTMLElement;
      before.parentNode!.insertBefore(note, before);
      $.on($('.xt-detach-reattach', note) as HTMLElement, 'click', close);
    };

    const writeRect = () => {
      if (!panel) return;
      const r = panel.getBoundingClientRect();
      $.set(opts.storageKey, {
        left: Math.round(r.left), top: Math.round(r.top),
        width: Math.round(r.width), height: Math.round(r.height),
      });
    };
    // Debounced so a drag-resize (which fires the observer continuously) doesn't
    // hammer storage; close() flushes the final rect synchronously.
    const saveRect = () => { clearTimeout(saveTimer); saveTimer = window.setTimeout(writeRect, 250); };

    const centerDefault = () => {
      if (!panel) return;
      // Match the Custom CSS detach panel: a large, near-fullscreen window so the
      // section's textarea has room to fill the space.
      const maxW = window.innerWidth, maxH = window.innerHeight;
      const w = Math.min(1100, Math.round(maxW * 0.96));
      const h = Math.min(820, Math.round(maxH * 0.92));
      panel.style.width = `${w}px`;
      panel.style.height = `${h}px`;
      panel.style.left = `${Math.round((maxW - w) / 2)}px`;
      panel.style.top = `${Math.round((maxH - h) / 2)}px`;
    };
    const resetPanel = () => { centerDefault(); writeRect(); };

    const onBarMousedown = (e: MouseEvent) => {
      if (e.button !== 0 || !panel) return;
      if ((e.target as HTMLElement).closest('button')) return; // let the action buttons click
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const dy = e.clientY - rect.top;
      const onMove = (me: MouseEvent) => {
        if (!panel) return;
        const left = Math.max(0, Math.min(me.clientX - dx, window.innerWidth - panel.offsetWidth));
        const top = Math.max(0, Math.min(me.clientY - dy, window.innerHeight - panel.offsetHeight));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
      };
      const onUp = () => {
        $.off(d, 'mousemove', onMove);
        $.off(d, 'mouseup', onUp);
        writeRect();
      };
      $.on(d, 'mousemove', onMove);
      $.on(d, 'mouseup', onUp);
    };

    const close = () => {
      if (!panel) return;
      ro?.disconnect();
      ro = null;
      clearTimeout(saveTimer);
      writeRect();
      if (note?.parentNode) {
        note.parentNode.insertBefore(curNode, note);
        note.remove();
      }
      note = null;
      delete curNode.dataset.detached;
      $.rm(panel);
      panel = null;
      curButton.dataset.open = 'false';
      delete Settings.detached[opts.storageKey];
      // Rejoin the accordion group it left on detach (re-adds the shared name).
      const sec = $('section', Settings.dialog) as HTMLElement | null;
      if (sec) Settings.applyAccordionMode(sec);
    };

    // Re-render of an already-detached section: the section drew a fresh docked
    // copy of the block. Discard it (the live, possibly-edited node stays in the
    // panel), leave a note in its place, and bind the new button to this panel.
    const adopt = (freshNode: HTMLElement, freshButton: HTMLElement) => {
      placeNote(freshNode);
      $.rm(freshNode);
      curButton = freshButton;
      curButton.dataset.open = 'true';
      $.on(curButton, 'click', toggle);
    };

    const open = () => {
      if (panel) return;

      // Mark the spot with a visible "Re-attach" note (also our restore anchor).
      placeNote(curNode);

      panel = $.el('div', {
        className: 'xt-detach-panel',
        innerHTML:
          '<div class="xt-detach-panel-bar">' +
            `<span class="xt-detach-panel-title">${opts.title}</span>` +
            '<span class="xt-detach-panel-actions">' +
              '<button type="button" class="xt-detach-panel-reset" title="Reset size and position">Reset</button>' +
              '<button type="button" class="xt-detach-panel-close" title="Re-attach">×</button>' +
            '</span>' +
          '</div>' +
          '<div class="xt-detach-panel-body"></div>',
      }) as HTMLElement;

      const bar = $('.xt-detach-panel-bar', panel) as HTMLElement;
      const body = $('.xt-detach-panel-body', panel) as HTMLElement;
      if (curNode.tagName === 'DETAILS') {
        // Leave the accordion group: native exclusive <details> is document-wide
        // by `name`, so a same-named section opening elsewhere would collapse
        // this panel — and its summary is hidden while detached, leaving it
        // blank and unrecoverable. Drop the name and force it open.
        curNode.removeAttribute('name');
        (curNode as HTMLDetailsElement).open = true;
      }
      curNode.dataset.detached = 'true';
      $.add(body, curNode);

      $.on($('.xt-detach-panel-close', panel) as HTMLElement, 'click', close);
      $.on($('.xt-detach-panel-reset', panel) as HTMLElement, 'click', resetPanel);
      $.on(bar, 'mousedown', onBarMousedown as (e: Event) => void);
      // Clicking anywhere in the panel raises it above the settings window.
      $.on(panel, 'mousedown', () => Settings.raiseToFront(panel));

      $.add(host, panel);
      Settings.raiseToFront(panel);
      // Register so a later re-render of this section adopts (keeps) this panel.
      Settings.detached[opts.storageKey] = { adopt };

      // Restore saved geometry (clamped to the viewport) or centre at a default.
      // (cast: $.get's loose typings declare the callback as zero-arg.)
      $.get({ [opts.storageKey]: null }, ((prefs: Record<string, any>) => {
        if (!panel) return;
        const saved = prefs[opts.storageKey];
        if (saved && saved.width) {
          const maxW = window.innerWidth, maxH = window.innerHeight;
          const w = Math.min(saved.width, maxW - 20);
          const h = Math.min(saved.height, maxH - 20);
          panel.style.width = `${w}px`;
          panel.style.height = `${h}px`;
          panel.style.left = `${Math.max(0, Math.min(saved.left, maxW - w))}px`;
          panel.style.top = `${Math.max(0, Math.min(saved.top, maxH - h))}px`;
        } else {
          centerDefault();
        }
        // Observe only after the initial size so we don't persist transient dims.
        ro = new ResizeObserver(saveRect);
        ro.observe(panel);
      }) as () => void);

      curButton.dataset.open = 'true';
      const ta = curNode.tagName === 'TEXTAREA' ? curNode : ($('textarea', curNode) as HTMLElement | null);
      ta?.focus();
    };

    // For personas the button lives inside <summary>, whose click would otherwise
    // toggle the <details>; preventDefault/stopPropagation keep that state put.
    function toggle(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      panel ? close() : open();
    }
    $.on(button, 'click', toggle);
  },

  // Reformat the whole textarea via Shift+Alt+F (or the Format CSS button), then
  // commit it through the same change event Ctrl+S uses so it persists, updates
  // the live style, and reflows the highlight overlay. A pure-whitespace diff is
  // skipped so an already-tidy document doesn't push a no-op onto the undo stack.
  applyCustomCSSFormat(textarea: HTMLTextAreaElement, highlight: HTMLPreElement) {
    const formatted = Settings.formatCustomCSS(textarea.value);
    if (formatted === textarea.value) return false;
    textarea.focus();
    // Select all then insertText so the reformat is a single native undo step.
    textarea.selectionStart = 0;
    textarea.selectionEnd = textarea.value.length;
    let ok = false;
    try { ok = d.execCommand('insertText', false, formatted); } catch {}
    if (!ok) textarea.value = formatted;
    textarea.selectionStart = textarea.selectionEnd = 0;
    textarea.scrollTop = textarea.scrollLeft = 0;
    $.event('change', null, textarea);
    Settings.renderCustomCSSHighlight(textarea, highlight);
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
    return true;
  },

  // Lightweight CSS pretty-printer. Not a full parser: it stashes comments and
  // strings so their contents are never touched, then walks the remaining source
  // tracking brace depth to re-emit consistent 2-space indentation, one
  // declaration per line, `selector {` / dedented `}`, and `prop: value;`
  // spacing, with a blank line between top-level rules. Anything it can't
  // classify is preserved verbatim, so the worst case is a no-op rather than
  // corrupted CSS.
  formatCustomCSS(css: string): string {
    const INDENT = '  ';
    // 1. Pull comments and strings out so their braces / semicolons / colons
    //    can't be mistaken for structure. Restored at the end.
    const stash: string[] = [];
    const work = css
      .replace(/\/\*[\s\S]*?\*\//g, m => `${stash.push(m) - 1}`)
      .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, m => `${stash.push(m) - 1}`);

    const PURE_PLACEHOLDER = /^(?:\d+\s*)+$/; // run is nothing but stashed tokens
    let out = '';
    let depth = 0;
    let buf = '';
    const pad = () => INDENT.repeat(depth);

    // Peel leading stashed comments off `s`, emitting each on its own line, so a
    // comment sitting before a selector/declaration isn't glued onto it.
    const peelComments = (s: string) => {
      let m: RegExpMatchArray | null;
      while ((m = s.match(/^\s*(\d+)\s*/))) {
        out += pad() + m[1] + '\n';
        s = s.slice(m[0].length);
      }
      return s;
    };

    // Split `s` on `sep` at paren/bracket depth 0 only, so commas inside
    // :is(…)/:not(…)/:where(…) or [attr] aren't mistaken for list separators.
    const splitTopLevel = (s: string, sep: string) => {
      const parts: string[] = [];
      let nest = 0, last = 0;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '(' || c === '[') nest++;
        else if (c === ')' || c === ']') nest = Math.max(0, nest - 1);
        else if (c === sep && nest === 0) { parts.push(s.slice(last, i)); last = i + 1; }
      }
      parts.push(s.slice(last));
      return parts;
    };

    const flushDecl = () => {
      let t = peelComments(buf.replace(/\s+/g, ' ').trim()).trim();
      buf = '';
      if (!t) return;
      if (PURE_PLACEHOLDER.test(t)) { out += pad() + t + '\n'; return; } // trailing comment only, no `;`
      // Normalise `prop:value` → `prop: value`, but only when the text left of
      // the first colon is a clean identifier — so values that contain colons
      // (url(http://…), data URIs) are left untouched.
      const ci = t.indexOf(':');
      if (ci > 0) {
        const prop = t.slice(0, ci).trim();
        if (/^(?:--)?[-\w]+$/.test(prop)) t = `${prop}: ${t.slice(ci + 1).trim()}`;
      }
      t = t.replace(/\s*!important/gi, ' !important');
      out += pad() + t + ';\n';
    };

    for (let i = 0; i < work.length; i++) {
      const ch = work[i];
      if (ch === '{') {
        if (depth === 0 && out && !out.endsWith('\n\n')) out += '\n'; // blank line between top-level rules
        const sel = peelComments(buf.replace(/\s+/g, ' ').trim()).trim();
        buf = '';
        const parts = splitTopLevel(sel, ',');
        if (parts.length > 1) {
          // Stack a selector list one-per-line (the last carries the brace), so
          // long lists stay readable instead of collapsing onto one line.
          parts.forEach((p, n) => { out += pad() + p.trim() + (n < parts.length - 1 ? ',\n' : ' {\n'); });
        } else {
          out += pad() + (sel ? sel + ' ' : '') + '{\n';
        }
        depth++;
      } else if (ch === '}') {
        flushDecl();
        depth = Math.max(0, depth - 1);
        out += pad() + '}\n';
      } else if (ch === ';') {
        flushDecl();
      } else {
        buf += ch;
      }
    }
    flushDecl(); // trailing declaration with no closing `;` or `}`

    // Restore stashed tokens, collapse blank-line runs, normalise edges.
    out = out.replace(/(\d+)/g, (_, n) => stash[+n]);
    return out.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\s+$/, '') + '\n';
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
    // No native 4chan theme class on <html> — e.g. StyleChan or a custom site
    // theme is driving the page. The class-scoped --xt-* palette vars aren't
    // present either, so the static CSS palette would fall back to white.
    // Signal updateTheme to sample the live, rendered colours instead.
    return 'xt-system-live';
  },

  // When the editor is in "Match site" mode but no native theme class is on
  // <html> (StyleChan / custom site theme), read the colours actually painted on
  // the page and pin them onto the editor so it follows the real look instead of
  // defaulting to white. For every other theme this clears the overrides and lets
  // the static CSS palette govern.
  applyCustomCSSEditorSystemColors(editor: HTMLElement) {
    const clear = () => {
      for (const v of ['--custom-css-bg', '--custom-css-text', '--custom-css-caret', '--custom-css-border']) {
        editor.style.removeProperty(v);
      }
      editor.style.colorScheme = '';
    };
    if (editor.dataset.theme !== 'xt-system-live') { clear(); return; }
    const sample = (el: Element | null) => {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      const m = cs.backgroundColor.match(/[\d.]+/g);
      const opaque = m && m.length >= 3 && !(m[3] !== undefined && parseFloat(m[3]) === 0);
      return opaque ? { bg: cs.backgroundColor, fg: cs.color } : null;
    };
    const colors = sample(d.body) || sample(d.documentElement);
    if (!colors) { clear(); return; }
    editor.style.setProperty('--custom-css-bg', colors.bg);
    editor.style.setProperty('--custom-css-text', colors.fg);
    editor.style.setProperty('--custom-css-caret', colors.fg);
    const fg = colors.fg.match(/[\d.]+/g);
    if (fg && fg.length >= 3) {
      editor.style.setProperty('--custom-css-border', `rgba(${fg[0]}, ${fg[1]}, ${fg[2]}, .35)`);
      // Light text ⇒ dark theme; keep the textarea's own caret/selection chrome aligned.
      editor.style.colorScheme = $.luma([+fg[0], +fg[1], +fg[2]]) > 128 ? 'dark' : 'light';
    }
  },

  refreshCustomCSSEditor(section: HTMLElement) {
    const textarea = $('.custom-css-textarea', section) as HTMLTextAreaElement | null;
    const highlight = $('.custom-css-highlight', section) as HTMLPreElement | null;
    if (!textarea || !highlight) return;
    Settings.renderCustomCSSHighlight(textarea, highlight);
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  },

  renderCustomCSSHighlight(textarea: HTMLTextAreaElement, highlight: HTMLPreElement) {
    // Keep a trailing newline so the last line remains visible while typing.
    const text = textarea.value;
    const source = text ? `${text}\n` : '\n';
    const bracketHighlights = highlight.dataset.bracketHighlight === 'false'
      ? null
      : Settings.customCSSBracketHighlights(text, textarea.selectionStart, textarea.selectionEnd);
    highlight.innerHTML = Settings.highlightCSSSource(source, bracketHighlights);
  },

  customCSSBracketHighlights(source: string, selectionStart: number, selectionEnd: number) {
    if (selectionStart !== selectionEnd) return null;
    const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
    const reversePairs: Record<string, string> = { '}': '{', ')': '(', ']': '[' };
    const isBracket = (ch: string) => !!(pairs[ch] || reversePairs[ch]);

    let anchor = -1;
    if (isBracket(source[selectionStart - 1])) {
      anchor = selectionStart - 1;
    } else if (isBracket(source[selectionStart])) {
      anchor = selectionStart;
    }
    if (anchor < 0) return null;

    const ignored = Settings.customCSSIgnoredCharMask(source);
    if (ignored[anchor]) return null;

    const ch = source[anchor];
    const isOpen = !!pairs[ch];
    const open = isOpen ? ch : reversePairs[ch];
    const close = isOpen ? pairs[ch] : ch;
    let depth = 0;

    if (isOpen) {
      for (let i = anchor; i < source.length; i++) {
        if (ignored[i]) continue;
        if (source[i] === open) depth++;
        if (source[i] === close) {
          depth--;
          if (depth === 0) {
            return {
              [anchor]: 'css-token-bracket-match',
              [i]: 'css-token-bracket-match',
            };
          }
        }
      }
    } else {
      for (let i = anchor; i >= 0; i--) {
        if (ignored[i]) continue;
        if (source[i] === close) depth++;
        if (source[i] === open) {
          depth--;
          if (depth === 0) {
            return {
              [anchor]: 'css-token-bracket-match',
              [i]: 'css-token-bracket-match',
            };
          }
        }
      }
    }

    return { [anchor]: 'css-token-bracket-mismatch' };
  },

  customCSSIgnoredCharMask(source: string) {
    const ignored: boolean[] = [];
    let i = 0;
    while (i < source.length) {
      if (source[i] === '/' && source[i + 1] === '*') {
        const start = i;
        i += 2;
        while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
        i = Math.min(source.length, i + 2);
        for (let j = start; j < i; j++) ignored[j] = true;
        continue;
      }
      if (source[i] === '"' || source[i] === "'") {
        const quote = source[i];
        const start = i++;
        while (i < source.length) {
          if (source[i] === '\\') {
            i += 2;
            continue;
          }
          if (source[i++] === quote) break;
        }
        for (let j = start; j < i; j++) ignored[j] = true;
        continue;
      }
      i++;
    }
    return ignored;
  },

  highlightCSSSource(source: string, bracketHighlights: Record<number, string> | null = null) {
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
    if (bracketHighlights) {
      code = Settings.applyCustomCSSVisibleCharSpans(code, bracketHighlights);
    }
    return code;
  },

  applyCustomCSSVisibleCharSpans(html: string, spans: Record<number, string>) {
    let out = '';
    let visibleIndex = 0;
    for (let i = 0; i < html.length; i++) {
      if (html[i] === '<') {
        const end = html.indexOf('>', i + 1);
        if (end === -1) {
          out += html.slice(i);
          break;
        }
        out += html.slice(i, end + 1);
        i = end;
        continue;
      }

      let chunk = html[i];
      if (html[i] === '&') {
        const end = html.indexOf(';', i + 1);
        if (end !== -1) {
          chunk = html.slice(i, end + 1);
          i = end;
        }
      }

      const className = spans[visibleIndex];
      out += className ? `<span class="${className}">${chunk}</span>` : chunk;
      visibleIndex++;
    }
    return out;
  },

  // Write styling Conf values to CSS custom properties so they apply
  // immediately. Called with no args, this writes the runtime (board)
  // variant onto :root and, if the settings dialog is open with an editing
  // variant, layers that variant's vars onto the dialog element so the
  // dialog + preview visually reflect what's being edited even while the
  // board behind it stays on its own variant.
  applyStylingVars() {
    const prevBgCache = Settings.styleBgCache;
    Settings.styleBgCache = {};
    try {
      Settings.writeStyleVarsTo(doc as HTMLElement, Settings.getBoardVariant(), true);
      Settings.syncLinkedMarkerColors(undefined, Settings.getBoardVariant());
      if (Settings.dialog && Settings.stylingEditingVariant
          && Settings.stylingEditingVariant !== Settings.getBoardVariant()) {
        Settings.writeStyleVarsTo(Settings.dialog, Settings.stylingEditingVariant, false);
      } else if (Settings.dialog) {
        // Same variant: clear any leftover dialog-scoped overrides so the
        // dialog inherits from :root.
        Settings.clearStyleVarsOn(Settings.dialog);
      }
      Settings.resolvedStyleColorCache = null;
      Settings.refreshUnsetStylingColorInputs();
      Settings.refreshStylingPreviewFromDialog();
    } finally {
      Settings.styleBgCache = prevBgCache;
    }
  },

  applyStylingVarsRaf: 0 as number,
  applyStylingVarsDeferred() {
    if (Settings.applyStylingVarsRaf) return;
    Settings.applyStylingVarsRaf = requestAnimationFrame(() => {
      Settings.applyStylingVarsRaf = 0;
      Settings.applyStylingVars();
    });
  },

  // The list of CSS variables we write, kept here so clearStyleVarsOn can
  // strip them off the dialog when the editing variant matches the board.
  STYLE_VAR_NAMES: [
    '--xt-highlight-own', '--xt-highlight-you', '--xt-highlight-ghost',
    '--xt-highlight-own-opacity', '--xt-highlight-you-opacity', '--xt-highlight-ghost-opacity',
    '--xt-highlight-edge-width', '--xt-post-background', '--xt-catalog-border-width',
    '--xt-edge-width-own', '--xt-edge-width-you', '--xt-edge-width-ghost',
    '--xt-edge-style-own', '--xt-edge-style-you', '--xt-edge-style-ghost',
    '--xt-catalog-border-width-own', '--xt-catalog-border-width-watched',
    '--xt-catalog-border-style-own', '--xt-catalog-border-style-watched',
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
    const styleVarValue = (value: any) =>
      value === Settings.THEME_BORDER_HIGHLIGHT ? 'var(--xt-border-highlight)' : value;
    const setVar = (cssVar: string, value: string) => {
      const resolved = styleVarValue(value);
      if (resolved) target.style.setProperty(cssVar, resolved);
      else target.style.removeProperty(cssVar);
    };
    const cv = (key: string) => Settings.styleConf(key, variant);
    // Per-section master switches (only ever off when StyleChan is installed).
    // When a section is off its whole effect is removed from the page without
    // touching the inner settings, so flipping it back on restores the look.
    const highlightsOn = Settings.stylingSectionEnabled('highlights');
    const markersOn = Settings.stylingSectionEnabled('scrollbarMarkers');
    const textColorsOn = Settings.stylingSectionEnabled('textColors');
    const threadHighlightsEnabled = highlightsOn && Conf['Enable Thread Highlights'] !== false;
    const catalogHighlightsEnabled = highlightsOn && Conf['Enable Catalog Highlights'] !== false;
    const catalogOwnEnabled = catalogHighlightsEnabled && Conf['Catalog Highlight Own Posts'] !== false;
    const catalogWatchedEnabled = catalogHighlightsEnabled && Conf['Catalog Highlight Watched Threads'] !== false;
    // Filtered-thread catalog highlight is independent of the Own/Watched master
    // (so the classic filter glow survives with catalog highlights off), gated
    // only by the highlights section + its own toggle.
    const catalogFilterEnabled = highlightsOn && Conf['Catalog Highlight Filter Posts'] !== false;
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
      // xt-(catalog-)edge-* suppress the background fill, so they apply when "background" is off.
      doc.classList.toggle('xt-catalog-edge-own', catalogOwnEnabled && !cv('Catalog Highlight Own Background'));
      doc.classList.toggle('xt-catalog-edge-watched', catalogWatchedEnabled && !cv('Catalog Highlight Watched Background'));
      // loc-image redirects the highlight from the whole tile onto the thumbnail.
      doc.classList.toggle('xt-catalog-own-loc-image', catalogOwnEnabled && cv('Catalog Highlight Own Location') === 'image');
      doc.classList.toggle('xt-catalog-watched-loc-image', catalogWatchedEnabled && cv('Catalog Highlight Watched Location') === 'image');
      doc.classList.toggle('xt-catalog-own-glow', catalogOwnEnabled && !!cv('Catalog Highlight Own Glow'));
      doc.classList.toggle('xt-catalog-watched-glow', catalogWatchedEnabled && !!cv('Catalog Highlight Watched Glow'));
      // Filtered-thread catalog highlight. The border/fill is opt-in (only with
      // a color set), so the default look stays the classic glow-only. The glow
      // is on unless the row explicitly turns it off (glow-off opt-out keeps the
      // eX glow working without depending on these classes for the common case).
      doc.classList.toggle('xt-highlight-catalog-filter', catalogFilterEnabled);
      doc.classList.toggle('xt-set-catalog-filter-highlight', catalogFilterEnabled && !!cv('Catalog Highlight Filter Color'));
      doc.classList.toggle('xt-catalog-edge-filter', catalogFilterEnabled && !cv('Catalog Highlight Filter Background'));
      doc.classList.toggle('xt-catalog-filter-loc-image', catalogFilterEnabled && cv('Catalog Highlight Filter Location') === 'image');
      // Suppress the eX filter glow whenever the row isn't actively glowing
      // (row off, or Glow unchecked) so the row fully governs it; defaults
      // (enabled + glow on) leave the classic glow untouched.
      doc.classList.toggle('xt-catalog-filter-glow-off', !(catalogFilterEnabled && !!cv('Catalog Highlight Filter Glow')));
      doc.classList.toggle('xt-edge-own', highlightsOn && !Conf['Highlight Own Background']);
      doc.classList.toggle('xt-edge-you', highlightsOn && !Conf['Highlight You Background']);
      doc.classList.toggle('xt-edge-ghost', highlightsOn && !Conf['Highlight Ghost Background']);
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
    const legacyWidth = Settings.styleConf('Highlight Edge Width', variant);
    const edgeWidth = parseFloat(String(cv('Thread Highlight Edge Width') || legacyWidth));
    setVar('--xt-highlight-edge-width', Number.isFinite(edgeWidth) ? `${$.minmax(edgeWidth, 1, 12)}px` : '');
    setVar('--xt-post-background', Settings.getPostBaseBackgroundCSS());
    const catalogBorderWidth = parseFloat(String(cv('Catalog Highlight Border Width') || legacyWidth));
    setVar('--xt-catalog-border-width', Number.isFinite(catalogBorderWidth) ? `${$.minmax(catalogBorderWidth, 1, 12)}px` : '');
    // Per-state widths. When unset the var is removed so the rule falls back to
    // the shared --xt-…-width above (the "linked" value), then to 3px.
    const setWidthVar = (key: string, varName: string, min = 1) => {
      const w = parseFloat(String(cv(key)));
      setVar(varName, Number.isFinite(w) ? `${$.minmax(w, min, 12)}px` : '');
    };
    const setStyleVar = (key: string, varName: string) => {
      const style = String(cv(key) || '');
      setVar(varName, /^(solid|dashed|dotted|double|groove|ridge|inset|outset)$/.test(style) ? style : '');
    };
    setWidthVar('Highlight Own Edge Width', '--xt-edge-width-own');
    setWidthVar('Highlight You Edge Width', '--xt-edge-width-you');
    setWidthVar('Highlight Ghost Edge Width', '--xt-edge-width-ghost');
    setStyleVar('Highlight Own Border Style', '--xt-edge-style-own');
    setStyleVar('Highlight You Border Style', '--xt-edge-style-you');
    setStyleVar('Highlight Ghost Border Style', '--xt-edge-style-ghost');
    setWidthVar('Catalog Highlight Own Border Width', '--xt-catalog-border-width-own', 0);
    setWidthVar('Catalog Highlight Watched Border Width', '--xt-catalog-border-width-watched', 0);
    setStyleVar('Catalog Highlight Own Border Style', '--xt-catalog-border-style-own');
    setStyleVar('Catalog Highlight Watched Border Style', '--xt-catalog-border-style-watched');
    setWidthVar('Catalog Highlight Filter Border Width', '--xt-catalog-border-width-filter', 0);
    setStyleVar('Catalog Highlight Filter Border Style', '--xt-catalog-border-style-filter');
    // Set catalog highlight colours unconditionally: the real board only paints them
    // under the enable-gated .xt-highlight-catalog-* classes, so an unused var is
    // harmless, while the styling preview (always-on demonstrator) can show them.
    setVar('--xt-catalog-own-highlight', cv('Catalog Highlight Own Color'));
    setVar('--xt-catalog-own-highlight-opacity',
      cv('Catalog Highlight Own Opacity') !== '' ? String(cv('Catalog Highlight Own Opacity')) : '');
    setVar('--xt-catalog-watched-highlight', cv('Catalog Highlight Watched Color'));
    setVar('--xt-catalog-watched-highlight-opacity',
      cv('Catalog Highlight Watched Opacity') !== '' ? String(cv('Catalog Highlight Watched Opacity')) : '');
    // Filter color stays unset when blank so the glow/border fall back to each
    // filter's own color (--xt-filter-highlight / --xt-highlight-shadow).
    setVar('--xt-catalog-filter-highlight', cv('Catalog Highlight Filter Color'));
    setVar('--xt-catalog-filter-highlight-opacity',
      cv('Catalog Highlight Filter Opacity') !== '' ? String(cv('Catalog Highlight Filter Opacity')) : '');
    const glowVar = (cssVar: string, key: string) =>
      setVar(cssVar, cv(key) !== '' && cv(key) != null ? String(cv(key)) : '');
    glowVar('--xt-catalog-own-glow-intensity', 'Catalog Highlight Own Glow Intensity');
    glowVar('--xt-catalog-watched-glow-intensity', 'Catalog Highlight Watched Glow Intensity');
    glowVar('--xt-catalog-filter-glow-intensity', 'Catalog Highlight Filter Glow Intensity');
    const ownMarkerLinked = !!cv('Scroll Marker Own Match Highlight');
    const youMarkerLinked = !!cv('Scroll Marker You Match Highlight');
    const ghostMarkerLinked = !!cv('Scroll Marker Ghost Match Highlight');
    // Scrollbar Markers section off ⇒ emit no marker color/opacity vars (the
    // ScrollMarkers renderer is also gated, so markers vanish entirely).
    const markerVar = (cssVar: string, value: any) =>
      setVar(cssVar, markersOn && value !== '' ? String(value) : '');
    markerVar('--xt-scroll-marker-own',
      ownMarkerLinked ? cv('Highlight Own Color') : cv('Scroll Marker Own Color'));
    markerVar('--xt-scroll-marker-you',
      youMarkerLinked ? cv('Highlight You Color') : cv('Scroll Marker You Color'));
    markerVar('--xt-scroll-marker-ghost',
      ghostMarkerLinked ? cv('Highlight Ghost Color') : cv('Scroll Marker Ghost Color'));
    markerVar('--xt-scroll-marker-unread', cv('Scroll Marker Unread Color'));
    markerVar('--xt-scroll-marker-own-opacity', cv('Scroll Marker Own Opacity'));
    markerVar('--xt-scroll-marker-you-opacity', cv('Scroll Marker You Opacity'));
    markerVar('--xt-scroll-marker-ghost-opacity', cv('Scroll Marker Ghost Opacity'));
    markerVar('--xt-scroll-marker-unread-opacity', cv('Scroll Marker Unread Opacity'));

    const baseBackground = Settings.getTextBaseBackground();
    const postBackground = Settings.getPostBaseBackground();
    const textColorMode = Settings.resolveTextMode(cv('textColorMode'));
    const autoTextPalette = Settings.autoTextPalette(baseBackground);
    // 'default' (and the Text Colors section being off) ⇒ no text-color override
    // at all: the page keeps the theme's native text/link/greentext, and the
    // empty values flow through to the highlight-text fallback below so those
    // stay theme-default too.
    const textColorsOverride = textColorsOn && textColorMode !== 'default';
    const textColor = !textColorsOverride ? '' : (textColorMode === 'auto' ? autoTextPalette.text : cv('Text Color'));
    const linkColor = !textColorsOverride ? '' : (textColorMode === 'auto' ? autoTextPalette.link : cv('Link Text Color'));
    const quoteColor = !textColorsOverride ? '' : (textColorMode === 'auto' ? autoTextPalette.quote : cv('Quote Text Color'));
    const deadLinkColor = !textColorsOverride ? '' : (textColorMode === 'auto' ? autoTextPalette.deadLink : cv('Dead Link Text Color'));
    const hasAnyTextOverride = !!(textColor || linkColor || quoteColor || deadLinkColor);
    // The shared .xt-custom-text-colors class also gates the per-post highlight
    // text rules, so keep it on when any thread highlight row recolors text even
    // if the global text mode is Defaults. (Empty global vars stay harmless:
    // var(--xt-quote-text-color) with no value is an invalid color and ignored.)
    const anyThreadHighlightText = highlightsOn && [
      'Highlight Own Text Mode', 'Highlight You Text Mode', 'Highlight Ghost Text Mode',
    ].some(k => Settings.resolveTextMode(cv(k)) !== 'default');
    if (updateRootClasses) {
      if (hasAnyTextOverride || anyThreadHighlightText) {
        $.addClass(doc, 'xt-custom-text-colors');
      } else {
        $.rmClass(doc, 'xt-custom-text-colors');
      }
    }
    setVar('--xt-text-color', textColor || '');
    setVar('--xt-link-text-color', linkColor || '');
    setVar('--xt-quote-text-color', quoteColor || '');
    setVar('--xt-dead-link-text-color', deadLinkColor || '');

    // Edge/border-only highlights draw just a border and leave the post on its
    // normal background — the highlight color never fills behind the text (see
    // the `:not(.xt-edge-*)` / `:not(.xt-catalog-edge-*)` gating in
    // variableBase.css). So the auto text palette must NOT tint the background
    // with the highlight color; passing null below makes withManual fall back to
    // the default text palette, which is computed against the bare baseBackground.
    const ownEdgeOnly = highlightsOn && !Conf['Highlight Own Background'];
    const youEdgeOnly = highlightsOn && !Conf['Highlight You Background'];
    const ghostEdgeOnly = highlightsOn && !Conf['Highlight Ghost Background'];
    const catalogOwnBorderOnly = catalogOwnEnabled && !cv('Catalog Highlight Own Background');
    const catalogWatchedBorderOnly = catalogWatchedEnabled && !cv('Catalog Highlight Watched Background');
    const catalogFilterBorderOnly = catalogFilterEnabled && !cv('Catalog Highlight Filter Background');
    const highlightOpacity = (
      opacityKey:
        | 'Highlight Own Opacity' | 'Highlight You Opacity' | 'Highlight Ghost Opacity'
        | 'Catalog Highlight Own Opacity' | 'Catalog Highlight Watched Opacity' | 'Catalog Highlight Filter Opacity',
    ) => {
      const opacity = cv(opacityKey);
      if (opacity === '' || opacity == null) return 1;
      const alpha = parseFloat(String(opacity));
      return Number.isFinite(alpha) ? $.minmax(alpha, 0, 1) : 1;
    };
    const withManual = (
      autoPalette: ReturnType<typeof Settings.autoTextPalette> | null,
      modeKey:
        | 'Highlight Own Text Mode' | 'Highlight You Text Mode' | 'Highlight Ghost Text Mode'
        | 'Catalog Highlight Own Text Mode' | 'Catalog Highlight Watched Text Mode' | 'Catalog Highlight Filter Text Mode',
      textKey:
        | 'Highlight Own Text Color' | 'Highlight You Text Color' | 'Highlight Ghost Text Color'
        | 'Catalog Highlight Own Text Color' | 'Catalog Highlight Watched Text Color' | 'Catalog Highlight Filter Text Color',
      subjectKey:
        | null
        | 'Catalog Highlight Own Subject Color' | 'Catalog Highlight Watched Subject Color' | 'Catalog Highlight Filter Subject Color',
      linkKey:
        | 'Highlight Own Link Color' | 'Highlight You Link Color' | 'Highlight Ghost Link Color'
        | 'Catalog Highlight Own Link Color' | 'Catalog Highlight Watched Link Color' | 'Catalog Highlight Filter Link Color',
      quoteKey:
        | 'Highlight Own Quote Color' | 'Highlight You Quote Color' | 'Highlight Ghost Quote Color'
        | 'Catalog Highlight Own Quote Color' | 'Catalog Highlight Watched Quote Color' | 'Catalog Highlight Filter Quote Color',
      deadKey:
        | 'Highlight Own Dead Link Color' | 'Highlight You Dead Link Color' | 'Highlight Ghost Dead Link Color'
        | 'Catalog Highlight Own Dead Link Color' | 'Catalog Highlight Watched Dead Link Color' | 'Catalog Highlight Filter Dead Link Color',
    ) => {
      const base = autoPalette || {
        text: textColor || '',
        subject: textColor || '',
        link: linkColor || '',
        quote: quoteColor || '',
        deadLink: deadLinkColor || '',
      };
      const mode = Settings.resolveTextMode(cv(modeKey));
      // 'default' ⇒ no override; the vars stay unset so the post text falls
      // back to the theme's native text/link/greentext colors.
      if (mode === 'default') return null;
      if (mode === 'auto') return base;
      return {
        text: cv(textKey) || base.text,
        subject: (subjectKey ? cv(subjectKey) : '') || base.subject || base.text,
        link: cv(linkKey) || base.link,
        quote: cv(quoteKey) || base.quote,
        deadLink: cv(deadKey) || base.deadLink,
      };
    };
    const ownPalette = withManual(
      ownEdgeOnly ? null : Settings.autoHighlightTextPalette('Highlight Own Color', 'Highlight Own Opacity', postBackground, variant),
      'Highlight Own Text Mode',
      'Highlight Own Text Color',
      null,
      'Highlight Own Link Color',
      'Highlight Own Quote Color',
      'Highlight Own Dead Link Color',
    );
    const youPalette = withManual(
      youEdgeOnly ? null : Settings.autoHighlightTextPalette('Highlight You Color', 'Highlight You Opacity', postBackground, variant),
      'Highlight You Text Mode',
      'Highlight You Text Color',
      null,
      'Highlight You Link Color',
      'Highlight You Quote Color',
      'Highlight You Dead Link Color',
    );
    const ghostPalette = withManual(
      ghostEdgeOnly ? null : Settings.autoHighlightTextPalette('Highlight Ghost Color', 'Highlight Ghost Opacity', postBackground, variant),
      'Highlight Ghost Text Mode',
      'Highlight Ghost Text Color',
      null,
      'Highlight Ghost Link Color',
      'Highlight Ghost Quote Color',
      'Highlight Ghost Dead Link Color',
    );
    const catalogOwnTextActive = catalogOwnEnabled && !catalogOwnBorderOnly && highlightOpacity('Catalog Highlight Own Opacity') > 0
      && Settings.resolveTextMode(cv('Catalog Highlight Own Text Mode')) !== 'default';
    const catalogWatchedTextActive = catalogWatchedEnabled && !catalogWatchedBorderOnly && highlightOpacity('Catalog Highlight Watched Opacity') > 0
      && Settings.resolveTextMode(cv('Catalog Highlight Watched Text Mode')) !== 'default';
    const catalogFilterTextActive = catalogFilterEnabled && !catalogFilterBorderOnly && highlightOpacity('Catalog Highlight Filter Opacity') > 0
      && Settings.resolveTextMode(cv('Catalog Highlight Filter Text Mode')) !== 'default';
    if (updateRootClasses) {
      doc.classList.toggle('xt-catalog-own-text-colors', catalogOwnTextActive);
      doc.classList.toggle('xt-catalog-watched-text-colors', catalogWatchedTextActive);
      doc.classList.toggle('xt-catalog-filter-text-colors', catalogFilterTextActive);
    }
    const catalogOwnPalette = withManual(
      catalogOwnTextActive ? Settings.autoHighlightTextPalette('Catalog Highlight Own Color', 'Catalog Highlight Own Opacity', postBackground, variant) : null,
      'Catalog Highlight Own Text Mode',
      'Catalog Highlight Own Text Color',
      'Catalog Highlight Own Subject Color',
      'Catalog Highlight Own Link Color',
      'Catalog Highlight Own Quote Color',
      'Catalog Highlight Own Dead Link Color',
    );
    const catalogWatchedPalette = withManual(
      catalogWatchedTextActive ? Settings.autoHighlightTextPalette('Catalog Highlight Watched Color', 'Catalog Highlight Watched Opacity', postBackground, variant) : null,
      'Catalog Highlight Watched Text Mode',
      'Catalog Highlight Watched Text Color',
      'Catalog Highlight Watched Subject Color',
      'Catalog Highlight Watched Link Color',
      'Catalog Highlight Watched Quote Color',
      'Catalog Highlight Watched Dead Link Color',
    );
    const catalogFilterPalette = withManual(
      catalogFilterTextActive ? Settings.autoHighlightTextPalette('Catalog Highlight Filter Color', 'Catalog Highlight Filter Opacity', postBackground, variant) : null,
      'Catalog Highlight Filter Text Mode',
      'Catalog Highlight Filter Text Color',
      'Catalog Highlight Filter Subject Color',
      'Catalog Highlight Filter Link Color',
      'Catalog Highlight Filter Quote Color',
      'Catalog Highlight Filter Dead Link Color',
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
    setVar('--xt-catalog-filter-text', catalogFilterPalette?.text || '');
    setVar('--xt-catalog-filter-subject', catalogFilterPalette?.subject || '');
    setVar('--xt-catalog-filter-link', catalogFilterPalette?.link || '');
    setVar('--xt-catalog-filter-quote', catalogFilterPalette?.quote || '');
    setVar('--xt-catalog-filter-dead-link', catalogFilterPalette?.deadLink || '');
  },

  autoTextPalette(rgb?: [number, number, number]): { text: string; subject: string; link: string; quote: string; deadLink: string } {
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

  contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
    const l1 = Settings.relativeLuminance(fg);
    const l2 = Settings.relativeLuminance(bg);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  },

  relativeLuminance(rgb: [number, number, number]): number {
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

  styleBgCache: null as { text?: [number, number, number]; post?: [number, number, number] } | null,

  getTextBaseBackground(): [number, number, number] {
    const cache = Settings.styleBgCache;
    if (cache?.text) return cache.text;
    const style = Settings.resolveCanvasBackgroundStyle();
    const rgba = Settings.parseCSSColorRGBA(style.backgroundColor);
    // Transparent background color with only an image has no reliable average
    // color; use white as a neutral fallback for contrast calculations.
    const result: [number, number, number] =
      rgba && rgba[3] > 0 ? [rgba[0], rgba[1], rgba[2]] : [255, 255, 255];
    if (cache) cache.text = result;
    return result;
  },

  getPostBaseBackground(): [number, number, number] {
    const cache = Settings.styleBgCache;
    if (cache?.post) return cache.post;
    const fallback = Settings.getTextBaseBackground();
    let bgColor = '';
    try {
      const el = g.SITE?.bgColoredEl?.();
      if (el && d.body) {
        el.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;';
        d.body.appendChild(el);
        bgColor = window.getComputedStyle(el).backgroundColor;
        $.rm(el);
      }
    } catch (e) {
      bgColor = '';
    }

    const rgba = Settings.parseCSSColorRGBA(bgColor);
    let result: [number, number, number];
    if (!rgba || rgba[3] <= 0) result = fallback;
    else {
      const postRgb: [number, number, number] = [rgba[0], rgba[1], rgba[2]];
      result = rgba[3] >= 1 ? postRgb : Settings.mixRgb(fallback, postRgb, rgba[3]);
    }
    if (cache) cache.post = result;
    return result;
  },

  getPostBaseBackgroundCSS(): string {
    const bg = Settings.getPostBaseBackground();
    return `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
  },

  autoHighlightTextPalette(
    colorKey:
      | 'Highlight Own Color' | 'Highlight You Color' | 'Highlight Ghost Color'
      | 'Catalog Highlight Own Color' | 'Catalog Highlight Watched Color',
    opacityKey:
      | 'Highlight Own Opacity' | 'Highlight You Opacity' | 'Highlight Ghost Opacity'
      | 'Catalog Highlight Own Opacity' | 'Catalog Highlight Watched Opacity',
    baseBackground: [number, number, number] = Settings.getTextBaseBackground(),
    variant?: StyleVariant,
  ): { text: string; subject: string; link: string; quote: string; deadLink: string } | null {
    // loose: styleConf reads as untyped here (TS2347), so drop the explicit type
    // arg; result is `any`, identical at runtime.
    const color = Settings.styleConf(colorKey, variant);
    const rgb = Settings.hexToRgb(color);
    if (!rgb) return null;
    const opacity = Settings.styleConf(opacityKey, variant);
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
      case 'Catalog Highlight Filter Color':
        // Blank ⇒ show the active theme's own filter glow color (the blue on
        // dark themes, red on Yotsuba, etc.) so the swatch isn't empty and
        // matches what the catalog actually draws.
        return 'var(--xt-catalog-filter-highlight, var(--xt-highlight-shadow, var(--xt-filter-highlight, rgba(221, 0, 0, .75))))';
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

  normalizeHexColorInput(value: string): string | null {
    const input = value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(input)) {
      return `#${input[0]}${input[0]}${input[1]}${input[1]}${input[2]}${input[2]}`.toLowerCase();
    }
    if (/^[0-9a-f]{6}$/i.test(input)) {
      return `#${input}`.toLowerCase();
    }
    return null;
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
    const hexInput = input.nextElementSibling as HTMLInputElement | null;
    if (hexInput?.classList.contains('styling-color-hex')) {
      hexInput.value = input.value || '';
      hexInput.disabled = input.disabled;
      hexInput.classList.remove('styling-color-hex-invalid');
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
        ? (Settings.styleConf(highlightKey, variant) || '')
        : (Settings.styleConf(markerKey, variant) || '');
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

  hslToHex(h: number, s: number, l: number): string {
    const hue = ((h % 360) + 360) % 360;
    const sat = $.minmax(s, 0, 100) / 100;
    const light = $.minmax(l, 0, 100) / 100;
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const hh = hue / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hh < 1)      { r = c; g = x; }
    else if (hh < 2) { r = x; g = c; }
    else if (hh < 3) { g = c; b = x; }
    else if (hh < 4) { g = x; b = c; }
    else if (hh < 5) { r = x; b = c; }
    else             { r = c; b = x; }
    const m = light - c / 2;
    const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${to(r)}${to(g)}${to(b)}`;
  },

  highlightPaletteThemeProfile(variant?: StyleVariant) {
    const siteStyle = String(Settings.styleConf('siteStyle', variant) || '').trim();
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

  suggestedHighlightPalettes(variant?: StyleVariant, batch = 0) {
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
    if (batch > 0) {
      const baseHue = (batch * 47) % 360;
      const sat = profile.kind === 'dark' ? 72 : 66;
      const ownLight = profile.kind === 'dark' ? 64 : 42;
      const youLight = profile.kind === 'dark' ? 66 : 38;
      const ghostLight = profile.kind === 'dark' ? 68 : 48;
      const catalogLight = profile.kind === 'dark' ? 62 : 36;
      const generated = Array.from({ length: 5 }, (_, i) => {
        const h = baseHue + (i * 31);
        const accentShift = 96 + ((batch + i) % 3) * 24;
        return {
          id: `generated-${batch}-${i}`,
          name: `Generated ${batch + 1}.${i + 1}`,
          colors: {
            own: Settings.hslToHex(h, sat, ownLight),
            you: Settings.hslToHex(h + accentShift, sat - 4, youLight),
            ghost: Settings.hslToHex(h + 210, profile.kind === 'dark' ? 12 : 10, ghostLight),
            catalogOwn: Settings.hslToHex(h + 165, sat - 8, catalogLight),
            catalogWatched: Settings.hslToHex(h + 270, sat - 2, catalogLight + (profile.kind === 'dark' ? 3 : 2)),
          },
        };
      });
      return {
        profile,
        palettes: generated,
      };
    }
    return {
      profile,
      palettes: profile.kind === 'dark' ? dark : light,
    };
  },

  normalizeSavedHighlightPalette(raw: any): {
    name: string;
    colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>;
    markers?: Partial<Record<'own' | 'you' | 'ghost', string>>;
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
    // Markers are optional; keep only valid-hex entries. An absent/empty markers
    // object is fine (older palettes simply never tracked them).
    const markers: Partial<Record<'own' | 'you' | 'ghost', string>> = {};
    const rawMarkers = raw.markers && typeof raw.markers === 'object' ? raw.markers : {};
    for (const slot of ['own', 'you', 'ghost'] as const) {
      const value = String(rawMarkers[slot] || '').trim().toLowerCase();
      if (isHex(value)) markers[slot] = value;
    }
    return {
      name,
      colors: { own, you, ghost, catalogOwn, catalogWatched },
      ...(raw.markers !== undefined ? { markers } : {}),
    };
  },

  savedHighlightPaletteList(): {
    name: string;
    colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>;
    markers?: Partial<Record<'own' | 'you' | 'ghost', string>>;
  }[] {
    const raw = Conf['savedHighlightPalettes'];
    if (!Array.isArray(raw)) return [];
    const out: {
      name: string;
      colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>;
      markers?: Partial<Record<'own' | 'you' | 'ghost', string>>;
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
    markers?: Partial<Record<'own' | 'you' | 'ghost', string>>;
  }[]) {
    const cleaned = list
      .map(item => Settings.normalizeSavedHighlightPalette(item))
      .filter(Boolean) as {
      name: string;
      colors: Record<'own' | 'you' | 'ghost' | 'catalogOwn' | 'catalogWatched', string>;
      markers?: Partial<Record<'own' | 'you' | 'ghost', string>>;
    }[];
    Conf['savedHighlightPalettes'] = cleaned;
    $.set('savedHighlightPalettes', cleaned);
  },

  CUSTOM_SITE_THEME_PREFIX: 'custom:' as const,

  isCustomSiteThemeValue(value: string): boolean {
    return typeof value === 'string' && value.startsWith(Settings.CUSTOM_SITE_THEME_PREFIX);
  },

  customSiteThemeName(value: string): string {
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
    return Settings.customSiteThemeList().find((t: { name: string }) => t.name === name) || null;
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
        note.textContent = 'Style options are only available on supported board pages.';
      } else {
        note.hidden = true;
      }
    }

    const desired = Settings.styleConf('siteStyle');
    if (desired && seen.has(desired)) {
      select.value = desired;
    } else if (!noOptions) {
      // No saved preference for this variant: reflect whatever theme is actually
      // rendered right now (4chan's own selector) rather than defaulting to the
      // first option, so the picker doesn't misreport the active theme.
      const current = ($.id('styleSelector') as HTMLSelectElement | null)?.value?.trim();
      if (current && seen.has(current)) {
        select.value = current;
      } else if (select.selectedIndex < 0) {
        select.selectedIndex = 0;
      }
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
  },

  removeCustomSiteTheme(name: string) {
    if (!name) return;
    const list = Settings.customSiteThemeList().filter((t: { name: string }) => t.name !== name);
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
      const fallback = Settings.styleConf('siteStyle') || '';
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

  siteStyleHome(this: HTMLInputElement) {
    if (!this.checked) return;
    const activeStyle = Settings.styleConf('siteStyle');
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
    'Styling',
    'Custom CSS',
    'Interface',
    'Threads & Posts',
    'History',
    'Watched Threads',
    'Media',
    'Posting',
    'Filters',
    'Keybinds',
    'Advanced'
  ],

  exportSectionOrder: [
    { name: 'General', option: 'General' },
    { name: 'Styling', option: 'Styling', children: ['Custom CSS'] },
    { name: 'Interface', option: 'Interface' },
    { name: 'Threads & Posts', option: 'Threads & Posts', children: ['History', 'Watched Threads'] },
    { name: 'Media', option: 'Media' },
    { name: 'Posting', option: 'Posting' },
    { name: 'Filters', option: 'Filters' },
    { name: 'Keybinds', option: 'Keybinds' },
    { name: 'Advanced', option: 'Advanced' }
  ],

  impExpPicker: null as HTMLDivElement | null,

  exportOptionKeys() {
    const options: Record<string, string[]> = dict();
    const keysIn = (category: string) => {
      const obj = Config.main[category as keyof typeof Config.main] || dict();
      const keys: string[] = [];
      for (const key in obj) {
        if (Array.isArray((obj as Record<string, any>)[key])) keys.push(key);
      }
      return keys;
    };
    const stylingOnlyKeys = [
      'Scrollbar Markers',
      'Scrollbar Mark Own Posts',
      'Scrollbar Mark Quotes You',
      'Scrollbar Mark Ghost Posts',
      'Scrollbar Mark Unread Line',
      'Scrollbar Marker Position',
      'Scrollbar Marker Hover Preview',
      'Highlight Posts Quoting You',
      'Highlight Own Posts',
      'Highlight Ghost Posts'
    ];

    options['General'] = [
      'JSON Index',
      `Use ${meta.name} Catalog`,
      'Index Refresh Notifications',
      'Open Threads in New Tab',
      'External Catalog',
      '404 Redirect',
      'Archive Report',
      'Exempt Archives from Encryption',
      'Show Updated Notifications',
      'Disable Native Extension',
      'Enable Native Flash Embedding',
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
      'Persistent Custom Board Titles',
      'Color User IDs',
      'Count Posts by ID',
      'Remove Spoilers',
      'Reveal Spoilers',
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

    options['History'] = [
      'lastReadPosts',
      'yourPosts',
      'hiddenThreads',
      'hiddenPosts',
      'hiddenPosterIds'
    ];

    options['Watched Threads'] = [
      'watchedThreads',
      'watcherBackup',
      'watcherLastModified'
    ];

    options['Media'] = [
      ...keysIn('Images and Videos'),
      ...keysIn('Linkification'),
      'sauces',
      'selectedArchives'
    ];

	    options['Posting'] = [
      ...keysIn('Posting and Captchas'),
      'Comment Preview Position', // deprecated/unused, kept for back-compat export
      'Comment Preview Inline Behavior',
      'Comment Preview Last Mode',
      'Comment Preview Float Position',
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
      'Thread Highlight Edge Width',
      'Highlight Own Edge Width',
      'Highlight You Edge Width',
      'Highlight Ghost Edge Width',
      'Catalog Highlight Border Width',
      'Catalog Highlight Own Border Width',
      'Catalog Highlight Watched Border Width',
      'Scroll Marker Match Highlights',
      'Scroll Marker Own Match Highlight',
      'Scroll Marker You Match Highlight',
      'Scroll Marker Ghost Match Highlight',
      'Catalog Highlight Own Posts',
      'Catalog Highlight Watched Threads',
      'Catalog Highlight Own Background',
      'Catalog Highlight Watched Background',
      'Highlight Own Color',
      'Highlight You Color',
      'Highlight Ghost Color',
      'Catalog Highlight Own Color',
      'Catalog Highlight Watched Color',
      'Catalog Highlight Own Background',
      'Catalog Highlight Watched Background',
      'Catalog Highlight Own Text Mode',
      'Catalog Highlight Watched Text Mode',
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
      'Highlight Own Text Mode',
      'Highlight You Text Mode',
      'Highlight Ghost Text Mode',
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
      'Highlight Own Background',
      'Highlight You Background',
      'Highlight Ghost Background',
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
      'settings.customCSSEditorExpanded',
      'settings.customCSSEditorBracketHighlight'
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
    $.get(Conf2, function(Conf2: Record<string, any>) {
      // Don't export cached JSON data or the remembered checkbox state.
      delete Conf2['boardConfig'];
      delete Conf2['settings.exportGroups'];
      // Default every group to checked, unless the user has exported before,
      // in which case restore their last-used selection.
      $.get('settings.exportGroups', null, function(items: Record<string, any>) {
        const lastUsed = items['settings.exportGroups'];
        const defaultCheckedOptions: Record<string, boolean> = dict();
        for (const name of Settings.exportOptionOrder) {
          defaultCheckedOptions[name] = lastUsed ? !!lastUsed[name] : true;
        }
        Settings.openImpExpPicker({
          title: 'Export Settings',
          action: 'Export',
          conf: Conf2,
          defaultCheckedGroups: defaultCheckedOptions,
          onConfirm: (checkedOptions: Record<string, boolean>) => Settings.doExport(checkedOptions, Conf2)
        });
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
    const groups = Settings.exportOptionOrder.filter((name: string) => checkedOptions[name]);
    // Remember the selection so the next export defaults to the same checkboxes.
    $.set('settings.exportGroups', checkedOptions);
    Settings.downloadExport({version: g.VERSION, date: Date.now(), groups, Conf: out});
  },

  downloadExport(data: Record<string, any>) {
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

  import(this: HTMLElement) {
    $('input[type=file]', this.parentNode as Element).click();
  },

  onImport(this: HTMLInputElement) {
    if ((this as HTMLInputElement).type !== 'file') { return; }
    let file;
    if (!(file = this.files![0])) { return; }
    this.value = null as any;
    const output = $('.imp-exp-result', Settings.dialog);

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        let data = dict.json((e.target as FileReader).result as string);
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
          onConfirm: (checkedOptions: Record<string, boolean>) => Settings.doImport(data, checkedOptions)
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
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
      Settings.loadSettings(selected, function(err: any) { // loose: storage callback error is untyped
        if (err) {
          output.textContent = 'Import failed due to an error.';
        } else if (confirm('Import successful. Reload now?')) {
          window.location.reload();
        }
      });
      return;
    }

    $.set(selected.Conf, function(err: any) { // loose: storage callback error is untyped
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
      const childOptions = (sectionInfo.children || []).filter((name: string) => presentGroups[name]);
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

  upgrade(data: Record<string, any>, version: string) {
    let corrupted, key, val;
    const changes = dict();
    const set = (key: string, value: any) => data[key] = (changes[key] = value);
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
    // "Remember QR State" was renamed to "QR Drafts" when drafts went per-thread.
    // Carry the user's existing toggle over. Idempotent: only seeds when unset.
    if (data['QR Drafts'] === undefined && data['Remember QR State'] !== undefined) {
      set('QR Drafts', data['Remember QR State']);
    }
    if (data['Dump List Remove File First'] === undefined) {
      if (data['QR Remove Button Clears File First'] !== undefined) {
        set('Dump List Remove File First', data['QR Remove Button Clears File First']);
      } else if (data['QR Thumbnail Remove File First'] !== undefined) {
        set('Dump List Remove File First', data['QR Thumbnail Remove File First']);
      }
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
    for (const variant of ['SFW', 'NSFW']) {
      const legacyWidth = data[`Highlight Edge Width ${variant}`] ?? data['Highlight Edge Width'];
      if (legacyWidth === undefined) continue;
      if (data[`Thread Highlight Edge Width ${variant}`] === undefined) set(`Thread Highlight Edge Width ${variant}`, legacyWidth);
      if (data[`Catalog Highlight Border Width ${variant}`] === undefined) set(`Catalog Highlight Border Width ${variant}`, legacyWidth);
    }
    // Per-state widths were split out of the single section width; seed each
    // from the section value so existing looks carry over until customized.
    for (const variant of ['SFW', 'NSFW']) {
      const threadShared = data[`Thread Highlight Edge Width ${variant}`] ?? data['Thread Highlight Edge Width'] ?? 3;
      for (const k of ['Highlight Own Edge Width', 'Highlight You Edge Width', 'Highlight Ghost Edge Width']) {
        if (data[`${k} ${variant}`] === undefined) set(`${k} ${variant}`, threadShared);
      }
      const catalogShared = data[`Catalog Highlight Border Width ${variant}`] ?? data['Catalog Highlight Border Width'] ?? 3;
      for (const k of ['Catalog Highlight Own Border Width', 'Catalog Highlight Watched Border Width']) {
        if (data[`${k} ${variant}`] === undefined) set(`${k} ${variant}`, catalogShared);
      }
    }
    // The "edge only" / "border only" toggles were replaced by inverted
    // "background" toggles: the colored edge is now the always-on default, and
    // checking the box adds the background fill. Migrate existing users by
    // inverting their old value. This block runs only on upgrade (see
    // Main.upgrade), so a thread key that's still undefined means a
    // pre-edge-feature user who had filled highlights -> background on.
    // Idempotent: only seeds keys not already present.
    for (const [oldKey, newKey] of [
      ['Highlight Own Edge Only', 'Highlight Own Background'],
      ['Highlight You Edge Only', 'Highlight You Background'],
      ['Highlight Ghost Edge Only', 'Highlight Ghost Background'],
    ]) {
      if (data[newKey] === undefined) {
        set(newKey, data[oldKey] !== undefined ? !data[oldKey] : true);
      }
    }
    // Catalog border-only toggles are per-variant (SFW/NSFW). Only seed when the
    // user actually stored a value; otherwise the new `false` default already
    // matches the old border-only default, so reads fall through to it.
    for (const [oldKey, newKey] of [
      ['Catalog Highlight Own Border Only', 'Catalog Highlight Own Background'],
      ['Catalog Highlight Watched Border Only', 'Catalog Highlight Watched Background'],
    ]) {
      for (const variant of ['SFW', 'NSFW']) {
        const old = data[`${oldKey} ${variant}`] ?? data[oldKey];
        if (old !== undefined && data[`${newKey} ${variant}`] === undefined) {
          set(`${newKey} ${variant}`, !old);
        }
      }
    }
    // Highlight text coloring moved from an "Auto text" checkbox to a
    // Defaults/Auto/Manual dropdown that defaults to Defaults (theme colors).
    // Preserve users who had set manual highlight text colors by switching
    // those rows to Manual; everyone else lands on Defaults.
    const highlightTextTypes: Array<[string, string[]]> = [
      ['Highlight Own Text Mode', ['Highlight Own Text Color', 'Highlight Own Link Color', 'Highlight Own Quote Color', 'Highlight Own Dead Link Color']],
      ['Highlight You Text Mode', ['Highlight You Text Color', 'Highlight You Link Color', 'Highlight You Quote Color', 'Highlight You Dead Link Color']],
      ['Highlight Ghost Text Mode', ['Highlight Ghost Text Color', 'Highlight Ghost Link Color', 'Highlight Ghost Quote Color', 'Highlight Ghost Dead Link Color']],
      ['Catalog Highlight Own Text Mode', ['Catalog Highlight Own Text Color', 'Catalog Highlight Own Subject Color', 'Catalog Highlight Own Link Color', 'Catalog Highlight Own Quote Color', 'Catalog Highlight Own Dead Link Color']],
      ['Catalog Highlight Watched Text Mode', ['Catalog Highlight Watched Text Color', 'Catalog Highlight Watched Subject Color', 'Catalog Highlight Watched Link Color', 'Catalog Highlight Watched Quote Color', 'Catalog Highlight Watched Dead Link Color']],
    ];
    for (const [legacyKey, modeBase] of [
      ['Highlight Own Text Auto', 'Highlight Own Text Mode'],
      ['Highlight You Text Auto', 'Highlight You Text Mode'],
      ['Highlight Ghost Text Auto', 'Highlight Ghost Text Mode'],
    ] as const) {
      if (data[legacyKey] !== undefined && data[modeBase] === undefined) {
        set(modeBase, data[legacyKey] ? 'auto' : 'manual');
      }
    }
    if (data['Scroll Marker Match Highlights'] !== undefined) {
      for (const key of [
        'Scroll Marker Own Match Highlight',
        'Scroll Marker You Match Highlight',
        'Scroll Marker Ghost Match Highlight',
      ]) {
        if (data[key] === undefined) set(key, !!data['Scroll Marker Match Highlights']);
      }
    }
    for (const variant of ['SFW', 'NSFW']) {
      for (const [modeBase, colorBases] of highlightTextTypes) {
        const modeKey = `${modeBase} ${variant}`;
        if (data[modeKey] !== undefined) continue;
        const hasManual = colorBases.some(c => {
          const v = data[`${c} ${variant}`];
          return typeof v === 'string' && v !== '';
        });
        if (hasManual) set(modeKey, 'manual');
      }
    }
    return changes;
  },

  loadSettings(data: Record<string, any>, cb: (err?: any) => void) {
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
    simpleContainer: HTMLElement | null;
    advancedType: string | null;
    advancedTextarea: HTMLTextAreaElement | null;
  },
  forcedFiltersMode: null as null | string,
  forcedFilterType: null as null | string,
  // Set by easyFilters(); flushes a pending debounced auto-save (called on close so an
  // edit made right before closing is persisted to Conf synchronously, not lost).
  easyFiltersFlush: null as null | (() => void),

  filter(section: HTMLElement) {
    const simplePanel = $.el('div') as HTMLDivElement;
    const advancedPanel = $.el('div') as HTMLDivElement;
    const previewState = {
      panel: null,
      simpleContainer: null as HTMLElement | null,
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

  advancedFilter(section: HTMLElement, previewState: any) { // loose: internal mutable preview-state bag
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
        Settings.prepareAutosaveTextarea(ta);
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
    const container = $('.easy-filters-list', section) as HTMLElement;
    const addButton = $('.easy-filter-add', section);
    const status = $('.easy-filter-status', section);
    if (previewState) previewState.simpleContainer = container;

    // Layout mode (auto/grid/list). "list" = inline rows, "grid" = vertical cards.
    // "auto" measures the actual layout: it lays the tiles out as inline rows and
    // checks whether any row's controls wrap onto a second line. If a row would
    // wrap it drops to "grid" (whose column count then auto-fits the width); while
    // every row still fits on one line it stays "list". Re-evaluated live via
    // ResizeObserver. Mode persists like settings.filtersMode; the resolved class
    // is layout-list/grid.
    let resizeObserver: ResizeObserver | null = null;
    let lastAutoWidth = -1;
    const dialogWidth = () => {
      const dialog = container.closest('#fourchanx-settings') as HTMLElement | null;
      return (dialog || container).getBoundingClientRect().width;
    };
    // True when, laid out as inline rows, any tile's controls spill onto a second
    // line. The tile is align-items:center, so controls of different heights still
    // share a vertical center while on one line; a wrapped control drops a full
    // line below. Comparing centers (not tops) avoids false positives from the
    // taller controls (selects, color picker) sitting higher within the same row.
    const inlineRowsWrap = () => {
      container.className = 'easy-filters-list layout-list';
      for (const tile of $$('.easy-filter-tile', container)) {
        let min = Infinity, max = -Infinity;
        for (const item of $$('.easy-filter-on, .easy-filter-remove, .easy-filter-field', tile)) {
          const r = item.getBoundingClientRect();
          if (!r.height) continue; // not laid out yet — ignore rather than count as wrapped
          const center = r.top + r.height / 2;
          if (center < min) min = center;
          if (center > max) max = center;
        }
        if (max - min > 6) return true; // a control sits ~a line below the rest
      }
      return false;
    };
    const resolveAuto = () => {
      lastAutoWidth = dialogWidth();
      container.className = `easy-filters-list ${inlineRowsWrap() ? 'layout-grid' : 'layout-list'}`;
    };
    const setLayout = (mode: string) => {
      if (!['auto', 'grid', 'list'].includes(mode)) mode = 'auto';
      for (const btn of $$('.easy-filter-layout-btn', section)) {
        btn.classList.toggle('selected', (btn as HTMLElement).dataset.layout === mode);
      }
      $.set('settings.easyFiltersLayout', mode);
      if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
      if (mode === 'auto') {
        resolveAuto();
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            if (Math.round(dialogWidth()) !== Math.round(lastAutoWidth)) resolveAuto();
          });
          resizeObserver.observe((container.closest('#fourchanx-settings') as HTMLElement) || container);
        }
      } else {
        container.className = `easy-filters-list layout-${mode}`;
      }
    };
    for (const btn of $$('.easy-filter-layout-btn', section)) {
      $.on(btn, 'click', () => setLayout((btn as HTMLElement).dataset.layout || 'auto'));
    }
    $.get('settings.easyFiltersLayout', 'auto', (item) => setLayout(item['settings.easyFiltersLayout']));

    const save = () => {
      const rules = Settings.collectEasyFilters(container);
      const serialized = JSON.stringify(rules);
      $.set('easyFilters', serialized);
      Conf['easyFilters'] = serialized;
      status.textContent = `Saved ${rules.length} rule${rules.length === 1 ? '' : 's'}.`;
      Settings.refreshCombinedFilterPreview(previewState);
    };

    // Auto-save: any add/edit/remove schedules a save. Debounced so typing a pattern
    // persists shortly after the last keystroke rather than on every character.
    let saveTimer: any = null;
    const markDirty = () => {
      status.textContent = 'Saving…';
      Settings.refreshCombinedFilterPreview(previewState);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { saveTimer = null; save(); }, 500);
    };
    Settings.easyFiltersFlush = () => {
      if (saveTimer == null) return;
      clearTimeout(saveTimer);
      saveTimer = null;
      save();
    };

    const addRow = (rule: any = {}) => {
      const row = Settings.easyFilterRow(rule, markDirty);
      $.add(container, row);
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

    status.textContent = `Loaded ${rules.length} rule${rules.length === 1 ? '' : 's'}.`;
    Settings.refreshCombinedFilterPreview(previewState);
  },

  parseEasyFilters(): any[] {
    return Filter.parseEasyFilterRules(Conf['easyFilters']);
  },

  easyFilterRow(rule: any, markDirty: () => void): HTMLElement {
    const tr = $.el('div', {
      className: 'easy-filter-tile',
      innerHTML: `
        <div class="easy-filter-tile-head">
          <label class="easy-filter-on" title="Enable/disable this filter"><input class="easy-filter-enabled" type="checkbox"></label>
          <button class="easy-filter-remove" type="button" title="Remove">\u00D7</button>
        </div>
        <label class="easy-filter-field"><input class="field easy-filter-pattern" type="text" placeholder="Pattern" aria-label="Pattern"></label>
        <label class="easy-filter-field"><input class="field easy-filter-boards" type="text" placeholder="Boards: all or g,v" aria-label="Boards"></label>
        <label class="easy-filter-field"><select class="field easy-filter-type" aria-label="Filter type" title="Filter type"></select></label>
        <label class="easy-filter-field"><span class="easy-filter-color-cell"><input class="easy-filter-color-on" type="checkbox" title="Apply this color (off = theme default)"><input class="easy-filter-color" type="color" title="Highlight color"></span></label>
        <label class="easy-filter-field"><input class="field easy-filter-class" type="text" placeholder="CSS class" aria-label="CSS class" title="Optional custom CSS class, applied alongside the color"></label>
        <label class="easy-filter-field" title="Auto: move highlighted OPs to top"><span data-abbr="A" data-full="Auto"></span><input class="easy-filter-auto" type="checkbox" title="Auto: move highlighted OPs to top"></label>
        <label class="easy-filter-field" title="Hide"><span data-abbr="H" data-full="Hide"></span><input class="easy-filter-hide" type="checkbox" title="Hide"></label>
        <label class="easy-filter-field" title="Override: matching highlight prevents this thread from being hidden by other rules"><span data-abbr="O" data-full="Override"></span><input class="easy-filter-override" type="checkbox" title="Override: matching highlight prevents this thread from being hidden by other rules"></label>
      `,
    }) as HTMLElement;

    const typeSelect = $('.easy-filter-type', tr) as HTMLSelectElement;
    $.add(typeSelect, $.el('option', { textContent: 'Filter type', value: '', disabled: true }));
    for (const [label, value] of Settings.easyFilterTypes) {
      $.add(typeSelect, $.el('option', { textContent: label, value }));
    }

    const enabledInput = $('.easy-filter-enabled', tr) as HTMLInputElement;
    const patternInput = $('.easy-filter-pattern', tr) as HTMLInputElement;
    const boardsInput = $('.easy-filter-boards', tr) as HTMLInputElement;
    const colorOnInput = $('.easy-filter-color-on', tr) as HTMLInputElement;
    const colorInput = $('.easy-filter-color', tr) as HTMLInputElement;
    const classInput = $('.easy-filter-class', tr) as HTMLInputElement;
    const autoInput = $('.easy-filter-auto', tr) as HTMLInputElement;
    const hideInput = $('.easy-filter-hide', tr) as HTMLInputElement;
    const overrideInput = $('.easy-filter-override', tr) as HTMLInputElement;
    const removeButton = $('.easy-filter-remove', tr);

    enabledInput.checked = rule.enabled != null ? !!rule.enabled : true;
    patternInput.value = rule.pattern || '';
    boardsInput.value = rule.boards || '';
    typeSelect.value = (rule.type in Config.filter) ? rule.type : 'general';
    // <input type="color"> needs a valid #rrggbb value; the normalizer guarantees one.
    const hexColor = /^#?([0-9a-f]{6})$/i.exec((rule.color || '').trim());
    colorInput.value = hexColor ? `#${hexColor[1].toLowerCase()}` : '#dd0000';
    colorOnInput.checked = !!rule.colorOn;
    classInput.value = rule.hlClass || '';
    autoInput.checked = !!rule.auto;
    hideInput.checked = rule.hide != null ? !!rule.hide : true;
    overrideInput.checked = !!rule.override;

    // Highlight controls (color + class) only apply when the rule highlights rather
    // than hides. The swatch itself also depends on its "apply color" checkbox, so an
    // off checkbox means "use the theme default" while a class can still be set.
    const syncHighlightControls = () => {
      const hidden = hideInput.checked;
      overrideInput.disabled = hidden;
      if (hidden) overrideInput.checked = false;
      colorOnInput.disabled = hidden;
      colorInput.disabled = hidden || !colorOnInput.checked;
      classInput.disabled = hidden;
    };
    syncHighlightControls();
    $.on(hideInput, 'change', syncHighlightControls);
    $.on(colorOnInput, 'change', syncHighlightControls);

    // Dim the whole row when the rule is disabled so its on/off state reads at a
    // glance — the leading toggle acts like a switch for the row.
    const syncEnabledState = () => {
      tr.classList.toggle('easy-filter-off', !enabledInput.checked);
    };
    syncEnabledState();
    $.on(enabledInput, 'change', syncEnabledState);

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

  collectEasyFilters(container: HTMLElement): any[] {
    const rules: any[] = [];
    for (const tr of $$('.easy-filter-tile', container)) {
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
        colorOn: ($('.easy-filter-color-on', tr) as HTMLInputElement).checked,
        hlClass: ($('.easy-filter-class', tr) as HTMLInputElement).value.trim().replace(/^\.+/, '').replace(/[^\w-]/g, ''),
        auto: ($('.easy-filter-auto', tr) as HTMLInputElement).checked,
        hide,
        override: !hide && ($('.easy-filter-override', tr) as HTMLInputElement).checked,
      });
    }
    return rules;
  },

  easyFilterRuleFromRow(tr: HTMLElement) {
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
      colorOn: ($('.easy-filter-color-on', tr) as HTMLInputElement).checked,
      hlClass: ($('.easy-filter-class', tr) as HTMLInputElement).value.trim().replace(/^\.+/, '').replace(/[^\w-]/g, ''),
      auto: ($('.easy-filter-auto', tr) as HTMLInputElement).checked,
      hide,
      override: !hide && ($('.easy-filter-override', tr) as HTMLInputElement).checked,
    };
  },

  easyFilterRuleToLine(rule: any): string | null {
    return Filter.easyRuleToLine(rule);
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

  refreshCombinedFilterPreview(previewStateArg?: null | {
    panel: HTMLDivElement | null;
    simpleContainer: HTMLElement | null;
    advancedType: string | null;
    advancedTextarea: HTMLTextAreaElement | null;
  }) {
    const previewState = arguments.length === 0 ? Settings.filtersPreviewState : previewStateArg!;
    const panel = previewState?.panel;
    if (!panel) return;
    $.rmAll(panel);

    if (!previewState.simpleContainer && !previewState.advancedTextarea) {
      $.add(panel, $.el('div', {
        className: 'filter-stats-empty',
        textContent: 'No filters loaded yet.',
      }));
      return;
    }

    if (previewState.simpleContainer) {
      const simpleGroup = $.el('div', { className: 'filter-preview-group' });
      $.add(simpleGroup, $.el('div', { className: 'filter-preview-heading', textContent: 'Simple Filters' }));
      const simplePanel = $.el('div', { className: 'filter-stats' });
      $.add(simpleGroup, simplePanel);
      Settings.renderEasyFilterPreview(previewState.simpleContainer, simplePanel);
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

  renderEasyFilterPreview(container: HTMLElement, panel: HTMLElement) {
    $.rmAll(panel);
    if (!g.BOARD?.threads || (g.VIEW !== 'index' && g.VIEW !== 'thread' && g.VIEW !== 'catalog')) {
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
    for (const tr of $$('.easy-filter-tile', container)) {
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
    if (!g.BOARD?.threads || (g.VIEW !== 'index' && g.VIEW !== 'thread' && g.VIEW !== 'catalog')) {
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
        return { invalid: err instanceof Error ? err.message : String(err) };
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
        const parsed = g.SITE!.Build.parseJSON(data, g.BOARD!);
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
    let href = (g.SITE!.Build as any).postURL?.(boardID, id, id) || (g.SITE!.Build as any).threadURL?.(boardID, id) || '';
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

  sauce(section: HTMLElement) {
    $.extend(section, { innerHTML: SaucePage });
    $('.warning', section).hidden = Conf['Sauce'];
    const ta = $('textarea', section);
    $.get('sauces', Conf['sauces'], function(item) {
      ta.value = item['sauces'];
      ta.hidden = false;
      Settings.prepareAutosaveTextarea(ta);
    }); // XXX prevent Firefox from adding initialization to undo queue
    $.on(ta, 'change', $.cb.value);
    // The Detach button now lives in the section's <summary> and is wired by the
    // section builder (see media()); nothing to do here.
  },

  advanced(section: HTMLElement) {
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

    $.get(items, function(items: Record<string, any>) {
      for (var key in items) {
        var val = items[key];
        input = inputs[key];
        input[input.type === 'checkbox' ? 'checked' : 'value'] = val;
        input.hidden = false; // XXX prevent Firefox from adding initialization to undo queue
        if (input.nodeName === 'TEXTAREA') {
          Settings.prepareAutosaveTextarea(input as HTMLTextAreaElement);
        }
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

    // Personas: Tab/Shift+Tab indent, Ctrl+/ to toggle `#` line comments, and a
    // Detach button (in the section's summary) that pops the whole block into a
    // floating window — matching the Custom CSS editor.
    const personaTA = $('.personafield', section) as HTMLTextAreaElement | null;
    if (personaTA) {
      Settings.bindPlainEditorKeys(personaTA, '#');
      Settings.makeDetachable(
        personaTA.closest('details') as HTMLElement | null,
        $('#personas-detach', section),
        { storageKey: 'settings.detachPanel.personas', title: 'Personas' },
      );
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
    $.get(itemsArchive, function(itemsArchive: Record<string, any>) {
      $.extend(Conf, itemsArchive);
      Redirect.selectArchives();
      Settings.addArchiveTable(section);
    });

    const boardSelect    = $('#archive-board-select', section);
    const table          = $('#archive-table', section);
    const updateArchives = $('#update-archives', section);

    if (boardSelect && table) {
      $.on(boardSelect, 'change', function(this: HTMLInputElement) {
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
      const volHint = inputs.beepVolume.closest('.sound-row')?.querySelector('.beep-volume-value') as HTMLElement | null;
      const syncBeepVolumeLabel = () => {
        if (volHint) {
          volHint.textContent = `${Math.round(Number(inputs.beepVolume.value) * 100)}%`;
        }
      };
      const previewBeepVolume = () => {
        $.cb.value.call(inputs.beepVolume);
        syncBeepVolumeLabel();
        ThreadUpdater.playBeep(false);
      };
      syncBeepVolumeLabel();
      $.on(inputs.beepVolume, 'input', previewBeepVolume);
      $.on(inputs.beepVolume, 'change', previewBeepVolume);
    }

    Settings.addSoundLibrary(section);
    Settings.addBoardSoundOverrides(section);
    Settings.addPostSoundOverrides(section);
  },

  addSoundLibrary(section: HTMLElement) {
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

  wireSoundUrlAdd(section: HTMLElement, render: () => void) {
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

  wireSoundExportImport(section: HTMLElement, render: () => void) {
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
          setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
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

  addUpdaterBoardSound(root: HTMLElement) {
    SoundManager.init();
    const boardID = g.BOARD?.ID;
    if (!boardID) {
      $.add(root, $.el('div', {
        className: 'description',
        textContent: 'Open a board to pick its update sound here (or set overrides in Advanced).',
      }));
      return;
    }

    const div = $.el('div');
    div.dataset.name = 'board-update-sound';
    const label = $.el('label');
    $.add(label, $.el('span', { className: 'setting-title', textContent: `Board update sound (/${boardID}/): ` }));
    const select = $.el('select', { className: 'field', name: 'board-update-sound' }) as HTMLSelectElement;
    const previewBtn = $.el('button', {
      type: 'button',
      className: 'sound-btn',
      textContent: 'Preview',
      title: 'Play the selected sound',
    });

    const fillOptions = () => {
      const current = SoundManager.getBoardOverride(boardID);
      $.rmAll(select);
      $.add(select, $.el('option', { value: '', textContent: 'Default (inherit)' }));
      for (const lib of SoundManager.library()) {
        const opt = $.el('option', { value: lib.id, textContent: lib.name });
        if (lib.id === current) opt.selected = true;
        $.add(select, opt);
      }
      if (current && !SoundManager.getEntry(current)) {
        const missing = $.el('option', { value: current, textContent: `(missing: ${current})` });
        missing.selected = true;
        $.add(select, missing);
      }
    };

    fillOptions();
    $.on(select, 'change', () => {
      const soundId = select.value || null;
      SoundManager.setBoardOverride(boardID, soundId);
      if (soundId) {
        const entry = SoundManager.getEntry(soundId);
        if (entry?.data) ThreadUpdater.playSound(entry.data, false);
      }
    });
    $.on(previewBtn, 'click', () => {
      const soundId = select.value;
      if (!soundId) {
        ThreadUpdater.playBeep(false);
        return;
      }
      const entry = SoundManager.getEntry(soundId);
      if (entry?.data) ThreadUpdater.playSound(entry.data, false);
    });

    $.add(label, select);
    $.add(div, [
      label,
      previewBtn,
      Settings.descriptionSpan('Plays on new posts in this board.'),
    ]);
    $.add(root, div);
  },

  addBoardSoundOverrides(section: HTMLElement) {
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
        const board = $.el('span', { className: 'sound-list__board', title: `${siteID}/${boardID}`, textContent: `/${boardID}/` });
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

  refreshBoardSoundsSelect(section: HTMLElement) {
    const sel = $('#board-sounds-sound', section) as HTMLSelectElement;
    if (!sel) return;
    $.rmAll(sel);
    for (const lib of SoundManager.library()) {
      const opt = $.el('option', { value: lib.id, textContent: lib.name });
      $.add(sel, opt);
    }
  },

  populateBoardDatalist(section: HTMLElement) {
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

  addPostSoundOverrides(section: HTMLElement) {
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

  addArchiveTable(section: HTMLElement) {
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

    const rows: HTMLTableRowElement[] = [];
    const boardOptions: HTMLOptionElement[] = [];
    for (boardID of Object.keys(archBoards).sort()) { // Alphabetical order
      var row = $.el('tr',
        {className: `board-${boardID}`});
      row.hidden = boardID !== g.BOARD!.ID;

      boardOptions.push($.el('option', {
        textContent: `/${boardID}/`,
        value:       `board-${boardID}`,
        selected:    boardID === g.BOARD!.ID
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

    if (!(g.BOARD!.ID in archBoards)) {
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

  addArchiveCell(boardID: string, data: Record<string, any>, type: string) {
    const {length} = data[type];
    const td = $.el('td',
      {className: 'archive-cell'});
    td.dataset.label = ({
      thread: 'Thread redirection',
      threadJSON: 'Thread fetching',
      post: 'Post fetching',
      file: 'File redirection',
    } as Record<string, string>)[type] || type;

    if (!length) {
      td.textContent = '--';
      return td;
    }

      const options: HTMLOptionElement[] = [];
    let i = 0;
    while (i < length) {
      var archive = data[type][i++];
      options.push($.el('option', {
        value: JSON.stringify(archive[0]),
        textContent: archive[1]
      }));
    }

    $.extend(td, {innerHTML: '<select></select>'});
    const select = td.firstElementChild as HTMLSelectElement;
    if (!(select.disabled = length === 1)) {
      // XXX GM can't into datasets
      select.setAttribute('data-boardid', boardID);
      select.setAttribute('data-type', type);
      $.on(select, 'change', Settings.saveSelectedArchive);
    }
    $.add(select, options);

    return td;
  },

  saveSelectedArchive(this: HTMLSelectElement) {
    $.get('selectedArchives', Conf['selectedArchives'], ({selectedArchives}) => {
      (selectedArchives[this.dataset.boardid!] || (selectedArchives[this.dataset.boardid!] = dict()))[this.dataset.type!] = JSON.parse(this.value);
      $.set('selectedArchives', selectedArchives);
      Conf['selectedArchives'] = selectedArchives;
      Redirect.selectArchives();
    });
  },

  boardnav(this: HTMLInputElement) {
    Header.generateBoardList(this.value);
  },

  time(this: HTMLInputElement) {
    this.nextElementSibling!.textContent = Time.format(new Date(), this.value);
  },

  timeLocale() {
    Settings.time.call($('[name=time]', Settings.dialog));
  },

  backlink(this: HTMLInputElement) {
    this.nextElementSibling!.textContent = this.value.replace(/%(?:id|%)/g, x => ({'%id': '123456789', '%%': '%'} as Record<string, string>)[x]);
  },

  fileInfo(this: HTMLInputElement) {
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
    FileInfo.format(this.value, data as any, this.nextElementSibling as HTMLElement);
  },

  favicon(this: HTMLElement) {
    Favicon.switch();
    if ((g.VIEW === 'thread') && Conf['Unread Favicon']) { Unread.update(); }
    const img = this.nextElementSibling!.children;
    const f = Favicon;
    const iterable = [f.SFW, f.unreadSFW, f.unreadSFWY, f.NSFW, f.unreadNSFW, f.unreadNSFWY, f.dead, f.unreadDead, f.unreadDeadY];
    for (let i = 0; i < iterable.length; i++) {
      var icon = iterable[i];
      if (!img[i]) { $.add(this.nextElementSibling!, $.el('img')); }
      (img[i] as HTMLImageElement).src = icon;
    }
  },

  togglecss(this: HTMLInputElement) {
    const details = $.x('ancestor::details[1]', this) as HTMLElement | null;
    const textarea = details ? ($('.custom-css-textarea', details) as HTMLTextAreaElement | null) : null;
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

  keybinds(section: HTMLElement) {
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
      var arr = Config.hotkeys[key as keyof typeof Config.hotkeys];
      var marker = Settings.isClickKeybind(key)
        ? '<span class="keybind-click-marker" title="Click modifier: hold the keys and click.">*</span>'
        : '';
      var tr = $.el('tr',
        { innerHTML: `<td class="setting-title">${marker}${arr[1]}</td><td><input class="field"></td>` });
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

    $.get(items, function (items: Record<string, any>) {
      for (key in items) {
        var val = items[key];
        inputs[key].value = val;
      }
    });
    $.on($('#reset-keys', details), 'click', Settings.resetKeybinds);
  },

  keybind(this: HTMLInputElement, e: KeyboardEvent) {
    if (e.keyCode === 9) return; // tab
    e.preventDefault();
    e.stopPropagation();
    const key = Keybinds.keyCode(e);
    if (Settings.isClickKeybind(this.name)) {
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
