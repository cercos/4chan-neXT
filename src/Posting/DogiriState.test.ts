import { describe, expect, it } from 'vitest';
import {
  addCaption, addRegion, applyProject, captionAt, captionBlockTop, captionLaneLevels,
  captionsAt, commitHistory, createHistory, createState, estimatedClippedBytes, formatTime,
  freeCaptionY, inRegion, keepRegions, mergeRegions, moveCaption, moveCaptionEdge, moveRegion,
  moveRegionEdge, moveRegionFree, nearestIndex, nextRegionStart, parseTime, redo, removeCaption,
  removeRegion, removeRegions,
  resetState, serializeProject, setCaptionY, settleRegion, snapshot, totalClipped, undo,
  UNDO_LIMIT, updateCaption, wrapCaptionLines,
} from './DogiriState';

describe('createState', () => {
  it('starts with one region covering the whole video and no captions', () => {
    const state = createState(90);
    expect(state.duration).toBe(90);
    expect(state.regions).toEqual([{ id: 1, start: 0, end: 90 }]);
    expect(state.captions).toEqual([]);
    expect(state.stripAudio).toBe(false);
  });

  it('treats invalid durations as zero with no regions', () => {
    expect(createState(NaN).duration).toBe(0);
    expect(createState(-5).duration).toBe(0);
    expect(createState(Infinity).duration).toBe(0);
    expect(createState(NaN).regions).toEqual([]);
  });
});

describe('resetState', () => {
  it('returns an edited state to pristine in place', () => {
    const state = createState(90);
    moveRegionEdge(state, 1, 'end', 20);
    addCaption(state, 12, 15, 'hello', 85, 'medium');
    state.stripAudio = true;
    resetState(state);
    expect(state).toEqual(createState(90));
  });

  it('is undoable through the history like any other edit', () => {
    const state = createState(90);
    const history = createHistory();
    moveRegionEdge(state, 1, 'end', 20);
    const before = snapshot(state);
    resetState(state);
    expect(commitHistory(history, before, state)).toBe(true);
    undo(history, state);
    expect(state.regions).toEqual([{ id: 1, start: 0, end: 20 }]);
  });
});

describe('formatTime', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });

  it('appends tenths when requested', () => {
    expect(formatTime(12.4, true)).toBe('0:12.4');
    expect(formatTime(0, true)).toBe('0:00.0');
    expect(formatTime(2.3, true)).toBe('0:02.3');
    expect(formatTime(65.7, true)).toBe('1:05.7');
    expect(formatTime(59.99, true)).toBe('1:00.0');
  });

  it('treats invalid input as zero', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-3)).toBe('0:00');
  });
});

describe('parseTime', () => {
  it('parses minutes:seconds with optional tenths', () => {
    expect(parseTime('1:23')).toBe(83);
    expect(parseTime('1:23.4')).toBeCloseTo(83.4);
    expect(parseTime('0:00.0')).toBe(0);
    expect(parseTime('10:05')).toBe(605);
  });

  it('parses plain seconds', () => {
    expect(parseTime('83')).toBe(83);
    expect(parseTime('83.4')).toBeCloseTo(83.4);
    expect(parseTime('.5')).toBeCloseTo(0.5);
    expect(parseTime('0')).toBe(0);
  });

  it('parses hours:minutes:seconds', () => {
    expect(parseTime('1:02:03')).toBe(3723);
    expect(parseTime('0:00:30.5')).toBeCloseTo(30.5);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseTime(' 1:23 ')).toBe(83);
  });

  it('allows seconds overflowing past 59', () => {
    expect(parseTime('0:90')).toBe(90);
  });

  it('round-trips formatTime output', () => {
    expect(parseTime(formatTime(65.7, true))).toBeCloseTo(65.7);
    expect(parseTime(formatTime(605))).toBe(605);
  });

  it('rejects garbage', () => {
    expect(parseTime('')).toBeNull();
    expect(parseTime('   ')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('1:2:3:4')).toBeNull();
    expect(parseTime('-5')).toBeNull();
    expect(parseTime('1:-5')).toBeNull();
    expect(parseTime('1:')).toBeNull();
    expect(parseTime(':30')).toBeNull();
    expect(parseTime('1:23,4')).toBeNull();
  });
});

