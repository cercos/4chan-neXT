// IndexedDB-backed blob store for Quick Reply draft attachments.
//
// The regular $.set/$.get storage layer (GM/localStorage/chrome.storage) is
// JSON-only and cannot hold File/Blob data, so draft files (images/videos)
// live here instead, referenced by an id from the JSON draft. IndexedDB stores
// File/Blob objects natively (no base64 bloat) and has a large per-origin quota.
//
// Every method FAILS SOFT: on any error (no IndexedDB, blocked, quota, etc.) it
// resolves to a harmless value so draft text still works and posting is never
// blocked.

const DB_NAME = 'fourchanXT';
const STORE = 'qrDraftFiles';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) { return dbPromise; }
  dbPromise = new Promise<IDBDatabase | null>(resolve => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) { db.createObjectStore(STORE); }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function store(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

const QRFileStore = {
  // Save a blob under `id`. Resolves true on success, false on any failure.
  async put(id: string, blob: Blob): Promise<boolean> {
    const db = await openDB();
    if (!db) { return false; }
    return new Promise<boolean>(resolve => {
      try {
        const req = store(db, 'readwrite').put(blob, id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  },

  // Fetch the blob stored under `id`, or undefined if missing/unavailable.
  async get(id: string): Promise<Blob | undefined> {
    const db = await openDB();
    if (!db) { return undefined; }
    return new Promise<Blob | undefined>(resolve => {
      try {
        const req = store(db, 'readonly').get(id);
        req.onsuccess = () => resolve(req.result as Blob | undefined);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  },

  // Delete one or more ids. Always resolves.
  async delete(ids: string | string[]): Promise<void> {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) { return; }
    const db = await openDB();
    if (!db) { return; }
    return new Promise<void>(resolve => {
      try {
        const os = store(db, 'readwrite');
        for (const id of list) { os.delete(id); }
        os.transaction.oncomplete = () => resolve();
        os.transaction.onerror = () => resolve();
        os.transaction.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  // All stored keys (cheap — does not read blob payloads). Used for orphan
  // cleanup by board-key prefix.
  async keys(): Promise<string[]> {
    const db = await openDB();
    if (!db) { return []; }
    return new Promise<string[]>(resolve => {
      try {
        const req = store(db, 'readonly').getAllKeys();
        req.onsuccess = () => resolve((req.result || []).map(String));
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  },
};

export default QRFileStore;
