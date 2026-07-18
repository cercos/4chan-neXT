export type TapAction = 'none' | 'popup';

export function countBacklinks(classNames: string[]): number {
  let count = 0;
  for (const className of classNames) {
    if (className.split(/\s+/).includes('backlink')) { count++; }
  }
  return count;
}

export function tapAction(count: number): TapAction {
  return count <= 0 ? 'none' : 'popup';
}

export function chipLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function canDrill(openFullIDs: string[], fullID: string): boolean {
  return !openFullIDs.includes(fullID);
}

export type BackAction = 'pop' | 'close';

export function backAction(depth: number): BackAction {
  return depth > 1 ? 'pop' : 'close';
}

export function rootTitle(count: number): string {
  return `${count} ${count === 1 ? 'reply' : 'replies'}`;
}
