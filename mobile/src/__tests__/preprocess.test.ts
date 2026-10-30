import { describe, expect, it } from '@jest/globals';

import { assessQuality, centerCropRect, looksLikePlant, pixelsToNCHW } from '../ml/preprocess';

const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

function solid(w: number, h: number, rgb: [number, number, number]) {
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) px.set([...rgb, 255], i * 4);
  return px;
}

describe('pixelsToNCHW', () => {
  it('lays out channels as planes and normalises like torchvision', () => {
    const px = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]); // 2×1: red, green
    const t = pixelsToNCHW(px, 2, 1, MEAN, STD);
    expect(t).toHaveLength(6);
    expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229); // R of pixel 0
    expect(t[1]).toBeCloseTo((0 - 0.485) / 0.229); // R of pixel 1
    expect(t[3]).toBeCloseTo((1 - 0.456) / 0.224); // G of pixel 1
    expect(t[4]).toBeCloseTo((0 - 0.406) / 0.225); // B of pixel 0
  });

  it('supports RGB input', () => {
    const t = pixelsToNCHW(new Uint8Array([0, 0, 255]), 1, 1, MEAN, STD, 3);
    expect(t[2]).toBeCloseTo((1 - 0.406) / 0.225);
  });

  it('throws on short buffers', () => {
    expect(() => pixelsToNCHW(new Uint8Array(3), 2, 2, MEAN, STD)).toThrow();
  });
});

describe('centerCropRect', () => {
  it('crops a centred square from a landscape photo', () => {
    expect(centerCropRect(4000, 3000, 0.875)).toEqual({ originX: 687, originY: 187, width: 2625, height: 2625 });
  });
  it('keeps the full short side at fraction 1', () => {
    expect(centerCropRect(300, 500, 1)).toEqual({ originX: 0, originY: 100, width: 300, height: 300 });
  });
});

describe('looksLikePlant', () => {
  it('accepts greens, yellows and browns', () => {
    expect(looksLikePlant(60, 140, 50)).toBe(true); // leaf green
    expect(looksLikePlant(200, 190, 60)).toBe(true); // chlorotic yellow
    expect(looksLikePlant(120, 80, 40)).toBe(true); // necrotic brown
  });
  it('rejects greys, blues and very dark pixels', () => {
    expect(looksLikePlant(128, 128, 128)).toBe(false);
    expect(looksLikePlant(40, 60, 200)).toBe(false);
    expect(looksLikePlant(10, 20, 10)).toBe(false);
  });
});

describe('assessQuality', () => {
  it('flags a flat image as unsharp and measures brightness', () => {
    const q = assessQuality(solid(16, 16, [60, 140, 50]), 16, 16);
    expect(q.sharpness).toBeCloseTo(0);
    expect(q.plantCoverage).toBe(1);
    expect(q.brightness).toBeCloseTo(0.299 * 60 + 0.587 * 140 + 0.114 * 50, 3);
  });

  it('gives a checkerboard high sharpness', () => {
    const w = 16;
    const px = new Uint8Array(w * w * 4);
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) {
        const v = (x + y) % 2 ? 255 : 0;
        px.set([v, v, v, 255], (y * w + x) * 4);
      }
    const q = assessQuality(px, w, w);
    expect(q.sharpness).toBeGreaterThan(1000);
    expect(q.plantCoverage).toBe(0);
  });
});
