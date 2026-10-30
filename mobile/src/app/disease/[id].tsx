import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { DiseaseDetails, DiseaseHeader } from '../../components/DiseaseDetails';
import { EmptyState } from '../../components/EmptyState';
import { getDisease } from '../../data/knowledge';
import { useTheme } from '../../theme';

export default function DiseaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const disease = getDisease(id);
  const { spacing } = useTheme();

  if (!disease) return <EmptyState icon="help-circle-outline" title="Unknown disease" />;

  return (
    <>
      <Stack.Screen options={{ title: disease.plant }} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: 48 }}>
        <DiseaseHeader disease={disease} />
        <DiseaseDetails disease={disease} />
      </ScrollView>
    </>
  );
}
