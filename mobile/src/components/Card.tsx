import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

export function Card({ children, style, title }: { children: ReactNode; style?: ViewStyle; title?: string }) {
  const { colors, radius, spacing, font } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },
        style,
      ]}
    >
      {title ? (
        <Text accessibilityRole="header" style={[font.subheading, { color: colors.text, marginBottom: spacing.sm }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
});
