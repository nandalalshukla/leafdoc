import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

interface Props {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, body, children }: Props) {
  const { colors, font } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text style={[font.heading, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[font.body, { color: colors.textMuted, textAlign: 'center' }]}>{body}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
