import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';

import bundledDetectorMeta from '../../assets/model/detector-meta.json';
import bundledMeta from '../../assets/model/model-meta.json';
import { BUNDLED_CLASSIFIER, BUNDLED_DETECTOR } from './bundledModels';
import type { DetectorMeta } from './detector';
import type { ModelMeta } from './types';

export class ModelUnavailableError extends Error {
  constructor() {
    super(
      'No disease model is installed. Train and export one with the training pipeline, or set expo.extra.model.remoteUrl.',
    );
    this.name = 'ModelUnavailableError';
  }
}

interface RemoteModelConfig {
  remoteUrl?: string | null;
  remoteMetaUrl?: string | null;
  /** Optional SHA-256 hex digest the downloaded model must match. */
  sha256?: string | null;
}

export interface ResolvedModel {
  bytes: Uint8Array;
  meta: ModelMeta;
  source: 'bundled' | 'downloaded';
}

const remoteConfig = (Constants.expoConfig?.extra?.model ?? {}) as RemoteModelConfig;

function modelsDir(): Directory {
  const dir = new Directory(Paths.document, 'models');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

async function bytesFromModule(moduleId: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  return new File(uri).bytes();
}

export function validateMeta(meta: ModelMeta): ModelMeta {
  if (!Array.isArray(meta.labels) || meta.labels.length === 0) throw new Error('Model metadata has no labels');
  if (!(meta.inputSize > 0)) throw new Error('Model metadata has an invalid input size');
  if (meta.mean?.length !== 3 || meta.std?.length !== 3) throw new Error('Model metadata needs 3-channel mean/std');
  return {
    ...meta,
    temperature: meta.temperature > 0 ? meta.temperature : 1,
    cropFraction: meta.cropFraction > 0 ? meta.cropFraction : 0.875,
    minMargin: meta.minMargin ?? 0.15,
  };
}

/**
 * Downloaded once and kept in the app's document directory so diagnosis keeps
 * working with no connectivity.
 */
async function resolveRemote(): Promise<ResolvedModel | null> {
  const { remoteUrl, remoteMetaUrl, sha256 } = remoteConfig;
  if (!remoteUrl || !remoteMetaUrl) return null;

  const dir = modelsDir();
  const modelFile = new File(dir, 'leafdoc.onnx');
  const metaFile = new File(dir, 'model-meta.json');

  if (!modelFile.exists || !metaFile.exists) {
    const tmpModel = new File(dir, 'leafdoc.onnx.download');
    const tmpMeta = new File(dir, 'model-meta.json.download');
    for (const f of [tmpModel, tmpMeta]) if (f.exists) f.delete();
    await File.downloadFileAsync(remoteMetaUrl, tmpMeta);
    await File.downloadFileAsync(remoteUrl, tmpModel);
    if (sha256) {
      const digest = (await tmpModel.digest('SHA-256')).toLowerCase();
      if (digest !== sha256.toLowerCase()) {
        tmpModel.delete();
        tmpMeta.delete();
        throw new Error('Downloaded model failed its integrity check');
      }
    }
    for (const f of [modelFile, metaFile]) if (f.exists) f.delete();
    await tmpMeta.move(metaFile);
    await tmpModel.move(modelFile);
  }

  const meta = validateMeta(JSON.parse(await metaFile.text()) as ModelMeta);
  return { bytes: await modelFile.bytes(), meta, source: 'downloaded' };
}

export async function resolveClassifier(): Promise<ResolvedModel> {
  if (BUNDLED_CLASSIFIER != null) {
    return {
      bytes: await bytesFromModule(BUNDLED_CLASSIFIER),
      meta: validateMeta(bundledMeta as ModelMeta),
      source: 'bundled',
    };
  }
  const remote = await resolveRemote();
  if (remote) return remote;
  throw new ModelUnavailableError();
}

export async function resolveDetector(): Promise<{ bytes: Uint8Array; meta: DetectorMeta } | null> {
  if (BUNDLED_DETECTOR == null) return null;
  return { bytes: await bytesFromModule(BUNDLED_DETECTOR), meta: bundledDetectorMeta as DetectorMeta };
}

export function hasConfiguredModel(): boolean {
  return BUNDLED_CLASSIFIER != null || Boolean(remoteConfig.remoteUrl && remoteConfig.remoteMetaUrl);
}

/** Remove a downloaded model so the next launch fetches a fresh copy. */
export function clearDownloadedModel(): void {
  const dir = new Directory(Paths.document, 'models');
  if (dir.exists) dir.delete();
}
