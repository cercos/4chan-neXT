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

export function parseServerConfidence(value: string | null | undefined): number {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export function parseTaskConfidence(value: string | null | undefined, taskCount: number): number[] | null {
  if (!value) { return null; }
  const parts = value.split(',').map(v => parseFloat(v));
  if (parts.length !== taskCount || parts.some(n => !Number.isFinite(n) || n < 0 || n > 1)) { return null; }
  return parts;
}

export function advanceSure(picks: (number | null)[], taskId: number, response: string): {response: string, taskId: number} | null {
  if (response.length !== taskId) { return null; }
  let i = taskId;
  while (i < picks.length && picks[i] != null) { response += picks[i]; i++; }
  return { response, taskId: i };
}
