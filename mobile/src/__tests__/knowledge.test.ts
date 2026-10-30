import { describe, expect, it } from '@jest/globals';

import meta from '../../assets/model/model-meta.json';
import { DISEASES, getDiseaseByLabel, groupByPlant, searchDiseases } from '../data/knowledge';

describe('knowledge base', () => {
  it('covers the 38 PlantVillage classes with unique ids and labels', () => {
    expect(DISEASES).toHaveLength(38);
    expect(new Set(DISEASES.map((d) => d.id)).size).toBe(38);
    expect(new Set(DISEASES.map((d) => d.label)).size).toBe(38);
  });

  it('has an entry for every model label', () => {
    for (const label of meta.labels) expect(getDiseaseByLabel(label)).toBeDefined();
  });

  it('fills every remedy section', () => {
    for (const d of DISEASES) {
      for (const field of ['symptoms', 'organic', 'chemical', 'prevention'] as const) {
        expect(d[field].length).toBeGreaterThan(0);
      }
      expect(d.cause.length).toBeGreaterThan(0);
      expect(d.type === 'healthy').toBe(d.severity === 'none');
    }
  });

  it('labels are sorted the way torchvision ImageFolder sorts class folders', () => {
    expect([...meta.labels].sort()).toEqual(meta.labels);
  });

  it('groups by plant with healthy entries last', () => {
    const tomato = groupByPlant().find((g) => g.plant === 'Tomato')!;
    expect(tomato.data).toHaveLength(10);
    expect(tomato.data.at(-1)?.type).toBe('healthy');
  });

  it('searches names and symptoms', () => {
    expect(searchDiseases('late blight').map((d) => d.id)).toEqual(['potato_late_blight', 'tomato_late_blight']);
    expect(searchDiseases('webbing').map((d) => d.id)).toContain('tomato_spider_mites');
  });
});
