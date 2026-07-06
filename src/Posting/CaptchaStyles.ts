export type CaptchaStyle = 'classic' | 'inline' | 'dots';

export const CAPTCHA_STYLE_VALUES: readonly CaptchaStyle[] = ['classic', 'inline', 'dots'];

export function normalizeCaptchaStyle(value: unknown): CaptchaStyle {
  return CAPTCHA_STYLE_VALUES.includes(value as CaptchaStyle) ? value as CaptchaStyle : 'inline';
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
  return style === 'classic' ? NARRATION[kind] : '';
}
