export interface TaskLike { items?: unknown[] }

export function parseAnswer(answer: string, tasks: TaskLike[]): (number | null)[] {
  return tasks.map((task, i) => {
    const ch = answer[i];
    if (ch == null || !/^[0-9]$/.test(ch)) { return null; }
    const n = +ch;
    const count = task?.items?.length ?? 0;
    return n < count ? n : null;
  });
}
