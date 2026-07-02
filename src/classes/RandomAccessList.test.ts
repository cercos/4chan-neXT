import { describe, expect, it } from 'vitest';
import RandomAccessList from './RandomAccessList';

const items = (ids: number[]) => ids.map(ID => ({ ID }));
const orderIDs = (list: RandomAccessList) => list.order().map(item => item.ID);

describe('RandomAccessList', () => {
  it('pushes items and links them in order', () => {
    const list = new RandomAccessList(items([1, 2, 3]));
    expect(list.length).toBe(3);
    expect(list.first.ID).toBe(1);
    expect(list.last.ID).toBe(3);
    expect(orderIDs(list)).toEqual([1, 2, 3]);
  });

  it('provides random access by ID', () => {
    const list = new RandomAccessList(items([10, 20]));
    expect(list[10].data).toEqual({ ID: 10 });
    expect(list[20].prev).toBe(list[10]);
  });

  it('ignores a push with a duplicate ID', () => {
    const list = new RandomAccessList(items([1]));
    list.push({ ID: 1, other: true });
    expect(list.length).toBe(1);
    expect(list[1].data).toEqual({ ID: 1 });
  });

  it('falls back to data.id when data.ID is missing', () => {
    const list = new RandomAccessList();
    list.push({ id: 7 });
    expect(list[7].data).toEqual({ id: 7 });
  });

  it('removes items and relinks neighbors', () => {
    const list = new RandomAccessList(items([1, 2, 3]));
    list.rm(2);
    expect(list.length).toBe(2);
    expect(list[2]).toBeUndefined();
    expect(orderIDs(list)).toEqual([1, 3]);
    expect(list[1].next).toBe(list[3]);
  });

  it('removes the first item with shift', () => {
    const list = new RandomAccessList(items([1, 2]));
    list.shift();
    expect(list.first.ID).toBe(2);
    expect(list.length).toBe(1);
  });

  it('moves an item before another with before()', () => {
    const list = new RandomAccessList(items([1, 2, 3]));
    list.before(list[1], list[3]);
    expect(orderIDs(list)).toEqual([3, 1, 2]);
    expect(list.first.ID).toBe(3);
    expect(list.last.ID).toBe(2);
  });

  it('moves an item after another with after()', () => {
    const list = new RandomAccessList(items([1, 2, 3]));
    list.after(list[3], list[1]);
    expect(orderIDs(list)).toEqual([2, 3, 1]);
    expect(list.first.ID).toBe(2);
    expect(list.last.ID).toBe(1);
  });

  it('moves an item to the front with prepend()', () => {
    const list = new RandomAccessList(items([1, 2, 3]));
    list.prepend(list[2]);
    expect(orderIDs(list)).toEqual([2, 1, 3]);
  });

  it('ignores prepend of an item that is not in the list', () => {
    const list = new RandomAccessList(items([1]));
    list.prepend({ ID: 99, prev: null, next: null, data: {} });
    expect(orderIDs(list)).toEqual([1]);
  });
});
