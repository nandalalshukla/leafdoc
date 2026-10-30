/** Numerically stable softmax with temperature scaling. */
export function softmax(logits: ArrayLike<number>, temperature = 1): Float64Array {
  const t = temperature > 0 && Number.isFinite(temperature) ? temperature : 1;
  const n = logits.length;
  const out = new Float64Array(n);
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = logits[i]! / t;
    out[i] = v;
    if (v > max) max = v;
  }
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const e = Math.exp(out[i]! - max);
    out[i] = e;
    sum += e;
  }
  for (let i = 0; i < n; i++) out[i] = out[i]! / sum;
  return out;
}

/** Indices of the k largest values, highest first. Ties keep the lower index first. */
export function topK(values: ArrayLike<number>, k: number): number[] {
  const idx = Array.from({ length: values.length }, (_, i) => i);
  idx.sort((a, b) => values[b]! - values[a]! || a - b);
  return idx.slice(0, Math.max(0, k));
}

/** Shannon entropy normalised to [0,1] by log(n). */
export function normalizedEntropy(probs: ArrayLike<number>): number {
  const n = probs.length;
  if (n <= 1) return 0;
  let h = 0;
  for (let i = 0; i < n; i++) {
    const p = probs[i]!;
    if (p > 0) h -= p * Math.log(p);
  }
  return h / Math.log(n);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
