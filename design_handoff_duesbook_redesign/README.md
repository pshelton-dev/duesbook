# Handoff: Duesbook — Modern Redesign (Home, Ledger, Members, Dues)

## Overview
Duesbook is a desktop app (Electron, Mac + Windows) for volunteer treasurers of small
organizations (clubs, lodges, PTAs, HOAs) — a checkbook-style ledger, member roster, and
dues-collection workflow. This package documents a visual/UX modernization of the existing
app: a warmer, more confidence-inspiring "bento card" treatment with simple geometric icon
tiles, replacing the original plain/bordered look, while keeping the calm "ledger, not
fintech dashboard" feel and the single-green identity.

## About the Design Files
The files in this bundle are **design references built in HTML** (Design Components, a
Claude prototyping format) — they demonstrate intended look, layout, and interaction, not
production code to copy directly. The task is to **recreate this design in Duesbook's real
codebase** (Electron + whatever front-end framework it uses) using the app's existing
component patterns and state management — not to ship the HTML as-is.

## Fidelity
**High-fidelity.** Colors, spacing, radii, and copy below are final; recreate pixel-close
using the target codebase's component library and layout primitives.

## Screens / Views

### App shell (all screens)
- Fixed left sidebar, 200px wide, white background (`#fff`), 1px right border `#e7e9e4`,
  22px vertical padding.
- Wordmark "Duesbook", 16px/700, letter-spacing -0.3px, at top with 20px side / 22px bottom
  padding.
- Six nav items: Home, Ledger, Members, Dues, Reports, Settings. Each item: 9px vertical /
  12px horizontal padding, 10px border radius, 13px/600 text, 8px margin between items
  (2px vertical, 14px horizontal).
  - **Active**: background `#2e7d46` (primary green), text `#fff`, small 8×8px square dot
    (3px radius) at `#fff` opacity 1.
  - **Inactive**: transparent background, text `#3a4a3d`, same dot at `#2e7d46` opacity 0.5.
  - Hover (inactive only): background `#eef2ec`.
- Content area: `margin-left: 200px`, padding 26px top / 32px sides / 64px bottom, max-width
  920px, page background `#f4f5f2`.
- Page title (h1): 23px/700, letter-spacing -0.3px, `#16281a`.

### Home
Orientation-only, no data entry. Sections top to bottom:
1. **Balance cards** — 3-column grid, 14px gap. Each account card: white background, 14px
   radius, 18px padding, shadow `0 4px 14px rgba(20,60,30,.06)`. Icon tile: 32×32px, 9px
   radius, background `#e3f2e6`, containing a centered 12×12px circle `#2e7d46`. Label
   11px `#8a938c`; amount 21px/700 tabular numerals. **Total** card uses the same layout but
   a green gradient background (`linear-gradient(135deg, #379a55, #2e7d46)`), white text,
   icon tile background `rgba(255,255,255,.2)` with a white inner circle.
2. **Dues progress** — white card, 14px radius, 18px/20px padding, `border-left: 3px solid
   #2e7d46` (accent-edge treatment), flex row with a 46×46px "progress ring" (two stacked
   circles: light track `#dcecdf` + green arc `#2e7d46`, rotated 45°), heading "Dues · July
   2026" (15px/700) + "View Dues →" link (13px/600, `#2e7d46`), and a summary line (12.5px
   `#8a938c`): "4 of 6 paid · $340.00 collected · $170.00 outstanding".
3. **Arrears** — soft red card `#fdf0ed`, 14px radius, 16px/20px padding. Header row: small
   8×8px diamond (rotated square) `#c1523f` + "Arrears" (14px/700, `#a5402f`). Each member
   row: name + small muted "N mo behind" label on one line (`white-space: nowrap` — do not
   let it wrap), amount right-aligned, 700 weight, tabular numerals, `#a5402f`. **Chip
   language fix**: the amount and the "months behind" fact are two separate pieces of text
   on the same line, not one packed pill/chip.
