import CrossOrigin from "../platform/CrossOrigin";
import { parseAnswer, parseServerConfidence, parseTaskConfidence } from "./CaptchaSolverLogic";
import type { SolveResult } from "./CaptchaBrowserSolver";

export const CLOUD_SOLVER_URL = 'https://solve.4chan-next.com/solve';
const TIMEOUT_MS = 20000;

export async function cloudSolveTasks(challenge: {tasks?: any[]}): Promise<SolveResult> { // loose: vendor TCaptcha task objects
  const tasks = challenge?.tasks;
  if (!tasks?.length) { throw new Error('No captcha tasks to solve'); }
  const req = await CrossOrigin.ajaxPromise(CLOUD_SOLVER_URL, {
    method: 'POST',
    body: JSON.stringify({ challenge }),
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    responseType: 'text',
    timeout: TIMEOUT_MS,
  });
  if (req.status === 429) { throw new Error('Cloud solver is busy for you right now, try again in a minute'); }
  if (req.status === 503) { throw new Error('Cloud solver is offline right now'); }
  if (req.status !== 200) { throw new Error(`Cloud solver unavailable (${req.status ? `HTTP ${req.status}` : 'no connection'})`); }
  const answer = String(req.response ?? '');
  if (!/^[0-9 ]{1,12}$/.test(answer)) { throw new Error('Unexpected cloud solver response'); }
  return {
    answer,
    choices: parseAnswer(answer, tasks),
    confidence: parseServerConfidence(req.getResponseHeader('X-Solver-Confidence')),
    taskConfidence: parseTaskConfidence(req.getResponseHeader('X-Solver-Task-Confidence'), tasks.length),
  };
}
