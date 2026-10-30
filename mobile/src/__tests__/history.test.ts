/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories and module resets need require() */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Diagnosis } from '../ml/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const deleted: string[] = [];
jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    exists = true;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    create() {}
  }
  class File extends Directory {
    async copy(dest: File) {
      return dest;
    }
    delete() {
      deleted.push(this.uri);
    }
  }
  return { Directory, File, Paths: { document: { uri: 'file:///docs' } } };
});

const diagnosis: Diagnosis = {
  status: 'confident',
  predictions: [{ label: 'Tomato___Late_blight', diseaseId: 'tomato_late_blight', probability: 0.9 }],
  reasons: [],
  quality: { brightness: 120, sharpness: 200, plantCoverage: 0.6 },
  modelVersion: 'test',
  leafDetected: false,
  inferenceMs: 42,
};

describe('history storage', () => {
  let history: typeof import('../storage/history');

  beforeEach(() => {
    jest.resetModules();
    deleted.length = 0;
    history = require('../storage/history');
  });

  it('saves scans newest first and copies the photo into app storage', async () => {
    const a = await history.saveScan('file:///cache/a.jpg', diagnosis);
    const b = await history.saveScan('file:///cache/b.png', diagnosis);
    expect(a.imageUri).toBe(`file:///docs/scans/${a.id}.jpg`);
    expect(b.imageUri.endsWith('.png')).toBe(true);
    expect((await history.listScans()).map((r) => r.id)).toEqual([b.id, a.id]);
    expect(await history.getScan(a.id)).toMatchObject({ diagnosis });
  });

  it('keeps privacy-mode scans out of persistent history', async () => {
    const r = await history.saveScan('file:///cache/a.jpg', diagnosis, { persist: false });
    expect(await history.listScans()).toEqual([]);
    expect((await history.getScan(r.id))?.imageUri).toBe('file:///cache/a.jpg');
  });

  it('deletes a scan and its stored photo, and notifies subscribers', async () => {
    const r = await history.saveScan('file:///cache/a.jpg', diagnosis);
    const seen: number[] = [];
    history.subscribe((records) => seen.push(records.length));
    await history.deleteScan(r.id);
    expect(await history.listScans()).toEqual([]);
    expect(deleted).toContain(r.imageUri);
    expect(seen).toEqual([0]);
  });

  it('clears everything', async () => {
    await history.saveScan('file:///cache/a.jpg', diagnosis);
    await history.saveScan('file:///cache/b.jpg', diagnosis);
    await history.clearScans();
    expect(await history.listScans()).toEqual([]);
    expect(deleted).toHaveLength(2);
  });
});
