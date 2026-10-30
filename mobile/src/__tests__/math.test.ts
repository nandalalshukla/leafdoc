import { describe, expect, it } from '@jest/globals';

import { normalizedEntropy, softmax, topK } from '../ml/math';

describe('softmax', () => {
  it('sums to 1 and preserves order', () => {
    const p = softmax([1, 2, 3]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(p[2]).toBeGreaterThan(p[1]!);
    expect(p[1]).toBeGreaterThan(p[0]!);
  });

  it('is stable for large logits', () => {
    const p = softmax([1000, 1001, 999]);
    expect(Array.from(p).every(Number.isFinite)).toBe(true);
    expect(p[1]).toBeCloseTo(0.6652, 3);
  });

  it('higher temperature flattens the distribution', () => {
    const sharp = softmax([0, 2, 4], 1);
    const soft = softmax([0, 2, 4], 2);
    expect(soft[2]).toBeLessThan(sharp[2]!);
    expect(soft[0]).toBeGreaterThan(sharp[0]!);
  });

  it('falls back to T=1 for invalid temperatures', () => {
    expect(Array.from(softmax([1, 2], 0))).toEqual(Array.from(softmax([1, 2], 1)));
    expect(Array.from(softmax([1, 2], NaN))).toEqual(Array.from(softmax([1, 2], 1)));
  });
});

describe('topK', () => {
  it('returns indices of the largest values, highest first', () => {
    expect(topK([0.1, 0.5, 0.2, 0.9], 3)).toEqual([3, 1, 2]);
  });
  it('handles k larger than the input', () => {
    expect(topK([0.2, 0.1], 5)).toEqual([0, 1]);
  });
});

describe('normalizedEntropy', () => {
  it('is 0 for a one-hot and 1 for uniform', () => {
    expect(normalizedEntropy([1, 0, 0])).toBeCloseTo(0);
    expect(normalizedEntropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(1);
  });
});
