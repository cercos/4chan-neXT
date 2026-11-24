import { describe, expect, it } from 'vitest';
import { fnv1a32, inputSize, promptImageB64, rgbaToChw, softmax, stripTags, tokenize } from './CaptchaBrowserSolverLogic';

describe('tokenizer (must match tools/captcha-model data.py)', () => {
  it('hashes like the Python fnv1a32', () => {
    expect(fnv1a32('hello')).toBe(1335831723);
    expect(fnv1a32('Next')).toBe(3705854472);
  });

  it('tokenizes the real prompt the same as Python', () => {
    const s = 'Use the scroll bar below to find the image that <b>not like the others</b>, then click Next.';
    expect(tokenize(stripTags(s))).toEqual([245, 541, 557, 283, 243, 37, 347, 541, 507, 813, 139, 823, 541, 499, 375, 112]);
  });

  it('pads to 16 tokens', () => {
    expect(tokenize('')).toEqual(new Array(16).fill(0));
  });
});

describe('promptImageB64', () => {
  it('prefers task.img, else the first data: image in the prompt html', () => {
    expect(promptImageB64({ img: 'AAA', str: '<img src="data:image/png;base64,BBB">' })).toBe('AAA');
    expect(promptImageB64({ str: 'find <img src="data:image/png;base64,BBB"> this' })).toBe('BBB');
    expect(promptImageB64({ str: 'no image' })).toBeNull();
  });
});

describe('inputSize', () => {
  it('keeps wide strips at their aspect ratio, squares everything else', () => {
    expect(inputSize(300, 80)).toEqual([360, 96]);
    expect(inputSize(80, 80)).toEqual([96, 96]);
    expect(inputSize(60, 60)).toEqual([96, 96]);
  });
});

describe('softmax / rgbaToChw', () => {
  it('softmax sums to 1 and keeps order', () => {
    const p = softmax([1, 3, 2]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(p.indexOf(Math.max(...p))).toBe(1);
  });

  it('normalizes RGBA pixels into ImageNet-normalized CHW', () => {
    const out = rgbaToChw([255, 255, 255, 255, 0, 0, 0, 255], 2, 1);
    expect(out.length).toBe(6);
    expect(out[0]).toBeCloseTo((1 - 0.485) / 0.229);
    expect(out[1]).toBeCloseTo((0 - 0.485) / 0.229);
    expect(out[2]).toBeCloseTo((1 - 0.456) / 0.224);
  });
});
