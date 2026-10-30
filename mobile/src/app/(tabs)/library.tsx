import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge } from '../../components/Badge';
import { severityTone } from '../../components/DiseaseDetails';
import { EmptyState } from '../../components/EmptyState';
import { groupByPlant, searchDiseases, SEVERITY_LABEL, TYPE_LABEL } from '../../data/knowledge';
import { useTheme } from '../../theme';

export default function LibraryScreen() {
  const { colors, font, spacing, radius } = useTheme();
  const [query, setQuery] = useState('');
  const sections = useMemo(() => groupByPlant(searchDiseases(query)), [query]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(d) => d.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search plant, disease or symptom"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text }]}
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search diseases"
          />
        </View>
      }
      ListEmptyComponent={<EmptyState icon="search-outline" title="No matches" body="Try a plant name like tomato." />}
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={[font.subheading, { color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          {section.plant}
        </Text>
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/disease/[id]', params: { id: item.id } }} asChild>
          <Pressable
            accessibilityRole="link"
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[font.subheading, { color: colors.text }]}>{item.name}</Text>
              <View style={styles.badges}>
                <Badge label={TYPE_LABEL[item.type]} tone={item.type === 'healthy' ? 'success' : 'neutral'} />
                {item.type !== 'healthy' ? <Badge label={SEVERITY_LABEL[item.severity]} tone={severityTone(item)} /> : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
});
