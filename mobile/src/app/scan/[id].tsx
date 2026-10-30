import { Image } from 'expo-image';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfidenceBar } from '../../components/ConfidenceBar';
import { DiseaseDetails, DiseaseHeader } from '../../components/DiseaseDetails';
import { EmptyState } from '../../components/EmptyState';
import { StatusBanner } from '../../components/StatusBanner';
import { getDisease, getDiseaseByLabel } from '../../data/knowledge';
import { usePickPhoto } from '../../hooks/usePickPhoto';
import { useScan } from '../../hooks/useScans';
import { deleteScan } from '../../storage/history';
import { useTheme } from '../../theme';

export default function ScanResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scan = useScan(id);
  const { colors, font, spacing } = useTheme();
  const { pick, busy } = usePickPhoto();

  if (scan === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (scan === null) {
    return <EmptyState icon="alert-circle-outline" title="Scan not found" body="It may have been deleted." />;
  }

  const { diagnosis } = scan;
  const top = diagnosis.predictions[0];
  const topDisease = top ? (getDisease(top.diseaseId) ?? getDiseaseByLabel(top.label)) : undefined;
  const confident = diagnosis.status === 'confident';

  const confirmDelete = () =>
    Alert.alert('Delete this scan?', 'The photo and result will be removed from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteScan(scan.id);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: confident && topDisease ? topDisease.plant : 'Result' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: 48 }}>
        <Image source={{ uri: scan.imageUri }} style={styles.photo} contentFit="cover" accessibilityLabel="Scanned leaf" />

        <StatusBanner status={diagnosis.status} reasons={diagnosis.reasons} />

        {confident && topDisease ? <DiseaseHeader disease={topDisease} /> : null}

        <Card title={confident ? 'Top matches' : 'Closest matches'}>
          <View style={{ gap: spacing.lg }}>
            {diagnosis.predictions.map((p, i) => {
              const d = getDisease(p.diseaseId) ?? getDiseaseByLabel(p.label);
              const content = (
                <ConfidenceBar
                  label={d?.name ?? p.label.replace(/_+/g, ' ')}
                  sublabel={d?.plant}
                  probability={p.probability}
                  highlight={i === 0 && confident}
                />
              );
              return d ? (
                <Link key={p.label} href={{ pathname: '/disease/[id]', params: { id: d.id } }} asChild>
                  <Pressable accessibilityRole="link" accessibilityHint="Opens the disease guide">
                    {content}
                  </Pressable>
                </Link>
              ) : (
                <View key={p.label}>{content}</View>
              );
            })}
          </View>
          <Text style={[font.small, { color: colors.textMuted, marginTop: spacing.md }]}>
            Confidence is calibrated: 80% means LeafDoc is right about 8 times in 10 on similar photos.
          </Text>
        </Card>

        {confident && topDisease ? <DiseaseDetails disease={topDisease} /> : null}

        <View style={{ gap: spacing.md }}>
          <Button
            title={confident ? 'Scan another leaf' : 'Retake photo'}
            icon="camera-outline"
            onPress={() => pick('camera')}
            disabled={busy}
          />
          {!confident ? (
            <Button title="Photo tips" icon="bulb-outline" variant="secondary" onPress={() => router.push('/tips')} />
          ) : null}
          <Button title="Delete scan" icon="trash-outline" variant="ghost" onPress={confirmDelete} />
        </View>

        <Text style={[font.small, { color: colors.textMuted, textAlign: 'center' }]}>
          {new Date(scan.createdAt).toLocaleString()} · model {diagnosis.modelVersion} · {diagnosis.inferenceMs} ms
          {diagnosis.leafDetected ? ' · leaf auto-cropped' : ''}
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 20 },
});
