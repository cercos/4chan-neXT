export type CaptchaStyle = 'stack' | 'classic' | 'inline' | 'dots';

export const CAPTCHA_STYLE_VALUES: readonly CaptchaStyle[] = ['stack', 'classic', 'inline', 'dots'];

export const DEFAULT_CAPTCHA_STYLE: CaptchaStyle = 'stack';

export function normalizeCaptchaStyle(value: unknown): CaptchaStyle {
  return CAPTCHA_STYLE_VALUES.includes(value as CaptchaStyle) ? value as CaptchaStyle : DEFAULT_CAPTCHA_STYLE;
}

export function applyCaptchaStyleClass(root: Element, style: CaptchaStyle | null): void {
  for (const name of CAPTCHA_STYLE_VALUES) {
    root.classList.toggle(`fourchanx-captcha-style-${name}`, style === name);
  }
}

const NARRATION = {
  complete: 'Done.',
  review: 'Click an image to edit, or post.',
} as const;

export function captchaNarration(style: CaptchaStyle, kind: keyof typeof NARRATION): string {
  if (style === 'classic') { return NARRATION[kind]; }
  if (style === 'stack' && kind === 'review') { return 'Click an answer to change it, or post.'; }
  return '';
}

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
