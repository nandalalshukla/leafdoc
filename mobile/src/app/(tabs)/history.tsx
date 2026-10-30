import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { formatPercent } from '../../components/ConfidenceBar';
import { EmptyState } from '../../components/EmptyState';
import { getDisease, getDiseaseByLabel } from '../../data/knowledge';
import { useScans } from '../../hooks/useScans';
import { useTheme } from '../../theme';

const STATUS = {
  confident: { label: 'Diagnosed', tone: 'success' },
  unsure: { label: 'Not sure', tone: 'warning' },
  retake: { label: 'Retake', tone: 'danger' },
} as const;

export default function HistoryScreen() {
  const scans = useScans();
  const { colors, font, spacing, radius } = useTheme();

  if (scans === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (scans.length === 0) {
    return (
      <EmptyState icon="time-outline" title="No scans yet" body="Your leaf checks are saved here, on this phone only.">
        <Button title="Scan a leaf" icon="camera-outline" onPress={() => router.navigate('/')} />
      </EmptyState>
    );
  }

  return (
    <FlatList
      data={scans}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 48 }}
      renderItem={({ item }) => {
        const top = item.diagnosis.predictions[0];
        const disease = top ? (getDisease(top.diseaseId) ?? getDiseaseByLabel(top.label)) : undefined;
        const status = STATUS[item.diagnosis.status];
        return (
          <Link href={{ pathname: '/scan/[id]', params: { id: item.id } }} asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Image source={{ uri: item.imageUri }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[font.subheading, { color: colors.text }]} numberOfLines={1}>
                  {disease ? disease.name : 'Unknown'}
                </Text>
                <Text style={[font.small, { color: colors.textMuted }]}>
                  {disease?.plant ? `${disease.plant} · ` : ''}
                  {top ? formatPercent(top.probability) : ''} · {new Date(item.createdAt).toLocaleDateString()}
                </Text>
                <Badge label={status.label} tone={status.tone} />
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </Link>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: 64, height: 64, borderRadius: 10 },
});
