import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY, debounce, dict, HOUR, MINUTE, SECOND } from './helpers';

describe('dict', () => {
  it('creates objects with no prototype', () => {
    const map = dict();
    expect(Object.getPrototypeOf(map)).toBeNull();
    expect('toString' in map).toBe(false);
  });

  it('clone returns primitives as-is', () => {
    expect(dict.clone(5)).toBe(5);
    expect(dict.clone('x')).toBe('x');
    expect(dict.clone(null)).toBeNull();
  });

  it('clone deep-copies nested objects and arrays', () => {
    const source = { a: [1, { b: 2 }], c: { d: [3] } };
    const copy = dict.clone(source);
    expect(copy).toEqual(source);
    copy.a[1].b = 99;
    copy.c.d.push(4);
    expect(source.a[1]).toEqual({ b: 2 });
    expect(source.c.d).toEqual([3]);
    expect(Object.getPrototypeOf(copy)).toBeNull();
  });

  it('json parses into prototype-less objects', () => {
    const parsed = dict.json('{"a": {"b": 1}}');
    expect(parsed.a.b).toBe(1);
    expect(Object.getPrototypeOf(parsed)).toBeNull();
  });
});

describe('time constants', () => {
  it('build on each other', () => {
    expect(SECOND).toBe(1000);
    expect(MINUTE).toBe(60 * SECOND);
    expect(HOUR).toBe(60 * MINUTE);
    expect(DAY).toBe(24 * HOUR);
  });
});

// debounce's return type is declared without parameters (it forwards `arguments`
// at runtime), so widen it for the tests.
const debounceLoose = debounce as (wait: number, fn: (...args: unknown[]) => unknown, leading?: boolean) => (...args: unknown[]) => void;

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs immediately on the leading edge', () => {
    const fn = vi.fn();
    const debounced = debounceLoose(100, fn);
    debounced('first');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('first');
  });

  it('coalesces calls within the wait window to the last arguments', () => {
    const fn = vi.fn();
    const debounced = debounceLoose(100, fn);
    debounced('first');
    debounced('second');
    debounced('third');
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('third');
  });

  it('waits for the timeout when leading is false', () => {
    const fn = vi.fn();
    const debounced = debounceLoose(100, fn, false);
    debounced('only');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('only');
  });

  it('runs immediately again once the wait has passed since the last call', () => {
    const fn = vi.fn();
    const debounced = debounceLoose(100, fn);
    debounced('first');
    vi.advanceTimersByTime(150);
    debounced('second');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('second');
  });
});
