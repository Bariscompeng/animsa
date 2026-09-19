#!/usr/bin/env bash
#
# Builds an UNSIGNED .ipa (§9.4).
#
# The signature is applied on the phone by AltStore, so CI deliberately turns
# code signing off entirely. The final `test !` asserts that: an .ipa that
# arrived with a provisioning profile baked in would be a bug.
set -euo pipefail

CONFIG=$([ "${APP_VARIANT:-release}" = "dev" ] && echo Debug || echo Release)

WS=$(ls -d ios/*.xcworkspace | head -n1)
SCHEME=$(basename "$WS" .xcworkspace)

echo "==> Workspace: $WS"
echo "==> Configuration: $CONFIG"
xcodebuild -list -workspace "$WS"

# Verify the scheme guessed from the workspace name actually exists.
if ! xcodebuild -list -workspace "$WS" | grep -qE "^[[:space:]]+${SCHEME}$"; then
  echo "::error::'$SCHEME' şeması bulunamadı"
  exit 1
fi

xcodebuild \
  -workspace "$WS" \
  -scheme "$SCHEME" \
  -configuration "$CONFIG" \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGN_ENTITLEMENTS="" \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build

APP=$(ls -d "build/Build/Products/${CONFIG}-iphoneos/"*.app | head -n1)
echo "==> App: $APP"

rm -rf dist Payload
mkdir -p dist Payload
cp -R "$APP" Payload/

VER=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$APP/Info.plist")
BLD=$(/usr/libexec/PlistBuddy -c 'Print CFBundleVersion' "$APP/Info.plist")
IPA="dist/Animsa-${APP_VARIANT:-release}-${VER}-${BLD}.ipa"

zip -qry "$IPA" Payload
rm -rf Payload

plutil -convert json -o dist/Info.json "$APP/Info.plist"

echo "==> IPA: $IPA ($(du -h "$IPA" | cut -f1))"

# An unsigned build must not carry a provisioning profile.
if [ -f "$APP/embedded.mobileprovision" ]; then
  echo "::error::IPA imzalı görünüyor (embedded.mobileprovision var)"
  exit 1
fi

echo "==> İmzasız IPA hazır"
