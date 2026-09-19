import { useColorScheme } from 'react-native';

import { palettes, type Palette, type ThemeName } from './tokens';

/** The active palette, following the system appearance. */
export function useTheme(): { colors: Palette; scheme: ThemeName; isDark: boolean } {
  const scheme: ThemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colors: palettes[scheme], scheme, isDark: scheme === 'dark' };
}
