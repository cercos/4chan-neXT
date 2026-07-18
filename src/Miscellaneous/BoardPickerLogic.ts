export type BoardEntry = { code: string; title: string };

const NAV_KEYWORDS = new Set([
  'toggle', 'external', 'current', 'all', 'title', 'replace', 'full', 'index',
  'catalog', 'archive', 'expired', 'nt', 'mode', 'sort', 'text',
]);

export function parseFavoriteBoards(value: string): string[] {
  if (!value) { return []; }
  const seen = new Set<string>();
  for (const token of value.split(/[\s,]+/)) {
    const code = token.toLowerCase();
    if (/^[a-z0-9]+$/.test(code)) { seen.add(code); }
  }
  return [...seen].sort();
}

export function serializeFavoriteBoards(codes: string[]): string {
  return [...new Set(codes)].sort().join(' ');
}

export function toggleFavorite(favorites: string[], code: string): string[] {
  return favorites.includes(code)
    ? favorites.filter(c => c !== code)
    : [...favorites, code].sort();
}

export function seedFavoritesFromBoardnav(boardnav: string): string[] {
  if (!boardnav) { return []; }
  const cleaned = boardnav
    .replace(/(\r\n|\n|\r)/g, ' ')
    .replace(/-?(?:text|mode|sort):"[^"]*"(?:,"[^"]*")?/g, ' ')
    .replace(/\{\{(?:"[^"]+")?|\}\}/g, ' ')
    .replace(/[{}[\]()|/\\]/g, ' ');
  const seen = new Set<string>();
  for (const token of cleaned.split(/\s+/)) {
    const base = token.split('-')[0].toLowerCase();
    if (!base || !/^[a-z0-9]+$/.test(base)) { continue; }
    if (NAV_KEYWORDS.has(base)) { continue; }
    seen.add(base);
  }
  return [...seen].sort();
}

export function filterBoards(boards: BoardEntry[], query: string): BoardEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) { return boards; }
  if (q.startsWith('/')) {
    const closed = q.length > 1 && q.endsWith('/');
    const code = q.replace(/^\/+|\/+$/g, '');
    if (!code) { return boards; }
    return boards.filter(b => closed
      ? b.code.toLowerCase() === code
      : b.code.toLowerCase().startsWith(code));
  }
  return boards.filter(b =>
    b.code.toLowerCase().includes(q) || b.title.toLowerCase().includes(q));
}

export function defaultTab(favoriteCount: number): 'favorites' | 'all' {
  return favoriteCount > 0 ? 'favorites' : 'all';
}
