import { InferenceSession, Tensor } from 'onnxruntime-react-native';

import { decide, predictionsFromLogits } from './decision';
import { bestDetection, detectionToCrop, letterboxToNCHW, type DetectorMeta } from './detector';
import { decodeRegion, loadSource, type CropRect } from './image';
import { resolveClassifier, resolveDetector } from './modelStore';
import { assessQuality, centerCropRect, pixelsToNCHW } from './preprocess';
import type { Diagnosis, ModelMeta } from './types';

interface Engine {
  classifier: InferenceSession;
  meta: ModelMeta;
  source: 'bundled' | 'downloaded';
  detector: { session: InferenceSession; meta: DetectorMeta } | null;
}

let enginePromise: Promise<Engine> | null = null;

const sessionOptions: InferenceSession.SessionOptions = {
  graphOptimizationLevel: 'all',
  executionProviders: ['cpu'],
};

async function createEngine(): Promise<Engine> {
  const resolved = await resolveClassifier();
  const classifier = await InferenceSession.create(resolved.bytes, sessionOptions);

  let detector: Engine['detector'] = null;
  try {
    const d = await resolveDetector();
    if (d) detector = { session: await InferenceSession.create(d.bytes, sessionOptions), meta: d.meta };
  } catch (e) {
    // The detector is optional; fall back to a centre crop.
    console.warn('[LeafDoc] Leaf detector failed to load, using centre crop', e);
  }

  const engine: Engine = { classifier, meta: resolved.meta, source: resolved.source, detector };
  await warmUp(engine);
  return engine;
}

/** One dummy run so the first real diagnosis is not slowed by lazy allocation. */
async function warmUp({ classifier, meta }: Engine) {
  const s = meta.inputSize;
  const input = new Tensor('float32', new Float32Array(3 * s * s), [1, 3, s, s]);
  await classifier.run({ [meta.inputName]: input });
}

/** Load (once) and return the inference engine. Safe to call repeatedly. */
export function getEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = createEngine().catch((e) => {
      enginePromise = null; // allow a retry after failure
      throw e;
    });
  }
  return enginePromise;
}

export async function getModelInfo() {
  const { meta, source, detector } = await getEngine();
  return { meta, source, hasDetector: detector != null };
}

function outputOf(results: InferenceSession.OnnxValueMapType, preferred: string, fallback: readonly string[]) {
  const value = results[preferred] ?? results[fallback[0] ?? ''];
  if (!value) throw new Error('Model produced no output');
  return value as Tensor;
}

async function detectLeaf(
  engine: Engine,
  source: Awaited<ReturnType<typeof loadSource>>,
): Promise<CropRect | null> {
  if (!engine.detector) return null;
  const { session, meta } = engine.detector;
  const size = meta.inputSize;
  const scale = Math.min(size / source.width, size / source.height);
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const img = await decodeRegion(source, null, w, h);
  const { tensor, padX, padY } = letterboxToNCHW(img.pixels, img.width, img.height, size);

  const results = await session.run({ [meta.inputName]: new Tensor('float32', tensor, [1, 3, size, size]) });
  const out = outputOf(results, meta.outputName, session.outputNames);
  const box = bestDetection(out.data as Float32Array, out.dims, size, meta.scoreThreshold);
  if (!box) return null;
  return detectionToCrop(
    box,
    { scale: img.width / source.width, padX, padY, inputSize: size },
    source.width,
    source.height,
    meta.boxPadding,
    meta.minBoxFraction,
  );
}

/** Run the full on-device pipeline on a photo URI. Never touches the network. */
export async function diagnose(uri: string): Promise<Diagnosis> {
  const engine = await getEngine();
  const { meta, classifier } = engine;
  const started = Date.now();

  const source = await loadSource(uri);
  try {
    let crop: CropRect | null = null;
    try {
      crop = await detectLeaf(engine, source);
    } catch (e) {
      console.warn('[LeafDoc] Leaf detection failed, using centre crop', e);
    }
    const leafDetected = crop != null;
    crop ??= centerCropRect(source.width, source.height, meta.cropFraction);

    const size = meta.inputSize;
    const img = await decodeRegion(source, crop, size, size);
    const quality = assessQuality(img.pixels, img.width, img.height);
    const input = new Tensor('float32', pixelsToNCHW(img.pixels, img.width, img.height, meta.mean, meta.std), [
      1,
      3,
      img.height,
      img.width,
    ]);

    const results = await classifier.run({ [meta.inputName]: input });
    const logits = outputOf(results, meta.outputName, classifier.outputNames).data as Float32Array;
    const predictions = predictionsFromLogits(logits, meta, 3);
    const { status, reasons } = decide(predictions, quality, meta);

    return {
      status,
      reasons,
      predictions,
      quality,
      leafDetected,
      modelVersion: meta.modelVersion,
      inferenceMs: Date.now() - started,
    };
  } finally {
    source.release();
  }
}
