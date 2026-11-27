export function pngSize(b64: string): { w: number; h: number } | null {
  try {
    const head = atob(b64.slice(0, 44));
    if (head.slice(1, 4) !== 'PNG' || head.length < 24) { return null; }
    const u32 = (o: number) => ((head.charCodeAt(o) << 24) | (head.charCodeAt(o + 1) << 16) |
      (head.charCodeAt(o + 2) << 8) | head.charCodeAt(o + 3)) >>> 0;
    return { w: u32(16), h: u32(20) };
  } catch {
    return null;
  }
}

export function isStripTask(items: unknown): boolean {
  const first = Array.isArray(items) ? items[0] : null;
  if (typeof first !== 'string') { return false; }
  const size = pngSize(first);
  return !!size && size.w >= 2 * size.h;
}
