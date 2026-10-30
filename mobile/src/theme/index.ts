import { useColorScheme } from 'react-native';

const light = {
  background: '#F3F8F1',
  surface: '#FFFFFF',
  surfaceAlt: '#E7F0E3',
  border: '#D5E2CF',
  text: '#13241A',
  textMuted: '#55685B',
  primary: '#2E7D32',
  primaryText: '#FFFFFF',
  primarySoft: '#DCEFD9',
  accent: '#8D6E00',
  success: '#2E7D32',
  successSoft: '#DCEFD9',
  warning: '#9A6200',
  warningSoft: '#FFF1D6',
  danger: '#B3261E',
  dangerSoft: '#FCE3E0',
  info: '#1F5E8C',
  infoSoft: '#DDEBF6',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#0F1A12',
  surface: '#17251B',
  surfaceAlt: '#1F3125',
  border: '#2C4232',
  text: '#E6F0E7',
  textMuted: '#9DB3A3',
  primary: '#7CC47F',
  primaryText: '#0B1A0E',
  primarySoft: '#21402A',
  accent: '#E0C04A',
  success: '#7CC47F',
  successSoft: '#21402A',
  warning: '#F2B544',
  warningSoft: '#3A2E14',
  danger: '#F28B82',
  dangerSoft: '#40201D',
  info: '#8CC4F0',
  infoSoft: '#1A3245',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const font = {
  title: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 19, fontWeight: '700' as const },
  subheading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
};

export function useTheme() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? dark : light;
  return { colors, dark: scheme === 'dark', spacing, radius, font };
}
