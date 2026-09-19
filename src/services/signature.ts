/**
 * Signature guard (§3.10).
 *
 * Reads the app bundle's own provisioning profile to learn when the free
 * seven-day signature expires. Everything here is best-effort: a development
 * build has no profile at all, and the app must simply report "Bilinmiyor".
 */
import { Directory, File, Paths } from 'expo-file-system';

import { logEvent } from '@/db/repos/misc';
import { getSetting, setSetting } from '@/db/repos/settings';
import {
  bytesToLatin1,
  parseProvisionExpiry,
  signatureStatus,
  type SignatureStatus,
} from '@/domain/provision';

const PROFILE_NAME = 'embedded.mobileprovision';

/**
 * Reads and parses the embedded provisioning profile.
 * @returns the expiry date, or null when there is no readable profile.
 */
export function readProvisionExpiry(): Date | null {
  try {
    const bundle: Directory = Paths.bundle;
    const file = new File(bundle, PROFILE_NAME);
    if (!file.exists) return null;
    const bytes = file.bytesSync();
    return parseProvisionExpiry(bytesToLatin1(bytes));
  } catch {
    // A missing or unreadable profile is normal in development.
    return null;
  }
}

/**
 * Re-reads the profile and stores the expiry.
 *
 * AltStore rewrites the profile when it refreshes, so this runs every time the
 * app comes to the foreground.
 *
 * @returns `{ status, changed }` — `changed` tells the caller to re-run the
 * reminder sync so the warnings move with the new date.
 */
export async function refresh(now: Date = new Date()): Promise<{
  status: SignatureStatus;
  changed: boolean;
}> {
  const expiry = readProvisionExpiry();
  const stored = await getSetting('signatureExpiresAt');
  const next = expiry ? expiry.getTime() : null;
  const changed = stored !== next;

  if (changed) {
    await setSetting('signatureExpiresAt', next);
    await logEvent('info', 'İmza bitiş tarihi güncellendi', {
      from: stored,
      to: next,
    });
  }

  return { status: signatureStatus(expiry, now), changed };
}

/** The stored status, without touching the filesystem. */
export async function currentStatus(now: Date = new Date()): Promise<SignatureStatus> {
  const stored = await getSetting('signatureExpiresAt');
  return signatureStatus(stored === null ? null : new Date(stored), now);
}

export { signatureStatus };
export type { SignatureStatus };
