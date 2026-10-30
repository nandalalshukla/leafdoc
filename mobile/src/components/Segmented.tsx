import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.item, { borderRadius: radius.sm }, selected && { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.text, { color: selected ? colors.primary : colors.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 4, gap: 4 },
  item: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  text: { fontWeight: '600', fontSize: 14 },
});
