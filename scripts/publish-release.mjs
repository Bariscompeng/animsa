#!/usr/bin/env node
/**
 * Publishes the built IPA as a GitHub release and refreshes the AltStore
 * source JSON that lives on a fixed `altstore-source` tag (§9.5).
 *
 * Runs on the macOS runner after scripts/build-ios.sh. All GitHub access goes
 * through `gh`, which the runner already authenticates via GH_TOKEN.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  SOURCE_TAG,
  downloadUrl,
  emptySource,
  privacyFromInfoPlist,
  releaseTag,
  sourceUrl,
  upsertVersion,
} from './altstoreSource.mjs';

const variant = process.env.APP_VARIANT === 'dev' ? 'dev' : 'release';
const repository = process.env.GITHUB_REPOSITORY ?? '';
const [owner, repo] = repository.split('/');

if (!owner || !repo) {
  console.error('GITHUB_REPOSITORY ayarlı değil; bu betik yalnızca CI içinde çalışır.');
  process.exit(1);
}

const gh = (args, options = {}) =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options });

// ------------------------------------------------------------------ artefacts

const ipaName = readdirSync('dist').find((f) => f.endsWith('.ipa'));
if (!ipaName) {
  console.error('dist/ içinde .ipa bulunamadı.');
  process.exit(1);
}
const ipaPath = join('dist', ipaName);
const ipaBytes = readFileSync(ipaPath);
const sha256 = createHash('sha256').update(ipaBytes).digest('hex');
const size = ipaBytes.length;

const infoPlist = JSON.parse(readFileSync('dist/Info.json', 'utf8'));
const version = infoPlist.CFBundleShortVersionString;
const build = String(infoPlist.CFBundleVersion);
const privacy = privacyFromInfoPlist(infoPlist);

console.log(`IPA: ${ipaName}`);
console.log(`Sürüm: ${version} (${build}), ${(size / 1_048_576).toFixed(1)} MB`);
console.log(`SHA-256: ${sha256}`);
console.log(`Gizlilik anahtarları: ${Object.keys(privacy).join(', ')}`);

// -------------------------------------------------------------- release notes

let notes = 'Değişiklikler listelenemedi.';
try {
  const log = execFileSync('git', ['log', '-10', '--pretty=format:- %s'], { encoding: 'utf8' });
  if (log.trim()) notes = log.trim();
} catch {
  // A shallow clone can fail here; the release simply gets the fallback text.
}

const tag = releaseTag(variant, version, build);

// ----------------------------------------------------------------- the release

const releaseArgs = [
  'release',
  'create',
  tag,
  ipaPath,
  '--title',
  `Anımsa ${version} (${build})${variant === 'dev' ? ' — Dev' : ''}`,
  '--notes',
  notes,
];
if (variant === 'dev') releaseArgs.push('--prerelease');

try {
  gh(releaseArgs);
  console.log(`Release oluşturuldu: ${tag}`);
} catch {
  // A rerun of the same build number: replace the asset in place.
  console.log(`Release zaten var, dosya güncelleniyor: ${tag}`);
  gh(['release', 'upload', tag, ipaPath, '--clobber']);
}

// ------------------------------------------------------------- source.json

const workDir = mkdtempSync(join(tmpdir(), 'animsa-source-'));
const sourcePath = join(workDir, 'source.json');
/**
 * The icon is served from raw.githubusercontent.com, which needs a real ref.
 * The default branch is whatever the repo actually uses (`main`, `master`, …),
 * so it is queried rather than assumed; the commit SHA is the last resort and
 * is always valid.
 */
function defaultBranch() {
  try {
    const name = gh([
      'repo',
      'view',
      `${owner}/${repo}`,
      '--json',
      'defaultBranchRef',
      '-q',
      '.defaultBranchRef.name',
    ]).trim();
    if (name) return name;
  } catch {
    // Fall through to the environment.
  }
  return process.env.GITHUB_SHA ?? 'HEAD';
}

const iconRef = defaultBranch();
const iconUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${iconRef}/assets/icon.png`;
console.log(`İkon dalı: ${iconRef}`);

// Make sure the permanent source tag exists before downloading from it.
try {
  gh(['release', 'view', SOURCE_TAG], { stdio: ['ignore', 'ignore', 'ignore'] });
} catch {
  console.log(`Kalıcı kaynak release'i oluşturuluyor: ${SOURCE_TAG}`);
  gh([
    'release',
    'create',
    SOURCE_TAG,
    '--title',
    'AltStore kaynağı',
    '--notes',
    'AltStore bu dosyayı okur. Silme.',
  ]);
}

let source;
try {
  gh(['release', 'download', SOURCE_TAG, '--pattern', 'source.json', '--dir', workDir]);
  source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  console.log(`Mevcut kaynak okundu (${source.apps?.length ?? 0} uygulama).`);
} catch {
  console.log('Kaynak bulunamadı, yenisi oluşturuluyor.');
  source = emptySource(iconUrl);
}

const updated = upsertVersion(
  source,
  variant,
  {
    version,
    buildVersion: build,
    date: new Date().toISOString(),
    localizedDescription: notes,
    downloadURL: downloadUrl(owner, repo, tag, ipaName),
    size,
    sha256,
  },
  { iconUrl, privacy },
);

writeFileSync(sourcePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

// Validate before publishing: a broken source silently stops every update.
JSON.parse(readFileSync(sourcePath, 'utf8'));

gh(['release', 'upload', SOURCE_TAG, sourcePath, '--clobber']);

console.log('');
console.log("AltStore kaynak URL'si:");
console.log(`  ${sourceUrl(owner, repo)}`);

if (existsSync('dist/Info.json')) {
  console.log('');
  console.log('Bitti.');
}
