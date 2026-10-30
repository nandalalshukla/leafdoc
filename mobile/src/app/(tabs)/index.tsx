import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useModel } from '../../hooks/ModelProvider';
import { usePickPhoto } from '../../hooks/usePickPhoto';
import { useSettings } from '../../hooks/SettingsProvider';
import { useTheme } from '../../theme';

export default function ScanScreen() {
  const { colors, font, spacing } = useTheme();
  const { state, reload } = useModel();
  const { pick, busy } = usePickPhoto();
  const { settings, loaded, update } = useSettings();
  const ready = state.status === 'ready';

  useEffect(() => {
    if (loaded && !settings.seenTips) {
      update({ seenTips: true });
      router.push('/tips');
    }
  }, [loaded, settings.seenTips, update]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <View style={styles.brand}>
            <Ionicons name="leaf" size={28} color={colors.primary} />
            <Text style={[font.title, { color: colors.text }]}>LeafDoc</Text>
          </View>
          <Text style={[font.body, { color: colors.textMuted }]}>
            Photograph a sick leaf to get the likely disease and what to do about it. Works offline — your photos
            never leave the phone.
          </Text>
        </View>

        <View style={[styles.hero, { backgroundColor: colors.primarySoft, borderRadius: 24 }]}>
          <Ionicons name="camera" size={56} color={colors.primary} />
          <Text style={[font.heading, { color: colors.text, textAlign: 'center' }]}>Check a leaf</Text>
          <Text style={[font.small, { color: colors.textMuted, textAlign: 'center' }]}>
            One leaf, filling the frame, in even daylight.
          </Text>
          <View style={{ alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.sm }}>
            <Button
              title="Take photo"
              icon="camera-outline"
              onPress={() => pick('camera')}
              disabled={!ready || busy}
              accessibilityHint="Opens the camera to photograph a leaf"
            />
            <Button
              title="Choose from gallery"
              icon="images-outline"
              variant="secondary"
              onPress={() => pick('library')}
              disabled={!ready || busy}
            />
          </View>
        </View>

        <ModelStatus state={state} onRetry={reload} />

        <Link href="/tips" asChild>
          <Pressable accessibilityRole="link" style={[styles.tipsLink, { borderColor: colors.border }]}>
            <Ionicons name="bulb-outline" size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[font.subheading, { color: colors.text }]}>How to take a good photo</Text>
              <Text style={[font.small, { color: colors.textMuted }]}>Better photos mean more accurate results</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModelStatus({ state, onRetry }: { state: ReturnType<typeof useModel>['state']; onRetry: () => void }) {
  const { colors, font } = useTheme();
  if (state.status === 'ready') return null;
  if (state.status === 'loading') {
    return (
      <View style={styles.statusRow}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[font.small, { color: colors.textMuted }]}>Loading the on-device model…</Text>
      </View>
    );
  }
  if (state.status === 'missing') {
    return (
      <Card title="Model not installed" style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
        <Text style={[font.body, { color: colors.text }]}>
          This build has no disease model yet. Train and export one with the training pipeline (see training/README.md)
          to enable diagnosis. You can still browse the disease guide.
        </Text>
      </Card>
    );
  }
  return (
    <Card title="Model failed to load" style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
      <Text style={[font.small, { color: colors.text, marginBottom: 12 }]}>{state.message}</Text>
      <Button title="Retry" icon="refresh" variant="secondary" onPress={onRetry} />
    </Card>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hero: { padding: 24, alignItems: 'center', gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  tipsLink: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderRadius: 16 },
});
