import Constants from 'expo-constants';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DISCLAIMER } from '../../data/knowledge';
import { useModel } from '../../hooks/ModelProvider';
import { useSettings } from '../../hooks/SettingsProvider';
import { formatPercent } from '../../components/ConfidenceBar';
import { clearScans } from '../../storage/history';
import type { Settings } from '../../storage/settings';
import { useTheme } from '../../theme';

const TOGGLES: { key: keyof Settings; title: string; body: string }[] = [
  { key: 'showChemical', title: 'Show chemical remedies', body: 'Off shows organic options only.' },
  { key: 'cropBeforeAnalyze', title: 'Crop before checking', body: 'Frame the leaf yourself after taking a photo.' },
  { key: 'saveHistory', title: 'Save scans to history', body: 'Photos and results are kept on this phone only.' },
  { key: 'haptics', title: 'Haptic feedback', body: 'Vibrate gently when a result is ready.' },
];

export default function SettingsScreen() {
  const { colors, font, spacing } = useTheme();
  const { settings, update } = useSettings();
  const { state } = useModel();

  const confirmClear = () =>
    Alert.alert('Clear all history?', 'Every saved scan and photo will be deleted from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearScans() },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 }}>
      <Card title="Preferences">
        <View style={{ gap: spacing.lg }}>
          {TOGGLES.map((t) => (
            <View key={t.key} style={styles.toggle}>
              <View style={{ flex: 1 }}>
                <Text style={[font.subheading, { color: colors.text }]}>{t.title}</Text>
                <Text style={[font.small, { color: colors.textMuted }]}>{t.body}</Text>
              </View>
              <Switch
                value={Boolean(settings[t.key])}
                onValueChange={(v) => update({ [t.key]: v })}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel={t.title}
              />
            </View>
          ))}
        </View>
      </Card>

      <Card title="Model">
        {state.status === 'ready' ? (
          <View style={{ gap: 6 }}>
            <Row label="Version" value={state.meta.modelVersion} />
            <Row label="Architecture" value={state.meta.architecture} />
            <Row label="Classes" value={String(state.meta.labels.length)} />
            <Row label="Leaf detector" value={state.hasDetector ? 'On' : 'Off (centre crop)'} />
            <Row label="Calibrated" value={state.meta.calibrated ? `Yes (T = ${state.meta.temperature.toFixed(2)})` : 'No'} />
            <Row label="'Not sure' below" value={formatPercent(state.meta.confidenceThreshold)} />
            {state.meta.metrics?.plantVillageTestAccuracy != null ? (
              <Row label="PlantVillage test" value={formatPercent(state.meta.metrics.plantVillageTestAccuracy)} />
            ) : null}
            {state.meta.metrics?.plantDocTestAccuracy != null ? (
              <Row label="PlantDoc (field) test" value={formatPercent(state.meta.metrics.plantDocTestAccuracy)} />
            ) : null}
            <Row label="Source" value={state.source === 'bundled' ? 'Bundled in app' : 'Downloaded, cached offline'} />
          </View>
        ) : (
          <Text style={[font.body, { color: colors.textMuted }]}>
            {state.status === 'loading' ? 'Loading…' : state.status === 'missing' ? 'Not installed' : state.message}
          </Text>
        )}
      </Card>

      <Card title="Data">
        <Button title="Clear scan history" icon="trash-outline" variant="danger" onPress={confirmClear} />
      </Card>

      <Card title="About">
        <Text style={[font.body, { color: colors.text }]}>
          LeafDoc {Constants.expoConfig?.version ?? ''} runs an on-device image classifier fine-tuned on PlantVillage
          and checked on real field photos. Everything works offline.
        </Text>
        <Text style={[font.small, { color: colors.textMuted, marginTop: spacing.md }]}>{DISCLAIMER}</Text>
      </Card>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors, font } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[font.small, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[font.small, { color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
