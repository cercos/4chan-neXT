import type { TrainingRecord } from './CaptchaTrainingLogLogic';

export const UPLOAD_URL = 'https://captcha-upload.4chan-next.workers.dev/submit';
export const UPLOAD_BATCH = 20;

export type UploadRecord = Pick<TrainingRecord, 'v' | 'id' | 'response' | 'source' | 'localAnswer' | 'localConfidence' | 'tasks'>;
export type UploadOutcome = 'sent' | 'retry' | 'rejected' | 'blocked';

export function toUploadRecord(r: TrainingRecord): UploadRecord {
  const { v, id, response, source, localAnswer, localConfidence, tasks } = r;
  const valid = localAnswer === null || /^[0-9]{1,10}$/.test(localAnswer);
  return {
    v, id, response, source, tasks,
    localAnswer: valid ? localAnswer : null,
    localConfidence: valid ? localConfidence : null,
  };
}

export function toNdjson(records: UploadRecord[]): string {
  return records.map(r => JSON.stringify(r)).join('\n');
}

export function classifyStatus(status: number): UploadOutcome {
  if (status === 200) { return 'sent'; }
  if (status === 400 || status === 413) { return 'rejected'; }
  if (status === 403) { return 'blocked'; }
  return 'retry';
}

export function contributorIdFrom(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function pendingUploads<T extends { sent?: boolean; postedAt: number }>(records: T[]): T[] {
  return records.filter(r => !r.sent).sort((a, b) => a.postedAt - b.postedAt);
}

export async function sendInBatches<R>(
  pending: R[],
  post: (batch: R[]) => Promise<UploadOutcome>,
  mark: (batch: R[], outcome: 'sent' | 'rejected') => Promise<void>,
  batchSize = UPLOAD_BATCH,
): Promise<'done' | 'retry' | 'blocked'> {
  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const outcome = await post(batch);
    if (outcome === 'retry' || outcome === 'blocked') { return outcome; }
    if (outcome === 'rejected' && batch.length > 1) {
      for (const one of batch) {
        const single = await post([one]);
        if (single === 'retry' || single === 'blocked') { return single; }
        await mark([one], single);
      }
      continue;
    }
    await mark(batch, outcome);
  }
  return 'done';
}