describe('regions', () => {
  it('shrinking the only region leaves room and addRegion fills the largest gap', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 20);
    const added = addRegion(state)!;
    expect(added).not.toBeNull();
    expect(added.start).toBeGreaterThanOrEqual(20);
    expect(added.end).toBeLessThanOrEqual(60);
    expect(added.end - added.start).toBeGreaterThan(0);
    expect(state.regions.map(r => r.id)).toEqual([1, added.id]);
  });

  it('addRegion returns null when regions cover everything', () => {
    const state = createState(60);
    expect(addRegion(state)).toBeNull();
  });

  it('addRegion returns null for a zero-duration video', () => {
    const state = createState(0);
    expect(addRegion(state)).toBeNull();
  });

  it('keeps regions sorted by start after adding', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 10);
    moveRegion(state, 1, 25);
    const added = addRegion(state)!;
    expect(state.regions[0].start).toBeLessThan(state.regions[1].start);
    expect(state.regions.some(r => r.id === added.id)).toBe(true);
  });

  it('edge drags clamp to the video bounds and a minimum length', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'start', -10);
    expect(state.regions[0].start).toBe(0);
    moveRegionEdge(state, 1, 'end', 100);
    expect(state.regions[0].end).toBe(60);
    moveRegionEdge(state, 1, 'start', 60);
    expect(state.regions[0].start).toBeLessThan(60);
    expect(state.regions[0].end - state.regions[0].start).toBeGreaterThan(0);
  });

  it('edge drags stop at the neighboring region', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 20);
    const b = addRegion(state)!;
    moveRegionEdge(state, b.id, 'start', 5);
    expect(state.regions[1].start).toBeGreaterThanOrEqual(20);
    moveRegionEdge(state, 1, 'end', 55);
    expect(state.regions[0].end).toBeLessThanOrEqual(state.regions[1].start);
  });

  it('moving a whole region preserves its length and stops at neighbors', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 10);
    const b = addRegion(state)!;
    moveRegionEdge(state, b.id, 'start', 40);
    moveRegionEdge(state, b.id, 'end', 50);
    moveRegion(state, b.id, 0);
    const moved = state.regions.find(r => r.id === b.id)!;
    expect(moved.end - moved.start).toBeCloseTo(10, 5);
    expect(moved.start).toBeGreaterThanOrEqual(10);
    moveRegion(state, b.id, 999);
    const moved2 = state.regions.find(r => r.id === b.id)!;
    expect(moved2.end).toBeLessThanOrEqual(60);
    expect(moved2.end - moved2.start).toBeCloseTo(10, 5);
  });

  it('removes a region by id', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 20);
    const b = addRegion(state)!;
    removeRegion(state, 1);
    expect(state.regions.map(r => r.id)).toEqual([b.id]);
  });

  it('moveRegionFree passes over other regions and keeps the array sorted', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 10);
    const b = addRegion(state)!;
    moveRegionFree(state, 1, 50);
    const moved = state.regions.find(r => r.id === 1)!;
    expect(moved.start).toBe(50);
    expect(moved.end).toBe(60);
    expect(state.regions[0].id).toBe(b.id);
  });

  it('moveRegionFree clamps to the video bounds', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 10);
    moveRegionFree(state, 1, -5);
    expect(state.regions[0]).toMatchObject({ start: 0, end: 10 });
    moveRegionFree(state, 1, 100);
    expect(state.regions[0]).toMatchObject({ start: 50, end: 60 });
  });

  it('settleRegion drops the region left of another when released left of its center', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 10);
    const b = addRegion(state)!;
    moveRegionFree(state, 1, 24);
    settleRegion(state, 1, { start: 0, end: 10 });
    const a = state.regions.find(r => r.id === 1)!;
    const other = state.regions.find(r => r.id === b.id)!;
    expect(a.end).toBeCloseTo(other.start, 5);
    expect(a.end - a.start).toBeCloseTo(10, 5);
  });

  it('settleRegion drops the region right of another when released right of its center', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 10);
    const b = addRegion(state)!;
    moveRegionFree(state, 1, 38);
    settleRegion(state, 1, { start: 0, end: 10 });
    const a = state.regions.find(r => r.id === 1)!;
    const other = state.regions.find(r => r.id === b.id)!;
    expect(a.start).toBeCloseTo(other.end, 5);
    expect(a.end - a.start).toBeCloseTo(10, 5);
  });

  it('settleRegion leaves a region alone when it overlaps nothing', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 10);
    moveRegionFree(state, 1, 30);
    settleRegion(state, 1, { start: 0, end: 10 });
    expect(state.regions[0]).toMatchObject({ start: 30, end: 40 });
  });

  it('settleRegion reverts to the fallback when the region fits nowhere', () => {
    const state = createState(24);
    moveRegionEdge(state, 1, 'end', 10);
    const b = addRegion(state)!;
    moveRegionEdge(state, b.id, 'start', 10);
    moveRegionEdge(state, b.id, 'end', 14);
    const c = addRegion(state)!;
    moveRegionEdge(state, c.id, 'start', 14);
    moveRegionEdge(state, c.id, 'end', 24);
    moveRegionFree(state, b.id, 2);
    settleRegion(state, b.id, { start: 10, end: 14 });
    expect(state.regions.find(r => r.id === b.id)).toMatchObject({ start: 10, end: 14 });
    expect(state.regions.map(r => r.id)).toEqual([1, b.id, c.id]);
  });

  it('ignores unknown ids', () => {
    const state = createState(60);
    moveRegionEdge(state, 999, 'end', 20);
    moveRegion(state, 999, 5);
    removeRegion(state, 999);
    expect(state.regions).toEqual([{ id: 1, start: 0, end: 60 }]);
  });
});

