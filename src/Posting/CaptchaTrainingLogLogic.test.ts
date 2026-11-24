import { describe, expect, it } from 'vitest';
import { answerSource, buildTrainingRecord, pickTasks } from './CaptchaTrainingLogLogic';

const challenge = (tasks: any[]) => ({ challenge: 'abc123', ttl: 120, tasks });
const task = (n: number, extra: Record<string, unknown> = {}) => ({ items: Array.from({ length: n }, (_, i) => `img${i}`), ...extra });

describe('answerSource', () => {
  it('is manual when the solver was not used', () => {
    expect(answerSource(undefined, '12')).toBe('manual');
    expect(answerSource(null, '12')).toBe('manual');
  });
  it('distinguishes accepted vs edited solver answers', () => {
    expect(answerSource('12', '12')).toBe('local');
    expect(answerSource('12', '13')).toBe('local-edited');
  });
});

describe('pickTasks', () => {
  it('keeps prompt text/image and string items only', () => {
    expect(pickTasks([{ str: 'pick', img: 'P', items: ['a', 1, 'b'], junk: true }])).toEqual([
      { str: 'pick', img: 'P', items: ['a', 'b'] },
    ]);
  });
  it('tolerates missing fields', () => {
    expect(pickTasks([{}])).toEqual([{ items: [] }]);
    expect(pickTasks(undefined as any)).toEqual([]);
  });
});

describe('buildTrainingRecord', () => {
  const pending = { challenge: challenge([task(4, { str: 'a' }), task(3, { img: 'P' })]), board: 'g', loadedAt: 1 };

  it('builds a correct-outcome record', () => {
    const r = buildTrainingRecord(pending, '21', 5)!;
    expect(r).toMatchObject({ v: 1, id: 'abc123', board: 'g', loadedAt: 1, postedAt: 5, outcome: 'correct', response: '21', source: 'manual', localAnswer: null });
    expect(r.tasks).toHaveLength(2);
    expect(r.tasks[1]).toEqual({ img: 'P', items: ['img0', 'img1', 'img2'] });
  });

  it('records the solver answer and source', () => {
    const r = buildTrainingRecord({ ...pending, localAnswer: '20', localConfidence: 0.8 }, '21', 5)!;
    expect(r).toMatchObject({ source: 'local-edited', localAnswer: '20', localConfidence: 0.8 });
  });

  it('rejects answers that do not line up with the tasks', () => {
    expect(buildTrainingRecord(pending, '2', 5)).toBeNull();
    expect(buildTrainingRecord(pending, '23', 5)).toBeNull();
    expect(buildTrainingRecord(pending, '2x', 5)).toBeNull();
  });

  it('rejects challenges without an id or tasks', () => {
    expect(buildTrainingRecord({ ...pending, challenge: { tasks: [task(2)] } }, '0', 5)).toBeNull();
    expect(buildTrainingRecord({ ...pending, challenge: challenge([]) }, '', 5)).toBeNull();
  });
});
