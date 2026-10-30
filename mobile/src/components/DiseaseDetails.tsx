import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DISCLAIMER, SEVERITY_LABEL, TYPE_LABEL, type DiseaseInfo } from '../data/knowledge';
import { useSettings } from '../hooks/SettingsProvider';
import { useTheme } from '../theme';
import { Badge } from './Badge';
import { BulletList } from './BulletList';
import { Card } from './Card';
import { Segmented } from './Segmented';

type RemedyTab = 'organic' | 'chemical';

export function severityTone(d: DiseaseInfo) {
  return d.severity === 'high' ? 'danger' : d.severity === 'moderate' ? 'warning' : d.severity === 'none' ? 'success' : 'info';
}

export function DiseaseHeader({ disease }: { disease: DiseaseInfo }) {
  const { colors, font } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[font.small, { color: colors.textMuted, textTransform: 'uppercase', fontWeight: '700' }]}>
        {disease.plant}
      </Text>
      <Text accessibilityRole="header" style={[font.title, { color: colors.text }]}>
        {disease.name}
      </Text>
      {disease.pathogen ? (
        <Text style={[font.small, { color: colors.textMuted, fontStyle: 'italic' }]}>{disease.pathogen}</Text>
      ) : null}
      <View style={styles.badges}>
        <Badge label={TYPE_LABEL[disease.type]} tone={disease.type === 'healthy' ? 'success' : 'neutral'} />
        <Badge label={SEVERITY_LABEL[disease.severity]} tone={severityTone(disease)} />
      </View>
      <Text style={[font.body, { color: colors.text }]}>{disease.summary}</Text>
    </View>
  );
}

export function DiseaseDetails({ disease }: { disease: DiseaseInfo }) {
  const { colors, font } = useTheme();
  const { settings } = useSettings();
  const [tab, setTab] = useState<RemedyTab>('organic');
  const healthy = disease.type === 'healthy';
  const activeTab = settings.showChemical ? tab : 'organic';

  return (
    <View style={{ gap: 14 }}>
      {!healthy && (
        <Card title="What to do">
          {settings.showChemical ? (
            <Segmented<RemedyTab>
              value={activeTab}
              onChange={setTab}
              options={[
                { value: 'organic', label: 'Organic' },
                { value: 'chemical', label: 'Chemical' },
              ]}
            />
          ) : null}
          <View style={{ marginTop: 12 }}>
            <BulletList items={activeTab === 'organic' ? disease.organic : disease.chemical} />
          </View>
          {activeTab === 'chemical' ? (
            <Text style={[font.small, { color: colors.warning, marginTop: 12 }]}>
              Use chemicals only after confirming the diagnosis. Follow the label, wear protection and observe the
              pre-harvest interval.
            </Text>
          ) : null}
        </Card>
      )}
      <Card title={healthy ? 'Looks healthy' : 'Cause'}>
        <Text style={[font.body, { color: colors.text }]}>{disease.cause}</Text>
      </Card>
      <Card title={healthy ? 'What healthy looks like' : 'Symptoms to check'}>
        <BulletList items={disease.symptoms} />
      </Card>
      <Card title="Prevention">
        <BulletList items={disease.prevention} />
      </Card>
      <Text style={[font.small, { color: colors.textMuted }]}>{DISCLAIMER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
