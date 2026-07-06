export interface TilePos { top: number; left: number }

const ROW_TOLERANCE = 2;

export function stepHorizontal(current: number, delta: 1 | -1, length: number): number {
  if (length <= 0) { return -1; }
  if (current < 0 || current >= length) { return 0; }
  return (current + delta + length) % length;
}

export function stepVertical(positions: TilePos[], current: number, delta: 1 | -1): number {
  if (!positions.length) { return -1; }
  if (current < 0 || current >= positions.length) { return 0; }

  const rows: number[][] = [];
  let prevTop = -Infinity;
  positions.forEach((pos, index) => {
    if (Math.abs(pos.top - prevTop) > ROW_TOLERANCE) {
      rows.push([]);
      prevTop = pos.top;
    }
    rows[rows.length - 1].push(index);
  });

  const rowIndex = rows.findIndex(row => row.includes(current));
  const targetRow = rows[rowIndex + delta];
  if (!targetRow) { return current; }

  const currentLeft = positions[current].left;
  let best = targetRow[0];
  for (const index of targetRow) {
    if (Math.abs(positions[index].left - currentLeft) < Math.abs(positions[best].left - currentLeft)) {
      best = index;
    }
  }
  return best;
}
