import { describe, expect, it } from 'vitest';
import { advanceSure, parseAnswer, parseServerConfidence, parseTaskConfidence } from './CaptchaSolverLogic';

const task = (n: number) => ({ items: Array(n).fill('x') });

describe('parseAnswer', () => {
  it('maps one digit per task to a tile index', () => {
    expect(parseAnswer('203', [task(4), task(4), task(4)])).toEqual([2, 0, 3]);
  });

  it('treats spaces and non-digits as unanswered', () => {
    expect(parseAnswer('1 x', [task(4), task(4), task(4)])).toEqual([1, null, null]);
  });

  it('rejects indexes beyond the task tile count', () => {
    expect(parseAnswer('15', [task(4), task(4)])).toEqual([1, null]);
  });

  it('pads short answers with nulls and ignores extra characters', () => {
    expect(parseAnswer('1', [task(3), task(3)])).toEqual([1, null]);
    expect(parseAnswer('1222', [task(3)])).toEqual([1]);
  });

  it('handles tasks with no items', () => {
    expect(parseAnswer('0', [{}])).toEqual([null]);
  });
});

describe('server confidence headers', () => {
  it('reads overall confidence and clamps it', () => {
    expect(parseServerConfidence('0.9731')).toBe(0.9731);
    expect(parseServerConfidence('7')).toBe(1);
    expect(parseServerConfidence(null)).toBe(0);
  });

  it('reads one confidence per task, else gives up', () => {
    expect(parseTaskConfidence('1.000,0.612', 2)).toEqual([1, 0.612]);
    expect(parseTaskConfidence('1.000', 2)).toBeNull();
    expect(parseTaskConfidence('1.000,x', 2)).toBeNull();
    expect(parseTaskConfidence('', 2)).toBeNull();
  });
});

describe('advanceSure', () => {
  const picks = [2, null, 1, 0];

  it('fills sure steps from the start and stops at the first unsure one', () => {
    expect(advanceSure(picks, 0, '')).toEqual({ response: '2', taskId: 1 });
  });

  it('after the user answers the unsure step, fills the rest', () => {
    expect(advanceSure(picks, 2, '23')).toEqual({ response: '2310', taskId: 4 });
  });

  it('stays put on an unsure step', () => {
    expect(advanceSure(picks, 1, '2')).toEqual({ response: '2', taskId: 1 });
  });

  it('gives up if the answer so far does not line up with the step', () => {
    expect(advanceSure(picks, 2, '2')).toBeNull();
  });
});
