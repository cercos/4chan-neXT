import { describe, expect, it } from 'vitest';
import { parseAnswer } from './CaptchaSolverLogic';

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
