import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { useTheme } from '../theme';

const TIPS: { icon: ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
  { icon: 'leaf-outline', title: 'One leaf, filling the frame', body: 'Get close so a single affected leaf covers most of the photo.' },
  { icon: 'sunny-outline', title: 'Even daylight', body: 'Bright shade or an overcast sky is best. Avoid harsh sun, flash and deep shadows.' },
  { icon: 'scan-outline', title: 'Tap to focus', body: 'Hold the phone steady and tap the leaf so the spots are sharp.' },
  { icon: 'albums-outline', title: 'Plain background', body: 'Hold the leaf against soil, your palm or paper rather than other leaves.' },
  { icon: 'repeat-outline', title: 'Check more than one leaf', body: 'If LeafDoc is unsure, try a different leaf showing the clearest symptoms.' },
];

export default function TipsScreen() {
  const { colors, font, spacing } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} style={{ backgroundColor: colors.background }}>
      <Text style={[font.body, { color: colors.textMuted }]}>
        LeafDoc was trained mostly on clean, close-up leaf photos. The closer your photo is to that, the more reliable
        the result.
      </Text>
      {TIPS.map((t) => (
        <View key={t.title} style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name={t.icon} size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[font.subheading, { color: colors.text }]}>{t.title}</Text>
            <Text style={[font.body, { color: colors.textMuted }]}>{t.body}</Text>
          </View>
        </View>
      ))}
      <Button title="Got it" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
