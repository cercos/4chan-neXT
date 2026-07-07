export type CaptionPosition = 'top' | 'bottom';
export type CaptionSize = 'small' | 'medium' | 'large';

export const MIN_REGION_LENGTH = 0.1;
const MIN_ADD_GAP = 0.4;

export interface DogiriRegion {
  id: number;
  start: number;
  end: number;
}

export const CAPTION_Y_MAX = 90;
export const POSITION_PRESETS: Record<CaptionPosition, number> = { top: 8, bottom: 82 };
export const SIZE_FRACTIONS: Record<CaptionSize, number> = { small: 0.045, medium: 0.065, large: 0.09 };
export const CAPTION_LINE_HEIGHT = 1.2;
export const CAPTION_MAX_WIDTH_FRACTION = 0.94;

export interface DogiriCaption {
  id: number;
  start: number;
  end: number;
  text: string;
  y: number;
  size: CaptionSize;
}

export interface DogiriState {
  duration: number;
  regions: DogiriRegion[];
  captions: DogiriCaption[];
  stripAudio: boolean;
  nextId: number;
}

export function createState(duration: number): DogiriState {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  return {
    duration: safeDuration,
    regions: safeDuration > 0 ? [{ id: 1, start: 0, end: safeDuration }] : [],
    captions: [],
    stripAudio: false,
    nextId: 2,
  };
}

export function resetState(state: DogiriState): void {
  Object.assign(state, createState(state.duration));
}

