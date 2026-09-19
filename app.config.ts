import type { ConfigContext, ExpoConfig } from 'expo/config';

type Variant = 'release' | 'dev';

const variant: Variant = process.env.APP_VARIANT === 'dev' ? 'dev' : 'release';
const isDev = variant === 'dev';

const displayName = isDev ? 'Anımsa Dev' : 'Anımsa';
const bundleIdentifier = isDev ? 'com.bariscoskun.animsa.dev' : 'com.bariscoskun.animsa';
const scheme = isDev ? 'animsa-dev' : 'animsa';
const icon = isDev ? './assets/icon-dev.png' : './assets/icon.png';

const ALARM_KIT_USAGE =
  'Alarmlı görevlerin sessiz modda da çalabilmesi için alarm kurma izni gerekiyor.';
const LOCATION_WHEN_IN_USE =
  'Yakındaki marketleri ve kayıtlı yerlerini gösterebilmek için konumuna ihtiyaç var.';
const LOCATION_ALWAYS =
  "Markete yaklaştığında veya evden çıktığında uygulama kapalıyken de hatırlatabilmek için 'Her Zaman' konum izni gerekiyor.";
const CAMERA_USAGE = 'Ürün barkodlarını okuyarak listeye eklemek için kamera kullanılır.';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  // ASCII technical name — this becomes the Xcode project and scheme name.
  name: 'Animsa',
  slug: 'animsa',
  version: process.env.npm_package_version ?? '1.0.0',
  orientation: 'portrait',
  icon,
  scheme,
  userInterfaceStyle: 'automatic',
  platforms: ['ios'],
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier,
    buildNumber: process.env.BUILD_NUMBER ?? '1',
    supportsTablet: false,
    infoPlist: {
      CFBundleDisplayName: displayName,
      CFBundleDevelopmentRegion: 'tr',
      NSLocationWhenInUseUsageDescription: LOCATION_WHEN_IN_USE,
      NSLocationAlwaysAndWhenInUseUsageDescription: LOCATION_ALWAYS,
      NSCameraUsageDescription: CAMERA_USAGE,
      NSAlarmKitUsageDescription: ALARM_KIT_USAGE,
      UIFileSharingEnabled: true,
      LSSupportsOpeningDocumentsInPlace: true,
      LSApplicationQueriesSchemes: ['altstore-classic', 'altstore'],
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['location', 'fetch', 'processing'],
    },
  },
  extra: {
    variant,
  },
  plugins: [
    // Registered first so its entitlements mod runs LAST: config-plugin mods
    // compose in reverse, and expo-notifications adds `aps-environment` in its
    // own mod, which must already have run before this one strips it.
    './plugins/withStripPushEntitlement',
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#FF7A1A',
        dark: { backgroundColor: '#1A0E05' },
      },
    ],
    'expo-sqlite',
    'expo-background-task',
    // Autolinking requires config plugins for these; listed here rather than in
    // an app.json so app.config.ts stays the single source of truth.
    'expo-sharing',
    'expo-status-bar',
    'expo-maps',
    '@react-native-community/datetimepicker',
    [
      'expo-location',
      {
        isIosBackgroundLocationEnabled: true,
        locationAlwaysAndWhenInUsePermission: LOCATION_ALWAYS,
        locationWhenInUsePermission: LOCATION_WHEN_IN_USE,
      },
    ],
    [
      'expo-notifications',
      {
        color: '#FF7A1A',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: CAMERA_USAGE,
        // Explicitly disabled: the app never records audio, so no
        // NSMicrophoneUsageDescription must end up in the Info.plist.
        microphonePermission: false,
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '26.0',
        },
      },
    ],
    ...(isDev ? ['expo-dev-client'] : []),
  ],
});
