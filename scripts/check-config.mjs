#!/usr/bin/env node
/**
 * Guards the app config against the two mistakes that would break sideloading
 * or add a permission prompt the app does not need (§8, §14):
 *
 *   - `NSMicrophoneUsageDescription` — expo-camera adds it unless told not to.
 *   - `aps-environment` — push entitlements cannot be signed by a free Apple ID.
 *
 * and asserts the one key that must be there for alarms to work.
 */
import { readFileSync } from 'node:fs';

const FORBIDDEN_INFO_PLIST = ['NSMicrophoneUsageDescription'];
const FORBIDDEN_ENTITLEMENTS = ['aps-environment', 'com.apple.developer.aps-environment'];
const REQUIRED_INFO_PLIST = [
  'NSAlarmKitUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSLocationWhenInUseUsageDescription',
  'NSCameraUsageDescription',
];

const MIN_IOS_VERSION = '26.0';

const path = process.argv[2];
if (!path) {
  console.error('Kullanım: node scripts/check-config.mjs <config.json>');
  process.exit(2);
}

const raw = readFileSync(path, 'utf8');
const config = JSON.parse(raw);
const infoPlist = config?.ios?.infoPlist ?? {};
const entitlements = config?.ios?.entitlements ?? {};

const problems = [];

for (const key of FORBIDDEN_INFO_PLIST) {
  if (key in infoPlist) problems.push(`Info.plist'te olmaması gereken anahtar var: ${key}`);
}

for (const key of FORBIDDEN_ENTITLEMENTS) {
  if (key in entitlements) problems.push(`Entitlements'ta olmaması gereken anahtar var: ${key}`);
}

for (const key of REQUIRED_INFO_PLIST) {
  if (!infoPlist[key]) problems.push(`Info.plist'te olması gereken anahtar yok: ${key}`);
}

// The whole raw config is scanned too: a plugin could place these elsewhere.
for (const key of [...FORBIDDEN_INFO_PLIST, ...FORBIDDEN_ENTITLEMENTS]) {
  if (raw.includes(`"${key}"`)) {
    if (!problems.some((p) => p.includes(key))) {
      problems.push(`Yapılandırmanın herhangi bir yerinde yasak anahtar bulundu: ${key}`);
    }
  }
}

// Every permission dialog the user can see must be Turkish (SPEC §0.4, §14).
// Plugins add some of these themselves with English defaults, so check them all
// rather than only the ones written by hand.
const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/;
const usageKeys = Object.keys(infoPlist).filter((k) => k.endsWith('UsageDescription'));
for (const key of usageKeys) {
  const text = infoPlist[key];
  if (typeof text !== 'string' || !TURKISH_LETTERS.test(text)) {
    problems.push(`İzin metni Türkçe görünmüyor: ${key} → "${text}"`);
  }
}

const deploymentTarget = (config?.plugins ?? [])
  .filter((p) => Array.isArray(p) && p[0] === 'expo-build-properties')
  .map((p) => p[1]?.ios?.deploymentTarget)
  .find(Boolean);

if (deploymentTarget && deploymentTarget !== MIN_IOS_VERSION) {
  problems.push(`iOS deployment target ${MIN_IOS_VERSION} olmalı, ${deploymentTarget} bulundu`);
}

if (problems.length > 0) {
  console.error('Yapılandırma kontrolü başarısız:');
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

console.log('✓ Yapılandırma kontrolü geçti');
console.log(`  · minimum iOS: ${deploymentTarget ?? 'belirtilmemiş'}`);
console.log(`  · izin anahtarları: ${usageKeys.length}, tamamı Türkçe`);
console.log('  · mikrofon izni yok, push entitlement yok');
