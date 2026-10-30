import type { ImageQuality } from './types';

/**
 * Convert interleaved RGBA (or RGB) bytes to a normalised NCHW float tensor,
 * matching torchvision's ToTensor() + Normalize(mean, std).
 */
export function pixelsToNCHW(
  pixels: Uint8Array,
  width: number,
  height: number,
  mean: readonly [number, number, number],
  std: readonly [number, number, number],
  channels: 3 | 4 = 4,
): Float32Array {
  const plane = width * height;
  if (pixels.length < plane * channels) {
    throw new Error(`Expected ${plane * channels} bytes, got ${pixels.length}`);
  }
  const out = new Float32Array(plane * 3);
  const [mr, mg, mb] = mean;
  const [sr, sg, sb] = std;
  for (let i = 0, p = 0; i < plane; i++, p += channels) {
    out[i] = (pixels[p]! / 255 - mr) / sr;
    out[plane + i] = (pixels[p + 1]! / 255 - mg) / sg;
    out[2 * plane + i] = (pixels[p + 2]! / 255 - mb) / sb;
  }
  return out;
}

/** Centre square crop that keeps `fraction` of the shorter side. */
export function centerCropRect(width: number, height: number, fraction: number) {
  const side = Math.max(1, Math.round(Math.min(width, height) * Math.min(1, Math.max(0.1, fraction))));
  return {
    originX: Math.floor((width - side) / 2),
    originY: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };
}

/**
 * Cheap photo-quality signals computed on the small model-input image:
 * exposure, sharpness (variance of Laplacian) and how much of the frame looks like a plant.
 */
export function assessQuality(
  pixels: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4 = 4,
): ImageQuality {
  const n = width * height;
  const luma = new Float32Array(n);
  let lumaSum = 0;
  let plant = 0;

  for (let i = 0, p = 0; i < n; i++, p += channels) {
    const r = pixels[p]!;
    const g = pixels[p + 1]!;
    const b = pixels[p + 2]!;
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[i] = y;
    lumaSum += y;
    if (looksLikePlant(r, g, b)) plant++;
  }

  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = luma[i - width]! + luma[i + width]! + luma[i - 1]! + luma[i + 1]! - 4 * luma[i]!;
      lapSum += lap;
      lapSqSum += lap * lap;
      count++;
    }
  }
  const lapMean = count ? lapSum / count : 0;
  const sharpness = count ? lapSqSum / count - lapMean * lapMean : 0;

  return {
    brightness: n ? lumaSum / n : 0,
    sharpness,
    plantCoverage: n ? plant / n : 0,
  };
}

/** Hue/saturation test for leaf tissue: healthy greens plus diseased yellows and browns. */
export function looksLikePlant(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (max < 25) return false; // too dark to tell
  const sat = delta / max;
  if (sat < 0.15) return false; // grey, white, black
  let hue: number;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;
  // ~20° (brown/orange lesions) through ~170° (blue-greens).
  return hue >= 20 && hue <= 170;
}
