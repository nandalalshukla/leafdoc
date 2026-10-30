import { useEffect, useState } from 'react';

import { getScan, listScans, subscribe, type ScanRecord } from '../storage/history';

export function useScans() {
  const [scans, setScans] = useState<ScanRecord[] | null>(null);
  useEffect(() => {
    let active = true;
    listScans().then((r) => active && setScans(r));
    const unsubscribe = subscribe((r) => setScans(r));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return scans;
}

export function useScan(id: string | undefined) {
  const [scan, setScan] = useState<ScanRecord | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    let active = true;
    getScan(id).then((r) => active && setScan(r ?? null));
    const unsubscribe = subscribe((records) => setScan(records.find((r) => r.id === id) ?? null));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [id]);
  return id ? scan : null;
}
