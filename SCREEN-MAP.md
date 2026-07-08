# Treasurer — Screen Map (Draft)

*Status: draft for review, 2026-07-08. Companion to [REQUIREMENTS.md](REQUIREMENTS.md)
and [DATA-MODEL.md](DATA-MODEL.md).*

## Navigation model

Single window, persistent left sidebar with six destinations:
**Home · Ledger · Members · Dues · Reports · Settings.**
No nested navigation deeper than one level anywhere — a volunteer treasurer
should never wonder "where am I?". Native menu bar (File/Edit/Help) mirrors
the important actions (backup now, export for new treasurer, check for
updates) so they're discoverable both ways.

## 0. First-run wizard

Shown only when the app opens with no data. One step per screen, back/next,
nothing else on screen. Order matters — it front-loads what's mandatory and
lets everything member-related be skipped:

1. **Organization** — org name, fiscal year start month.
2. **Accounts** — add at least one account with opening balance and
   as-of date. ("Enter the balance from your last bank statement.")
3. **Backup folder** — choose where automatic backups go. Deliberately step 3,
   not last: skippable, but skipping shows a plain-language warning, and Home
   nags until it's set. This is the dead-laptop insurance.
4. **Dues** *(skippable)* — dues amount and current period dates, prefilled
   from fiscal year.
5. **Members** *(skippable)* — CSV import (with a column-mapping preview and a
   downloadable template) or "I'll add them later".

Lands on Home. Total time for a prepared treasurer: under five minutes.

## 1. Home

The "state of the books" at a glance — what a treasurer wants when they open
the app once a month:

- **Account balance cards** (one per active account, plus total).
- **Dues progress** for the current period: N of M members paid, $ collected,
  $ outstanding, one-click to the Dues screen.
- **Recent transactions** (last ~10, read-only, click through to Ledger).
- **Health strip**: last backup date (amber if stale, red if never), update
  available notice (dismissible), unallocated dues deposits if any.

No data entry happens here; it's orientation plus warnings.

## 2. Ledger

The checkbook register. Heart of day-to-day use.

- **Account switcher** (tabs across the top — orgs have 1–3 accounts).
- **Register table**: date · payee · category · memo · amount · running
  balance · cleared checkbox. Newest at top. Income green-tinted amounts,
  expenses plain — no red ink for normal spending.
- **Add transaction**: income / expense / transfer. Transfers pick the other
  account and create the linked pair invisibly.
- **Filters**: date range, category, text search, "uncleared only" (the
  month-end reconcile view).
- Recording income in the system **Dues category** prompts "allocate this to
  members?" and hands off to the Dues payment flow — one path, not two ways
  to do the same thing. A dues-linked transaction shows a small member badge;
  editing its amount below its allocations warns and offers to fix them.

## 3. Members

The roster.

- **Table**: name · email · phone · joined · current-period dues status chip
  (paid / partial / owed / waived / exempt) · active/former filter
  (former = has `left_date`; shown only on demand).
- **Add/edit** in a side panel — the baseline fields only (name, email, phone,
  address, join date, notes) plus the dues-exempt toggle and "mark as left".
- **Member detail**: contact info + full dues history (every period: owed,
  paid, dates, linked transactions) — the "did Bob pay in 2024?" answer.
- **CSV import** (same flow as the wizard) available here permanently.

## 4. Dues

The collection workflow — the screen the treasurer lives in every renewal
season, built around the most-repeated action in the app.

- **Period selector** (defaults to current) + summary bar: collected /
  outstanding / progress.
- **Roster for the period**: member · owed · paid · outstanding · status chip.
  Sortable, filterable to "hasn't paid".
- **Record payment** — the fast path, one dialog, target under 30 seconds:
  1. Pick member(s) — type-ahead. Picking two members (spouse pays for both)
     splits one check across both memberships.
  2. Amount(s) — prefilled with what's owed; editable for partial payments.
  3. Deposit details — account, date, check # → memo. One save creates the
     ledger transaction *and* the allocations. No second step.
- **Row actions**: waive (override to $0 with a note), adjust owed (prorate a
  mid-year joiner), view payment history.
- **Manage periods**: create next year's period (prefilled from fiscal year +
  last amount), edit label/dates/amount.

## 5. Reports

- **Three reports** (v1): treasurer's report, dues status roster, year-end
  summary. Pick report → pick period/date range (prefilled sensibly: "last
  month", "current period", "last fiscal year") → live on-screen preview.
- **Output**: Print (opens OS print dialog — print-to-PDF is how PDFs happen,
  zero PDF code to maintain) and CSV export for the table-shaped reports.
  Reports are print-styled HTML: clean serif header with org name, period,
  and generated date — presentable at a board meeting with no fiddling.

## 6. Settings

- **Organization**: name, fiscal year start.
- **Categories**: add/rename/deactivate; system Dues category shown but locked.
- **Backups**: folder, retention count, last-backup time, **Back up now**,
  **Restore from backup…** (lists timestamped backups, confirms loudly).
- **Handoff**: **Export for new treasurer** — copies the data file to a chosen
  location alongside a generated README ("what this file is, how to open it,
  what to set up first") . Also reachable from the File menu.
- **Updates**: notify-only toggle, "check now", current version.
- **About**: version, license, link to project site.

## The flows that must be effortless

| Flow | Path | Bar to clear |
|---|---|---|
| Record a dues check | Dues → Record payment | < 30 seconds, one dialog |
| Month-end | Ledger (uncleared filter) → tick against statement → Reports → treasurer's report → Print | No math by hand |
| New fiscal year | Dues → new period (prefilled) | Two clicks + confirm |
| Treasurer handoff | Settings → Export for new treasurer | One file + README out |
| Disaster recovery | Fresh install → Settings → Restore from backup | Books back in minutes |

## Deliberate omissions (v1)

- No dashboard charts/graphs — numbers and status chips only.
- No batch transaction import (bank CSV/OFX) — deferred; the ledger is
  hand-entered, which is realistic for small-org volume.
- No keyboard-shortcut system beyond standard OS conventions.
- No dark mode commitment yet (nice-to-have; decide during build).

## Resolved questions (2026-07-08)

- Transaction entry: side-panel form in v1; inline register editing is a
  possible v2 upgrade (register table design keeps it open).
- Report output: print (OS print-to-PDF) + CSV. No bundled PDF generation.
- Home screen: kept — orientation, dues progress, and health warnings live there.
- Application name: **Duesbook** (see REQUIREMENTS.md for due diligence).
