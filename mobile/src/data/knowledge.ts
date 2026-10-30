import data from './diseases.json';

export type DiseaseType = 'fungal' | 'bacterial' | 'viral' | 'oomycete' | 'pest' | 'healthy';
export type Severity = 'none' | 'low' | 'moderate' | 'high';

export interface DiseaseInfo {
  id: string;
  /** PlantVillage folder name used as the model label. */
  label: string;
  plant: string;
  name: string;
  pathogen?: string;
  type: DiseaseType;
  severity: Severity;
  summary: string;
  cause: string;
  symptoms: string[];
  organic: string[];
  chemical: string[];
  prevention: string[];
}

export const DISCLAIMER: string = data.disclaimer;
export const DISEASES = data.classes as DiseaseInfo[];

const byId = new Map(DISEASES.map((d) => [d.id, d]));
const byLabel = new Map(DISEASES.map((d) => [d.label, d]));

export function getDisease(id: string | undefined): DiseaseInfo | undefined {
  return id ? byId.get(id) : undefined;
}

export function getDiseaseByLabel(label: string): DiseaseInfo | undefined {
  return byLabel.get(label);
}

export const TYPE_LABEL: Record<DiseaseType, string> = {
  fungal: 'Fungus',
  bacterial: 'Bacteria',
  viral: 'Virus',
  oomycete: 'Water mould',
  pest: 'Pest',
  healthy: 'Healthy',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  none: 'No action needed',
  low: 'Low risk',
  moderate: 'Act soon',
  high: 'Act now',
};

/** Diseases grouped by plant, plants sorted alphabetically, healthy entry last. */
export function groupByPlant(list: DiseaseInfo[] = DISEASES): { plant: string; data: DiseaseInfo[] }[] {
  const groups = new Map<string, DiseaseInfo[]>();
  for (const d of list) {
    const g = groups.get(d.plant) ?? [];
    g.push(d);
    groups.set(d.plant, g);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([plant, data]) => ({
      plant,
      data: [...data].sort((a, b) => Number(a.type === 'healthy') - Number(b.type === 'healthy') || a.name.localeCompare(b.name)),
    }));
}

export function searchDiseases(query: string, list: DiseaseInfo[] = DISEASES): DiseaseInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((d) =>
    [d.name, d.plant, d.pathogen ?? '', d.summary, ...d.symptoms].some((s) => s.toLowerCase().includes(q)),
  );
}
