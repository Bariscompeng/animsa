/**
 * Pure helpers for building and updating the AltStore source JSON (§9.5).
 *
 * Kept free of `gh`, the filesystem and the network so the update logic can be
 * unit-tested (§10).
 */

export const SOURCE_IDENTIFIER = 'com.bariscoskun.animsa.source';
export const SOURCE_TAG = 'altstore-source';
export const TINT_COLOR = '#FF7A1A';
export const DEVELOPER_NAME = 'Barış Coşkun';
export const MIN_OS_VERSION = '26.0';

/** Versions kept per app entry; older ones are dropped. */
export const KEEP_VERSIONS = 5;

export const BUNDLE_IDS = {
  release: 'com.bariscoskun.animsa',
  dev: 'com.bariscoskun.animsa.dev',
};

const APP_NAMES = {
  release: 'Anımsa',
  dev: 'Anımsa Dev',
};

const APP_DESCRIPTIONS = {
  release: 'Görev, alarm, ev listesi ve konum hatırlatıcı.',
  dev: 'Anımsa geliştirme sürümü. Günlük kullanım için Anımsa uygulamasını kur.',
};

/**
 * Every `*UsageDescription` key from the built app's Info.plist.
 * AltStore compares these against the IPA, so they must match exactly.
 *
 * Emitted as an ARRAY of `{ name, usageDescription }`, not a dictionary:
 * AltStore Classic decodes each entry into a type with a required `name`, and
 * a dictionary makes it fail the whole source with
 * `No value associated with key CodingKeys(stringValue: "name")`.
 */
export function privacyFromInfoPlist(infoPlist) {
  const out = [];
  for (const [key, value] of Object.entries(infoPlist ?? {})) {
    if (key.endsWith('UsageDescription') && typeof value === 'string') {
      out.push({ name: key, usageDescription: value });
    }
  }
  return out;
}

/** An empty source with no apps yet. */
export function emptySource(iconUrl) {
  return {
    name: 'Anımsa',
    identifier: SOURCE_IDENTIFIER,
    subtitle: 'Kişisel kaynak',
    iconURL: iconUrl,
    tintColor: TINT_COLOR,
    apps: [],
    news: [],
  };
}

/**
 * Legacy fields that older AltStore Classic builds read straight off the app
 * object, before the `versions` array existed.
 *
 * Their absence is not a graceful degradation: the app's Swift decoder throws
 * "No value associated with key", and the whole source fails to add with no
 * indication of which key was missing. Newer builds ignore these, so emitting
 * both shapes costs nothing and makes the source work on either.
 */
function legacyFields(entry) {
  return {
    version: entry.version,
    versionDate: entry.date,
    versionDescription: entry.localizedDescription,
    downloadURL: entry.downloadURL,
    size: entry.size,
    // Sources this AltStore build accepts always carry this one.
    screenshotURLs: [],
  };
}

/**
 * Inserts a new version at the head of the matching app entry, creating the
 * entry when the variant appears for the first time.
 *
 * @param source Existing source JSON (or a fresh one from `emptySource`).
 * @param variant 'release' | 'dev'
 * @param version Version payload: version, buildVersion, date, downloadURL,
 *                size, sha256, localizedDescription.
 * @param meta    { iconUrl, privacy }
 * @returns a new source object; the input is not mutated.
 */
export function upsertVersion(source, variant, version, meta) {
  const bundleIdentifier = BUNDLE_IDS[variant];
  if (!bundleIdentifier) throw new Error(`Bilinmeyen varyant: ${variant}`);

  const next = {
    ...source,
    apps: [...(source.apps ?? [])],
    news: source.news ?? [],
  };

  const entry = {
    version: version.version,
    buildVersion: version.buildVersion,
    date: version.date,
    localizedDescription: version.localizedDescription,
    downloadURL: version.downloadURL,
    size: version.size,
    sha256: version.sha256,
    minOSVersion: MIN_OS_VERSION,
  };

  const index = next.apps.findIndex((a) => a.bundleIdentifier === bundleIdentifier);

  if (index === -1) {
    next.apps.push({
      name: APP_NAMES[variant],
      bundleIdentifier,
      developerName: DEVELOPER_NAME,
      subtitle: APP_DESCRIPTIONS[variant],
      localizedDescription: APP_DESCRIPTIONS[variant],
      iconURL: meta.iconUrl,
      tintColor: TINT_COLOR,
      ...legacyFields(entry),
      versions: [entry],
      appPermissions: { entitlements: [], privacy: meta.privacy },
    });
    return next;
  }

  const existing = next.apps[index];
  // A rebuild of the same build number replaces rather than duplicates.
  const withoutDuplicate = (existing.versions ?? []).filter(
    (v) => !(v.version === entry.version && v.buildVersion === entry.buildVersion),
  );

  next.apps[index] = {
    ...existing,
    subtitle: existing.subtitle ?? APP_DESCRIPTIONS[variant],
    iconURL: meta.iconUrl,
    // The legacy block always mirrors the newest version.
    ...legacyFields(entry),
    versions: [entry, ...withoutDuplicate].slice(0, KEEP_VERSIONS),
    appPermissions: { entitlements: [], privacy: meta.privacy },
  };

  return next;
}

/** The permanent URL AltStore subscribes to. */
export function sourceUrl(owner, repo = 'animsa') {
  return `https://github.com/${owner}/${repo}/releases/download/${SOURCE_TAG}/source.json`;
}

export function downloadUrl(owner, repo, tag, fileName) {
  return `https://github.com/${owner}/${repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`;
}

export function releaseTag(variant, version, build) {
  return `${variant}-${version}-${build}`;
}
