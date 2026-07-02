import { describe, expect, it } from 'vitest';
import { E, g } from './globals';

describe('E (HTML escaper)', () => {
  it('escapes the five HTML-sensitive characters', () => {
    expect(E(`<a href="x">Tom & Jerry's</a>`))
      .toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#039;s&lt;/a&gt;');
  });

  it('leaves safe text untouched', () => {
    expect(E('plain text 123')).toBe('plain text 123');
  });

  it('cat concatenates template innerHTML', () => {
    const a = document.createElement('template');
    a.innerHTML = '<b>one</b>';
    const b = document.createElement('template');
    b.innerHTML = '<i>two</i>';
    expect(E.cat([a, b])).toBe('<b>one</b><i>two</i>');
  });
});

describe('g', () => {
  it('exposes the script namespace and version', () => {
    expect(g.NAMESPACE).toBe('4chan-neXT');
    expect(typeof g.VERSION).toBe('string');
    expect(g.VERSION_DATE).toBeInstanceOf(Date);
  });
});
