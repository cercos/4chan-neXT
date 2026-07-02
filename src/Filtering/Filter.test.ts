import { describe, expect, it, vi } from 'vitest';

// Filter's import graph reaches Main through Callbacks/Menu/Settings, and Main's
// module-scope feature registry trips over the import cycle outside the rollup
// bundle. The functions under test never touch Main, so stub it out.
vi.mock('../main/Main', () => ({
  default: { handleErrors: () => {}, features: [] },
}));

import Filter from './Filter';

// normalizeEasyRule returns null only for non-objects; assert that away for the
// object-input tests.
const normalize = (rule: Record<string, unknown>) => Filter.normalizeEasyRule(rule)!;

describe('Filter.normalizeEasyRule', () => {
  it('rejects non-objects', () => {
    expect(Filter.normalizeEasyRule(null)).toBeNull();
    expect(Filter.normalizeEasyRule('nope')).toBeNull();
  });

  it('fills defaults for an empty rule', () => {
    expect(normalize({})).toEqual({
      enabled: true,
      pattern: '',
      boards: '',
      type: 'general',
      color: '#dd0000',
      colorOn: false,
      hlClass: '',
      auto: false,
      hide: true,
      override: false,
      action: undefined,
      caseSensitive: false,
    });
  });

  it('maps legacy field names to filter types', () => {
    expect(normalize({ field: 'title' }).type).toBe('subject');
    expect(normalize({ field: 'body' }).type).toBe('comment');
    expect(normalize({ field: 'name' }).type).toBe('name');
  });

  it('accepts hex colors with or without # and turns the swatch on', () => {
    const rule = normalize({ color: 'DD00FF' });
    expect(rule.color).toBe('#dd00ff');
    expect(rule.colorOn).toBe(true);
  });

  it('migrates a legacy class name stored in color to hlClass', () => {
    const rule = normalize({ color: '.my-class' });
    expect(rule.hlClass).toBe('my-class');
    expect(rule.color).toBe('#dd0000');
    expect(rule.colorOn).toBe(false);
  });

  it('sanitizes hlClass to css-class characters', () => {
    expect(normalize({ hlClass: '..foo.bar!baz' }).hlClass).toBe('foobarbaz');
  });

  it('infers hide from the action', () => {
    expect(normalize({ action: 'highlight' }).hide).toBe(false);
    expect(normalize({ action: 'notify' }).hide).toBe(false);
    expect(normalize({ action: 'hide' }).hide).toBe(true);
    expect(normalize({ action: 'highlight', hide: true }).hide).toBe(true);
  });
});

describe('Filter.parseEasyFilterRules', () => {
  it('parses a JSON string of rules', () => {
    const rules = Filter.parseEasyFilterRules('[{"pattern": "foo"}]');
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).toBe('foo');
  });

  it('accepts an already-parsed array', () => {
    expect(Filter.parseEasyFilterRules([{ pattern: 'x' }])).toHaveLength(1);
  });

  it('returns an empty list for garbage', () => {
    expect(Filter.parseEasyFilterRules('not json')).toEqual([]);
    expect(Filter.parseEasyFilterRules('{"a": 1}')).toEqual([]);
    expect(Filter.parseEasyFilterRules(undefined)).toEqual([]);
    expect(Filter.parseEasyFilterRules('')).toEqual([]);
  });
});

describe('Filter.easyHighlightClasses', () => {
  it('combines the generated color class and the custom class', () => {
    expect(Filter.easyHighlightClasses({ colorOn: true, color: '#aabbcc', hlClass: 'mine' }))
      .toEqual(['xt-hl-aabbcc', 'mine']);
    expect(Filter.easyHighlightClasses({ colorOn: false, color: '#aabbcc', hlClass: '' }))
      .toEqual([]);
  });
});

describe('Filter.easyRuleToLine', () => {
  it('skips disabled rules and empty patterns', () => {
    expect(Filter.easyRuleToLine(normalize({ pattern: 'foo', enabled: false }))).toBeNull();
    expect(Filter.easyRuleToLine(normalize({ pattern: '   ' }))).toBeNull();
  });

  it('builds a hide line with the general type expansion', () => {
    expect(Filter.easyRuleToLine(normalize({ pattern: 'foo' })))
      .toBe('/foo/i;type:subject,name,comment');
  });

  it('respects case sensitivity and boards', () => {
    expect(Filter.easyRuleToLine(normalize({ pattern: 'foo', caseSensitive: true, boards: 'g,a' })))
      .toBe('/foo/;boards:g,a;type:subject,name,comment');
  });

  it('escapes regex metacharacters in the pattern', () => {
    const line = Filter.easyRuleToLine(normalize({ pattern: 'f.o (bar)' }));
    expect(line).toContain('/f\\.o \\(bar\\)/i');
  });

  it('builds highlight lines with color class, top and override', () => {
    const line = Filter.easyRuleToLine(normalize({
      pattern: 'foo', action: 'highlight', color: '#aabbcc', auto: true, override: true,
    }));
    expect(line).toBe('/foo/i;type:subject,name,comment;highlight:xt-hl-aabbcc;top:yes;override');
  });

  it('appends notify', () => {
    const line = Filter.easyRuleToLine(normalize({ pattern: 'foo', action: 'notify' }));
    expect(line).toBe('/foo/i;type:subject,name,comment;highlight;top:no;notify');
  });
});
