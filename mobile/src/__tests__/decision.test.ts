import { describe, expect, it } from '@jest/globals';

import { decide, predictionsFromLogits } from '../ml/decision';
import type { ImageQuality, ModelMeta } from '../ml/types';
import meta from '../../assets/model/model-meta.json';

const GOOD: ImageQuality = { brightness: 120, sharpness: 300, plantCoverage: 0.6 };
const THRESH = { confidenceThreshold: 0.6, minMargin: 0.15 };
const pred = (...ps: number[]) => ps.map((probability, i) => ({ label: `L${i}`, probability }));

describe('decide', () => {
  it('is confident with a clear, high-probability winner', () => {
    expect(decide(pred(0.9, 0.05, 0.02), GOOD, THRESH)).toEqual({ status: 'confident', reasons: [] });
  });

  it('is unsure below the confidence threshold', () => {
    const r = decide(pred(0.45, 0.2, 0.1), GOOD, THRESH);
    expect(r.status).toBe('unsure');
    expect(r.reasons).toContain('low_confidence');
  });

  it('is unsure when the top two are too close', () => {
    const r = decide(pred(0.62, 0.55, 0.01), GOOD, THRESH);
    expect(r.status).toBe('unsure');
    expect(r.reasons).toEqual(['ambiguous']);
  });

  it('asks for a retake on bad exposure even when confident', () => {
    const r = decide(pred(0.95, 0.01), { ...GOOD, brightness: 10 }, THRESH);
    expect(r.status).toBe('retake');
    expect(r.reasons).toContain('too_dark');
  });

  it('asks for a retake when no leaf is visible and the model is unsure', () => {
    const r = decide(pred(0.4, 0.3), { ...GOOD, plantCoverage: 0.02 }, THRESH);
    expect(r.status).toBe('retake');
    expect(r.reasons).toEqual(expect.arrayContaining(['no_leaf', 'low_confidence']));
  });

  it('keeps a confident result but records a blur warning', () => {
    const r = decide(pred(0.92, 0.03), { ...GOOD, sharpness: 5 }, THRESH);
    expect(r.status).toBe('confident');
    expect(r.reasons).toEqual(['blurry']);
  });
});

describe('predictionsFromLogits', () => {
  const m = meta as ModelMeta;

  it('maps logits to knowledge-base entries in label order', () => {
    const logits = new Float32Array(m.labels.length).fill(0);
    const idx = m.labels.indexOf('Tomato___Late_blight');
    logits[idx] = 10;
    const [top] = predictionsFromLogits(logits, m);
    expect(top?.label).toBe('Tomato___Late_blight');
    expect(top?.diseaseId).toBe('tomato_late_blight');
    expect(top?.probability).toBeGreaterThan(0.99);
  });

  it('applies the calibration temperature', () => {
    const logits = new Float32Array(m.labels.length).fill(0);
    logits[0] = 4;
    const hot = predictionsFromLogits(logits, { ...m, temperature: 3 })[0]!.probability;
    const cold = predictionsFromLogits(logits, { ...m, temperature: 1 })[0]!.probability;
    expect(hot).toBeLessThan(cold);
  });

  it('rejects a model whose output size does not match the labels', () => {
    expect(() => predictionsFromLogits(new Float32Array(5), m)).toThrow(/labels/);
  });
});
