import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  /** Show chemical remedies alongside organic ones. */
  showChemical: boolean;
  haptics: boolean;
  /** Save every scan to history. */
  saveHistory: boolean;
  /** Let the user crop to the leaf right after taking or choosing a photo. */
  cropBeforeAnalyze: boolean;
  /** Has the user seen the photo tips? */
  seenTips: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  showChemical: true,
  haptics: true,
  saveHistory: true,
  cropBeforeAnalyze: true,
  seenTips: false,
};

const KEY = 'leafdoc.settings.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}
