/**
 * Tests for the AltStore source-update logic (§10). The script's pure half
 * lives in `scripts/altstoreSource.mjs` precisely so it can be tested here.
 */
import {
  BUNDLE_IDS,
  KEEP_VERSIONS,
  MIN_OS_VERSION,
  downloadUrl,
  emptySource,
  privacyFromInfoPlist,
  releaseTag,
  sourceUrl,
  upsertVersion,
} from '../../scripts/altstoreSource.mjs';

type AltVersion = {
  version: string;
  buildVersion: string;
  date: string;
  localizedDescription: string;
  downloadURL: string;
  size: number;
  sha256: string;
  minOSVersion?: string;
};

type AltApp = {
  name: string;
  bundleIdentifier: string;
  versions: AltVersion[];
  appPermissions: { entitlements: unknown[]; privacy: Record<string, string> };
  iconURL: string;
};

type AltSource = { identifier: string; apps: AltApp[]; news: unknown[]; iconURL: string };

const ICON = 'https://example.invalid/icon.png';
const META = { iconUrl: ICON, privacy: { NSCameraUsageDescription: 'Kamera' } };

const version = (over: Partial<AltVersion> = {}): AltVersion => ({
  version: '1.0.0',
  buildVersion: '42',
  date: '2026-09-19T12:00:00.000Z',
  localizedDescription: 'Değişiklikler',
  downloadURL: 'https://example.invalid/Animsa.ipa',
  size: 12_345_678,
  sha256: 'a'.repeat(64),
  ...over,
});

const appFor = (src: AltSource, variant: 'release' | 'dev'): AltApp | undefined =>
  src.apps.find((a) => a.bundleIdentifier === BUNDLE_IDS[variant]);

describe('privacyFromInfoPlist', () => {
  it('keeps only *UsageDescription keys', () => {
    const result = privacyFromInfoPlist({
      NSCameraUsageDescription: 'Kamera',
      NSAlarmKitUsageDescription: 'Alarm',
      CFBundleVersion: '42',
      UIFileSharingEnabled: true,
    });
    expect(result).toEqual({
      NSCameraUsageDescription: 'Kamera',
      NSAlarmKitUsageDescription: 'Alarm',
    });
  });

  it('ignores non-string values', () => {
    expect(privacyFromInfoPlist({ NSFooUsageDescription: 42 })).toEqual({});
  });

  it('handles a missing plist', () => {
    expect(privacyFromInfoPlist(undefined as never)).toEqual({});
  });
});

describe('emptySource', () => {
  it('starts with no apps', () => {
    const src = emptySource(ICON);
    expect(src.apps).toEqual([]);
    expect(src.identifier).toBe('com.bariscoskun.animsa.source');
  });
});

