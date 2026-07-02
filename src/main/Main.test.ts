import { describe, expect, it } from 'vitest';
import Main from './Main';

// Minimal stand-ins for g.SITE-shaped objects; parseURL only calls these hooks.
const yotsubaLike = {
  ID: 'boards.4chan.org',
  isFileURL: (url: URL) => url.hostname === 'i.4cdn.org',
} as any;

const parse = (href: string, site = yotsubaLike) =>
  Main.parseURL(site, new URL(href) as unknown as Location);

describe('Main.parseURL', () => {
  it('returns an empty object without a site', () => {
    expect(Main.parseURL(undefined, new URL('https://example.com/') as unknown as Location))
      .toEqual({});
  });

  it('parses a thread URL', () => {
    expect(parse('https://boards.4chan.org/g/thread/104028493/ptg')).toEqual({
      siteID: 'boards.4chan.org',
      boardID: 'g',
      VIEW: 'thread',
      threadID: 104028493,
      THREADID: 104028493,
    });
  });

  it('strips a file extension from the thread ID', () => {
    const result = parse('https://boards.4chan.org/g/thread/104028493.json');
    expect(result.threadID).toBe(104028493);
  });

  it('parses an archived thread URL', () => {
    expect(parse('https://boards.4chan.org/g/archive/res/1234.html')).toMatchObject({
      boardID: 'g',
      VIEW: 'thread',
      threadID: 1234,
      threadArchived: true,
    });
  });

  it('parses catalog and archive views', () => {
    expect(parse('https://boards.4chan.org/g/catalog').VIEW).toBe('catalog');
    expect(parse('https://boards.4chan.org/g/archive').VIEW).toBe('archive');
  });

  it('parses index views with and without page numbers', () => {
    expect(parse('https://boards.4chan.org/g/').VIEW).toBe('index');
    expect(parse('https://boards.4chan.org/g/2').VIEW).toBe('index');
    expect(parse('https://boards.4chan.org/g/index.html').VIEW).toBe('index');
  });

  it('parses file URLs', () => {
    expect(parse('https://i.4cdn.org/g/1234.png')).toMatchObject({
      boardID: 'g',
      VIEW: 'file',
    });
  });

  it('stops at the site for boardless pages', () => {
    const site = { ...yotsubaLike, isBoardlessPage: () => true };
    expect(parse('https://boards.4chan.org/', site)).toEqual({ siteID: 'boards.4chan.org' });
  });

  it('sets no VIEW for auxiliary pages', () => {
    const site = { ...yotsubaLike, isAuxiliaryPage: () => true };
    const result = parse('https://boards.4chan.org/g/whatever', site);
    expect(result.boardID).toBe('g');
    expect(result.VIEW).toBeUndefined();
  });
});
