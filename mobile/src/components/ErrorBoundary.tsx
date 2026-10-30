import type { ErrorBoundaryProps } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { Button } from './Button';

/** Route-level error boundary used by expo-router for every screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors, font } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <Text style={[font.title, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[font.body, { color: colors.textMuted }]}>
        LeafDoc hit an unexpected problem. Your saved scans are safe.
      </Text>
      <ScrollView style={[styles.box, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[font.small, { color: colors.textMuted }]}>{error.message}</Text>
      </ScrollView>
      <Button title="Try again" icon="refresh" onPress={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  box: { maxHeight: 160, padding: 12, borderRadius: 12 },
});
