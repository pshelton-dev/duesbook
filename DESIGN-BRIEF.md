# Duesbook — design brief

*Paste-ready context for a Claude design session. Goal: model the current UI
faithfully first, then explore improvements — don't invent a new app.
Companion to SCREEN-MAP.md (structure) and REQUIREMENTS.md (scope), but this
document is self-contained.*

## What the app is

Duesbook is a desktop app (Electron, Mac + Windows) for volunteer treasurers
of small organizations — clubs, lodges, PTAs, HOAs. It manages bank/cash
accounts (a checkbook-style ledger), a member roster, and monthly or annual
dues collection, plus printable reports and automatic local backups. The user
is a non-professional who opens the app a few times a month; clarity and
"can't get lost" beat power features. All data is local; there is no cloud,
login, or sync.

**Tone target:** calm, trustworthy, ledger-like. Feels like well-organized
paper books, not a fintech dashboard. No charts in v1 — numbers and status
chips carry the information.

## Hard constraints

- Desktop window, resizable, roughly 1200×800 typical. Mouse-first.
- Single window, flat navigation: persistent left sidebar, six screens,
  nothing nested deeper than one level.
- Light mode only today (dark mode is open for discussion).
- Reports must print cleanly (print CSS hides everything but the report page).
- Currency is USD; amounts always right-aligned with tabular numerals.

## Current design tokens

**Type:** system font stack (`-apple-system, Segoe UI, Roboto`), base 14px.
Page titles (h1) 20px/600, section heads (h2) 15px/600, tables 13px, hints
12px `#777`. Reports alone use a serif (Georgia) masthead.

**Color:** near-black text `#1a1a1a` on white; muted `#666`/`#777`/`#999`;
borders `#ddd` (panels) / `#ccc` (inputs) / `#eee` (table rules); sidebar
background `#f4f4f2`.

Single accent — a bookkeeper green:
- Primary button `#3b6d3b` (hover `#2f572f`), white text
- Soft green fill `#dce8dc` (active nav item, "paid" chip, ok badge)
- Green tint `#f4f9f4` with border `#b8d4b8` (notice panels, active account
  tab, total balance card)
- Focus ring `#9dbf9d`; positive amounts `#2f6f2f`

Status palette (chips/panels):
- Warn/partial: bg `#fdf6ec`, border `#e0c48c`, text `#8a6420`
- Danger/owed: bg `#fbeeee`, border `#d9a0a0`, text `#a32d2d`
- Waived/exempt (neutral): bg `#eef0f4`, text `#4a5568`
- Not-applicable: bg `#f1f1ef`, text `#999`

**Shape & spacing:** 6px radius on inputs/buttons, 8px on panels/cards/tabs,
12px on the wizard card, full-pill chips. Content area padding 24px top,
32px sides. Panels cap at 640px wide; the report page at 720px.

## App shell

Fixed 200px sidebar (`#f4f4f2`, 1px right border): "Duesbook" wordmark, then
six flat nav items — **Home · Ledger · Members · Dues · Reports · Settings**.
Active item gets the soft-green pill. Content area scrolls independently.

All editing happens in a **right-side drawer** (fixed, full-height, 380px —
520px for the payment flow), white with a left shadow: header with title +
Close, stacked form fields, footer with Delete (danger, left) and
Cancel/Save (right). Never a centered modal, except the first-run wizard.

## Screens (current anatomy)

### 0. First-run wizard
Only screen at first launch: centered 720px card on the `#f4f4f2` backdrop.
Step pills across the top (current = green pill, done = green text), body,
Back/Next footer. Five steps: Organization → Accounts (opening balances) →
Backup folder (skippable, warns loudly) → Dues (amount, cadence
monthly/yearly, first period; skippable) → Members (CSV import with column
mapping, or skip). A small "restoring from a handoff?" link on step 1.

### 1. Home
Orientation only, no data entry.
- **Balance cards** — one bordered card per account (name + large amount),
  plus a green-tinted Total card.
- **Dues progress** — "Jul 2026: 4 of 6 paid", $ collected / $ outstanding,
  thin green progress bar, link to Dues.
- **Arrears panel** (danger-styled) — members ≥N months behind, with amounts.
- **Health strip** — panels for stale/never backup (warn/danger), update
  available (dismissible), unallocated dues deposits.
