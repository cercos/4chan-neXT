import { Conf } from "../globals/globals";
import {
  buildTrainingRecord, exportFileName, toJsonl,
  type PendingChallenge, type TrainingRecord,
} from "./CaptchaTrainingLogLogic";

const DB_NAME = 'fourchanx-captcha-training';
const STORE = 'records';
const MAX_PENDING = 20;

type StoredRecord = TrainingRecord & { exported?: boolean };

let dbPromise: Promise<IDBDatabase> | null = null;
function openDB(): Promise<IDBDatabase> {
  return dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const pending = new Map<string, PendingChallenge>();
let lastSubmitted: { id: string; response: string } | null = null;

const CaptchaTrainingLog = {
  onChange: null as null | (() => void),

  enabled() { return !!Conf['Save Captchas for Training']; },

  noteChallenge(challenge: any, board: string) { // loose: raw TCaptcha `twister` JSON
    if (!this.enabled() || !challenge?.challenge || !challenge?.tasks?.length) { return; }
    pending.set(challenge.challenge, { challenge, board, loadedAt: Date.now() });
    while (pending.size > MAX_PENDING) { pending.delete(pending.keys().next().value!); }
  },

  noteSolverAnswer(id: string, answer: string, confidence: number) {
    const p = pending.get(id);
    if (!p) { return; }
    p.localAnswer = answer;
    p.localConfidence = confidence;
  },

  noteSubmitted(id: string, response: string) {
    lastSubmitted = pending.has(id) && response ? { id, response } : null;
  },

  async notePostSuccessful() {
    const sub = lastSubmitted;
    lastSubmitted = null;
    if (!sub || !this.enabled()) { return; }
    const p = pending.get(sub.id);
    pending.delete(sub.id);
    if (!p) { return; }
    const record = buildTrainingRecord(p, sub.response, Date.now());
    if (!record) { return; }
    try {
      await withStore('readwrite', s => s.put(record));
      console.log('[Save Captchas for Training] saved', record.id, record.response, record.source);
      this.onChange?.();
    } catch (err) {
      console.warn('[Save Captchas for Training] save failed', err);
    }
  },

  async all(): Promise<StoredRecord[]> {
    return (await withStore<StoredRecord[]>('readonly', s => s.getAll())) || [];
  },

  async counts() {
    const records = await this.all();
    return { total: records.length, unexported: records.filter(r => !r.exported).length };
  },

  async exportNew(): Promise<number> {
    const records = (await this.all()).filter(r => !r.exported);
    if (!records.length) { return 0; }
    const clean = records.map(({ exported: _e, ...r }) => r as TrainingRecord);
    const url = URL.createObjectURL(new Blob([toJsonl(clean)], { type: 'application/x-ndjson' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(new Date());
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    await withStore('readwrite', s => { for (const r of records) { s.put({ ...r, exported: true }); } });
    this.onChange?.();
    return records.length;
  },

  async clearExported(): Promise<number> {
    const done = (await this.all()).filter(r => r.exported);
    await withStore('readwrite', s => { for (const r of done) { s.delete(r.id); } });
    this.onChange?.();
    return done.length;
  },
};

export default CaptchaTrainingLog;
