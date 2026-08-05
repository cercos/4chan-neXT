import {
  BRIDGE_EVENT,
  BRIDGE_HELLO,
  BRIDGE_READY,
  BRIDGE_REQUEST,
  BRIDGE_RESPONSE,
  decodeDetail,
  encodeDetail,
  type BridgeEvent,
  type BridgeRequest,
} from './bridgeProtocol';

type BridgeInstance = {
  dispatch: (name: string, detail: unknown) => void;
  respond: (id: number, data?: any, error?: string) => void;
  emit: (event: BridgeEvent) => void;
  invalidate: () => void;
  working: () => boolean;
  handlers: { [T in BridgeRequest['type']]: (req: Extract<BridgeRequest, { type: T }>) => void };
  announce: () => void;
};

const dispatch = (name: string, detail: unknown) => {
  document.dispatchEvent(new CustomEvent(name, { detail: encodeDetail(detail) }));
};

const respond = (id: number, data?: any, error?: string) => {
  const res: { id: number; data?: any; error?: string } = { id };
  if (data !== undefined) res.data = data;
  if (error !== undefined) res.error = error;
  dispatch(BRIDGE_RESPONSE, res);
};

const emit = (event: BridgeEvent) => dispatch(BRIDGE_EVENT, event);

let invalidated = false;
const invalidate = () => {
  if (invalidated) return;
  invalidated = true;
  emit({ kind: 'invalidated' });
};

const working = () => {
  try {
    return !!chrome.runtime.getManifest();
  } catch (err) {
    return false;
  }
};

const eventPageCallbacks = new Map<number, (data: any) => void>();
chrome.runtime.onMessage.addListener(({ id, data }: { id: number; data: any }) => {
  const cb = eventPageCallbacks.get(id);
  if (!cb) return;
  eventPageCallbacks.delete(id);
  cb(data);
});

const handlers: { [T in BridgeRequest['type']]: (req: Extract<BridgeRequest, { type: T }>) => void } = {
  storageGet(req) {
    chrome.storage[req.area].get(req.keys, result => {
      respond(req.id, result, chrome.runtime.lastError?.message);
    });
  },
  storageSet(req) {
    chrome.storage[req.area].set(req.data, () => {
      respond(req.id, undefined, chrome.runtime.lastError?.message);
    });
  },
  storageRemove(req) {
    chrome.storage[req.area].remove(req.keys, () => {
      respond(req.id, undefined, chrome.runtime.lastError?.message);
    });
  },
  storageClear(req) {
    chrome.storage[req.area].clear(() => {
      respond(req.id, undefined, chrome.runtime.lastError?.message);
    });
  },
  message(req) {
    chrome.runtime.sendMessage(req.params, (eventPageID: number) => {
      if (chrome.runtime.lastError) {
        respond(req.id, undefined, chrome.runtime.lastError.message);
        return;
      }
      eventPageCallbacks.set(eventPageID, data => respond(req.id, data));
    });
  },
};

const instance: BridgeInstance = {
  dispatch, respond, emit, invalidate, working, handlers,
  announce: () => {
    if (!working()) {
      invalidate();
      return;
    }
    dispatch(BRIDGE_READY, {
      manifestVersion: chrome.runtime.getManifest().manifest_version,
      quotaBytesPerItem: chrome.storage.sync.QUOTA_BYTES_PER_ITEM,
    });
  },
};

(globalThis as any)._4chanNextBridge = instance;

if (!(globalThis as any)._4chanNextBridgeSetup) {
  (globalThis as any)._4chanNextBridgeSetup = true;

  document.addEventListener(BRIDGE_REQUEST, ev => {
    const b = (globalThis as any)._4chanNextBridge as BridgeInstance;
    let req: BridgeRequest;
    try {
      req = decodeDetail(ev);
    } catch (err) {
      return;
    }
    if (!b.working()) {
      b.invalidate();
      b.respond(req.id, undefined, 'extension context invalidated');
      return;
    }
    try {
      (b.handlers[req.type] as (r: BridgeRequest) => void)(req);
    } catch (err) {
      if (!b.working()) b.invalidate();
      b.respond(req.id, undefined, '' + err);
    }
  });

  document.addEventListener(BRIDGE_HELLO, () => {
    const b = (globalThis as any)._4chanNextBridge as BridgeInstance;
    b.announce();
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  const b = (globalThis as any)._4chanNextBridge as BridgeInstance;
  b.emit({ kind: 'storageChanged', changes, area: area as 'local' | 'sync' });
});

instance.announce();
