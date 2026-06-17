import $ from "../platform/$";

export default class SimpleDict<T> {
  // loose: any — dynamic string-keyed storage; values are T but `keys` is string[], so a precise union isn't expressible here.
  [key: string]: any;

  keys: string[]

  constructor() {
    this.keys = [];
  }

  push(key: any, data: T) { // loose: any — key is coerced via `${key}`; callers pass strings, numbers, and `this`-typed values.
    key = `${key}`;
    if (!this[key]) { this.keys.push(key); }
    this[key] = data;
  }

  /**
   * Inserts at the right place. Assumes the keys are numeric and already sorted ascending.
   * @returns The index where the item was inserted.
   */
  insert(key: number, data: T): number;
  /**
   * Inserts at the right place. Assumes the keys are already sorted ascending.
   * @param compare A function to compare the keys. Should return true if the given key is bigger than the one compared
   * to, and false otherwise. Defaults to a numeric comparison.
   * @returns The index where the item was inserted.
   */
  insert(key: string | number, data: T, compare: (lastKey: string, key: string | number) => boolean): number;
  insert(key: string | number, data: T, compare = (lastKey: string, key: string | number) => (+lastKey) < (+key)): number {
    const keyString = key.toString();
    if (keyString in this) {
      this[keyString] = data;
      return this.keys.indexOf(keyString);
    }

    const length = this.keys.length
    if (!length || compare(this.lastKey(), key)) {
      this.push(key, data);
      return length;
    }

    let indexOfNext = this.keys.findIndex(k => !compare(k, key));
    if (indexOfNext === -1) {
      this.push(key, data);
    } else {
      this[keyString] = data;
      this.keys.splice(indexOfNext, 0, keyString);
    }
    return indexOfNext;
  }

  insertAt(key: string, index: number, data: T) {
    this[key] = data;
    this.keys.splice(index, 0, key);
  }

  rm(key: any) { // loose: any — key is coerced via `${key}`; callers pass varied key-like values.
    let i;
    key = `${key}`;
    if ((i = this.keys.indexOf(key)) !== -1) {
      this.keys.splice(i, 1);
      delete this[key];
    }
  }

  forEach(fn: (data: T) => void) {
    for (var key of this.keys) { fn(this[key]); }
  }

  get(key: any): T { // loose: any — key forwarded to $.getOwn; callers pass varied key-like values.
    if (key === 'keys') {
      return undefined as unknown as T;
    } else {
      return $.getOwn(this, key);
    }
  }

  lastKey(): string {
    return this.keys[this.keys.length - 1];
  }

  last(): T {
    return this.keys.length ? this[this.keys.length - 1] : undefined;
  }
}