describe('upsertVersion', () => {
  it('creates the app entry on first publish', () => {
    const result = upsertVersion(emptySource(ICON), 'release', version(), META);
    const app = appFor(result, 'release');
    expect(app).toBeDefined();
    expect(app!.versions).toHaveLength(1);
    expect(app!.name).toBe('Anımsa');
  });

  it('stamps the minimum iOS version', () => {
    const result = upsertVersion(emptySource(ICON), 'release', version(), META);
    expect(appFor(result, 'release')!.versions[0]!.minOSVersion).toBe(MIN_OS_VERSION);
  });

  it('puts the newest version first', () => {
    let src = upsertVersion(emptySource(ICON), 'release', version({ buildVersion: '1' }), META);
    src = upsertVersion(src, 'release', version({ buildVersion: '2' }), META);
    const versions = appFor(src, 'release')!.versions;
    expect(versions[0]!.buildVersion).toBe('2');
    expect(versions[1]!.buildVersion).toBe('1');
  });

  it('keeps at most five versions', () => {
    let src = emptySource(ICON);
    for (let i = 1; i <= 8; i++) {
      src = upsertVersion(src, 'release', version({ buildVersion: String(i) }), META);
    }
    const versions = appFor(src, 'release')!.versions;
    expect(versions).toHaveLength(KEEP_VERSIONS);
    expect(versions[0]!.buildVersion).toBe('8');
    expect(versions[KEEP_VERSIONS - 1]!.buildVersion).toBe('4');
  });

  it('replaces a rebuild of the same version and build', () => {
    let src = upsertVersion(
      emptySource(ICON),
      'release',
      version({ sha256: 'a'.repeat(64) }),
      META,
    );
    src = upsertVersion(src, 'release', version({ sha256: 'b'.repeat(64) }), META);
    const versions = appFor(src, 'release')!.versions;
    expect(versions).toHaveLength(1);
    expect(versions[0]!.sha256).toBe('b'.repeat(64));
  });

  it('keeps release and dev as two separate entries', () => {
    let src = upsertVersion(emptySource(ICON), 'release', version(), META);
    src = upsertVersion(src, 'dev', version(), META);
    expect(src.apps).toHaveLength(2);
    expect(appFor(src, 'release')!.bundleIdentifier).toBe('com.bariscoskun.animsa');
    expect(appFor(src, 'dev')!.bundleIdentifier).toBe('com.bariscoskun.animsa.dev');
  });

  it('does not touch the dev entry when publishing release', () => {
    let src = upsertVersion(emptySource(ICON), 'dev', version({ buildVersion: '7' }), META);
    src = upsertVersion(src, 'release', version({ buildVersion: '9' }), META);
    expect(appFor(src, 'dev')!.versions[0]!.buildVersion).toBe('7');
  });

  it('always reports empty entitlements (the IPA is unsigned)', () => {
    const src = upsertVersion(emptySource(ICON), 'release', version(), META);
    expect(appFor(src, 'release')!.appPermissions.entitlements).toEqual([]);
  });

  it('carries the privacy strings through verbatim', () => {
    const privacy = {
      NSCameraUsageDescription: 'Kamera izni',
      NSAlarmKitUsageDescription: 'Alarm',
    };
    const src = upsertVersion(emptySource(ICON), 'release', version(), { iconUrl: ICON, privacy });
    expect(appFor(src, 'release')!.appPermissions.privacy).toEqual(privacy);
  });

  it('refreshes privacy on a later publish', () => {
    let src = upsertVersion(emptySource(ICON), 'release', version({ buildVersion: '1' }), META);
    src = upsertVersion(src, 'release', version({ buildVersion: '2' }), {
      iconUrl: ICON,
      privacy: { NSCameraUsageDescription: 'Yeni metin' },
    });
    expect(appFor(src, 'release')!.appPermissions.privacy).toEqual({
      NSCameraUsageDescription: 'Yeni metin',
    });
  });

  it('does not mutate the input', () => {
    const original = emptySource(ICON);
    upsertVersion(original, 'release', version(), META);
    expect(original.apps).toHaveLength(0);
  });

  it('rejects an unknown variant', () => {
    expect(() => upsertVersion(emptySource(ICON), 'beta', version(), META)).toThrow();
  });

  it('produces valid JSON', () => {
    const src = upsertVersion(emptySource(ICON), 'release', version(), META);
    expect(() => JSON.parse(JSON.stringify(src))).not.toThrow();
  });
});

describe('legacy AltStore Classic fields', () => {
  // Older builds read the newest version off the app object itself. Omitting
  // these makes the Swift decoder throw "No value associated with key" and the
  // source fails to add, with no hint about which key was missing.
  const LEGACY = [
    'version',
    'versionDate',
    'versionDescription',
    'downloadURL',
    'size',
    'screenshotURLs',
    'permissions',
    'subtitle',
  ];

  it('emits every legacy field on a new app entry', () => {
    const src = upsertVersion(emptySource(ICON), 'release', version(), META);
    const app = appFor(src, 'release')! as unknown as Record<string, unknown>;
    for (const key of LEGACY) {
      expect(Object.keys(app)).toContain(key);
    }
  });

  it('mirrors the newest version in the legacy block', () => {
    let src = upsertVersion(emptySource(ICON), 'release', version({ buildVersion: '1' }), META);
    src = upsertVersion(
      src,
      'release',
      version({ buildVersion: '2', downloadURL: 'https://example.invalid/new.ipa' }),
      META,
    );
    const app = appFor(src, 'release')! as unknown as Record<string, unknown>;
    expect(app.downloadURL).toBe('https://example.invalid/new.ipa');
    expect(app.versions).toHaveLength(2);
  });

  it('keeps the modern versions array alongside', () => {
    const src = upsertVersion(emptySource(ICON), 'release', version(), META);
    const app = appFor(src, 'release')!;
    expect(app.versions[0]!.buildVersion).toBe('42');
  });
});

describe('url helpers', () => {
  it('builds the permanent source URL', () => {
    expect(sourceUrl('kullanici')).toBe(
      'https://github.com/kullanici/animsa/releases/download/altstore-source/source.json',
    );
  });

  it('builds the release tag', () => {
    expect(releaseTag('release', '1.0.0', '42')).toBe('release-1.0.0-42');
    expect(releaseTag('dev', '1.0.0', '42')).toBe('dev-1.0.0-42');
  });

  it('builds a download URL', () => {
    expect(downloadUrl('me', 'animsa', 'release-1.0.0-42', 'Animsa-release-1.0.0-42.ipa')).toBe(
      'https://github.com/me/animsa/releases/download/release-1.0.0-42/Animsa-release-1.0.0-42.ipa',
    );
  });
});
