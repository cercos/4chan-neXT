// Event channel between the MV3 MAIN-world content script (script.js) and the
// isolated-world bridge (bridge.js). detail is a JSON string because plain
// objects do not reliably cross Chrome world boundaries.
export const BRIDGE_REQUEST = '4chan-neXT-bridge-request';
export const BRIDGE_RESPONSE = '4chan-neXT-bridge-response';
export const BRIDGE_READY = '4chan-neXT-bridge-ready';
export const BRIDGE_HELLO = '4chan-neXT-bridge-hello';
export const BRIDGE_EVENT = '4chan-neXT-bridge-event';

export const SYNC_QUOTA_BYTES_PER_ITEM_FALLBACK = 8192;

export type StorageArea = 'local' | 'sync';

export type BridgeRequest =
  | { id: number; type: 'storageGet'; area: StorageArea; keys: string[] | null }
  | { id: number; type: 'storageSet'; area: StorageArea; data: Record<string, any> }
  | { id: number; type: 'storageRemove'; area: StorageArea; keys: string[] }
  | { id: number; type: 'storageClear'; area: StorageArea }
  | { id: number; type: 'message'; params: any };

export type BridgeResponse = { id: number; data?: any; error?: string };

export type BridgeEvent =
  | {
      kind: 'storageChanged';
      changes: Record<string, { newValue?: any; oldValue?: any }>;
      area: StorageArea;
    }
  | { kind: 'invalidated' };

export type BridgeReadyInfo = { manifestVersion: number; quotaBytesPerItem: number };

export const encodeDetail = (value: unknown): string => JSON.stringify(value);

export const decodeDetail = (ev: Event): any => JSON.parse((ev as CustomEvent<string>).detail);
