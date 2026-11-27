import type { SolveResult } from "./CaptchaBrowserSolver";

export interface ExtraSolver {
  id: string;
  label: string;
  logAs?: string;
  solve(challenge: {tasks?: any[]}): Promise<SolveResult>; // loose: vendor TCaptcha task objects
}

export const extraSolver: ExtraSolver | null = null;
