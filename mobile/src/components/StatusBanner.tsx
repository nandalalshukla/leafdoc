import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { REASON_TEXT } from '../ml/decision';
import type { DiagnosisReason, DiagnosisStatus } from '../ml/types';
import { useTheme } from '../theme';

const COPY: Record<DiagnosisStatus, { title: string; body: string }> = {
  confident: { title: 'Likely diagnosis', body: 'The model is confident about this photo.' },
  unsure: {
    title: 'Not sure — please retake',
    body: "LeafDoc can't tell for certain. Here are the closest matches, but take another photo before you treat.",
  },
  retake: {
    title: 'Photo problem — retake',
    body: 'The photo is hard to read. Follow the tips below and try again.',
  },
};

export function StatusBanner({ status, reasons }: { status: DiagnosisStatus; reasons: DiagnosisReason[] }) {
  const { colors, font, radius } = useTheme();
  const tone =
    status === 'confident'
      ? { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle' as const }
      : status === 'unsure'
        ? { bg: colors.warningSoft, fg: colors.warning, icon: 'help-circle' as const }
        : { bg: colors.dangerSoft, fg: colors.danger, icon: 'camera-reverse' as const };
  const { title, body } = COPY[status];
  const shownReasons = status === 'confident' ? [] : reasons;

  return (
    <View
      style={[styles.wrap, { backgroundColor: tone.bg, borderRadius: radius.lg }]}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.header}>
        <Ionicons name={tone.icon} size={24} color={tone.fg} />
        <Text style={[font.heading, { color: tone.fg, flex: 1 }]}>{title}</Text>
      </View>
      <Text style={[font.body, { color: colors.text }]}>{body}</Text>
      {shownReasons.map((r) => (
        <Text key={r} style={[font.small, { color: colors.text }]}>
          • {REASON_TEXT[r]}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
