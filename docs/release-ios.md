# Getting a build onto a phone (iOS)

The repeatable path is TestFlight, the same one BillTrack uses. No cable,
no Developer Mode on the phone, no cloud build service: the archive is
built and signed on the Mac and uploaded with an App Store Connect API key.

## One-time setup (already done on this Mac for BillTrack)

1. Apple Developer Program membership, and Xcode signed in to that Apple ID
   (Xcode → Settings → Accounts). Automatic signing does the rest.
2. One registered test device on the team (Developer portal → Devices). A
   command-line archive needs a *development* profile to exist, and that
   needs a device, even though TestFlight itself never uses it.
3. An App Store Connect API key (Users and Access → Integrations → App Store
   Connect API, role App Manager) saved as
   `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`. The key id and
   issuer id are identifiers; the `.p8` is the secret and stays in that folder.
4. Homebrew and CocoaPods, so the Expo native project can be generated locally.

## One-time per app

- `app.json` carries `expo.ios.bundleIdentifier` and `expo.ios.appleTeamId`
  (the 10-character Team ID, which is the certificate's *OU*, not the id in
  parentheses after your name).
- Create the app record in App Store Connect: My Apps → **+** → New App,
  platform iOS, this bundle id, any SKU. The upload tool cannot create it.

## Every build

```bash
ASC_KEY_ID=<key id> ASC_ISSUER_ID=<issuer id> ./scripts/testflight.sh --upload
```

Without `--upload` it archives and exports only, and prints what was signed.
The script regenerates the native project from `app.json`, archives Release
(the JavaScript is bundled into the app; no Metro), exports for the App
Store, validates, and uploads. App Store Connect assigns the build number
(`manageAppVersionAndBuildNumber`), so nothing needs bumping between
uploads; bump `expo.version` in `app.json` when the *version* changes.

Processing takes a few minutes. Then in App Store Connect → the app →
TestFlight, the build appears; internal testers (team members) get it in the
TestFlight app on the phone at once. External testers need Test Information
filled in and one Beta App Review per version. Builds expire after 90 days.

## When it fails

- **"No profiles for …" / signing errors**: Xcode is not signed in, or the
  team id in `app.json` is wrong. `security find-identity -v -p codesigning`
  shows the certificate; the Team ID is its OU.
- **"No suitable application records were found"** on upload: the app record
  does not exist in App Store Connect yet.
- **Error 90189**: this build number is already uploaded. Not a failure.
- **A native crash at launch**: `~/Library/Logs/DiagnosticReports/<App>-*.ips`
  names the cause. Precompiled Expo modules that link frameworks a device
  lacks are routed through source builds via `expo.autolinking.ios.buildFromSource`
  in `package.json`.

## Development on the simulator

`npm run ios` builds and installs the development client on the booted
simulator and starts Metro. Expo Go is not used: it cannot carry the app's
document type, file-sharing keys, or entitlements.

## App Store screenshots

The store listing takes up to ten screenshots per device size. The set is
produced from simulator captures over the fictional demo club, composed with
a headline on the brand green by `scripts/store-screenshots/compose-all.sh`.

1. **Build Release for the simulator** so there is no developer overlay:
   `npx expo run:ios --device <udid> --configuration Release --no-bundler`.
   The app lands in `DerivedData/Duesbook-*/Build/Products/Release-iphonesimulator/Duesbook.app`
   and installs on any simulator with `xcrun simctl install <udid> <that .app>`.
2. **Devices.** An iPhone 14 Plus simulator (1284 × 2778) and an iPad Air
   13-inch (2048 × 2732); both sizes are accepted by App Store Connect as
   they are. Boot both and install the app on each.
3. **Seed the demo books** into each app container, with the app closed:
   `npm run seed:demo -- "$(xcrun simctl get_app_container <udid> com.duesbook.app data)/Library/Duesbook/duesbook.db"`.
4. **Status bar.** `xcrun simctl status_bar <udid> override --time 9:41 --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularMode active --cellularBars 4`.
5. **Capture** each screen with `xcrun simctl io <udid> screenshot build/store/raw/<device>-<screen>.png`,
   where `<device>` is `phone` or `ipad` and `<screen>` is one of the names
   in `compose-all.sh` (home, dues, payment, members, member, ledger,
   reports, backups). Reach the screens with the tab bar and taps; deep
   links (`xcrun simctl openurl <udid> duesbook:///dues`) work but iOS asks
   "Open in Duesbook?" each time. For `payment`, add two members who owe.
6. **Compose:** `scripts/store-screenshots/compose-all.sh` writes the
   finished PNGs to `build/store/out/`, numbered in store order.

On the iPad the app shows its tablet layout (sidebar, list + detail), so
the same eight screens read differently there; `payment` and `member`
come from the detail pane's buttons and the Members list.
