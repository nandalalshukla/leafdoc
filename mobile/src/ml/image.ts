import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import * as jpeg from 'jpeg-js';

export interface DecodedImage {
  /** RGBA bytes. */
  pixels: Uint8Array;
  width: number;
  height: number;
}

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * Load a photo once, honouring EXIF orientation and capping its size so later
 * crops are fast. Callers must `release()` the returned ref.
 */
export async function loadSource(uri: string, maxSide = 1600): Promise<ImageRef> {
  return ImageManipulator.manipulate(uri, { maxWidth: maxSide, maxHeight: maxSide }).renderAsync();
}

/** Crop (optional) and resize a loaded image, then decode it to RGBA bytes in JS. */
export async function decodeRegion(
  source: ImageRef,
  crop: CropRect | null,
  width: number,
  height: number,
): Promise<DecodedImage> {
  const ctx = ImageManipulator.manipulate(source);
  if (crop) ctx.crop(crop);
  ctx.resize({ width: Math.round(width), height: Math.round(height) });
  const ref = await ctx.renderAsync();
  let tmp: File | null = null;
  try {
    const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
    tmp = new File(saved.uri);
    const bytes = await tmp.bytes();
    const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
    return { pixels: decoded.data, width: decoded.width, height: decoded.height };
  } finally {
    ref.release();
    try {
      tmp?.delete();
    } catch {
      // Temp file cleanup is best-effort.
    }
  }
}
