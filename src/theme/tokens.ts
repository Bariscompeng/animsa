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
  groupedBackground: '#EFEFF4',
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
  accentSoft: '#3D2514',
  // Not pure black: cards need a surface to sit on, otherwise every grouped
  // list dissolves into the background and the screen reads as unfinished.
  background: '#141417',
  groupedBackground: '#0C0C0E',
  card: '#1E1E22',
  cardElevated: '#2A2A30',
  separator: '#3A3A41',
  text: '#FAFAFC',
  textSecondary: '#B4B4BE',
  textTertiary: '#86868F',
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

/** Type scale. Screens pick from here instead of inventing sizes. */
export const type = {
  hero: { size: 28, weight: '700' as const },
  title: { size: 22, weight: '700' as const },
  headline: { size: 17, weight: '600' as const },
  body: { size: 17, weight: '400' as const },
  callout: { size: 15, weight: '400' as const },
  caption: { size: 13, weight: '400' as const },
  label: { size: 12, weight: '600' as const },
} as const;

/** Minimum iOS hit target. */
export const MIN_TOUCH = 44;
