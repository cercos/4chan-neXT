import { describe, expect, it } from 'vitest';
import { stepHorizontal, stepVertical, type TilePos } from './CaptchaKeyNav';

const grid = (rows: number[], width = 50, height = 50): TilePos[] => {
  const positions: TilePos[] = [];
  rows.forEach((count, row) => {
    for (let col = 0; col < count; col++) {
      positions.push({ top: row * height, left: col * width });
    }
  });
  return positions;
};

describe('stepHorizontal', () => {
  it('highlights the first tile when nothing is highlighted yet', () => {
    expect(stepHorizontal(-1, 1, 6)).toBe(0);
    expect(stepHorizontal(-1, -1, 6)).toBe(0);
  });

  it('moves one tile left or right', () => {
    expect(stepHorizontal(2, 1, 6)).toBe(3);
    expect(stepHorizontal(2, -1, 6)).toBe(1);
  });

  it('wraps around at both ends', () => {
    expect(stepHorizontal(5, 1, 6)).toBe(0);
    expect(stepHorizontal(0, -1, 6)).toBe(5);
  });

  it('returns -1 when there are no tiles', () => {
    expect(stepHorizontal(-1, 1, 0)).toBe(-1);
    expect(stepHorizontal(3, -1, 0)).toBe(-1);
  });
});

describe('stepVertical', () => {
  it('highlights the first tile when nothing is highlighted yet', () => {
    expect(stepVertical(grid([3, 3]), -1, 1)).toBe(0);
    expect(stepVertical(grid([3, 3]), -1, -1)).toBe(0);
  });

  it('moves to the same column in the adjacent row', () => {
    const positions = grid([3, 3]);
    expect(stepVertical(positions, 1, 1)).toBe(4);
    expect(stepVertical(positions, 4, -1)).toBe(1);
  });

  it('clamps at the top and bottom rows', () => {
    const positions = grid([3, 3]);
    expect(stepVertical(positions, 1, -1)).toBe(1);
    expect(stepVertical(positions, 4, 1)).toBe(4);
  });

  it('lands on the nearest column when the target row is shorter', () => {
    const positions = grid([3, 2]);
    expect(stepVertical(positions, 2, 1)).toBe(4);
  });

  it('returns to the original column from a shorter row when distances tie toward earlier tiles', () => {
    const positions = grid([3, 1]);
    expect(stepVertical(positions, 3, -1)).toBe(0);
  });

  it('returns -1 when there are no tiles', () => {
    expect(stepVertical([], -1, 1)).toBe(-1);
    expect(stepVertical([], 2, -1)).toBe(-1);
  });

  it('treats near-equal tops as the same row', () => {
    const positions: TilePos[] = [
      { top: 0, left: 0 }, { top: 0.5, left: 50 },
      { top: 60, left: 0 }, { top: 60.4, left: 50 },
    ];
    expect(stepVertical(positions, 1, 1)).toBe(3);
  });
});
