import { describe, expect, it } from 'vitest';
import { backAction, canDrill, chipLabel, countBacklinks, rootTitle, tapAction } from './MobileRepliesLogic';

describe('countBacklinks', () => {
  it('counts elements with the backlink class', () => {
    expect(countBacklinks(['backlink', 'backlink', 'backlink'])).toBe(3);
  });

  it('counts filtered backlinks', () => {
    expect(countBacklinks(['backlink filtered', 'backlink'])).toBe(2);
  });

  it('ignores hashlinks and other elements', () => {
    expect(countBacklinks(['backlink', 'hashlink', 'backlink filtered', 'hashlink filtered'])).toBe(2);
  });

  it('does not match classes that merely contain the word', () => {
    expect(countBacklinks(['backlinkish', 'not-a-backlink'])).toBe(0);
  });

  it('returns zero for an empty container', () => {
    expect(countBacklinks([])).toBe(0);
  });
});

describe('tapAction', () => {
  it('does nothing without replies', () => {
    expect(tapAction(0)).toBe('none');
  });

  it('opens the popup for any reply count', () => {
    expect(tapAction(1)).toBe('popup');
    expect(tapAction(2)).toBe('popup');
    expect(tapAction(150)).toBe('popup');
  });
});

describe('backAction', () => {
  it('pops when there is a trail to go back through', () => {
    expect(backAction(3)).toBe('pop');
    expect(backAction(2)).toBe('pop');
  });

  it('closes the popup from the first screen', () => {
    expect(backAction(1)).toBe('close');
    expect(backAction(0)).toBe('close');
  });
});

describe('canDrill', () => {
  it('allows posts not yet in the trail', () => {
    expect(canDrill(['g.100', 'g.200'], 'g.300')).toBe(true);
  });

  it('blocks the root view from reopening', () => {
    expect(canDrill(['g.100'], 'g.100')).toBe(false);
  });

  it('blocks any view already in the trail', () => {
    expect(canDrill(['g.100', 'g.200', 'g.300'], 'g.200')).toBe(false);
  });
});

describe('rootTitle', () => {
  it('pluralizes the reply count', () => {
    expect(rootTitle(1)).toBe('1 reply');
    expect(rootTitle(5)).toBe('5 replies');
  });
});

describe('chipLabel', () => {
  it('shows the count', () => {
    expect(chipLabel(1)).toBe('1');
    expect(chipLabel(42)).toBe('42');
  });

  it('caps the label at 99+', () => {
    expect(chipLabel(99)).toBe('99');
    expect(chipLabel(100)).toBe('99+');
    expect(chipLabel(358)).toBe('99+');
  });
});
