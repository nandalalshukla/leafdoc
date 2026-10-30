import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { useHaptics } from '../hooks/useHaptics';
import { useSettings } from '../hooks/SettingsProvider';
import { diagnose } from '../ml/engine';
import { saveScan } from '../storage/history';
import { useTheme } from '../theme';

export default function AnalyzeScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const { colors, font, spacing } = useTheme();
  const { settings, loaded } = useSettings();
  const { notify } = useHaptics();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!uri || !loaded || started.current) return;
    started.current = true;
    (async () => {
      try {
        const diagnosis = await diagnose(uri);
        const record = await saveScan(uri, diagnosis, { persist: settings.saveHistory });
        notify(diagnosis.status === 'confident' ? 'success' : 'warning');
        router.replace({ pathname: '/scan/[id]', params: { id: record.id } });
      } catch (e) {
        notify('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [uri, loaded, settings.saveHistory, notify]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background, padding: spacing.xl }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.photo} contentFit="cover" accessibilityLabel="Your leaf photo" />
      ) : null}
      {error ? (
        <View style={{ gap: spacing.md, alignSelf: 'stretch' }}>
          <Text style={[font.heading, { color: colors.danger, textAlign: 'center' }]}>{"Couldn't check this photo"}</Text>
          <Text style={[font.body, { color: colors.textMuted, textAlign: 'center' }]}>{error}</Text>
          <Button title="Back" icon="arrow-back" onPress={() => router.back()} />
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: spacing.md }} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[font.subheading, { color: colors.text }]}>Looking for signs of disease…</Text>
          <Text style={[font.small, { color: colors.textMuted }]}>Running on your phone — no internet needed</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  photo: { width: 240, height: 240, borderRadius: 24 },
});
