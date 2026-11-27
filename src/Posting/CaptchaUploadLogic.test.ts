import { describe, expect, it } from 'vitest';
import {
  MAX_SEND_TRIES, classifyStatus, contributorIdFrom, pendingUploads, sendInBatches, takeTry, toNdjson, toUploadRecord,
  withTimeout, type UploadOutcome,
} from './CaptchaUploadLogic';
import type { TrainingRecord } from './CaptchaTrainingLogLogic';

const rec = (id: string, postedAt = 1): TrainingRecord => ({
  v: 1, id, board: 'g', loadedAt: 0, postedAt, outcome: 'correct', response: '1', source: 'manual',
  localAnswer: null, localConfidence: null, tasks: [{ items: ['a', 'b'] }],
});

describe('toUploadRecord', () => {
  it('drops board, timestamps and outcome', () => {
    expect(toUploadRecord(rec('x'))).toEqual({
      v: 1, id: 'x', response: '1', source: 'manual', localAnswer: null, localConfidence: null, tasks: [{ items: ['a', 'b'] }],
    });
  });
});

describe('toUploadRecord extra solver answer', () => {
  it('names the fields after the solver', () => {
    const r = toUploadRecord({ ...rec('x'), source: 'demo', extraSolver: 'demo', extraAnswer: '12', extraConfidence: 0.95 });
    expect(r.demoAnswer).toBe('12');
    expect(r.demoConfidence).toBe(0.95);
    expect('extraAnswer' in r).toBe(false);
  });
  it('leaves the fields out when there is no usable answer', () => {
    expect('demoAnswer' in toUploadRecord({ ...rec('x'), extraSolver: 'demo', extraAnswer: '1 2', extraConfidence: 0.9 })).toBe(false);
    expect(toUploadRecord({ ...rec('x'), extraSolver: 'demo', extraAnswer: '12', extraConfidence: 7 }).demoConfidence).toBeNull();
  });
  it('never overwrites the local fields', () => {
    expect(toUploadRecord({ ...rec('x'), extraSolver: 'local', extraAnswer: '12', extraConfidence: 0.9 }).localAnswer).toBeNull();
  });
});

describe('toUploadRecord local answer', () => {
  it('nulls an answer the server would reject', () => {
    const r = toUploadRecord({ ...rec('x'), localAnswer: '2 1', localConfidence: 0.7 });
    expect(r.localAnswer).toBeNull();
    expect(r.localConfidence).toBeNull();
  });

  it('keeps a valid answer', () => {
    const r = toUploadRecord({ ...rec('x'), localAnswer: '21', localConfidence: 0.7 });
    expect(r.localAnswer).toBe('21');
    expect(r.localConfidence).toBe(0.7);
  });
});

describe('toNdjson', () => {
  it('writes one record per line', () => {
    expect(toNdjson([toUploadRecord(rec('a')), toUploadRecord(rec('b'))]).split('\n')).toHaveLength(2);
  });
});

describe('classifyStatus', () => {
  it('maps server responses', () => {
    expect(classifyStatus(200)).toBe('sent');
    expect(classifyStatus(400)).toBe('rejected');
    expect(classifyStatus(413)).toBe('rejected');
    expect(classifyStatus(403)).toBe('blocked');
    expect(classifyStatus(429)).toBe('retry');
    expect(classifyStatus(500)).toBe('retry');
    expect(classifyStatus(0)).toBe('retry');
  });
});

describe('contributorIdFrom', () => {
  it('makes 32 hex chars from 16 bytes', () => {
    expect(contributorIdFrom(new Uint8Array([0, 1, 255, ...Array(13).fill(16)]))).toBe('0001ff' + '10'.repeat(13));
  });
});

describe('pendingUploads', () => {
  it('keeps unsent records, oldest first, including ones an older version marked rejected', () => {
    const list = [{ ...rec('c', 3) }, { ...rec('a', 1), sent: true }, { ...rec('b', 2) }, { ...rec('d', 0), rejected: true }];
    expect(pendingUploads(list).map(r => r.id)).toEqual(['d', 'b', 'c']);
  });
});

describe('sendInBatches', () => {
  const run = async (items: string[], outcomes: (batch: string[]) => UploadOutcome, batchSize = 2) => {
    const posts: string[][] = [];
    const marks: [string[], string][] = [];
    const result = await sendInBatches(items,
      async (b) => { posts.push(b); return outcomes(b); },
      async (b, o) => { marks.push([b, o]); },
      batchSize);
    return { result, posts, marks };
  };

  it('sends everything in batches', async () => {
    const r = await run(['a', 'b', 'c'], () => 'sent');
    expect(r.result).toBe('done');
    expect(r.posts).toEqual([['a', 'b'], ['c']]);
    expect(r.marks).toEqual([[['a', 'b'], 'sent'], [['c'], 'sent']]);
  });
  it('stops on retry and leaves the rest unsent', async () => {
    const r = await run(['a', 'b', 'c'], () => 'retry');
    expect(r.result).toBe('retry');
    expect(r.posts).toEqual([['a', 'b']]);
    expect(r.marks).toEqual([]);
  });
  it('stops on blocked', async () => {
    expect((await run(['a'], () => 'blocked')).result).toBe('blocked');
  });
  it('splits a rejected batch to find the bad record', async () => {
    const r = await run(['a', 'bad', 'c'], (b) => (b.includes('bad') ? 'rejected' : 'sent'), 3);
    expect(r.result).toBe('done');
    expect(r.marks).toEqual([[['a'], 'sent'], [['bad'], 'rejected'], [['c'], 'sent']]);
  });
  it('stops a split if the server starts limiting', async () => {
    let calls = 0;
    const r = await run(['a', 'b'], () => (++calls === 1 ? 'rejected' : 'retry'));
    expect(r.result).toBe('retry');
    expect(r.marks).toEqual([]);
  });
});

describe('takeTry', () => {
  it('counts a try on each record it sends', () => {
    const { send, drop } = takeTry([{ id: 'a' }, { id: 'b', tries: 3 }]);
    expect(send).toEqual([{ id: 'a', tries: 1 }, { id: 'b', tries: 4 }]);
    expect(drop).toEqual([]);
  });
  it('gives up after the last try', () => {
    const { send, drop } = takeTry([{ id: 'a', tries: MAX_SEND_TRIES - 1 }, { id: 'b', tries: MAX_SEND_TRIES }]);
    expect(send.map(r => r.id)).toEqual(['a']);
    expect(drop.map(r => r.id)).toEqual(['b']);
  });
  it('defaults to 5 tries', () => {
    expect(MAX_SEND_TRIES).toBe(5);
  });
});

describe('withTimeout', () => {
  it('passes the result through', async () => {
    expect(await withTimeout(Promise.resolve('sent'), 1000, 'retry')).toBe('sent');
  });
  it('falls back when the promise hangs or fails', async () => {
    expect(await withTimeout(new Promise<string>(() => {}), 10, 'retry')).toBe('retry');
    expect(await withTimeout(Promise.reject(new Error('x')), 1000, 'retry')).toBe('retry');
  });
});
