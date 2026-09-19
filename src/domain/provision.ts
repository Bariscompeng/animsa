/**
 * Signature guard (§3.10, §5.9).
 *
 * `embedded.mobileprovision` is a CMS-signed container, but the profile itself
 * is a plain XML plist embedded in the binary. Decoding the bytes as latin1 and
 * pulling out `ExpirationDate` is enough — and never throws on garbage input.
 */

const EXPIRY_RE = /<key>ExpirationDate<\/key>\s*<date>([^<]+)<\/date>/;

/** Hours before expiry at which the app warns. */
export const WARN_HOURS = [48, 24] as const;
/** Hours before expiry at which the app raises an alarm instead. */
export const ALARM_HOURS = 12;
/** Below this many hours the Today screen shows the orange banner. */
export const BANNER_HOURS = 48;

/**
 * Extracts the provisioning profile expiry.
 * @returns the expiry date, or null when the text holds no readable date.
 */
export function parseProvisionExpiry(text: string): Date | null {
  if (!text) return null;
  const m = EXPIRY_RE.exec(text);
  if (!m || !m[1]) return null;
  const parsed = new Date(m[1]);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Decodes raw profile bytes as latin1 so the embedded XML stays intact. */
export function bytesToLatin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    out += String.fromCharCode(...slice);
  }
  return out;
}

export type SignatureStatus = {
  expiresAt: Date | null;
  msRemaining: number | null;
  hoursRemaining: number | null;
  expired: boolean;
  /** True when the Today screen should show the warning banner. */
  showBanner: boolean;
};

export function signatureStatus(expiresAt: Date | null, now: Date): SignatureStatus {
  if (!expiresAt) {
    return {
      expiresAt: null,
      msRemaining: null,
      hoursRemaining: null,
      expired: false,
      showBanner: false,
    };
  }
  const msRemaining = expiresAt.getTime() - now.getTime();
  const hoursRemaining = msRemaining / 3_600_000;
  return {
    expiresAt,
    msRemaining,
    hoursRemaining,
    expired: msRemaining <= 0,
    showBanner: msRemaining > 0 && hoursRemaining < BANNER_HOURS,
  };
}