describe('bulk region operations', () => {
  const fourClips = () => {
    const state = createState(60);
    state.regions = [
      { id: 1, start: 0, end: 10 },
      { id: 2, start: 15, end: 20 },
      { id: 3, start: 25, end: 30 },
      { id: 4, start: 40, end: 50 },
    ];
    state.nextId = 5;
    return state;
  };

  it('removeRegions drops all listed ids and reports the count', () => {
    const state = fourClips();
    expect(removeRegions(state, [2, 4])).toBe(2);
    expect(state.regions.map(r => r.id)).toEqual([1, 3]);
  });

  it('removeRegions ignores unknown ids', () => {
    const state = fourClips();
    expect(removeRegions(state, [99, 3])).toBe(1);
    expect(state.regions.map(r => r.id)).toEqual([1, 2, 4]);
  });

  it('keepRegions drops everything not listed and reports the removed count', () => {
    const state = fourClips();
    expect(keepRegions(state, [2, 3])).toBe(2);
    expect(state.regions.map(r => r.id)).toEqual([2, 3]);
  });

  it('keepRegions with no ids clears all regions', () => {
    const state = fourClips();
    expect(keepRegions(state, [])).toBe(4);
    expect(state.regions).toEqual([]);
  });

  it('mergeRegions spans the selected clips and absorbs unselected clips inside the span', () => {
    const state = fourClips();
    const merged = mergeRegions(state, [2, 4])!;
    expect(merged).toMatchObject({ start: 15, end: 50 });
    expect(merged.id).toBe(5);
    expect(state.regions).toEqual([
      { id: 1, start: 0, end: 10 },
      merged,
    ]);
  });

  it('mergeRegions keeps the result sorted among untouched clips', () => {
    const state = fourClips();
    const merged = mergeRegions(state, [2, 3])!;
    expect(state.regions.map(r => r.id)).toEqual([1, merged.id, 4]);
    expect(merged).toMatchObject({ start: 15, end: 30 });
  });

  it('mergeRegions returns null and leaves the state alone with fewer than two matching ids', () => {
    const state = fourClips();
    expect(mergeRegions(state, [2])).toBeNull();
    expect(mergeRegions(state, [99, 98])).toBeNull();
    expect(state.regions.map(r => r.id)).toEqual([1, 2, 3, 4]);
    expect(state.nextId).toBe(5);
  });
});

describe('totals and estimates', () => {
  it('totalClipped sums region lengths', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 15);
    expect(totalClipped(state)).toBe(15);
  });

  it('estimatedClippedBytes is proportional to clipped duration', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 15);
    expect(estimatedClippedBytes(state, 4000)).toBe(1000);
    expect(estimatedClippedBytes(createState(0), 4000)).toBe(0);
  });
});

