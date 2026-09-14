# Duesbook — Screen Map (v2, mobile)

*Status: draft for review, 2026-09-13. Companion to [REQUIREMENTS.md](REQUIREMENTS.md)
and [DATA-MODEL.md](DATA-MODEL.md). The desktop screen map is frozen at tag
`v1.3.0`.*

## Design starting point: three meeting moments

The desktop app was designed around a monthly desk session. The phone app is
designed around what happens at the meeting, because that is where the phone
beats the desktop and where the treasurer is under time pressure:

1. **"Who still owes?"** — from a cold launch to the answer in one tap.
2. **"Bob just handed me a check."** — from the roster to saved in under ten
   seconds, with nothing to type in the common case.
3. **"Here's the treasurer's report."** — show it on the phone, AirDrop the
   PDF to the secretary, or print it, from one Share button.

The monthly desk work (bank import, ticking cleared, month-end report) still
has to be fully possible on the phone, but it is allowed to take longer and
use more taps. Tablet layouts make the desk work comfortable again.

## Navigation model

**Bottom tab bar, five tabs:** Home · Dues · Ledger · Members · Reports.
Settings lives behind a gear icon in Home's header — it is a
once-a-quarter destination and does not earn a tab.

Depth rule, stricter than v1's: **tab → one pushed detail screen → one modal
sheet.** Nothing deeper. A volunteer should never be three "back"s from
where they started.

How v1's desktop patterns map:

| Desktop (v1) | Phone (v2) |
|---|---|
| Left sidebar, six items | Bottom tabs (five) + Settings gear |
| Right-hand edit drawer (420/520/640px) | Bottom sheet, full-height on phone |
| Register/roster tables | Two-line list rows, amount right-aligned |
| Print dialog | Share sheet (PDF) |
| Folder / file pickers | Snapshot toggle, share sheet, document picker |
| Native menu bar (File/Edit/Help) | Overflow (…) menu in the relevant screen |
| First-run wizard card | Paged full-screen flow |
| Home health strip | Same, but tappable rows |

**Tablet layout** (iPad, Android tablets, ≥ 700pt wide): a persistent left
sidebar with all six destinations replaces the tab bar, and Ledger, Members,
and Dues become list + detail side by side. Sheets become centered forms.
Same screens, same code, wider container.

## 0. First run

A paged full-screen flow, one step per page, progress pills across the top.
Same steps and rules as v1.3.0 except step 3.

1. **Organization** — name, fiscal year start month, **"Your books start
   on"** (the date that anchors every opening balance and pins the first
   dues period, so nothing can double-count — see WISHLIST history).
2. **Accounts** — at least one; name, type, opening balance struck as of the
   books-start date. "Enter the balance from your last statement."
3. **Backups** — replaces v1's folder picker with one toggle: *"Keep
   timestamped copies of your books in iCloud Drive / on this device?"*
   On by default, plain-language explanation of what leaves the device and
   where it goes. Skipping shows the same warning as v1; Home nags until a
   snapshot exists.
4. **Dues** *(skippable)* — cadence, amount, first period prefilled from the
   books-start date.
5. **Members** *(skippable)* — import a CSV via the document picker, or
   "I'll add them later".

The welcome page also offers **"Taking over from a previous treasurer? Open
their file"** (document picker), and opening a `.duesbook` file from Files,
Mail, or AirDrop lands here too when no books exist yet.

## 1. Home

Orientation plus warnings, reordered so the meeting glance comes first:

- **Dues card** for the current period: paid N of M, $ outstanding, progress
  bar. Tapping opens the Dues tab.
- **Behind on dues**: the arrears list (name, months behind, $), capped at a
  few rows with "and 3 more". Tapping a row opens that member's dues sheet.
- **Balances**: one card per active account plus total.
- **Needs attention**: unallocated dues deposits, stale/absent backup, in
  the same amber/red language as v1. Rows are tappable and go straight to
  the fix.
- **Recent activity**: last five transactions, read-only, tap → Ledger.
- **One shortcut**: a full-width **Record a payment** button pinned at the
  bottom. This is a deliberate break from v1's "no data entry on Home" rule:
  at a meeting, launch-to-payment in one tap is worth more than purity.
- Header: organization name, gear → Settings.

## 2. Dues

The meeting screen. Everything on it is optimized for reading at arm's
length and tapping with a thumb.

- **Period picker** at the top (current by default), with a "Manage
  periods…" entry at the bottom of the picker.
- **Summary strip**: collected · outstanding · paid N of M.
- **Unallocated deposits** banner when any exist → Allocate sheet.
- **Filter chips**: All · Owes · Paid. "Owes" is the meeting default when
  anyone owes.
