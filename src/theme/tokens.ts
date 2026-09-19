/**
 * Light/dark colour pairs. Every screen reads colours through `useTheme()` so
 * the whole app follows the system appearance without per-screen branching.
 */
export const ACCENT = '#FF7A1A';

export type ThemeName = 'light' | 'dark';

export type Palette = {
  accent: string;
  accentSoft: string;
  background: string;
  groupedBackground: string;
  card: string;
  cardElevated: string;
  separator: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  danger: string;
  dangerSoft: string;
  success: string;
  warning: string;
  warningSoft: string;
  overlay: string;
};

const light: Palette = {
  accent: ACCENT,
  accentSoft: '#FFF0E4',
  background: '#FFFFFF',
  groupedBackground: '#F2F2F7',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  separator: '#D8D8DE',
  text: '#11111A',
  textSecondary: '#5B5B66',
  textTertiary: '#8E8E99',
  danger: '#D93025',
  dangerSoft: '#FDECEA',
  success: '#1E8E3E',
  warning: '#B25000',
  warningSoft: '#FFF2E3',
  overlay: 'rgba(0,0,0,0.35)',
};

const dark: Palette = {
  accent: '#FF9447',
  accentSoft: '#3A2312',
  background: '#000000',
  groupedBackground: '#0B0B0F',
  card: '#1C1C1E',
  cardElevated: '#2C2C2E',
  separator: '#38383C',
  text: '#F5F5F7',
  textSecondary: '#A8A8B0',
  textTertiary: '#7C7C86',
  danger: '#FF6B5E',
  dangerSoft: '#3A1512',
  success: '#4ADE80',
  warning: '#FFB066',
  warningSoft: '#3A2A12',
  overlay: 'rgba(0,0,0,0.6)',
};

export const palettes: Record<ThemeName, Palette> = { light, dark };

/** Spacing scale in points. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Minimum iOS hit target. */
export const MIN_TOUCH = 44;
