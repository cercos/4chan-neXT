const PHONE_MAX_SCREEN = 600;

export function detectMobileDevice(win: Window = window): boolean {
  try {
    const coarse = win.matchMedia('(pointer: coarse)').matches;
    const touch = (win.navigator.maxTouchPoints ?? 0) > 0;
    const small = Math.min(win.screen.width, win.screen.height) <= PHONE_MAX_SCREEN;
    return coarse && touch && small;
  } catch (error) {
    return false;
  }
}

export function resolveMobileLayout(setting: string, detected: boolean): boolean {
  if (setting === 'on') { return true; }
  if (setting === 'off') { return false; }
  return detected;
}

export function applyMobileLayout(setting: string, root: Element, win: Window = window): boolean {
  const enabled = resolveMobileLayout(setting, detectMobileDevice(win));
  root.classList.toggle('xt-mobile', enabled);
  return enabled;
}

const BAR_LAYOUT_CLASSES: Record<string, string[]> = {
  'icons-bottom': ['xt-bar-split', 'xt-icons-bottom'],
  'icons-top': ['xt-bar-split', 'xt-icons-top'],
};

const LEGACY_BAR_LAYOUTS: Record<string, string> = {
  'combined-top': 'icons-bottom',
  'combined-bottom': 'icons-top',
  'split-icons-bottom': 'icons-bottom',
  'split-icons-top': 'icons-top',
};

const ALL_BAR_CLASSES = ['xt-bar-bottom', 'xt-bar-split', 'xt-icons-bottom', 'xt-icons-top'];

export function resolveBarLayout(setting: string): string {
  if (BAR_LAYOUT_CLASSES[setting]) { return setting; }
  return LEGACY_BAR_LAYOUTS[setting] || 'icons-bottom';
}

export function barLayoutClasses(setting: string): string[] {
  return BAR_LAYOUT_CLASSES[resolveBarLayout(setting)];
}

export function iconsInMobileBar(_setting: string): boolean {
  return true;
}

export function applyBarLayout(setting: string, root: Element, enabled = true): void {
  const active = enabled ? barLayoutClasses(setting) : [];
  for (const cls of ALL_BAR_CLASSES) {
    root.classList.toggle(cls, active.includes(cls));
  }
}