- **Roster list**, owing members first, then alphabetical: each row is name
  (with override note beneath if any), a status dot + label on the left,
  outstanding amount right-aligned. Tap → **member dues sheet**.
- **Member dues sheet**: owed / paid / outstanding for this period, then
  actions: **Record payment** (primary), Adjust amount, Waive, View history.
  Swiping a roster row right also reveals Record payment, as an accelerator,
  never the only path.

### Record payment — the ten-second flow

Opened from a member's row, everything is prefilled and the default case
needs zero edits:

1. **Member** — already selected. "+ Add another member" reveals a search
   for the spouse-pays-both case.
2. **Amount** — prefilled with what's owed, numeric keypad, editable for
   partials.
3. **Into account** — **remembered from the last payment** (new in v2; v1
   defaulted to the first account). Most meeting collections go into the
   cash box, and the treasurer should not have to change it every time.
4. **Date** — today.
5. **Check # / note** — optional, collapsed until tapped.
6. **Save** — one tap. Creates the ledger transaction and the allocation,
   as in v1. A brief confirmation toast; the sheet closes; the roster row
   updates in place.

Opened from Home or the Dues header with no member selected, step 1 is a
search field with the keyboard already up.

**Allocate** (from an unallocated deposit) is the same sheet with the
account/date/note section replaced by the deposit summary and "$X left to
allocate", as in v1.

### Manage periods

Reached from the period picker. A list of periods (label, dates, amount,
"current" badge). Tap → edit sheet. **New period** prefills the next
period from the last one's cadence and amount, as v1's auto-roll does.

## 3. Ledger

The checkbook register, as a list.

- **Account switcher**: segmented control across the top (orgs have one to
  three accounts). Balance for the selected account beneath it.
- **Search field** and a **Filter** button → filter sheet: date range
  presets, category, "uncleared only" (the month-end reconcile view).
  Active filters show as removable chips under the search field.
