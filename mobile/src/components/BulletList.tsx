import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

export function BulletList({ items }: { items: string[] }) {
  const { colors, font } = useTheme();
  return (
    <View style={styles.list}>
      {items.map((item, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={[font.body, styles.text, { color: colors.text }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  text: { flex: 1 },
});
