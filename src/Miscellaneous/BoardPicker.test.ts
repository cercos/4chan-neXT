import { describe, expect, it } from 'vitest';
import {
  defaultTab,
  filterBoards,
  parseFavoriteBoards,
  seedFavoritesFromBoardnav,
  serializeFavoriteBoards,
  toggleFavorite,
} from './BoardPickerLogic';

describe('parseFavoriteBoards', () => {
  it('parses a space-separated list into sorted unique codes', () => {
    expect(parseFavoriteBoards('v g a g')).toEqual(['a', 'g', 'v']);
  });

  it('accepts commas and mixed whitespace', () => {
    expect(parseFavoriteBoards('g,  v\n a')).toEqual(['a', 'g', 'v']);
  });

  it('lowercases codes', () => {
    expect(parseFavoriteBoards('G V')).toEqual(['g', 'v']);
  });

  it('drops tokens that are not plain board codes', () => {
    expect(parseFavoriteBoards('g /v/ @site foo-catalog')).toEqual(['g']);
  });

  it('returns empty for empty or missing input', () => {
    expect(parseFavoriteBoards('')).toEqual([]);
    expect(parseFavoriteBoards(undefined as unknown as string)).toEqual([]);
  });
});

describe('serializeFavoriteBoards', () => {
  it('joins sorted unique codes with spaces', () => {
    expect(serializeFavoriteBoards(['v', 'g', 'g', 'a'])).toBe('a g v');
  });

  it('round-trips through parseFavoriteBoards', () => {
    expect(parseFavoriteBoards(serializeFavoriteBoards(['mu', '3', 's4s']))).toEqual(['3', 'mu', 's4s']);
  });
});

describe('toggleFavorite', () => {
  it('adds a missing code, keeping sort order', () => {
    expect(toggleFavorite(['a', 'v'], 'g')).toEqual(['a', 'g', 'v']);
  });

  it('removes a present code', () => {
    expect(toggleFavorite(['a', 'g', 'v'], 'g')).toEqual(['a', 'v']);
  });

  it('does not mutate the input array', () => {
    const favorites = ['a', 'v'];
    toggleFavorite(favorites, 'g');
    expect(favorites).toEqual(['a', 'v']);
  });
});

describe('seedFavoritesFromBoardnav', () => {
  it('extracts plain board codes', () => {
    expect(seedFavoritesFromBoardnav('g v a mu')).toEqual(['a', 'g', 'mu', 'v']);
  });

  it('strips modifier suffixes from board tokens', () => {
    expect(seedFavoritesFromBoardnav('g-catalog v-full a-index')).toEqual(['a', 'g', 'v']);
  });

  it('ignores nav keywords and external/toggle/current tokens', () => {
    const defaultNav = `[ toggle-all ]
[current-index-text:"Index"
current-catalog-text:"Catalog"
current-expired-text:"Expired"
current-archive-text:"Archive"]
[external-text:"FAQ","https://example.com"]`;
    expect(seedFavoritesFromBoardnav(defaultNav)).toEqual([]);
  });

  it('keeps boards found inside nav group syntax', () => {
    expect(seedFavoritesFromBoardnav('catalog{a b c}')).toEqual(['a', 'b', 'c']);
  });

  it('ignores quoted text/mode/sort arguments', () => {
    expect(seedFavoritesFromBoardnav('g-text:"tech stuff" v-sort:"reply count"')).toEqual(['g', 'v']);
  });

  it('handles wrapped spans and brackets', () => {
    expect(seedFavoritesFromBoardnav('{{"my-span" g v }} [ a / mu ]')).toEqual(['a', 'g', 'mu', 'v']);
  });

  it('returns empty for empty input', () => {
    expect(seedFavoritesFromBoardnav('')).toEqual([]);
  });
});

describe('filterBoards', () => {
  const boards = [
    { code: 'g', title: 'Technology' },
    { code: 'gd', title: 'Graphic Design' },
    { code: 'wsg', title: 'Worksafe GIF' },
    { code: 'v', title: 'Video Games' },
    { code: 'qst', title: 'Quests' },
  ];

  it('returns all boards for an empty or whitespace query', () => {
    expect(filterBoards(boards, '')).toEqual(boards);
    expect(filterBoards(boards, '   ')).toEqual(boards);
  });

  it('matches board codes case-insensitively', () => {
    expect(filterBoards(boards, 'QST')).toEqual([{ code: 'qst', title: 'Quests' }]);
  });

  it('matches titles by substring case-insensitively', () => {
    expect(filterBoards(boards, 'tech')).toEqual([{ code: 'g', title: 'Technology' }]);
  });

  it('returns empty when nothing matches', () => {
    expect(filterBoards(boards, 'zzz')).toEqual([]);
  });

  it('matches codes by prefix only for slash queries, ignoring titles', () => {
    expect(filterBoards(boards, '/g')).toEqual([
      { code: 'g', title: 'Technology' },
      { code: 'gd', title: 'Graphic Design' },
    ]);
  });

  it('matches the exact board for a closed slash query', () => {
    expect(filterBoards(boards, '/g/')).toEqual([{ code: 'g', title: 'Technology' }]);
  });

  it('treats slash queries case-insensitively', () => {
    expect(filterBoards(boards, '/WSG')).toEqual([{ code: 'wsg', title: 'Worksafe GIF' }]);
  });

  it('returns all boards for a lone slash', () => {
    expect(filterBoards(boards, '/')).toEqual(boards);
  });

  it('still matches codes and titles by substring for plain queries', () => {
    expect(filterBoards(boards, 'g')).toEqual([
      { code: 'g', title: 'Technology' },
      { code: 'gd', title: 'Graphic Design' },
      { code: 'wsg', title: 'Worksafe GIF' },
      { code: 'v', title: 'Video Games' },
    ]);
  });
});

describe('defaultTab', () => {
  it('opens Favorites when any favorites exist', () => {
    expect(defaultTab(1)).toBe('favorites');
    expect(defaultTab(5)).toBe('favorites');
  });

  it('opens All boards when there are none', () => {
    expect(defaultTab(0)).toBe('all');
  });
});
