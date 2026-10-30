import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

import { useSettings } from './SettingsProvider';

export function useHaptics() {
  const { settings } = useSettings();
  const tap = useCallback(() => {
    if (settings.haptics) Haptics.selectionAsync().catch(() => {});
  }, [settings.haptics]);
  const notify = useCallback(
    (type: 'success' | 'warning' | 'error') => {
      if (!settings.haptics) return;
      const map = {
        success: Haptics.NotificationFeedbackType.Success,
        warning: Haptics.NotificationFeedbackType.Warning,
        error: Haptics.NotificationFeedbackType.Error,
      };
      Haptics.notificationAsync(map[type]).catch(() => {});
    },
    [settings.haptics],
  );
  return { tap, notify };
}
