import { describe, expect, it, vi } from 'vitest';

// SimpleDict only uses $.getOwn, but importing the real $ singleton drags in the
// whole app through the Notice/Header/Callbacks/Main import cycle. Stub it.
vi.mock('../platform/$', () => ({
  default: {
    getOwn: (obj: Record<string, unknown>, key: string) =>
      Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined,
  },
}));

import SimpleDict from './SimpleDict';

describe('SimpleDict', () => {
  it('pushes values and tracks keys in push order', () => {
    const dict = new SimpleDict<string>();
    dict.push(123, 'a');
    dict.push('456', 'b');
    expect(dict.keys).toEqual(['123', '456']);
    expect(dict.get(123)).toBe('a');
    expect(dict.get('456')).toBe('b');
  });

  it('does not duplicate a key pushed twice, but updates the value', () => {
    const dict = new SimpleDict<string>();
    dict.push(1, 'a');
    dict.push(1, 'b');
    expect(dict.keys).toEqual(['1']);
    expect(dict.get(1)).toBe('b');
  });

  it('inserts numeric keys in sorted position', () => {
    const dict = new SimpleDict<string>();
    dict.push(10, 'a');
    dict.push(30, 'c');
    const index = dict.insert(20, 'b');
    expect(index).toBe(1);
    expect(dict.keys).toEqual(['10', '20', '30']);
  });

  it('appends on insert when the key is the largest', () => {
    const dict = new SimpleDict<string>();
    dict.push(10, 'a');
    expect(dict.insert(20, 'b')).toBe(1);
    expect(dict.keys).toEqual(['10', '20']);
  });

  it('replaces the value on insert of an existing key', () => {
    const dict = new SimpleDict<string>();
    dict.push(10, 'a');
    dict.push(20, 'b');
    expect(dict.insert(10, 'z')).toBe(0);
    expect(dict.keys).toEqual(['10', '20']);
    expect(dict.get(10)).toBe('z');
  });

  it('inserts into an empty dict', () => {
    const dict = new SimpleDict<string>();
    expect(dict.insert(5, 'a')).toBe(0);
    expect(dict.keys).toEqual(['5']);
  });

  it('removes keys with rm and ignores unknown keys', () => {
    const dict = new SimpleDict<string>();
    dict.push(1, 'a');
    dict.push(2, 'b');
    dict.rm(1);
    expect(dict.keys).toEqual(['2']);
    expect(dict.get(1)).toBeUndefined();
    dict.rm(99);
    expect(dict.keys).toEqual(['2']);
  });

  it('iterates values with forEach in key order', () => {
    const dict = new SimpleDict<string>();
    dict.push(1, 'a');
    dict.push(2, 'b');
    const seen: string[] = [];
    dict.forEach(v => seen.push(v));
    expect(seen).toEqual(['a', 'b']);
  });

  it('get() does not leak the keys array or inherited properties', () => {
    const dict = new SimpleDict<string>();
    dict.push(1, 'a');
    expect(dict.get('keys')).toBeUndefined();
    expect(dict.get('toString')).toBeUndefined();
  });

  it('lastKey returns the highest pushed key', () => {
    const dict = new SimpleDict<string>();
    dict.push(1, 'a');
    dict.push(2, 'b');
    expect(dict.lastKey()).toBe('2');
  });
});
