import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BRIDGE_EVENT,
  BRIDGE_HELLO,
  BRIDGE_READY,
  BRIDGE_REQUEST,
  BRIDGE_RESPONSE,
  decodeDetail,
  encodeDetail,
} from './bridgeProtocol';

type AnyFn = (...args: any[]) => any;

function makeChromeStub() {
  const store: Record<'local' | 'sync', Record<string, any>> = { local: {}, sync: {} };
  const onChangedListeners: AnyFn[] = [];
  const onMessageListeners: AnyFn[] = [];
  const stub = {
    runtime: {
      lastError: undefined as { message: string } | undefined,
      getManifest: vi.fn(() => ({ manifest_version: 3 })),
      sendMessage: vi.fn(),
      onMessage: { addListener: (fn: AnyFn) => onMessageListeners.push(fn) },
    },
    storage: {
      sync: {
        QUOTA_BYTES_PER_ITEM: 8192,
        get: (keys: string[] | null, cb: AnyFn) => cb({ ...store.sync }),
        set: (data: any, cb: AnyFn) => { Object.assign(store.sync, data); cb(); },
        remove: (keys: string[], cb?: AnyFn) => { for (const k of keys) delete store.sync[k]; cb?.(); },
        clear: (cb: AnyFn) => { store.sync = {}; cb(); },
      },
      local: {
        get: (keys: string[] | null, cb: AnyFn) => cb({ ...store.local }),
        set: (data: any, cb: AnyFn) => { Object.assign(store.local, data); cb(); },
        remove: (keys: string[], cb?: AnyFn) => { for (const k of keys) delete store.local[k]; cb?.(); },
        clear: (cb: AnyFn) => { store.local = {}; cb(); },
      },
      onChanged: { addListener: (fn: AnyFn) => onChangedListeners.push(fn) },
    },
  };
  return { stub, store, onChangedListeners, onMessageListeners };
}

function collect(eventName: string) {
  const seen: any[] = [];
  document.addEventListener(eventName, ev => seen.push(decodeDetail(ev)));
  return seen;
}

function request(req: object) {
  document.dispatchEvent(new CustomEvent(BRIDGE_REQUEST, { detail: encodeDetail(req) }));
}

describe('bridge', () => {
  let chromeStub: ReturnType<typeof makeChromeStub>;
  let recordedListeners: Array<[string, AnyFn]> = [];

  beforeEach(async () => {
    vi.resetModules();
    chromeStub = makeChromeStub();
    (globalThis as any).chrome = chromeStub.stub;
    recordedListeners = [];
    const originalAddEventListener = document.addEventListener;
    document.addEventListener = ((eventName: string, listener: AnyFn, ...args: any[]) => {
      recordedListeners.push([eventName, listener]);
      originalAddEventListener.call(document, eventName, listener, ...args);
    }) as any;
    await import('./bridge');
    document.addEventListener = originalAddEventListener;
  });

  afterEach(() => {
    for (const [eventName, listener] of recordedListeners) {
      document.removeEventListener(eventName, listener);
    }
    delete (globalThis as any).chrome;
  });

  it('announces ready on load with manifest info', async () => {
    const ready = collect(BRIDGE_READY);
    document.dispatchEvent(new CustomEvent(BRIDGE_HELLO));
    expect(ready).toContainEqual({ manifestVersion: 3, quotaBytesPerItem: 8192 });
  });

  it('answers storageSet then storageGet with matching ids', async () => {
    const responses = collect(BRIDGE_RESPONSE);
    request({ id: 1, type: 'storageSet', area: 'local', data: { a: 1 } });
    request({ id: 2, type: 'storageGet', area: 'local', keys: ['a'] });
    expect(responses.find(r => r.id === 1)).toEqual({ id: 1 });
    expect(responses.find(r => r.id === 2)).toEqual({ id: 2, data: { a: 1 } });
  });

  it('answers storageRemove and storageClear', async () => {
    const responses = collect(BRIDGE_RESPONSE);
    chromeStub.store.sync = { a: 1, b: 2 };
    request({ id: 3, type: 'storageRemove', area: 'sync', keys: ['a'] });
    expect(chromeStub.store.sync).toEqual({ b: 2 });
    request({ id: 4, type: 'storageClear', area: 'sync' });
    expect(chromeStub.store.sync).toEqual({});
    expect(responses.map(r => r.id)).toEqual([3, 4]);
  });

  it('forwards storage.onChanged as a bridge event', () => {
    const events = collect(BRIDGE_EVENT);
    for (const fn of chromeStub.onChangedListeners) {
      fn({ key1: { newValue: 5 } }, 'sync');
    }
    expect(events).toContainEqual({
      kind: 'storageChanged',
      changes: { key1: { newValue: 5 } },
      area: 'sync',
    });
  });

  it('relays message requests through the eventPage id protocol', () => {
    const responses = collect(BRIDGE_RESPONSE);
    chromeStub.stub.runtime.sendMessage.mockImplementation((params: any, cb: AnyFn) => cb(41));
    request({ id: 7, type: 'message', params: { type: 'ajax', url: 'x' } });
    expect(chromeStub.stub.runtime.sendMessage).toHaveBeenCalled();
    for (const fn of chromeStub.onMessageListeners) fn({ id: 40, data: 'not-mine' });
    expect(responses).toEqual([]);
    for (const fn of chromeStub.onMessageListeners) fn({ id: 41, data: { ok: true } });
    expect(responses).toEqual([{ id: 7, data: { ok: true } }]);
  });

  it('emits invalidated once when the runtime dies', () => {
    const events = collect(BRIDGE_EVENT);
    chromeStub.stub.runtime.getManifest.mockImplementation(() => { throw new Error('context invalidated'); });
    request({ id: 8, type: 'storageGet', area: 'local', keys: null });
    request({ id: 9, type: 'storageGet', area: 'local', keys: null });
    expect(events.filter(e => e.kind === 'invalidated')).toHaveLength(1);
  });
});
