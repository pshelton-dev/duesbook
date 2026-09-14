# Duesbook — Requirements & Decisions (v2, mobile)

*Status: requirements draft for the mobile rewrite, 2026-09-13. The desktop
app's requirements are frozen with it at tag `v1.3.0`.*

## What changed and why

Duesbook v1 was a desktop app (Electron, Mac + Windows). The pilot showed the
assumption behind that choice was wrong: **not every volunteer treasurer has a
desktop computer, but every one of them has a phone** — and the phone is the
device that goes to the meeting, where dues are collected and the treasurer's
report is given. v2 is a complete move to mobile, not a companion app. The
desktop app is frozen at v1.3.0 and receives no further releases.

Everything that was hard-won in v1 carries over unchanged: the data model,
the dues formula, period rolling, transfer pairing, and bank-import
reconciliation. What changes is the platform, the screens, and how backups
and handoff work on a device without a filesystem the user browses.

## Vision

A phone app for treasurers of small organizations (clubs, HOAs, PTAs, lodges,
congregations) to manage accounts, members, and dues — and to take the books
to the meeting. All data lives on the treasurer's device; nothing is sent to
any outside system. Free and open source.

## Target user

Unchanged: a volunteer treasurer, often non-technical and not an accountant,
serving a limited term and handing the books to a successor. Two additions:

- They may not own a computer at all. The phone must be sufficient for
  everything, including setup, month-end, and handoff.
- They use the app in two very different modes: **at the desk** once a month
  (statement in hand, bank import, reports) and **at the meeting** (glance at
  who owes, record payments handed over in person, show the report). The
  meeting mode is new, and it drives the redesign.

## Locked decisions

### Platform & stack
- **iOS and Android from one codebase.** Same principle as v1's "one codebase
  for Mac and Windows": the target audience is "everyone with a phone", and
  half of them are on Android.
- **Expo + React Native + TypeScript.** TypeScript and React carry over, so
  the owner can still follow the code — the reason Electron was chosen in v1.
  SwiftUI was considered and rejected on that basis, and because it is
  iOS-only.
- **SQLite via expo-sqlite**; one organization's entire books in a single
  `.db` file, exactly as in v1. expo-sqlite's synchronous API lets the v1
  data layer (`src/main/*.ts`) port close to line-for-line.
- **iPad and Android tablets** run the same app with a wider layout (sidebar
  + detail). This is a layout adaptation, not a separate product.
- **No over-the-air JavaScript updates** (no `expo-updates`). Updates ship
  through the app stores only. An OTA channel is a network call and a
  supply-chain surface, and the app's trust story is "no network".

### Data
- **The schema and migration list are shared with v1 byte-for-byte.** Schema
  version 4 is the baseline; the mobile app carries the same four migrations
  so any file the desktop app ever produced restores cleanly. New migrations
  are appended, never rewritten. DATA-MODEL.md remains the source of truth.
- **One device holds the books.** No sync between a phone and a tablet, or
  between two phones. A second device gets a *snapshot* via restore, and the
  app says so plainly. (SQLite inside a synced folder is a documented
  corruption path; multi-device sync is a v3-or-never question.)
- **Migration for existing users**: export a handoff file from the desktop
  app, get it onto the phone (AirDrop, Files, email), open it in Duesbook.
  No conversion step.

### Scope (v2.0)
Feature parity with v1.3.0, re-prioritized around the meeting:
- Simple categorized ledger (not double-entry), cleared checkbox, transfers
  as linked pairs — unchanged.
- Dues: one amount per period, monthly or per-fiscal-year cadence, partial
  payments, per-member overrides/waivers, auto-rolling periods, arrears
  flagging — unchanged.
- Bank import (CSV, Excel, OFX/QFX) from a file the treasurer downloads from
  their bank's app or site — same engine, phone-sized mapping UI.
- Three reports: treasurer's report, dues roster, year-end summary.
- Single organization per install, single user. USD only. Fiscal year start
  configurable.