- **Recent transactions** — last 10, read-only mini-table, click → Ledger.

### 2. Ledger
The checkbook register; heart of day-to-day use.
- **Account tabs** across the top: rounded cards showing name + balance;
  active = green border + tint. "New transaction" button on the right.
- **Filter bar**: text search, date range, category select, "uncleared only".
- **Register table**: Date · Payee · Category · Memo · Amount · Balance ·
  Cleared (inline checkbox). Newest first, sticky header, hover highlight;
  income green, expenses plain black (no red ink for normal spending); memo
  truncates. A small badge marks dues-linked transactions.
- Row click opens the **transaction drawer**: income/expense/transfer
  segmented control; transfers pick the peer account and create the linked
  pair invisibly.

### 3. Members
- **Roster table**: Name · Email · Phone · Joined · dues status chip. Chip
  shows the total position across all months, e.g. `Owed · $150 · 3 mo`
  (red), `Paid` (green), `Exempt` (gray). Former members hidden behind a
  filter. "Add member" + "Import CSV" buttons.
- **Member detail**: contact info + full dues history (every period: owed,
  paid, dates, linked transactions). Edit drawer has baseline fields plus
  dues-exempt toggle and "mark as left".

### 4. Dues
The collection workflow — the most-repeated action in the app lives here.
- **Header**: period picker (defaults to current month) + "Record payment"
  primary button; period create/edit.
- **Summary bar**: Collected / Outstanding / N of M paid, big
  tabular-numeral figures with small uppercase labels.
- **Unallocated deposits** notice row when dues income exists in the ledger
  that isn't assigned to members yet → allocate flow.
- **Period roster table**: Member · Owed · Paid · Outstanding · status chip,
  filterable to "hasn't paid". Row actions: record payment, waive, adjust.
- **Payment drawer** (wide, 520px): member type-ahead, multiple members per
  check (spouse pays both), amounts prefilled with what's owed, deposit
  details (account, date, check #). One save = ledger transaction +
  allocations. Target: under 30 seconds.

### 5. Reports
- Segmented control picks the report: Treasurer's report · Dues roster ·
  Year-end summary; date-range presets (fiscal-year aware).
- **Report page**: a paper-like 720px sheet — serif masthead (org name,
  report title, period, generated date) over a double-ruled line, then
  clean tables with bold total rows. Print and Export CSV buttons.

### 6. Settings
Stacked panels: Organization (name, fiscal year, dues cadence, arrears
threshold) · Categories (system "Dues" category locked) · Backups (folder,
retention, last-backup time, Back up now, Restore list) · Handoff (Export
for new treasurer) · Updates (notify-only toggle, Check now) · About.

## Component inventory

Sidebar nav item · panel (plain / notice / warn / error) · buttons (default,
primary green, danger, small) · form field (label above input, hint below) ·
segmented control · status chips (paid / partial / owed / waived / exempt /
n-a) · badges · account tab card · filter bar · register table · mini table ·
summary bar · balance card · progress bar · right drawer (2 widths) ·
type-ahead list · amount input (right-aligned, narrow) · report sheet ·
wizard card with step pills.

## Where to push (the agenda)

Model the current state first, then explore. Known friction and open
questions, roughly in priority order:

1. **Visual identity.** The current look is deliberately plain — is there a
   warmer, more confidence-inspiring treatment (type, green, density,
   iconography — there are currently *no icons anywhere*) that keeps the
   calm ledger feel?
2. **Home hierarchy.** Cards, progress, warnings, and a table compete; what
   should a once-a-month treasurer see first? Health warnings (backup!)
   need urgency without alarm fatigue.
3. **Wizard step 2/4 conflict** (top of WISHLIST.md): opening balance date
   vs. backdated dues periods can double-count. Design a "when do your books
   start?" moment that makes the tradeoff legible to a non-accountant.
4. **Status chip language.** `Owed · $150 · 3 mo` packs three facts into one
   pill — is there a clearer roster treatment for "how behind is this
   member?"
5. **Drawer-only editing.** Everything edits in a right drawer; inline
   register editing is a candidate v2 upgrade. Worth mocking?
6. **Empty states & first-month experience** after the wizard.
7. **Dark mode** — not committed; explore only if it falls out cheaply.

Non-goals for this session: charts/dashboards, mobile, multi-org, themes
beyond light/dark.