describe('clipped playback helpers', () => {
  it('inRegion is start-inclusive and end-exclusive', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'start', 10);
    moveRegionEdge(state, 1, 'end', 20);
    expect(inRegion(state, 10)).toBe(true);
    expect(inRegion(state, 19.9)).toBe(true);
    expect(inRegion(state, 20)).toBe(false);
    expect(inRegion(state, 5)).toBe(false);
  });

  it('nextRegionStart returns the next region after a time, or null', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'start', 10);
    moveRegionEdge(state, 1, 'end', 20);
    const b = addRegion(state)!;
    expect(nextRegionStart(state, 0)).toBe(10);
    expect(nextRegionStart(state, 20)).toBe(state.regions.find(r => r.id === b.id)!.start);
    expect(nextRegionStart(state, 59.99)).toBeNull();
  });
});

describe('captions', () => {
  it('adds a caption from an explicit range, clamped to the video, with a clamped y', () => {
    const state = createState(60);
    const caption = addCaption(state, 7, 9, 'lol', 82, 'medium')!;
    expect(caption).toMatchObject({ start: 7, end: 9, text: 'lol', y: 82, size: 'medium' });
    const clamped = addCaption(state, -5, 100, 'x', 200, 'small')!;
    expect(clamped.start).toBe(0);
    expect(clamped.end).toBe(60);
    expect(clamped.y).toBe(90);
  });

  it('rejects empty text or zero-length ranges', () => {
    const state = createState(60);
    expect(addCaption(state, 7, 9, '   ', 82, 'medium')).toBeNull();
    expect(addCaption(state, 9, 9, 'x', 82, 'medium')).toBeNull();
    expect(state.captions).toHaveLength(0);
  });

  it('trims caption text', () => {
    const state = createState(60);
    expect(addCaption(state, 7, 9, '  hi  ', 8, 'small')!.text).toBe('hi');
  });

  it('update can re-time a caption with a clamped range and adjust y', () => {
    const state = createState(60);
    const caption = addCaption(state, 7, 9, 'x', 82, 'medium')!;
    updateCaption(state, caption.id, 'x', 'medium', { start: 30, end: 100 }, 10);
    expect(caption.start).toBe(30);
    expect(caption.end).toBe(60);
    expect(caption.y).toBe(10);
    updateCaption(state, caption.id, 'x', 'medium', { start: 20, end: 20 });
    expect(caption.start).toBe(30);
    expect(caption.end).toBe(60);
    expect(caption.y).toBe(10);
  });

  it('update returns null for unknown ids or empty text', () => {
    const state = createState(60);
    const caption = addCaption(state, 7, 9, 'x', 82, 'medium')!;
    expect(updateCaption(state, 999, 'y', 'small')).toBeNull();
    expect(updateCaption(state, caption.id, ' ', 'small')).toBeNull();
    expect(state.captions[0].text).toBe('x');
  });

  it('setCaptionY clamps and ignores unknown ids', () => {
    const state = createState(60);
    const caption = addCaption(state, 7, 9, 'x', 50, 'medium')!;
    setCaptionY(state, caption.id, -10);
    expect(caption.y).toBe(0);
    setCaptionY(state, caption.id, 300);
    expect(caption.y).toBe(90);
    setCaptionY(state, 999, 40);
    expect(caption.y).toBe(90);
  });

  it('caption edges drag with a minimum length and captions may overlap', () => {
    const state = createState(60);
    const a = addCaption(state, 10, 20, 'a', 8, 'medium')!;
    const b = addCaption(state, 15, 25, 'b', 8, 'medium')!;
    moveCaptionEdge(state, a.id, 'end', 24);
    expect(a.end).toBe(24);
    moveCaptionEdge(state, a.id, 'start', 100);
    expect(a.start).toBeLessThan(a.end);
    moveCaptionEdge(state, b.id, 'end', 999);
    expect(b.end).toBe(60);
  });

  it('moving a whole caption preserves length and clamps to the video', () => {
    const state = createState(60);
    const caption = addCaption(state, 10, 20, 'x', 8, 'medium')!;
    moveCaption(state, caption.id, 55);
    expect(caption.start).toBe(50);
    expect(caption.end).toBe(60);
    moveCaption(state, caption.id, -5);
    expect(caption.start).toBe(0);
    expect(caption.end).toBe(10);
  });

  it('removes a caption by id', () => {
    const state = createState(60);
    const caption = addCaption(state, 7, 9, 'x', 82, 'medium')!;
    removeCaption(state, caption.id);
    expect(state.captions).toHaveLength(0);
  });

  it('captionAt returns the covering caption, most recent wins on overlap', () => {
    const state = createState(60);
    addCaption(state, 10, 20, 'first', 82, 'medium');
    addCaption(state, 15, 25, 'second', 82, 'medium');
    expect(captionAt(state, 12)!.text).toBe('first');
    expect(captionAt(state, 17)!.text).toBe('second');
    expect(captionAt(state, 25)).toBeNull();
    expect(captionAt(state, 5)).toBeNull();
  });

  it('captionsAt returns every covering caption in insertion order', () => {
    const state = createState(60);
    addCaption(state, 10, 20, 'first', 8, 'medium');
    addCaption(state, 15, 25, 'second', 82, 'medium');
    expect(captionsAt(state, 17).map(c => c.text)).toEqual(['first', 'second']);
    expect(captionsAt(state, 12).map(c => c.text)).toEqual(['first']);
    expect(captionsAt(state, 30)).toEqual([]);
  });
});

