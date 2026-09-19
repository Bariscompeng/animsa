#!/usr/bin/env node
/**
 * Asserts that the AlarmKit native module is actually linked.
 *
 * This guard exists because the failure it catches is silent and expensive:
 * when the module is missing, `requireOptionalNativeModule` returns null,
 * `alarms.ts` quietly falls back to notifications, and the app keeps working —
 * right up to the morning an alarm does not ring through silent mode.
 *
 * It bit once already: the podspec sat at the module root, but
 * expo-modules-autolinking only scans a module's *subdirectories* for
 * `.podspec` files, so the module resolved in `search` yet never reached the
 * Podfile. Nothing failed; the alarm feature simply was not in the binary.
 *
 * Usage:
 *   node scripts/check-alarmkit.mjs            # autolinking resolves the pod
 *   node scripts/check-alarmkit.mjs <App.app>  # …and it is in the built binary
 */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const POD_NAME = 'AnimsaAlarmKit';
const MODULE_CLASS = 'AlarmKitModule';

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// ------------------------------------------------- 1. autolinking resolution

let resolved;
try {
  const raw = execFileSync(
    'npx',
    ['expo-modules-autolinking', 'resolve', '-p', 'apple', '--json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' },
  );
  resolved = JSON.parse(raw);
} catch (error) {
  fail(`Autolinking çalıştırılamadı: ${error.message}`);
}

const entry = (resolved.modules ?? []).find((m) =>
  (m.pods ?? []).some((p) => p.podName === POD_NAME),
);

if (!entry) {
  fail(
    `Autolinking "${POD_NAME}" pod'unu bulamadı.\n` +
      `  Podspec modülün ALT dizininde olmalı (modules/alarm-kit/ios/${POD_NAME}.podspec).\n` +
      `  Modül kökündeki bir podspec sessizce yok sayılır.`,
  );
}

if (!(entry.modules ?? []).some((m) => m.class === MODULE_CLASS)) {
  fail(`"${MODULE_CLASS}" sınıfı expo-module.config.json içinde bildirilmemiş.`);
}

console.log(`✓ Autolinking: ${POD_NAME} pod'u ve ${MODULE_CLASS} sınıfı çözümlendi`);

// ------------------------------------------------------- 2. podspec sanity

const podspecDir = entry.pods.find((p) => p.podName === POD_NAME).podspecDir;
const podspec = readFileSync(join(podspecDir, `${POD_NAME}.podspec`), 'utf8');

// A Swift pod without swift_version installs cleanly and then compiles nothing:
// the target exists, no swiftc ever runs, and the app fails much later with
// "no such module". Catch it here instead.
if (!/s\.swift_version\s*=/.test(podspec)) {
  fail(
    `${POD_NAME}.podspec içinde swift_version yok.
` +
      `  CocoaPods bu durumda Swift derlemesini hiç kurmaz; hedef kaynaksız kalır
` +
      `  ve uygulama "no such module '${POD_NAME}'" ile düşer.`,
  );
}

const swiftFiles = readdirSync(podspecDir).filter((f) => f.endsWith('.swift'));
if (swiftFiles.length === 0) {
  fail(`${podspecDir} içinde hiç .swift dosyası yok.`);
}

console.log(`✓ Podspec: swift_version bildirilmiş, ${swiftFiles.length} Swift dosyası var`);

// ------------------------------------------------- 3. presence in the binary

const appPath = process.argv[2];
if (!appPath) {
  console.log('  (derlenmiş .app verilmedi, ikili kontrolü atlandı)');
  process.exit(0);
}

if (!existsSync(appPath)) fail(`Uygulama bulunamadı: ${appPath}`);

/** Every Mach-O in the bundle: the main binary plus each framework. */
function binaries(root) {
  const out = [];
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    if (statSync(full).isFile() && !name.includes('.')) out.push(full);
  }
  const frameworks = join(root, 'Frameworks');
  if (existsSync(frameworks)) {
    for (const name of readdirSync(frameworks)) {
      const inner = join(frameworks, name, name.replace(/\.framework$/, ''));
      if (existsSync(inner)) out.push(inner);
    }
  }
  return out;
}

const found = binaries(appPath).filter((file) =>
  readFileSync(file).includes(Buffer.from(POD_NAME, 'utf8')),
);

if (found.length === 0) {
  fail(
    `Derlenmiş uygulamada "${POD_NAME}" izi yok — modül derlemeye girmemiş.\n` +
      `  Alarmlar sessizce bildirime düşecekti.`,
  );
}

console.log(
  `✓ İkili: ${POD_NAME} şurada bulundu → ${found.map((f) => f.split(/[\\/]/).pop()).join(', ')}`,
);
