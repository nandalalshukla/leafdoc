// This file is rewritten by `training/export_onnx.py --install` and
// `training/export_detector.py --install` when a trained model is copied into
// `assets/model/`. Keep it as `null` until a model file exists, otherwise Metro
// fails to bundle. A remote model URL can be configured instead in
// `app.json → expo.extra.model` (downloaded once, then used offline).

/** `require('../../assets/model/leafdoc.onnx')` once installed. */
export const BUNDLED_CLASSIFIER: number | null = null;

/** `require('../../assets/model/leaf-detector.onnx')` once installed (optional). */
export const BUNDLED_DETECTOR: number | null = null;
