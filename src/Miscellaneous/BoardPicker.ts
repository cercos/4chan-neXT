import BoardConfig from '../General/BoardConfig';
import CatalogLinks from './CatalogLinks';
import { Conf, d, doc, g } from '../globals/globals';
import $ from '../platform/$';
import {
  defaultTab,
  filterBoards,
  parseFavoriteBoards,
  seedFavoritesFromBoardnav,
  serializeFavoriteBoards,
  toggleFavorite,
} from './BoardPickerLogic';
import type { BoardEntry } from './BoardPickerLogic';

type PickerTab = 'favorites' | 'all';

const BoardPicker = {
  trigger: undefined as HTMLAnchorElement | undefined,
  panel: undefined as HTMLElement | undefined,
  list: undefined as HTMLElement | undefined,
  search: undefined as HTMLInputElement | undefined,
  tabButtons: {} as Record<PickerTab, HTMLAnchorElement>,
  tab: 'all' as PickerTab,
  query: '',

  init() {
    const trigger = $.el('a', {
      href: 'javascript:;',
      className: 'boardpicker-toggle',
      textContent: g.BOARD ? `/${g.BOARD.ID}/ ▾` : 'Boards ▾',
    }) as HTMLAnchorElement;
    BoardPicker.trigger = trigger;
    $.on(trigger, 'click', BoardPicker.toggle);

    const panel = (BoardPicker.panel = $.el('div', { id: 'boardpicker' }));
    const tabs = $.el('div', { className: 'boardpicker-tabs' });
    const labels: Array<[PickerTab, string]> = [['favorites', 'Favorites'], ['all', 'All boards']];
    for (const [key, label] of labels) {
      const btn = $.el('a', {
        href: 'javascript:;',
        className: 'boardpicker-tab',
        textContent: label,
      }) as HTMLAnchorElement;
      $.on(btn, 'click', () => BoardPicker.setTab(key));
      BoardPicker.tabButtons[key] = btn;
      $.add(tabs, btn);
    }

    const search = (BoardPicker.search = $.el('input', {
      className: 'boardpicker-search',
      type: 'search',
      placeholder: 'Search boards',
    }) as HTMLInputElement);
    $.on(search, 'input', () => {
      BoardPicker.query = search.value;
      BoardPicker.renderList();
    });

    BoardPicker.list = $.el('div', { className: 'boardpicker-list' });
    $.add(panel, [tabs, search, BoardPicker.list]);

    $.on(d, 'click', BoardPicker.clickAway);
    $.sync('favoriteBoards', (val: string) => {
      Conf['favoriteBoards'] = val;
      if (BoardPicker.isOpen()) { BoardPicker.render(); }
    });
    BoardConfig.ready(() => {
      if (BoardPicker.isOpen()) { BoardPicker.render(); }
    });
  },

  isOpen() {
    return $.hasClass(doc, 'xt-boardpicker-open');
  },

  toggle() {
    if (BoardPicker.isOpen()) {
      BoardPicker.close();
    } else {
      BoardPicker.open();
    }
  },

  open() {
    BoardPicker.seedIfNeeded();
    BoardPicker.tab = defaultTab(BoardPicker.favorites().length);
    BoardPicker.query = '';
    BoardPicker.search!.value = '';
    BoardPicker.render();
    $.addClass(doc, 'xt-boardpicker-open');
  },

  close() {
    $.rmClass(doc, 'xt-boardpicker-open');
  },

  clickAway(e: Event) {
    if (!BoardPicker.isOpen()) { return; }
    const target = e.target as HTMLElement;
    if (!target.isConnected) { return; }
    if (target.closest('.boardpicker-link') || !target.closest('#boardpicker, #shortcut-boards')) {
      BoardPicker.close();
    }
  },

  favorites(): string[] {
    return parseFavoriteBoards(Conf['favoriteBoards']);
  },

  saveFavorites(codes: string[]) {
    const value = serializeFavoriteBoards(codes);
    Conf['favoriteBoards'] = value;
    $.set('favoriteBoards', value);
  },

  seedIfNeeded() {
    if (Conf['favoriteBoardsSeeded']) { return; }
    const known = BoardPicker.allBoards();
    const current = BoardPicker.favorites();
    const seeds = current.length ? current : seedFavoritesFromBoardnav(Conf['boardnav']);
    const codes = known.length
      ? seeds.filter(code => known.some(b => b.code === code))
      : seeds;
    BoardPicker.saveFavorites(codes);
    if (known.length) {
      Conf['favoriteBoardsSeeded'] = true;
      $.set('favoriteBoardsSeeded', true);
    }
  },

  allBoards(): BoardEntry[] {
    const boards = (BoardConfig as { boards?: Record<string, { title?: string }> }).boards
      || Conf['boardConfig'].boards || {};
    return Object.keys(boards).sort().map(code => ({ code, title: boards[code].title || '' }));
  },

  setTab(tab: PickerTab) {
    BoardPicker.tab = tab;
    BoardPicker.render();
  },

  render() {
    for (const key of ['favorites', 'all'] as PickerTab[]) {
      BoardPicker.tabButtons[key].classList.toggle('active', BoardPicker.tab === key);
    }
    BoardPicker.search!.hidden = BoardPicker.tab !== 'all';
    BoardPicker.renderList();
  },

  renderList() {
    const list = BoardPicker.list!;
    $.rmAll(list);
    const all = BoardPicker.allBoards();
    const favorites = BoardPicker.favorites();
    let entries: BoardEntry[];
    if (BoardPicker.tab === 'favorites') {
      entries = favorites.map(code => all.find(b => b.code === code) || { code, title: '' });
      if (!entries.length) {
        $.add(list, $.el('div', {
          className: 'boardpicker-empty',
          textContent: 'No favorites yet. Star boards in All boards.',
        }));
        return;
      }
    } else {
      entries = filterBoards(all, BoardPicker.query);
    }
    const frag = $.frag();
    for (const entry of entries) {
      $.add(frag, BoardPicker.buildRow(entry, favorites.includes(entry.code)));
    }
    $.add(list, frag);
    CatalogLinks.setLinks(list);
  },

  buildRow(entry: BoardEntry, isFavorite: boolean): HTMLElement {
    const row = $.el('div', { className: 'boardpicker-row' });
    if (entry.code === g.BOARD?.ID) { $.addClass(row, 'current'); }
    const star = $.el('a', {
      href: 'javascript:;',
      className: `boardpicker-star${isFavorite ? ' favorited' : ''}`,
      textContent: isFavorite ? '★' : '☆',
    });
    $.on(star, 'click', (e: Event) => {
      e.stopPropagation();
      BoardPicker.saveFavorites(toggleFavorite(BoardPicker.favorites(), entry.code));
      BoardPicker.renderList();
    });
    const link = $.el('a', {
      className: 'boardpicker-link',
      href: `${location.protocol}//${BoardConfig.domain(entry.code)}/${entry.code}/`,
      textContent: entry.title ? `/${entry.code}/ - ${entry.title}` : `/${entry.code}/`,
    });
    $.add(row, [star, link]);
    return row;
  },
};

export default BoardPicker;