- **Register list**, newest first. Each row: line 1 = payee (or "Transfer
  to Savings"), amount right-aligned, income tinted green; line 2 = date ·
  category, running balance small and muted under the amount. A cleared
  transaction shows a check mark before the date. The running balance
  stays truthful under filters, as in v1. Dues-linked rows carry the small
  member badge.
- **Tap a row** → edit sheet (the same form as Add, with Delete at the
  bottom, transfers editing both halves as in v1). **Swipe** reveals
  "Mark cleared" — the fast path for ticking against a statement.
- **Add (+)** → sheet: type segmented control (Income · Expense · Transfer)
  at the top; **amount first** with the numeric keypad up; then category
  (a searchable list; "+ New category" at the bottom), payee, date, memo,
  cleared. Transfers swap category for the other account and direction.
  Income in the system Dues category ends with "Allocate to members?" and
  hands off to the payment sheet — one path, as in v1.
- **Overflow (…)**: Import from bank file…, Export CSV.

### Bank import (full-screen modal flow)

Same engine as v1; the mapping UI is rebuilt for a phone.

1. **Pick file** — document picker (Files app; the file the treasurer
   downloaded from the bank's site or app). CSV, XLSX, OFX/QFX. OFX skips
   step 2.
2. **Map columns** — v1's one-screen mapping grid does not fit a phone.
   Instead, one question per page with a sample from the file under each:
   "Which column is the date?" → "…the description?" → "…the amount, or is
   it split into two columns?" Auto-guessed answers are preselected so the
   common case is Next, Next, Next.
3. **Review** — three collapsible sections: New (checked), Possible
   duplicates (unchecked, with the matching existing transaction shown
   beneath), Already recorded (read-only). Same three buckets as v1.
4. **Import** — the pre-import snapshot runs first if snapshots are on
   (v1's backup-first policy), then the commit summary.

## 4. Members

- **Searchable list**, last-name order, current members by default with a
  "Former" filter chip. Each row: name; beneath it the dues position in the
  v1 language — separate Due ($) and Behind (N months) values with a status
  dot. Exempt and former members labeled.
- **Tap** → **member detail** (pushed screen): contact block with native
  tap-to-call / text / email; dues history by period (owed, paid,
  outstanding, status); linked transactions; Edit button → sheet.
- **Add (+)** → sheet with the baseline fields (name, email, phone, address,
  join date, notes), dues-exempt toggle, "mark as left". **Add from
  Contacts** at the top of the sheet prefills name, email, and phone; the
  Contacts permission is requested only when tapped.
- **Overflow (…)**: Import from CSV… (document picker → the same one-
  question-per-page mapping pattern as bank import → preview → import).

## 5. Reports

- **Report picker**: segmented control — Treasurer's · Dues roster ·
  Year-end.
- **Range picker**: a button showing the current selection ("Last month",
  "Jul 2026", "FY 2025–2026"); tapping opens a presets sheet, fiscal-year
  aware, with a custom range at the bottom.
- **Preview**: the v1 print-styled report sheet (serif masthead, double
  rule, tables with bold totals) rendered in a web view, pinch-zoomable.
  This is what gets shown across the table at the meeting.
- **Share** (primary): generates the PDF from that same HTML and opens the
  share sheet — AirDrop, Mail, Print, Save to Files.
- **Export CSV** (secondary) for the table-shaped reports, via share sheet.

## 6. Settings (gear from Home)

Grouped list, same panels as v1 minus Updates:

- **Organization** — name, fiscal year start, dues cadence, arrears
  threshold.
- **Accounts** — list; tap → edit name, opening balance, as-of date, with
  v1's non-blocking "transactions predate this" warnings.
- **Categories** — add, rename, deactivate; system categories shown locked.
- **Backups** — snapshot toggle, where snapshots go (plain language: "your
  iCloud Drive → Duesbook"), retention count, last snapshot time,
  **Snapshot now**, **Save a copy…** (share sheet), **Restore…** (list of
  snapshots, or pick any `.duesbook`/`.db` file), each restore confirmed
  loudly with a pre-restore safety copy.
- **Handoff** — **Export for new treasurer**: writes
  `<org>-duesbook-<date>.duesbook` and opens the share sheet. The
  READ-ME-FIRST text from v1 becomes the share message and an in-app
  "how the new treasurer opens this" page.
- **Security** — biometric app lock toggle (off by default).
- **About** — version, license, link to the repository.

## 7. Receiving a file

Opening a `.duesbook` (or `.db`) file from anywhere — Files, Mail, AirDrop,
a messaging app — launches Duesbook and asks: *"Restore these books? This
replaces the books on this phone (a safety copy is kept)."* On a fresh
install this is the takeover path; on an existing install it is disaster
recovery or a deliberate replacement. Same code path as Settings → Restore.

## The flows that must be effortless

| Flow | Path | Bar to clear |
|---|---|---|
| Who owes, at the meeting | Launch → Dues tab | One tap; "Owes" filter preselected |
| Record a handed-over payment | Dues → tap member → Save | < 10 seconds, nothing typed in the common case |
| Show the report at the meeting | Reports → (already on current period) → Share | Two taps to a PDF in someone else's hands |
| Month-end at the desk | Ledger → Import from bank file → Review → Import; then uncleared filter + swipe-to-clear | No math by hand; mapping is Next-Next-Next |
| New fiscal year / month | Automatic (auto-roll), or Dues → Manage periods → New | Zero taps in the common case |
| Treasurer handoff | Settings → Handoff → Export → AirDrop | One file, opens directly in the new phone's Duesbook |
| Disaster recovery | Install → open the snapshot from Files | Books back in minutes |
| Moving from the desktop app | Desktop: Export for new treasurer → get file to phone → tap it | No conversion; same schema |

## Deliberate omissions (v2.0)

- No phone landscape layout; tablets get the wide layout instead.
- No home-screen widgets, watch app, or notifications of any kind.
- No inline editing in the register — the sheet is the editor, as in v1.
- No charts. Numbers, progress bars, and status dots only.
- No member-facing features (portals, emailed statements).
- Dark mode: follow the system appearance if it falls out of the token
  system cheaply; not a commitment.

## Design language

The v1.1 redesign's identity carries over as the palette and voice:
bookkeeper green (`#2e7d46`) as the single accent, warm off-white ground,
white cards, dot-plus-label statuses with separate Due/Behind values, the
serif report sheet. The bento-card grid becomes native grouped lists and
cards; drawers become sheets; the sidebar's green active pill becomes the
active tab tint. A mobile design canvas (the `design` skill) is the next
artifact after this map is reviewed.

## Resolved (2026-09-14)

1. Home **keeps the pinned Record a payment button**. The break from v1's
   "no data entry on Home" is deliberate: launch-to-payment in one tap.
2. The Dues roster **opens on the Owes filter whenever anyone owes**; All
   is one tap away.
3. The payment sheet's account **remembers the last one used, app-wide**.
   One payment into the cash box and every later meeting payment defaults
   there.
4. Bank-import mapping is **one question per page** with a sample value
   from the file under each option. The single-form version is not mocked.
5. **Add from Contacts** ships in 2.0 and appears in the Add-member sheet.