- **Recording a payment handed over at a meeting must take under ten
  seconds** from the roster: tap the member, confirm the prefilled amount,
  save. (v1's bar was 30 seconds from a desk.)

### Backups
The v1 rule ("automatic backups to a folder you choose, possibly a synced
drive") has no phone equivalent. Three layers replace it:

1. **OS device backup** (iCloud Backup / Android Auto Backup) covers the
   app's data automatically. Most users already have it on. Nothing to
   configure; the app just says whether it can tell it's enabled.
2. **App-owned snapshot folder** — timestamped copies of the books in a
   folder the app owns and the user can see in the Files app (iOS: the app's
   iCloud Drive container; Android: the app's Documents folder, carried by
   Auto Backup — exact Android mechanism to be confirmed during build).
   Toggleable, on by default, with a retention count, same as v1's
   auto-backup. **This is the only way user data ever leaves the device, and
   it goes only to the user's own cloud account.**
3. **Manual export** — "Save a copy" to any location via the share sheet, for
   people who turn layer 2 off.

Health warnings on Home follow the same amber/red staleness rules as v1.

### Treasurer handoff
- **Export for new treasurer** produces a single file and hands it to the
  share sheet: AirDrop, Files, Drive, Mail, whatever the treasurer uses.
- The file is a plain SQLite database with the extension **`.duesbook`** so
  that tapping it in Files, Mail, or an AirDrop prompt opens Duesbook
  directly. (`.db` files from the desktop app are also accepted.)
- **Opening a `.duesbook` file** in the app offers to restore it, with a
  loud confirmation and a pre-restore safety copy, as in v1.

### Reports
- On-screen preview reuses v1's print-styled HTML report sheet, rendered in a
  web view.
- **Share as PDF** via the OS share sheet (generated from that same HTML with
  `expo-print`) replaces v1's print dialog. AirDrop to the secretary, mail to
  the board, print via AirPrint — all from one button.
- CSV export for table-shaped reports, also via the share sheet.

### Privacy, updates, security
- **Zero network calls under normal operation.** Stricter than v1: the
  notify-only update check is deleted because the stores handle updates.
  Snapshot uploads to the user's own cloud account are the sole exception
  and are user-controlled.
- **No analytics, crash-reporting, or advertising SDKs.** Nothing in the
  binary talks to anyone.
- **No app-level encryption**, for the same reason as v1 ("forgot the
  password = org's books permanently lost"). Phones are better here than
  laptops: device encryption is on by default behind the passcode.
- **Biometric app lock** (Face ID / fingerprint) is available in Settings,
  **off by default**. A phone at a meeting gets handed around; the lock is
  cheap and the failure mode is a passcode fallback, not lost data.

### Distribution
- **App Store and Google Play.** TestFlight and Play internal testing for the
  pilot. Sideloading is not a realistic path for volunteers.
- Apple Developer Program (~$99/yr, already budgeted in v1 for code signing)
  and Google Play developer registration (one-time fee).
- **Free, open source, MIT.** The public repo stays the trust story: the code
  in the repo is the app in the store.
- **Never publish another GitHub Release in this repo.** Installed desktop
  apps poll the latest release and would show a bogus "update available".
  Git tags are fine; Releases are not.

### Versioning
- The mobile app starts at **2.0.0**. The `.duesbook` file it writes is the
  same schema version as v1.3.0 (4).

## Explicit non-goals for v2.0
- Multi-device sync, multi-user, cloud anything beyond the user's own
  snapshot folder
- Live bank connections (permanent non-goal, as in v1)
- Payment-app integration (Venmo/PayPal APIs) — the manual allocation
  guidance in docs/venmo-paypal-dues.md still applies
- Anything member-facing: portals, emailed statements, push notifications
- Double-entry bookkeeping, membership tiers, budgeting, attachments,
  multi-org, non-USD currencies, app-level encryption (all as in v1)
- Home-screen widgets, watch apps, phone landscape layouts

## Mobile-native candidates (cheap, not committed)
Things a phone makes easy that a desktop didn't. Decide during build, in
this order of likely value:
- **Add member from Contacts** — pick a contact, name/email/phone prefill.
  Costs a Contacts permission prompt and a privacy-label entry.
- **Tap-to-contact from a member's detail** — call, text, email via the OS.
  Free; no permission needed.
- **Dues reminder by text** — from a member who owes, open Messages with a
  prefilled "your dues of $X for July are outstanding". The treasurer sends
  it; the app sends nothing.
- **Follow system dark mode** — React Native exposes it cheaply; the v1
  token system already isolates colors.

## Open items
- [ ] Android snapshot-folder mechanism (Documents via Storage Access
      Framework vs. rely on Auto Backup alone) — confirm during build.
- [ ] Whether v2.0 ships iOS first with Android following, or both together.
      One codebase either way; this is a testing-bandwidth question.
- [ ] Repo layout: `main` becomes the mobile app with the desktop preserved at
      `v1.3.0` and a `desktop-final` branch, vs. a fresh repo. Recommendation:
      same repo — the schema, migrations, and shared modules carry over and
      keep their history.
- [ ] README and docs rewrite for the phone (screenshots, store links,
      "moving from the desktop app" section).

## Resolved (2026-09-13)
- Platforms, stack, desktop fate, and backup story decided in a structured
  decision round; see "Locked decisions" above.
- Application name stays **Duesbook**. App Store name availability to be
  re-checked at first TestFlight upload.
