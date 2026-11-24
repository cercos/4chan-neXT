
export const RECORD_VERSION = 1;

export type AnswerSource = 'manual' | 'local' | 'local-edited';
export type Outcome = 'correct';

export interface TrainingTask {
  str?: string;
  img?: string;
  items: string[];
}

export interface TrainingRecord {
  v: number;
  id: string;
  board: string;
  loadedAt: number;
  postedAt: number;
  outcome: Outcome;
  response: string;
  source: AnswerSource;
  localAnswer: string | null;
  localConfidence: number | null;
  tasks: TrainingTask[];
}

export interface PendingChallenge {
  challenge: any; // loose: raw TCaptcha `twister` JSON
  board: string;
  loadedAt: number;
  localAnswer?: string;
  localConfidence?: number;
}

export function answerSource(solverAnswer: string | undefined | null, response: string): AnswerSource {
  if (solverAnswer == null) { return 'manual'; }
  return solverAnswer === response ? 'local' : 'local-edited';
}

export function pickTasks(rawTasks: any[]): TrainingTask[] { // loose: vendor task objects
  return (rawTasks || []).map(t => {
    const task: TrainingTask = { items: Array.isArray(t?.items) ? t.items.filter((i: unknown) => typeof i === 'string') : [] };
    if (typeof t?.str === 'string') { task.str = t.str; }
    if (typeof t?.img === 'string') { task.img = t.img; }
    return task;
  });
}

export function buildTrainingRecord(pending: PendingChallenge, response: string, postedAt: number): TrainingRecord | null {
  const tasks = pickTasks(pending.challenge?.tasks);
  const id = pending.challenge?.challenge;
  if (typeof id !== 'string' || !id || !tasks.length) { return null; }
  if (response.length !== tasks.length) { return null; }
  for (let i = 0; i < tasks.length; i++) {
    const n = Number(response[i]);
    if (!/^[0-9]$/.test(response[i]) || n >= tasks[i].items.length) { return null; }
  }
  return {
    v: RECORD_VERSION,
    id,
    board: pending.board,
    loadedAt: pending.loadedAt,
    postedAt,
    outcome: 'correct',
    response,
    source: answerSource(pending.localAnswer, response),
    localAnswer: pending.localAnswer ?? null,
    localConfidence: pending.localConfidence ?? null,
    tasks,
  };
}