export function formatTime(seconds: number, tenths = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) { seconds = 0; }
  if (tenths) {
    const total = Math.round(seconds * 10);
    const whole = Math.floor(total / 10);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${total % 10}`;
  }
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function parseTime(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) { return null; }
  const parts = trimmed.split(':');
  if (parts.length > 3) { return null; }
  let seconds = 0;
  for (let i = 0; i < parts.length; i++) {
    const pattern = i === parts.length - 1 ? /^(\d+(\.\d+)?|\.\d+)$/ : /^\d+$/;
    if (!pattern.test(parts[i])) { return null; }
    seconds = seconds * 60 + parseFloat(parts[i]);
  }
  return seconds;
}

const clampValue = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);

function regionIndex(state: DogiriState, id: number): number {
  return state.regions.findIndex(region => region.id === id);
}

export function addRegion(state: DogiriState): DogiriRegion | null {
  if (state.duration <= 0) { return null; }
  let gapStart = 0;
  let bestStart = 0;
  let bestLength = 0;
  for (const region of state.regions) {
    if (region.start - gapStart > bestLength) {
      bestLength = region.start - gapStart;
      bestStart = gapStart;
    }
    gapStart = region.end;
  }
  if (state.duration - gapStart > bestLength) {
    bestLength = state.duration - gapStart;
    bestStart = gapStart;
  }
  if (bestLength < MIN_ADD_GAP) { return null; }
  const inset = bestLength / 4;
  const region: DogiriRegion = {
    id: state.nextId++,
    start: bestStart + inset,
    end: bestStart + bestLength - inset,
  };
  state.regions.push(region);
  state.regions.sort((a, b) => a.start - b.start);
  return region;
}

export function removeRegion(state: DogiriState, id: number): void {
  state.regions = state.regions.filter(region => region.id !== id);
}

export function removeRegions(state: DogiriState, ids: number[]): number {
  const drop = new Set(ids);
  const before = state.regions.length;
  state.regions = state.regions.filter(region => !drop.has(region.id));
  return before - state.regions.length;
}

export function keepRegions(state: DogiriState, ids: number[]): number {
  const keep = new Set(ids);
  const before = state.regions.length;
  state.regions = state.regions.filter(region => keep.has(region.id));
  return before - state.regions.length;
}

export function mergeRegions(state: DogiriState, ids: number[]): DogiriRegion | null {
  const chosen = new Set(ids);
  const selected = state.regions.filter(region => chosen.has(region.id));
  if (selected.length < 2) { return null; }
  const start = Math.min(...selected.map(region => region.start));
  const end = Math.max(...selected.map(region => region.end));
  state.regions = state.regions.filter(region => region.end <= start || region.start >= end);
  const merged: DogiriRegion = { id: state.nextId++, start, end };
  state.regions.push(merged);
  state.regions.sort((a, b) => a.start - b.start);
  return merged;
}

export function moveRegionEdge(state: DogiriState, id: number, edge: 'start' | 'end', time: number): void {
  const index = regionIndex(state, id);
  if (index < 0) { return; }
  const region = state.regions[index];
  if (edge === 'start') {
    const lo = index > 0 ? state.regions[index - 1].end : 0;
    const hi = region.end - MIN_REGION_LENGTH;
    region.start = clampValue(time, lo, Math.max(lo, hi));
  } else {
    const hi = index < state.regions.length - 1 ? state.regions[index + 1].start : state.duration;
    const lo = region.start + MIN_REGION_LENGTH;
    region.end = clampValue(time, Math.min(lo, hi), hi);
  }
}

export function moveRegion(state: DogiriState, id: number, start: number): void {
  const index = regionIndex(state, id);
  if (index < 0) { return; }
  const region = state.regions[index];
  const length = region.end - region.start;
  const lo = index > 0 ? state.regions[index - 1].end : 0;
  const hi = (index < state.regions.length - 1 ? state.regions[index + 1].start : state.duration) - length;
  region.start = clampValue(start, lo, Math.max(lo, hi));
  region.end = region.start + length;
}

export function moveRegionFree(state: DogiriState, id: number, start: number): void {
  const region = state.regions.find(existing => existing.id === id);
  if (!region) { return; }
  const length = region.end - region.start;
  region.start = clampValue(start, 0, Math.max(0, state.duration - length));
  region.end = region.start + length;
  state.regions.sort((a, b) => a.start - b.start);
}

export function settleRegion(
  state: DogiriState, id: number, fallback: { start: number, end: number },
): void {
  const region = state.regions.find(existing => existing.id === id);
  if (!region) { return; }
  const length = region.end - region.start;
  const overlapsOther = () => state.regions.find(other =>
    other.id !== id && other.start < region.end && other.end > region.start);
  let guard = state.regions.length + 2;
  while (guard-- > 0) {
    const other = overlapsOther();
    if (!other) { break; }
    const center = (region.start + region.end) / 2;
    const otherCenter = (other.start + other.end) / 2;
    if (center < otherCenter) {
      region.end = other.start;
      region.start = region.end - length;
    } else {
      region.start = other.end;
      region.end = region.start + length;
    }
    if (region.start < 0) {
      region.start = 0;
      region.end = length;
    } else if (region.end > state.duration) {
      region.end = state.duration;
      region.start = state.duration - length;
    }
  }
  if (overlapsOther() || region.start < 0 || region.end > state.duration) {
    region.start = fallback.start;
    region.end = fallback.end;
  }
  state.regions.sort((a, b) => a.start - b.start);
}

export function totalClipped(state: DogiriState): number {
  return state.regions.reduce((sum, region) => sum + (region.end - region.start), 0);
}

export function estimatedClippedBytes(state: DogiriState, totalBytes: number): number {
  if (state.duration <= 0) { return 0; }
  return Math.round(totalBytes * (totalClipped(state) / state.duration));
}

export function inRegion(state: DogiriState, time: number): boolean {
  return state.regions.some(region => time >= region.start && time < region.end);
}

export function nextRegionStart(state: DogiriState, time: number): number | null {
  for (const region of state.regions) {
    if (region.start > time) { return region.start; }
  }
  return null;
}

export function addCaption(
  state: DogiriState, start: number, end: number, text: string, y: number, size: CaptionSize,
): DogiriCaption | null {
  text = text.trim();
  start = clampValue(start, 0, state.duration);
  end = clampValue(end, 0, state.duration);
  if (start > end) { [start, end] = [end, start]; }
  if (!text || end - start <= 0) { return null; }
  const caption: DogiriCaption = {
    id: state.nextId++, start, end, text, y: clampValue(y, 0, CAPTION_Y_MAX), size,
  };
  state.captions.push(caption);
  return caption;
}

export function updateCaption(
  state: DogiriState, id: number, text: string, size: CaptionSize,
  range?: { start: number, end: number }, y?: number,
): DogiriCaption | null {
  const caption = state.captions.find(existing => existing.id === id);
  text = text.trim();
  if (!caption || !text) { return null; }
  caption.text = text;
  caption.size = size;
  if (y != null) { caption.y = clampValue(y, 0, CAPTION_Y_MAX); }
  if (range) {
    let start = clampValue(range.start, 0, state.duration);
    let end = clampValue(range.end, 0, state.duration);
    if (start > end) { [start, end] = [end, start]; }
    if (end - start > 0) {
      caption.start = start;
      caption.end = end;
    }
  }
  return caption;
}

export function setCaptionY(state: DogiriState, id: number, y: number): void {
  const caption = state.captions.find(existing => existing.id === id);
  if (caption) { caption.y = clampValue(y, 0, CAPTION_Y_MAX); }
}

export function moveCaptionEdge(state: DogiriState, id: number, edge: 'start' | 'end', time: number): void {
  const caption = state.captions.find(existing => existing.id === id);
  if (!caption) { return; }
  if (edge === 'start') {
    caption.start = clampValue(time, 0, Math.max(0, caption.end - MIN_REGION_LENGTH));
  } else {
    caption.end = clampValue(time, Math.min(caption.start + MIN_REGION_LENGTH, state.duration), state.duration);
  }
}

export function moveCaption(state: DogiriState, id: number, start: number): void {
  const caption = state.captions.find(existing => existing.id === id);
  if (!caption) { return; }
  const length = caption.end - caption.start;
  caption.start = clampValue(start, 0, Math.max(0, state.duration - length));
  caption.end = caption.start + length;
}

export function removeCaption(state: DogiriState, id: number): void {
  state.captions = state.captions.filter(caption => caption.id !== id);
}

export function captionAt(state: DogiriState, time: number): DogiriCaption | null {
  for (let i = state.captions.length - 1; i >= 0; i--) {
    const caption = state.captions[i];
    if (time >= caption.start && time < caption.end) { return caption; }
  }
  return null;
}

export function captionsAt(state: DogiriState, time: number): DogiriCaption[] {
  return state.captions.filter(caption => time >= caption.start && time < caption.end);
}

export function captionLaneLevels(state: DogiriState): { levels: Map<number, number>, rows: number } {
  const levels = new Map<number, number>();
  const rowEnds: number[] = [];
  const sorted = [...state.captions].sort((a, b) => a.start - b.start || a.id - b.id);
  for (const caption of sorted) {
    let row = rowEnds.findIndex(end => caption.start >= end);
    if (row < 0) {
      row = rowEnds.length;
      rowEnds.push(0);
    }
    rowEnds[row] = caption.end;
    levels.set(caption.id, row);
  }
  return { levels, rows: Math.max(1, rowEnds.length) };
}

const CAPTION_Y_CLEARANCE = 9;

export function freeCaptionY(state: DogiriState, start: number, end: number, y: number): number {
  const collides = (candidate: number) => state.captions.some(caption =>
    caption.start < end && caption.end > start && Math.abs(caption.y - candidate) < CAPTION_Y_CLEARANCE);
  if (!collides(y)) { return y; }
  const step = y >= 50 ? -CAPTION_Y_CLEARANCE : CAPTION_Y_CLEARANCE;
  for (let candidate = y + step; candidate >= 0 && candidate <= CAPTION_Y_MAX; candidate += step) {
    if (!collides(candidate)) { return candidate; }
  }
  return y;
}

export function wrapCaptionLines(
  measure: (text: string) => number, text: string, maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) { lines.push(line); }
  return lines;
}

export function captionBlockTop(y: number, blockHeightPct: number): number {
  return Math.max(0, Math.min(y, 98 - blockHeightPct));
}

export function nearestIndex(values: number[], target: number): number {
  let best = -1;
  let bestDistance = Infinity;
  values.forEach((value, index) => {
    const distance = Math.abs(value - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

export interface DogiriProjectVideo {
  name: string;
  size: number;
  fingerprint: string;
}

export interface DogiriProject {
  name: string;
  savedAt: number;
  video: DogiriProjectVideo;
  duration: number;
  regions: { start: number, end: number }[];
  captions: { start: number, end: number, text: string, y: number, size: CaptionSize }[];
  stripAudio: boolean;
  quality: string;
  restored?: boolean;
}

export function serializeProject(
  state: DogiriState, name: string, savedAt: number, video: DogiriProjectVideo, quality: string,
): DogiriProject {
  return {
    name,
    savedAt,
    video,
    quality,
    duration: state.duration,
    regions: state.regions.map(region => ({ start: region.start, end: region.end })),
    captions: state.captions.map(caption => ({
      start: caption.start, end: caption.end, text: caption.text, y: caption.y, size: caption.size,
    })),
    stripAudio: state.stripAudio,
  };
}

const CAPTION_SIZES: CaptionSize[] = ['small', 'medium', 'large'];

export function applyProject(state: DogiriState, project: DogiriProject): void {
  const { duration } = state;
  state.regions = [];
  state.captions = [];
  state.nextId = 1;
  let prevEnd = 0;
  const regions = [...(project.regions || [])].sort((a, b) => a.start - b.start);
  for (const raw of regions) {
    const start = Math.max(clampValue(+raw.start || 0, 0, duration), prevEnd);
    const end = clampValue(+raw.end || 0, 0, duration);
    if (end - start < MIN_REGION_LENGTH) { continue; }
    state.regions.push({ id: state.nextId++, start, end });
    prevEnd = end;
  }
  for (const raw of project.captions || []) {
    const start = clampValue(+raw.start || 0, 0, duration);
    const end = clampValue(+raw.end || 0, 0, duration);
    const text = String(raw.text || '').trim();
    if (!text || end - start <= 0) { continue; }
    state.captions.push({
      id: state.nextId++,
      start,
      end,
      text,
      y: clampValue(+raw.y || 0, 0, CAPTION_Y_MAX),
      size: CAPTION_SIZES.includes(raw.size) ? raw.size : 'medium',
    });
  }
  state.stripAudio = !!project.stripAudio;
}

export interface DogiriSnapshot {
  regions: DogiriRegion[];
  captions: DogiriCaption[];
  stripAudio: boolean;
}

export interface DogiriHistory {
  undo: DogiriSnapshot[];
  redo: DogiriSnapshot[];
}

export const UNDO_LIMIT = 100;

export function createHistory(): DogiriHistory {
  return { undo: [], redo: [] };
}

export function snapshot(state: DogiriState): DogiriSnapshot {
  return {
    regions: state.regions.map(region => ({ ...region })),
    captions: state.captions.map(caption => ({ ...caption })),
    stripAudio: state.stripAudio,
  };
}

function applySnapshot(state: DogiriState, snap: DogiriSnapshot): void {
  state.regions = snap.regions.map(region => ({ ...region }));
  state.captions = snap.captions.map(caption => ({ ...caption }));
  state.stripAudio = snap.stripAudio;
}

function sameSnapshot(a: DogiriSnapshot, b: DogiriSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function commitHistory(history: DogiriHistory, before: DogiriSnapshot, state: DogiriState): boolean {
  if (sameSnapshot(before, snapshot(state))) { return false; }
  history.undo.push(before);
  if (history.undo.length > UNDO_LIMIT) { history.undo.shift(); }
  history.redo.length = 0;
  return true;
}

export function undo(history: DogiriHistory, state: DogiriState): boolean {
  const snap = history.undo.pop();
  if (!snap) { return false; }
  history.redo.push(snapshot(state));
  applySnapshot(state, snap);
  return true;
}

export function redo(history: DogiriHistory, state: DogiriState): boolean {
  const snap = history.redo.pop();
  if (!snap) { return false; }
  history.undo.push(snapshot(state));
  applySnapshot(state, snap);
  return true;
}