describe('captionLaneLevels', () => {
  it('keeps non-overlapping captions on one row', () => {
    const state = createState(60);
    const a = addCaption(state, 0, 10, 'a', 82, 'medium')!;
    const b = addCaption(state, 10, 20, 'b', 82, 'medium')!;
    const { levels, rows } = captionLaneLevels(state);
    expect(rows).toBe(1);
    expect(levels.get(a.id)).toBe(0);
    expect(levels.get(b.id)).toBe(0);
  });

  it('fans overlapping captions onto separate rows', () => {
    const state = createState(60);
    const a = addCaption(state, 0, 20, 'a', 82, 'medium')!;
    const b = addCaption(state, 5, 25, 'b', 82, 'medium')!;
    const c = addCaption(state, 10, 30, 'c', 82, 'medium')!;
    const { levels, rows } = captionLaneLevels(state);
    expect(rows).toBe(3);
    expect(new Set([levels.get(a.id), levels.get(b.id), levels.get(c.id)]).size).toBe(3);
  });

  it('reuses a freed row after an overlap ends', () => {
    const state = createState(60);
    const a = addCaption(state, 0, 10, 'a', 82, 'medium')!;
    const b = addCaption(state, 5, 15, 'b', 82, 'medium')!;
    const c = addCaption(state, 20, 30, 'c', 82, 'medium')!;
    const { levels, rows } = captionLaneLevels(state);
    expect(rows).toBe(2);
    expect(levels.get(a.id)).toBe(0);
    expect(levels.get(b.id)).toBe(1);
    expect(levels.get(c.id)).toBe(0);
  });

  it('reports one row for an empty lane', () => {
    expect(captionLaneLevels(createState(60)).rows).toBe(1);
  });
});

describe('freeCaptionY', () => {
  it('returns the preset when nothing collides', () => {
    const state = createState(60);
    expect(freeCaptionY(state, 0, 5, 82)).toBe(82);
    addCaption(state, 20, 30, 'x', 82, 'medium');
    expect(freeCaptionY(state, 0, 5, 82)).toBe(82);
  });

  it('stacks bottom captions upward and top captions downward', () => {
    const state = createState(60);
    addCaption(state, 0, 10, 'x', 82, 'medium');
    expect(freeCaptionY(state, 0, 10, 82)).toBe(73);
    addCaption(state, 0, 10, 'y', 8, 'medium');
    expect(freeCaptionY(state, 0, 10, 8)).toBe(17);
  });

  it('skips past multiple stacked captions', () => {
    const state = createState(60);
    addCaption(state, 0, 10, 'x', 82, 'medium');
    addCaption(state, 0, 10, 'y', 73, 'medium');
    expect(freeCaptionY(state, 0, 10, 82)).toBe(64);
  });

  it('gives up and returns the preset when the frame is full', () => {
    const state = createState(60);
    for (let y = 0; y <= 90; y += 5) {
      addCaption(state, 0, 10, 'x', y, 'medium');
    }
    expect(freeCaptionY(state, 0, 10, 82)).toBe(82);
  });
});

