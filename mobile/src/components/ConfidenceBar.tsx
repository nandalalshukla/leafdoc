import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

export function formatPercent(p: number): string {
  if (p >= 0.995) return '>99%';
  if (p < 0.01) return '<1%';
  return `${Math.round(p * 100)}%`;
}

interface Props {
  label: string;
  sublabel?: string;
  probability: number;
  highlight?: boolean;
}

export function ConfidenceBar({ label, sublabel, probability, highlight }: Props) {
  const { colors, font } = useTheme();
  const pct = Math.max(0, Math.min(1, probability));
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`${label}${sublabel ? `, ${sublabel}` : ''}: ${formatPercent(pct)} confidence`}
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[font.subheading, { color: colors.text }]} numberOfLines={2}>
            {label}
          </Text>
          {sublabel ? <Text style={[font.small, { color: colors.textMuted }]}>{sublabel}</Text> : null}
        </View>
        <Text style={[font.subheading, { color: highlight ? colors.primary : colors.textMuted }]}>{formatPercent(pct)}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        <View
          style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: highlight ? colors.primary : colors.textMuted }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
