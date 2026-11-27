import { describe, expect, it } from 'vitest';
import { modelLabel, parseModelInfo } from './CaptchaBrowserSolverLogic';

describe('model info', () => {
  it('reads a numeric version with a display label', () => {
    const info = parseModelInfo({ version: 1.2001, label: '1.2.1', format: 1, sizeMB: 6.3 })!;
    expect(info.version).toBe(1.2001);
    expect(modelLabel(info)).toBe('1.2.1');
  });
  it('falls back to the number when there is no label', () => {
    expect(modelLabel(parseModelInfo({ version: 1.1, format: 1 })!)).toBe('1.1');
  });
  it('ignores a bad label and rejects a non-numeric version', () => {
    expect(modelLabel(parseModelInfo({ version: 1.2, label: '<b>x</b>', format: 1 })!)).toBe('1.2');
    expect(parseModelInfo({ version: '1.2.1', format: 1 })).toBeNull();
  });
  it('orders third-digit bumps between minor versions', () => {
    expect(1.2001 > 1.1 && 1.2002 > 1.2001 && 1.3 > 1.2002 && 1.2010 > 1.2009).toBe(true);
  });
});