describe('wrapCaptionLines', () => {
  const measure = (text: string) => text.length * 10;

  it('keeps short text on one line', () => {
    expect(wrapCaptionLines(measure, 'hello world', 200)).toEqual(['hello world']);
  });

  it('wraps at the widest line that fits', () => {
    expect(wrapCaptionLines(measure, 'aaa bbb ccc ddd', 79)).toEqual(['aaa bbb', 'ccc ddd']);
  });

  it('puts a single oversized word on its own line', () => {
    expect(wrapCaptionLines(measure, 'tiny incomprehensibilities tiny', 100)).toEqual([
      'tiny', 'incomprehensibilities', 'tiny',
    ]);
  });

  it('collapses runs of whitespace and returns no lines for blank text', () => {
    expect(wrapCaptionLines(measure, '  a   b  ', 300)).toEqual(['a b']);
    expect(wrapCaptionLines(measure, '   ', 300)).toEqual([]);
  });
});

describe('nearestIndex', () => {
  it('finds the index of the closest value', () => {
    expect(nearestIndex([1, 5, 9], 6)).toBe(1);
    expect(nearestIndex([1, 5, 9], 100)).toBe(2);
  });

  it('returns -1 for an empty list or all-Infinity values', () => {
    expect(nearestIndex([], 5)).toBe(-1);
    expect(nearestIndex([Infinity, Infinity], 5)).toBe(-1);
  });
});

describe('captionBlockTop', () => {
  it('leaves blocks that fit where they are', () => {
    expect(captionBlockTop(10, 20)).toBe(10);
  });

  it('shifts a block up so it stays inside the frame', () => {
    expect(captionBlockTop(90, 30)).toBe(68);
  });

  it('never goes above the top of the frame', () => {
    expect(captionBlockTop(10, 200)).toBe(0);
  });
});

describe('undo history', () => {
  it('commits a change and undoes it, redo restores it', () => {
    const state = createState(60);
    const history = createHistory();
    const before = snapshot(state);
    moveRegionEdge(state, 1, 'end', 20);
    expect(commitHistory(history, before, state)).toBe(true);
    expect(undo(history, state)).toBe(true);
    expect(state.regions[0].end).toBe(60);
    expect(redo(history, state)).toBe(true);
    expect(state.regions[0].end).toBe(20);
  });

  it('skips no-op commits', () => {
    const state = createState(60);
    const history = createHistory();
    expect(commitHistory(history, snapshot(state), state)).toBe(false);
    expect(history.undo).toHaveLength(0);
    expect(undo(history, state)).toBe(false);
  });

  it('a new commit clears the redo stack', () => {
    const state = createState(60);
    const history = createHistory();
    let before = snapshot(state);
    moveRegionEdge(state, 1, 'end', 20);
    commitHistory(history, before, state);
    undo(history, state);
    expect(history.redo).toHaveLength(1);
    before = snapshot(state);
    moveRegionEdge(state, 1, 'end', 30);
    commitHistory(history, before, state);
    expect(history.redo).toHaveLength(0);
    expect(redo(history, state)).toBe(false);
  });

  it('restores captions and stripAudio, and snapshots are isolated from later edits', () => {
    const state = createState(60);
    const history = createHistory();
    const caption = addCaption(state, 10, 20, 'x', 82, 'medium')!;
    let before = snapshot(state);
    state.stripAudio = true;
    setCaptionY(state, caption.id, 10);
    commitHistory(history, before, state);
    undo(history, state);
    expect(state.stripAudio).toBe(false);
    expect(state.captions[0].y).toBe(82);
    setCaptionY(state, state.captions[0].id, 40);
    expect(history.redo[0].captions[0].y).toBe(10);
  });

  it('caps the undo stack at UNDO_LIMIT entries', () => {
    const state = createState(600);
    const history = createHistory();
    for (let i = 0; i < UNDO_LIMIT + 20; i++) {
      const before = snapshot(state);
      moveRegionEdge(state, 1, 'end', 600 - i - 1);
      commitHistory(history, before, state);
    }
    expect(history.undo).toHaveLength(UNDO_LIMIT);
  });

  it('undoing keeps ids unique for later additions', () => {
    const state = createState(60);
    const history = createHistory();
    const before = snapshot(state);
    const added = addCaption(state, 10, 20, 'x', 82, 'medium')!;
    commitHistory(history, before, state);
    undo(history, state);
    const readded = addCaption(state, 30, 40, 'y', 82, 'medium')!;
    expect(readded.id).not.toBe(added.id);
  });
});

