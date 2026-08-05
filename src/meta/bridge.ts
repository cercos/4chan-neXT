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

document.addEventListener(BRIDGE_REQUEST, ev => {
  let req: BridgeRequest;
  try {
    req = decodeDetail(ev);
  } catch (err) {
    return;
  }
  if (!working()) {
    invalidate();
    respond(req.id, undefined, 'extension context invalidated');
    return;
  }
  try {
    (handlers[req.type] as (r: BridgeRequest) => void)(req);
  } catch (err) {
    if (!working()) invalidate();
    respond(req.id, undefined, '' + err);
  }
});

const announce = () => {
  if (!working()) {
    invalidate();
    return;
  }
  dispatch(BRIDGE_READY, {
    manifestVersion: chrome.runtime.getManifest().manifest_version,
    quotaBytesPerItem: chrome.storage.sync.QUOTA_BYTES_PER_ITEM,
  });
};

chrome.storage.onChanged.addListener((changes, area) => {
  emit({ kind: 'storageChanged', changes, area: area as 'local' | 'sync' });
});

document.addEventListener(BRIDGE_HELLO, announce);
announce();
