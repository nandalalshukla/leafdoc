/** Metadata written by `training/export_onnx.py` next to the ONNX model. */
export interface ModelMeta {
  schemaVersion: number;
  modelVersion: string;
  architecture: string;
  inputName: string;
  outputName: string;
  /** Square input resolution, e.g. 224. */
  inputSize: number;
  /** Fraction of the shorter image side kept by the centre crop (mirrors Resize(256) → CenterCrop(224)). */
  cropFraction: number;
  mean: [number, number, number];
  std: [number, number, number];
  /** Temperature from calibration; logits are divided by this before softmax. */
  temperature: number;
  /** Calibrated top-1 probability below which LeafDoc says "not sure". */
  confidenceThreshold: number;
  /** Minimum gap between top-1 and top-2 probabilities to count as confident. */
  minMargin: number;
  calibrated: boolean;
  metrics: ModelMetrics | null;
  /** Class labels in the exact order of the model's output logits. */
  labels: string[];
}

export interface ModelMetrics {
  plantVillageTestAccuracy?: number;
  plantDocTestAccuracy?: number;
  eceBefore?: number;
  eceAfter?: number;
  [key: string]: number | undefined;
}

export interface Prediction {
  /** Dataset label, e.g. `Tomato___Late_blight`. */
  label: string;
  /** Knowledge-base id, e.g. `tomato_late_blight` (undefined if the label is unknown). */
  diseaseId?: string;
  probability: number;
}

export interface ImageQuality {
  /** Mean luma 0–255. */
  brightness: number;
  /** Variance of the Laplacian on the luma channel; low values mean blur. */
  sharpness: number;
  /** Fraction of pixels that look like plant tissue (green, yellow or brown). */
  plantCoverage: number;
}

export type DiagnosisStatus = 'confident' | 'unsure' | 'retake';

export type DiagnosisReason =
  | 'low_confidence'
  | 'ambiguous'
  | 'too_dark'
  | 'too_bright'
  | 'blurry'
  | 'no_leaf';

export interface Diagnosis {
  status: DiagnosisStatus;
  /** Top predictions, highest first. */
  predictions: Prediction[];
  reasons: DiagnosisReason[];
  quality: ImageQuality;
  modelVersion: string;
  /** True when the leaf detector supplied the crop. */
  leafDetected: boolean;
  inferenceMs: number;
}

export interface DetectionBox {
  /** Normalised [0,1] coordinates relative to the detector input. */
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}