describe('projects', () => {
  const video = { name: 'clip.mp4', size: 1234, fingerprint: '1234-abc' };

  it('round-trips regions, captions, and settings through serialize/apply', () => {
    const state = createState(60);
    moveRegionEdge(state, 1, 'end', 20);
    const b = addRegion(state)!;
    addCaption(state, 5, 9, 'top text', 8, 'large');
    state.stripAudio = true;
    const project = serializeProject(state, 'my edit', 111, video, 'low');
    expect(project).toMatchObject({ name: 'my edit', savedAt: 111, video, quality: 'low', duration: 60 });

    const fresh = createState(60);
    applyProject(fresh, project);
    expect(fresh.regions.map(r => [r.start, r.end]))
      .toEqual(state.regions.map(r => [r.start, r.end]));
    expect(fresh.captions).toHaveLength(1);
    expect(fresh.captions[0]).toMatchObject({ start: 5, end: 9, text: 'top text', y: 8, size: 'large' });
    expect(fresh.stripAudio).toBe(true);
    expect(fresh.regions.some(r => r.id === b.id + 100)).toBe(false);
  });

  it('clamps project data into a shorter video and drops what no longer fits', () => {
    const state = createState(100);
    moveRegionEdge(state, 1, 'end', 30);
    const b = addRegion(state)!;
    moveRegionEdge(state, b.id, 'start', 80);
    moveRegionEdge(state, b.id, 'end', 95);
    addCaption(state, 10, 20, 'keep', 82, 'medium');
    addCaption(state, 90, 95, 'gone', 82, 'medium');
    const project = serializeProject(state, 'p', 1, video, 'medium');

    const shorter = createState(50);
    applyProject(shorter, project);
    expect(shorter.regions).toHaveLength(1);
    expect(shorter.regions[0]).toMatchObject({ start: 0, end: 30 });
    expect(shorter.captions).toHaveLength(1);
    expect(shorter.captions[0].text).toBe('keep');
  });

  it('resolves overlaps created by clamping and keeps ids unique', () => {
    const project = {
      name: 'p', savedAt: 1, video, duration: 100, quality: 'medium', stripAudio: false,
      regions: [{ start: 10, end: 45 }, { start: 44, end: 90 }],
      captions: [{ start: 0, end: 5, text: 'a', y: 82, size: 'medium' as const }],
    };
    const state = createState(50);
    applyProject(state, project);
    expect(state.regions.map(r => [r.start, r.end])).toEqual([[10, 45], [45, 50]]);
    const ids = [...state.regions.map(r => r.id), ...state.captions.map(c => c.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.nextId).toBeGreaterThan(Math.max(...ids));
  });

  it('tolerates junk fields in a stored project', () => {
    const state = createState(60);
    applyProject(state, {
      name: 'junk', savedAt: 1, video, duration: 60, quality: 'nope', stripAudio: 1 as any,
      regions: [{ start: NaN, end: 20 }, { start: 30, end: 30.01 }],
      captions: [
        { start: 5, end: 10, text: '  ', y: 82, size: 'medium' },
        { start: 5, end: 10, text: 'ok', y: 400, size: 'huge' as any },
      ],
    });
    expect(state.regions).toEqual([{ id: 1, start: 0, end: 20 }]);
    expect(state.captions).toHaveLength(1);
    expect(state.captions[0]).toMatchObject({ text: 'ok', y: 90, size: 'medium' });
    expect(state.stripAudio).toBe(true);
  });
});
