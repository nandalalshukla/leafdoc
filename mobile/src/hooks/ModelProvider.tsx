import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getModelInfo } from '../ml/engine';
import { ModelUnavailableError } from '../ml/modelStore';
import type { ModelMeta } from '../ml/types';

export type ModelState =
  | { status: 'loading' }
  | { status: 'ready'; meta: ModelMeta; source: 'bundled' | 'downloaded'; hasDetector: boolean }
  | { status: 'missing' }
  | { status: 'error'; message: string };

interface ModelContextValue {
  state: ModelState;
  reload: () => void;
}

const ModelContext = createContext<ModelContextValue>({ state: { status: 'loading' }, reload: () => {} });

export function ModelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModelState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getModelInfo()
      .then((info) => !cancelled && setState({ status: 'ready', ...info }))
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ModelUnavailableError) setState({ status: 'missing' });
        else setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((a) => a + 1);
  }, []);
  const value = useMemo(() => ({ state, reload }), [state, reload]);
  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

export function useModel() {
  return useContext(ModelContext);
}