4. **Recent Transactions** — (tweakable position, see below) white card, 14px radius,
   shadow, each row: small 22×22px empty icon-placeholder square (`#eef2ec`, 7px radius),
   date (52px column, `#8a938c`), payee, category (`#8a938c`), amount (right-aligned, 700,
   green `#2e7d46` for income / `#16281a` for expense). Rows are clickable → Ledger.
5. **Health strip** — column of notice cards, each with `border-left: 3px solid <accent>`
   instead of a full-tint background:
   - Backup warning: bg `#fff9e9`, accent `#cf9a3e`, text `#8a6420`, "Back up now" action.
   - Update available (dismissible, × button): bg `#eef0f4`, accent `#7a8a94`, text
     `#4a5568`.

**Tweak implemented**: a boolean "Home layout" tweak (`recentBelowArrears`, default **on**)
reorders sections 4/5 so Recent Transactions renders directly under Arrears, above the
Health strip (the reviewed/approved order). Implement as a simple layout-order toggle,
not two different sets of markup.

### Ledger
The checkbook register.
- **Account tabs**: rounded 12px cards, 10px/18px padding. Active tab: solid green
  `#2e7d46` background, white text. Inactive: white background, shadow
  `0 4px 14px rgba(20,60,30,.06)`, muted `#8a938c` label / `#16281a` balance.
- **"New transaction"** button: solid green, white text, 10px radius, 700 weight, hover
  darkens to `#256339`.
- **Filter bar**: search input, category select, "Uncleared only" checkbox+label — all
  13px, inputs bordered `#dde3dc`, 9px radius, white background.
- **Register table**: white card, 14px radius, shadow. Header row 11px/700 `#8a938c`.
  Columns: Date (70px) · Payee (flex) · Category (90px) · Memo (140px, truncates) ·
  Amount (80px, right, tabular, green for income/black for expense) · Balance (80px,
  right, muted) · Cleared (60px, checkbox). Dues-linked rows show a small "DUES" badge
  (10px/700, bg `#e3f2e6`, text `#2e7d46`, 6px radius) next to the payee. Row hover:
  `#f7f9f6`. Row click opens the transaction drawer; the cleared checkbox stops
  propagation so it can be toggled without opening the drawer.

### Members
- **Header**: "Members" title + "Import CSV" (secondary) and "Add member" (primary green)
  buttons.
- **Roster table**: white card. Columns: Member (flex, 600 weight) · Contact (200px,
  muted email) · Status (90px, right-aligned) · Due (80px, right, tabular) · Behind
  (90px, right, muted). **Chip language fix**: status is a small colored dot + label
  (Paid `#2e7d46` / Owed `#c1523f` / Exempt `#7a8a94`) in its own column; the dollar
  amount and the "months behind" figure each get their own column instead of being
  packed into one pill (e.g. no more `Owed · $150 · 3 mo`). Row click → member drawer.

### Dues
- **Header**: "Dues · July 2026" + primary "Record payment" button.
- **Summary row**: 3-column grid — Collected (green figure), Outstanding, and a Paid
  "4 of 6" card with the same green gradient treatment as the Home Total card.
- **Period roster table**: same column pattern as Members (Member · Owed · Paid ·
  Outstanding · Status dot+label), white card.

### Reports & Settings
Not yet redesigned in this direction — currently placeholder stub screens ("Not yet
redesigned in this direction — happy to mock this up next"). Flag to the design team
before building these; do not invent content for them.

## Drawers (all screens)
Right-side, fixed, full-height, white, shadow `-8px 0 28px rgba(20,60,30,.12)`, with a
`rgba(20,40,26,.10)` scrim over the rest of the page (click to close).
- **Transaction drawer** (380px): header + close (×), a segmented control (Income /
  Expense / Transfer — active segment gets a white pill on a light-green track
  `#eef2ec`), stacked fields (Date, Payee, Category select, Memo, Amount, Cleared
  checkbox), footer with Delete (red text, left) and Cancel/Save (right).
- **Member drawer** (380px): Name, Email, a read-only "Dues history" mini-list (period +
  colored status), Dues-exempt checkbox, footer with "Mark as left" (red text) and
  Cancel/Save.
- **Payment drawer** (480px, wider): Member type-ahead input, Amount + Deposit account,
  Date + Check #, footer with Cancel/Save payment (no Delete — this is a create-only
  flow).

