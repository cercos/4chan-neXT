import { Conf } from "../globals/globals";
import $ from "../platform/$";
import CrossOrigin from "../platform/CrossOrigin";
import { buildTrainingRecord, type PendingChallenge, type TrainingRecord } from "./CaptchaTrainingLogLogic";
import {
  MAX_SEND_TRIES, UPLOAD_URL, classifyStatus, contributorIdFrom, pendingUploads, sendInBatches, takeTry, toNdjson,
  toUploadRecord, withTimeout, type UploadOutcome,
} from "./CaptchaUploadLogic";

const DB_NAME = 'fourchanx-captcha-training';
const STORE = 'records';
const MAX_PENDING = 20;

type StoredRecord = TrainingRecord & { sent?: boolean; tries?: number };

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
let sending = false;
let blocked = false;

function contributorId(): Promise<string> {
  return new Promise(resolve => {
    $.get('captchaContributorId', '', (items: Record<string, any>) => {
      const existing = items['captchaContributorId'];
      if (typeof existing === 'string' && /^[0-9a-f]{32}$/.test(existing)) { resolve(existing); return; }
      const id = contributorIdFrom(crypto.getRandomValues(new Uint8Array(16)));
      $.set('captchaContributorId', id);
      resolve(id);
    });
  });
}

function sentCount(): Promise<number> {
  return new Promise(resolve => {
    $.get('captchaSentCount', 0, (items: Record<string, any>) => { resolve(+items['captchaSentCount'] || 0); });
  });
}

async function addSent(n: number): Promise<void> {
  $.set('captchaSentCount', await sentCount() + n);
}

async function postBatch(batch: StoredRecord[], id: string): Promise<UploadOutcome> {
  const req = await CrossOrigin.ajaxPromise(UPLOAD_URL, {
    method: 'POST',
    body: toNdjson(batch.map(toUploadRecord)),
    headers: { 'Content-Type': 'application/x-ndjson', 'X-Contributor': id },
    responseType: 'text',
    timeout: 15000,
  });
  const outcome = classifyStatus(req.status);
  if (outcome === 'rejected') { console.warn('[Send Captchas for Training] rejected', req.status, req.response); }
  return outcome;
}

const CaptchaTrainingLog = {
  onChange: null as null | (() => void),

  enabled() { return !!Conf['Send Captchas for Training']; },

  noteChallenge(challenge: any, board: string) { // loose: raw TCaptcha `twister` JSON
    if (!this.enabled() || !challenge?.challenge || !challenge?.tasks?.length) { return; }
    pending.set(challenge.challenge, { challenge, board, loadedAt: Date.now() });
    while (pending.size > MAX_PENDING) { pending.delete(pending.keys().next().value!); }
  },

  noteSolverAnswer(id: string, answer: string, confidence: number, solver = 'browser') {
    const p = pending.get(id);
    if (!p) { return; }
    if (solver !== 'browser') {
      p.extraSolver = solver;
      p.extraAnswer = answer;
      p.extraConfidence = confidence;
      return;
    }
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
      console.log('[Send Captchas for Training] saved', record.id, record.response, record.source);
      this.onChange?.();
      this.sendPending();
    } catch (err) {
      console.warn('[Send Captchas for Training] save failed', err);
    }
  },

  async all(): Promise<StoredRecord[]> {
    return (await withStore<StoredRecord[]>('readonly', s => s.getAll())) || [];
  },

  async counts(): Promise<{ waiting: number; sent: number }> {
    return { waiting: (await this.all()).filter(r => !r.sent).length, sent: await sentCount() };
  },

  async sendPending(): Promise<void> {
    if (!this.enabled() || sending || blocked) { return; }
    sending = true;
    try {
      const records = await this.all();
      const done = records.filter(r => r.sent);
      if (done.length) { await withStore('readwrite', s => { for (const r of done) { s.delete(r.id); } }); }
      const { send: pending, drop } = takeTry(pendingUploads<StoredRecord>(records));
      await withStore('readwrite', s => {
        for (const r of drop) { s.delete(r.id); }
        for (const r of pending) { s.put(r); }
      });
      if (drop.length) {
        console.warn(`[Send Captchas for Training] gave up on ${drop.length} after ${MAX_SEND_TRIES} tries`);
        this.onChange?.();
      }
      if (!pending.length) { return; }
      const id = await contributorId();
      const result = await sendInBatches(
        pending,
        batch => withTimeout(postBatch(batch, id), 30000, 'retry' as UploadOutcome),
        async (batch, outcome) => {
          await withStore('readwrite', s => { for (const r of batch) { s.delete(r.id); } });
          if (outcome === 'sent') { await addSent(batch.length); }
          this.onChange?.();
        },
      );
      if (result === 'blocked') { blocked = true; }
    } catch (err) {
      console.warn('[Send Captchas for Training] send failed', err);
    } finally {
      sending = false;
      this.onChange?.();
    }
  },
};

export default CaptchaTrainingLog;
