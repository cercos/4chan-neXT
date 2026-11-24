export const IMG_SIZE = 96;
export const STRIP_MIN_ASPECT = 2.0;
export const VOCAB = 1024;
export const MAX_TOKENS = 16;
export const MEAN = [0.485, 0.456, 0.406] as const;
export const STD = [0.229, 0.224, 0.225] as const;

export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(s)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function stripTags(html: string | undefined | null): string {
  return (html || '').replace(/<[^>]+>/g, ' ');
}

export function tokenize(text: string): number[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  const ids = words.slice(0, MAX_TOKENS).map(w => (fnv1a32(w) % VOCAB) + 1);
  while (ids.length < MAX_TOKENS) { ids.push(0); }
  return ids;
}

export function promptImageB64(task: { img?: unknown; str?: unknown }): string | null {
  if (typeof task.img === 'string' && task.img) { return task.img; }
  const m = typeof task.str === 'string'
    ? task.str.match(/<img[^>]*\bsrc\s*=\s*["']data:image\/[a-z]+;base64,([^"']+)["']/i)
    : null;
  return m ? m[1] : null;
}

export function inputSize(w: number, h: number): [number, number] {
  if (w >= STRIP_MIN_ASPECT * h) { return [Math.round(IMG_SIZE * w / h), IMG_SIZE]; }
  return [IMG_SIZE, IMG_SIZE];
}

export function softmax(logits: ArrayLike<number>): number[] {
  const arr = Array.from(logits);
  const max = Math.max(...arr);
  const exps = arr.map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / sum);
}

export function rgbaToChw(rgba: ArrayLike<number>, w: number, h: number): Float32Array {
  const out = new Float32Array(3 * w * h);
  const plane = w * h;
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * plane + i] = (rgba[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return out;
}