## Interactions & Behavior
- Sidebar nav switches the visible screen; no page reload, no nested routes.
- Ledger: account tab click switches the active account's register; search box filters
  by payee/memo (case-insensitive substring); "Uncleared only" filters to `cleared:
  false` rows; row click opens the transaction drawer pre-filled; cleared checkbox
  toggles inline without opening the drawer.
- Home: "View Dues →" and a Recent Transactions row both navigate to Ledger/Dues.
- Update-available notice has a dismiss (×) button (session-only dismissal is fine).
- All drawers close via the × button, the Cancel button, or clicking the scrim.

## State Management
- Current screen (enum: home / ledger / members / dues / reports / settings).
- Ledger: active account id, search text, "uncleared only" boolean, per-account
  transaction rows (with a `cleared` boolean that can be toggled).
- Drawer open/closed + which record is loaded into it (transaction / member / payment),
  and the segmented transaction type (income/expense/transfer).
- Home layout tweak: boolean controlling Recent Transactions vs. Health Strip order.

## Design Tokens

**Color**
- App background: `#f4f5f2`. Sidebar/card background: `#fff`.
- Text: primary `#16281a`, muted `#8a938c`, secondary muted `#6f7a72`.
- Borders: `#e7e9e4` (sidebar), `#dde3dc` (inputs), `#f0f2ee` (table rules).
- Primary green: `#2e7d46`, hover `#256339`, soft fill `#e3f2e6`.
- Green gradient (hero/total cards): `linear-gradient(135deg, #379a55, #2e7d46)`.
- Danger/arrears: bg `#fdf0ed`, text `#a5402f` / `#c1523f`.
- Warn/backup: bg `#fff9e9`, text `#8a6420`, accent `#cf9a3e`.
- Neutral/exempt/update: bg `#eef0f4`, text `#4a5568` / `#7a8a94`.

**Type**: system font stack (`-apple-system, "Segoe UI", Roboto, sans-serif`), base 14px.
H1 23px/700 (letter-spacing -0.3px), H2 14–15px/700, table headers 11px/700 uppercase-ish
muted, body/table 13px, hints 11–12.5px muted. All currency is right-aligned with
`font-variant-numeric: tabular-nums` and formatted with thousands separators (e.g.
`$4,215.32`, never `$4215.32`).

**Shape & elevation**: 14px radius on cards, 9–10px on inputs/buttons/nav items, 6–7px on
small badges, pill/circle for status dots and icon-tile inner shapes. Card shadow
`0 4px 14px rgba(20,60,30,.06)` (stronger `,.16` on the green hero cards). Notice/detail
cards use a `border-left: 3px solid <accent>` instead of a full-tint fill.

**Spacing**: content padding 26px top / 32px sides; 14px gap between Home sections; 18–20px
internal card padding; 16px inter-card gaps.

## Icons
No illustrative icons — simple CSS-drawn geometric marks only: filled circles for account
tiles, a partial-ring for the dues progress indicator, a small rotated square (diamond) for
warning/danger markers, and a plain circular dot for status chips. No icon font or SVG
icon set is required; these are trivial to recreate as small `div`s or minimal inline SVG
in the target codebase.

## Assets
No photographic or illustrative assets. All visuals are solid colors, gradients, and
CSS-drawn shapes.

## Files
- `Duesbook - Redesign.dc.html` — the full interactive design reference (Home, Ledger,
  Members, Dues screens; transaction/member/payment drawers; the Home-layout tweak).
  Open directly in a browser to explore behavior.
