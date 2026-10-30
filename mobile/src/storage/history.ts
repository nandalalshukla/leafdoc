import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import type { Diagnosis } from '../ml/types';

export interface ScanRecord {
  id: string;
  createdAt: number;
  /** Persistent copy of the photo inside the app's document directory. */
  imageUri: string;
  diagnosis: Diagnosis;
  note?: string;
}

const KEY = 'leafdoc.history.v1';
const MAX_RECORDS = 200;

type Listener = (records: ScanRecord[]) => void;
const listeners = new Set<Listener>();
let cache: ScanRecord[] | null = null;
/** Results shown when history saving is turned off: kept in memory for this session only. */
const transient = new Map<string, ScanRecord>();

function scansDir(): Directory {
  const dir = new Directory(Paths.document, 'scans');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function persist(records: ScanRecord[]) {
  cache = records;
  await AsyncStorage.setItem(KEY, JSON.stringify(records));
  listeners.forEach((l) => l(records));
}

export async function listScans(): Promise<ScanRecord[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as ScanRecord[]) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

export async function getScan(id: string): Promise<ScanRecord | undefined> {
  return transient.get(id) ?? (await listScans()).find((r) => r.id === id);
}

/**
 * Copy the photo out of the picker's cache and store the diagnosis.
 * With `persist: false` the result lives in memory only (privacy mode).
 */
export async function saveScan(
  photoUri: string,
  diagnosis: Diagnosis,
  { persist: keep = true }: { persist?: boolean } = {},
): Promise<ScanRecord> {
  const id = newId();
  if (!keep) {
    const record: ScanRecord = { id, createdAt: Date.now(), imageUri: photoUri, diagnosis };
    transient.set(id, record);
    return record;
  }
  let imageUri = photoUri;
  try {
    const ext = photoUri.split('?')[0]?.split('.').pop()?.toLowerCase();
    const dest = new File(scansDir(), `${id}.${ext && ext.length <= 4 ? ext : 'jpg'}`);
    await new File(photoUri).copy(dest);
    imageUri = dest.uri;
  } catch (e) {
    console.warn('[LeafDoc] Could not copy photo into app storage', e);
  }

  const record: ScanRecord = { id, createdAt: Date.now(), imageUri, diagnosis };
  const records = [record, ...(await listScans())];
  const kept = records.slice(0, MAX_RECORDS);
  records.slice(MAX_RECORDS).forEach(deletePhoto);
  await persist(kept);
  return record;
}

function deletePhoto(record: ScanRecord) {
  try {
    const f = new File(record.imageUri);
    if (f.exists && f.uri.includes('/scans/')) f.delete();
  } catch {
    // ignore
  }
}

export async function updateScanNote(id: string, note: string) {
  const records = (await listScans()).map((r) => (r.id === id ? { ...r, note } : r));
  await persist(records);
}

export async function deleteScan(id: string) {
  transient.delete(id);
  const records = await listScans();
  const target = records.find((r) => r.id === id);
  if (target) deletePhoto(target);
  await persist(records.filter((r) => r.id !== id));
}

export async function clearScans() {
  transient.clear();
  (await listScans()).forEach(deletePhoto);
  await persist([]);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
