/**
 * Opening AltStore so the user can refresh the signature (§3.10).
 *
 * `LSApplicationQueriesSchemes` in app.config.ts lists both schemes, which is
 * what makes `canOpenURL` able to answer truthfully.
 */
import { Linking } from 'react-native';

import { logEvent } from '@/db/repos/misc';

const SCHEMES = ['altstore-classic://', 'altstore://'];

/**
 * Tries each AltStore scheme in turn.
 * @returns false when neither is installed, so the caller can show the manual
 * instructions instead.
 */
export async function openAltStore(): Promise<boolean> {
  for (const scheme of SCHEMES) {
    try {
      if (await Linking.canOpenURL(scheme)) {
        await Linking.openURL(scheme);
        return true;
      }
    } catch {
      // Try the next scheme.
    }
  }
  await logEvent('info', 'AltStore açılamadı');
  return false;
}
