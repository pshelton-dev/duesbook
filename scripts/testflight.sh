#!/usr/bin/env bash
# Archive, sign for the App Store, and upload to TestFlight — the phone
# install path. Same shape as BillTrack's script, adapted for an Expo
# project: the native project is generated, and the app name, bundle id,
# and team come from app.json so nothing here is project-specific.
#
#   ./scripts/testflight.sh            # prebuild + archive + export only
#   ./scripts/testflight.sh --upload   # ...and validate + upload
#
# Uploading needs an App Store Connect API key: App Store Connect -> Users
# and Access -> Integrations -> App Store Connect API, role "App Manager".
# Put the downloaded file at ~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8
# and export ASC_KEY_ID and ASC_ISSUER_ID. Those two are identifiers; the .p8
# is the secret and never leaves that directory. One-off alternative: Xcode ->
# Window -> Organizer -> Distribute App.
#
# Once per app, by hand: create the app record in App Store Connect (My Apps
# -> + -> New App) with this bundle id. altool cannot create it.
set -euo pipefail
cd "$(dirname "$0")/.."
export LANG=en_US.UTF-8
export PATH="/opt/homebrew/bin:$PATH"

name=$(node -p "require('./app.json').expo.name")
scheme=$(node -p "require('./app.json').expo.name.replace(/[^A-Za-z0-9]/g, '')")
bundle=$(node -p "require('./app.json').expo.ios.bundleIdentifier")
team=$(node -p "require('./app.json').expo.ios.appleTeamId")
version=$(node -p "require('./app.json').expo.version")
[[ $team =~ ^[A-Z0-9]{10}$ ]] || { echo "app.json expo.ios.appleTeamId must be the 10-character Team ID" >&2; exit 1; }

echo "== $name $version ($bundle, team $team)"

# The native project is generated, not tracked. Regenerate it so the archive
# reflects app.json and package.json exactly; pods install as part of this.
# (Check `git diff app.json` afterwards: the very first prebuild on a machine
# once rewrote it with duplicated document-type entries.)
npx expo prebuild --platform ios

archive="build/$scheme.xcarchive"
export_dir="build/export"
rm -rf "$archive" "$export_dir"
mkdir -p build

# Signed archive (development profile, which needs one registered device on
# the team), re-signed for distribution at export. Release bundles the JS.
xcodebuild -workspace "ios/$scheme.xcworkspace" -scheme "$scheme" \
  -destination 'generic/platform=iOS' -configuration Release \
  -archivePath "$archive" -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$team" archive | tail -3

# ExportOptions is generated too, so the team id has exactly one source.
cat > build/ExportOptions.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>manageAppVersionAndBuildNumber</key>
	<true/>
	<key>method</key>
	<string>app-store-connect</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>teamID</key>
	<string>$team</string>
	<key>uploadSymbols</key>
	<true/>
</dict>
</plist>
EOF

xcodebuild -exportArchive -archivePath "$archive" \
  -exportOptionsPlist build/ExportOptions.plist -exportPath "$export_dir" \
  -allowProvisioningUpdates | tail -2

ipa="$export_dir/$scheme.ipa"

# Confirm what actually got signed rather than trusting that export succeeded.
peek=$(mktemp -d)
unzip -qq -o "$ipa" -d "$peek"
echo
echo "built $ipa ($(du -h "$ipa" | cut -f1))"
codesign -dvv "$peek/Payload/$scheme.app" 2>&1 | grep -E "^(Authority=Apple Distribution|TeamIdentifier)"
plutil -p "$peek/Payload/$scheme.app/Info.plist" | grep -E '"(CFBundleIdentifier|CFBundleShortVersionString|CFBundleVersion)"'
rm -rf "$peek"

if [[ ${1:-} != --upload ]]; then
  echo
  echo "Not uploading. Re-run with --upload, or drag the .ipa into Transporter."
  exit 0
fi

: "${ASC_KEY_ID:?set ASC_KEY_ID (App Store Connect API key id)}"
: "${ASC_ISSUER_ID:?set ASC_ISSUER_ID (App Store Connect issuer id)}"

# Validate first: a rejected upload after a slow transfer says the same thing
# several minutes later. Error 90189 = this build number is already up there,
# the expected result of running twice, dressed up as a wall of JSON.
if ! out=$(xcrun altool --validate-app -f "$ipa" -t ios \
             --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID" 2>&1); then
  if grep -q 90189 <<<"$out"; then
    echo "$out" | grep -o "build number '[0-9]*'" | head -1 | sed 's/^/Already uploaded: /'
    echo "Nothing to do: App Store Connect already has this build."
    exit 0
  fi
  echo "$out" >&2
  exit 1
fi
echo "$out" | grep -E "VERIFY SUCCEEDED|No errors" || true

xcrun altool --upload-app -f "$ipa" -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"

echo
echo "Uploaded. Processing takes a few minutes; the build then appears under"
echo "TestFlight in App Store Connect. Install it from the TestFlight app."
