export const QR_OVERFLOW_ACTION_IDS: string[] = [
  'qr-oekaki-button',
  'qr-dogiri-button',
  'qr-jpg',
  'qr-view',
  'qr-randomize',
  'qr-restore-name',
  'url-button',
  'custom-cooldown-button',
  'split-post',
  'dump-button',
];

export function actionLabel(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function keyboardInset(innerHeight: number, viewportHeight: number, offsetTop: number): number {
  return Math.max(0, Math.round(innerHeight - viewportHeight - offsetTop));
}

export function shouldCloseAfterPost(mobile: boolean, dumpMode: boolean, postsRemaining: number): boolean {
  return mobile && dumpMode && postsRemaining === 0;
}

export function shouldAutoExpand(trigger: string, expanded: boolean): boolean {
  if (expanded) { return false; }
  return trigger === 'dump-on';
}
