# Treasurer — Requirements & Decisions

*Status: requirements phase complete; no code yet. Last updated 2026-07-08.*

## Vision

A desktop application for treasurers of small organizations (clubs, HOAs, PTAs,
lodges, congregations) to manage accounts, members, and dues. All data is stored
locally; no private data is transmitted to any outside system under normal
operation. To be released publicly for use by others.

## Target user

A volunteer treasurer, often non-technical and not an accountant, who typically
serves a limited term and hands the books to a successor. The design must assume
treasurer turnover is normal, not exceptional.

## Locked decisions

### Platform & stack
- **Single codebase for Windows and macOS** — no separate versions.
- **Electron + TypeScript + React** for the app; everything in one language
  (owner has light JavaScript background and needs to be able to follow the code).
- **SQLite via better-sqlite3**; an organization's entire books live in a single
  `.db` file (this is the foundation of the backup/handoff story).
- Packaging via electron-builder; CI (GitHub Actions) builds Mac + Windows
  installers from one repo.

### Scope (v1)
- **Simple categorized ledger** — each account (checking, savings, cash box) is a
  register of dated transactions with income/expense categories. NOT double-entry.
- **Dues: one configurable amount per period**, same for every member. Partial
  payments are tracked. (Tiers = possible v2; one added table.)
- **Dues cadence: monthly or per-fiscal-year, chosen at setup** (2026-07-08
  correction: target orgs bill monthly, e.g. "$10/month"; annual remains
  supported). Periods auto-roll forward on launch — a monthly org never
  creates "August" by hand.
- **Arrears notification**: members with outstanding dues in N+ started
  periods (default 2, configurable in Settings) are flagged on Home.
- **Single organization per install.** (Multi-org later would just be "open a
  different file" — the one-file design keeps this cheap.)
- **Single user, single machine.** Others receive exported reports, not app access.
- Transactions have a simple **"cleared" checkbox** for ticking off against bank
  statements — no full reconciliation machinery.
- **CSV import for the initial member list**; manual entry of opening balances.
- **USD only** in v1.
- **Fiscal year start is configurable** (many orgs run July–June).

### Reports (v1 must-haves)
1. **Treasurer's report** — period summary for meetings: opening balances,
   income/expenses by category, closing balances.
2. **Dues status roster** — who has paid, who owes, amounts outstanding.
3. **Year-end summary** — full-year income/expense totals by category.

(Budget vs. actual: explicitly deferred, not a v1 feature.)

### Backup & treasurer handoff
- **Automatic timestamped backups** to a user-chosen folder (which may be a
  synced drive if the org chooses — the app itself never syncs anything).
- **Guided "export for new treasurer" flow** for handoff at end of term.
- Rationale: local-only storage means a dead laptop = lost org records unless
  backup is built in. This is a first-class feature, not an afterthought.

### Privacy, updates, security
- **No app-level encryption in v1.** Rely on OS protections (user accounts,
  FileVault/BitLocker). Rationale: for volunteer treasurers, "forgot the
  password = org's books permanently lost" is a worse failure mode than the
  marginal privacy gain.
- **Notify-only update check**: app queries GitHub Releases for the latest
  version number (no user data transmitted), shows a notice with a download
  link. Disableable in settings. No auto-install.
- Under normal operation the app makes **no network calls except the update
  check**.

### Distribution
- **Free, open source.** Public repo. Open code is the trust story backing the
  privacy claims ("audit it yourself").
- Code signing budgeted: Apple Developer account (~$99/yr, notarization) +
  Windows code-signing certificate, to avoid Gatekeeper/SmartScreen warnings.

## Open items (must settle before public release)
- [x] **License: MIT** (decided 2026-07-08 after reviewing MIT / MPL-2.0 /
      GPLv3 / Apache-2.0 — simplicity and adoption won; keeps the Mac App
      Store option open, accepts the low risk of closed forks). LICENSE file
      in repo root.

## Resolved after initial draft
- Member record fields: name, email, phone, address, join date, notes
  (see DATA-MODEL.md).
- Audit trail: timestamps only in v1; auto-backups are the recovery story.
- Attachments (receipt scans): deferred, additive migration later.
- Data model drafted and reviewed: see DATA-MODEL.md (2026-07-08).
- Report output: print-styled HTML + OS print dialog (covers paper and PDF),
  CSV export for table-shaped reports. No bundled PDF library.
- Screen map drafted and reviewed: see SCREEN-MAP.md (2026-07-08).
- **Application name: Duesbook** (2026-07-08). Due diligence: no existing app,
  npm package, or GitHub project owns the name. Runner-up ClubBooks was
  rejected because an unrelated "ClubBooks" app by ClubBooks Inc exists on the
  App Store. npm `duesbook` unclaimed at decision time.

## Explicit non-goals for v1
- Double-entry bookkeeping
- Multi-user / sync / cloud anything
- Multiple organizations in one install
- Membership tiers / per-member dues amounts
- Budgeting
- App-level encryption
- Non-USD currencies
