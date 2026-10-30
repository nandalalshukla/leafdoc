import { clamp } from './math';
import type { DetectionBox } from './types';

export interface DetectorMeta {
  schemaVersion: number;
  modelVersion: string;
  architecture: string;
  inputName: string;
  outputName: string;
  inputSize: number;
  scoreThreshold: number;
  /** Extra margin added around the detected leaf, as a fraction of box size. */
  boxPadding: number;
  /** Ignore boxes smaller than this fraction of the image side (likely noise). */
  minBoxFraction: number;
}

/**
 * Pick the best leaf box from a single-class YOLOv8 ONNX output.
 *
 * Ultralytics exports a `[1, 4 + numClasses, numAnchors]` tensor with
 * centre-x, centre-y, width, height in input pixels followed by class scores.
 * We only need the single best leaf, so a max over scores replaces NMS.
 */
export function bestDetection(
  output: ArrayLike<number>,
  dims: readonly number[],
  inputSize: number,
  scoreThreshold: number,
): DetectionBox | null {
  const rows = dims[1] ?? 0;
  const anchors = dims[2] ?? 0;
  if (rows < 5 || anchors <= 0 || output.length < rows * anchors) return null;

  let best = -1;
  let bestScore = scoreThreshold;
  for (let a = 0; a < anchors; a++) {
    let score = 0;
    for (let c = 4; c < rows; c++) score = Math.max(score, output[c * anchors + a]!);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  if (best < 0) return null;

  const cx = output[best]! / inputSize;
  const cy = output[anchors + best]! / inputSize;
  const w = output[2 * anchors + best]! / inputSize;
  const h = output[3 * anchors + best]! / inputSize;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h, score: bestScore };
}

/**
 * Map a box from the letterboxed detector input back to the original image and
 * turn it into a padded square crop (the classifier expects square inputs).
 */
export function detectionToCrop(
  box: DetectionBox,
  letterbox: { scale: number; padX: number; padY: number; inputSize: number },
  imageWidth: number,
  imageHeight: number,
  padding: number,
  minBoxFraction: number,
) {
  const { scale, padX, padY, inputSize } = letterbox;
  const x0 = (box.x * inputSize - padX) / scale;
  const y0 = (box.y * inputSize - padY) / scale;
  const bw = (box.width * inputSize) / scale;
  const bh = (box.height * inputSize) / scale;

  const shorter = Math.min(imageWidth, imageHeight);
  if (Math.max(bw, bh) < shorter * minBoxFraction) return null;

  const side = Math.min(shorter, Math.max(bw, bh) * (1 + 2 * padding));
  const cx = x0 + bw / 2;
  const cy = y0 + bh / 2;
  const originX = Math.round(clamp(cx - side / 2, 0, imageWidth - side));
  const originY = Math.round(clamp(cy - side / 2, 0, imageHeight - side));
  const s = Math.round(side);
  return { originX, originY, width: s, height: s };
}

/**
 * Place an RGBA image of size w×h (already scaled to fit `size`) in the centre of a
 * size×size canvas padded with YOLO's grey (114) and return a normalised NCHW tensor.
 */
export function letterboxToNCHW(pixels: Uint8Array, w: number, h: number, size: number) {
  const padX = Math.floor((size - w) / 2);
  const padY = Math.floor((size - h) / 2);
  const plane = size * size;
  const out = new Float32Array(3 * plane).fill(114 / 255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      const dst = (y + padY) * size + (x + padX);
      out[dst] = pixels[src]! / 255;
      out[plane + dst] = pixels[src + 1]! / 255;
      out[2 * plane + dst] = pixels[src + 2]! / 255;
    }
  }
  return { tensor: out, padX, padY };
}
