import { describe, expect, it } from '@jest/globals';

import { bestDetection, detectionToCrop, letterboxToNCHW } from '../ml/detector';

describe('bestDetection', () => {
  // Layout [1, 5, N]: rows are cx, cy, w, h, score.
  const anchors = 3;
  const out = new Float32Array([
    100, 160, 50, // cx
    100, 160, 50, // cy
    40, 200, 10, // w
    40, 100, 10, // h
    0.2, 0.9, 0.5, // score
  ]);

  it('picks the highest-scoring box and normalises it', () => {
    const box = bestDetection(out, [1, 5, anchors], 320, 0.35)!;
    expect(box.score).toBeCloseTo(0.9);
    expect(box.x).toBeCloseTo((160 - 100) / 320);
    expect(box.y).toBeCloseTo((160 - 50) / 320);
    expect(box.width).toBeCloseTo(200 / 320);
    expect(box.height).toBeCloseTo(100 / 320);
  });

  it('returns null when nothing beats the threshold', () => {
    expect(bestDetection(out, [1, 5, anchors], 320, 0.95)).toBeNull();
  });

  it('returns null for malformed outputs', () => {
    expect(bestDetection(out, [1, 3, anchors], 320, 0.1)).toBeNull();
  });
});

describe('detectionToCrop', () => {
  it('maps a letterboxed box back to the photo as a padded square', () => {
    // 640×480 photo → scale 0.5 into 320×240, padded 40px top/bottom.
    const box = { x: 100 / 320, y: 90 / 320, width: 100 / 320, height: 60 / 320, score: 0.9 };
    const crop = detectionToCrop(box, { scale: 0.5, padX: 0, padY: 40, inputSize: 320 }, 640, 480, 0.1, 0.1)!;
    // Box in photo: x 200..400, y 100..220 → 200 wide, side = 240, centred on (300,160).
    expect(crop).toEqual({ originX: 180, originY: 40, width: 240, height: 240 });
  });

  it('ignores tiny boxes', () => {
    const box = { x: 0.5, y: 0.5, width: 0.01, height: 0.01, score: 0.9 };
    expect(detectionToCrop(box, { scale: 1, padX: 0, padY: 0, inputSize: 320 }, 320, 320, 0.1, 0.15)).toBeNull();
  });

  it('keeps the crop inside the image', () => {
    const box = { x: 0.9, y: 0.9, width: 0.3, height: 0.3, score: 0.9 };
    const c = detectionToCrop(box, { scale: 1, padX: 0, padY: 0, inputSize: 320 }, 320, 320, 0.1, 0.1)!;
    expect(c.originX + c.width).toBeLessThanOrEqual(320);
    expect(c.originY + c.height).toBeLessThanOrEqual(320);
  });
});

describe('letterboxToNCHW', () => {
  it('centres the image and pads with grey', () => {
    const px = new Uint8Array([255, 255, 255, 255]); // 1×1 white
    const { tensor, padX, padY } = letterboxToNCHW(px, 1, 1, 3);
    expect([padX, padY]).toEqual([1, 1]);
    expect(tensor[4]).toBe(1); // centre of R plane
    expect(tensor[0]).toBeCloseTo(114 / 255);
  });
});
