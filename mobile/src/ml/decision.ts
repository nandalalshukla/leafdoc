import diseases from '../data/diseases.json';
import { softmax, topK } from './math';
import type { DiagnosisReason, DiagnosisStatus, ImageQuality, ModelMeta, Prediction } from './types';

/** Thresholds for the photo-quality gate. Tuned on 224×224 inputs. */
export const QUALITY_LIMITS = {
  minBrightness: 35,
  maxBrightness: 235,
  minSharpness: 40,
  minPlantCoverage: 0.12,
} as const;

const labelToId = new Map<string, string>(diseases.classes.map((c) => [c.label, c.id]));

export function diseaseIdForLabel(label: string): string | undefined {
  return labelToId.get(label);
}

export function predictionsFromLogits(logits: ArrayLike<number>, meta: ModelMeta, k = 3): Prediction[] {
  if (logits.length !== meta.labels.length) {
    throw new Error(`Model returned ${logits.length} scores but metadata lists ${meta.labels.length} labels`);
  }
  const probs = softmax(logits, meta.temperature);
  return topK(probs, k).map((i) => {
    const label = meta.labels[i]!;
    return { label, diseaseId: diseaseIdForLabel(label), probability: probs[i]! };
  });
}

/**
 * Turn calibrated predictions and photo quality into a user-facing verdict.
 * - `retake`: the photo itself is unusable (exposure) or clearly not a leaf and the model is unsure.
 * - `unsure`: the model's calibrated confidence is below threshold or top-2 are too close.
 * - `confident`: show the diagnosis and remedy.
 */
export function decide(
  predictions: Prediction[],
  quality: ImageQuality,
  meta: Pick<ModelMeta, 'confidenceThreshold' | 'minMargin'>,
): { status: DiagnosisStatus; reasons: DiagnosisReason[] } {
  const reasons: DiagnosisReason[] = [];
  const p1 = predictions[0]?.probability ?? 0;
  const p2 = predictions[1]?.probability ?? 0;

  if (quality.brightness < QUALITY_LIMITS.minBrightness) reasons.push('too_dark');
  if (quality.brightness > QUALITY_LIMITS.maxBrightness) reasons.push('too_bright');
  if (quality.sharpness < QUALITY_LIMITS.minSharpness) reasons.push('blurry');
  if (quality.plantCoverage < QUALITY_LIMITS.minPlantCoverage) reasons.push('no_leaf');

  const lowConfidence = p1 < meta.confidenceThreshold;
  const ambiguous = p1 - p2 < meta.minMargin;
  if (lowConfidence) reasons.push('low_confidence');
  else if (ambiguous) reasons.push('ambiguous');

  const exposureBad = reasons.includes('too_dark') || reasons.includes('too_bright');
  const photoSuspect = reasons.includes('no_leaf') || reasons.includes('blurry');

  let status: DiagnosisStatus;
  if (exposureBad || (photoSuspect && (lowConfidence || ambiguous))) status = 'retake';
  else if (lowConfidence || ambiguous) status = 'unsure';
  else status = 'confident';

  return { status, reasons };
}

export const REASON_TEXT: Record<DiagnosisReason, string> = {
  low_confidence: 'The model is not confident about this photo.',
  ambiguous: 'Two diseases look similar here — the top matches are close.',
  too_dark: 'The photo is too dark. Move to daylight or shade without deep shadows.',
  too_bright: 'The photo is over-exposed. Avoid direct harsh sunlight on the leaf.',
  blurry: 'The photo looks blurry. Hold steady and tap to focus on the leaf.',
  no_leaf: "We couldn't see much leaf. Fill the frame with a single leaf.",
};
