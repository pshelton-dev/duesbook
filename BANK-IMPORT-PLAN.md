# Bank Import — Implementation Plan

*Status: planned 2026-07-11, not yet built. Companion to [REQUIREMENTS.md](REQUIREMENTS.md)
and [DATA-MODEL.md](DATA-MODEL.md). Supersedes the "no bank import" v1 non-goal —
a deliberate scope pull-forward decided during the pilot.*

## What it is

Import transactions from a bank-exported file (CSV, XLSX, or OFX/QFX) into one
ledger account, **reconciliation-aware**: imported rows are matched against
existing transactions so re-imports and hand-entered entries are never
double-counted. Fully local — the user downloads the file from their bank's
website themselves; Duesbook never talks to a bank.

**Explicit non-goal, permanently:** live bank connections / aggregators
(Plaid-style). Collecting bank credentials and transmitting them to a third
party breaks the app's core privacy promise. File import only.

## Locked decisions (2026-07-11)

| Decision | Choice | Why |
|---|---|---|
| Model | **Reconciliation-aware** (not bulk-add) | Users hand-enter AND import; blind adds would double-count. Reuses the existing cleared/reconcile flow. |
| Formats | **CSV + XLSX + OFX/QFX** | CSV is universal; the pilot bank (PNC) exports **XLSX**; OFX carries a unique FITID that makes dedup exact. |
| XLSX parsing | Tiny zip dep (`fflate`) + minimal hand-rolled XML value extraction | Full xlsx libs are heavy; we only need values, shared strings, and serial dates. fflate is ~8KB, zero deps, no install scripts. |
| OFX parsing | Hand-rolled | OFX transaction blocks are simple SGML; keeps a dependency out. |
| Categorization | **Uncategorized on import**; bank description → payee | Matches the manual flow; payee→category rules are a possible later add. |
| Safety | **Auto-backup immediately before commit** | Bulk change insurance; backup engine already exists. First-class undo deferred. |
| Import target | One account per import | You download per-account from the bank; hangs off the active Ledger tab. |

## The pipeline

```
pick file → parse (per format) → normalized rows → reconcile → PREVIEW → commit
```

**Normalized row:** `{ date: ISO, amountCents: signed int, description, memo?, fitid? }`

1. **Parse**
   - *CSV*: column-mapping step (reuse the member-import mapping pattern):
     date / description / amount columns, **sign convention** (single signed
     column vs. separate withdrawal+deposit columns), date format.
   - *XLSX*: unzip → sheet1 + sharedStrings → same mapping step as CSV.
     Dates arrive as Excel serials (days since 1899-12-30) — convert.
   - *OFX/QFX*: structured; `DTPOSTED`/`TRNAMT`/`NAME`/`MEMO`/`FITID`. No mapping step.
2. **Reconcile** — pure function `(db, accountId, rows) → buckets`:
   - **Duplicate** (skip): FITID already on a txn (OFX), or fingerprint already
     on a txn (CSV/XLSX). Fingerprint = hash(accountId, date, amountCents,
     normalized description, **occurrence index**) — the occurrence index
     distinguishes genuinely identical same-day rows (two identical dues
     payments), which the pilot data shows are realistic.
   - **Match** (mark cleared): an existing **uncleared** txn with the same
     amount, date within ±4 days → propose marking it cleared instead of adding.
   - **New** (add): inserted as uncategorized, cleared, payee = trimmed description.
3. **Preview** — the safety surface. Three sections (Duplicates / Matches / New),
   each row individually accept/rejectable. Nothing written until commit.
4. **Commit** — auto-backup, then one atomic DB transaction: set matched txns
   cleared (+ stamp their fitid/fingerprint), insert accepted new rows.

## Data model

Migration **004**:
```sql
ALTER TABLE txn ADD COLUMN import_fitid TEXT;        -- OFX FITID, nullable
ALTER TABLE txn ADD COLUMN import_fingerprint TEXT;  -- CSV/XLSX fingerprint, nullable
CREATE INDEX idx_txn_import ON txn(account_id, import_fitid, import_fingerprint);
```

## Code layout

- `src/main/import.ts` — parsers (`parseCsvBank`, `parseXlsx`, `parseOfx`),
  `reconcileImport`, `commitImport`.
- IPC: `openBankFile()` (dialog → `{ text|bytes, format }`),
  `previewBankImport(accountId, …)`, `commitBankImport(accountId, decisions)` —
  wired through `src/main/ipc.ts`, preload, `shared/types.ts`.
- Renderer: **"Import transactions"** button in the Ledger header →
  `screens/ledger/ImportFlow.tsx` (stepped drawer/panel: file → mapping (CSV/XLSX
  only) → preview → summary).

## Known format facts (pilot bank: PNC, business portal)

- Exports **XLSX**, one sheet, ~75 rows/year (volume is trivial).
- Columns: `Date | Description | Withdrawals | Deposits | Balance` —
  withdrawal/deposit are **separate, both positive** (the two-column sign case).
- Dates are Excel serial numbers.
- Descriptions: uppercase, embedded masked refs, trailing whitespace (trim);
  same-day rows with identical descriptions occur (differ only by amount — and
  sometimes not even that, hence the occurrence index).
- A running `Balance` column exists → optional future preview check ("computed
  balance matches the bank's"). Not in scope for phase 1.
- No unique transaction ID in CSV/XLSX exports → fingerprint dedup.

## Interactions with existing features

- **Transfers**: a bank file can't distinguish a transfer from income/expense;
  imported rows land as income/expense and the user reclassifies. If both sides'
  accounts are imported, each side reconciles independently.
- **Dues**: an imported deposit categorized as Dues feeds the existing
  unallocated-deposit → allocate-to-members flow. No new code needed.

## Implementation notes (phase 1, built 2026-07-11)

- **"Uncategorized" is a real category, not NULL.** The txn CHECK constraint
  requires income/expense rows to carry a category, so migration 004 adds two
  locked system categories (`Uncategorized` income + expense) as the landing
  zone. Same spirit as "uncategorized on import", no schema surgery.
- **Third duplicate net: `cleared-match`.** A bank row whose amount+date (±4d)
  matches an already-**cleared**, non-import-stamped txn is bucketed as a
  duplicate (default skip) — adding it would double-count money the treasurer
  hand-entered and reconciled manually. (Uncleared matches remain the
  mark-cleared proposals.)
- **Backup policy on commit:** backup folder configured → the pre-import backup
  must succeed or the import aborts untouched; no folder configured → proceed
  (same risk posture as every other edit; Home already nags to set one).
- **Float noise is real:** XLSX caches IEEE-754 values (`76.319999999999993`
  = $76.32); the cents parser accepts long decimal tails and rounds.
- Verified against the real PNC file (74/74 rows) + a CSV round-trip of the
  same grid: import → re-import = 0 added; uncleared hand-entered txn →
  matched & marked cleared; cleared hand-entered txn → skipped as duplicate.

## Implementation notes (phase 3, built 2026-07-11)

- `parseOfx` handles OFX 1.x (SGML, unclosed leaf tags, colon-style header)
  and 2.x (XML) in one pass; DTPOSTED time/zone suffixes dropped; description
  = NAME → MEMO → "TRNTYPE CHECKNUM" fallback. OFX rows skip the mapping step
  in the UI (already structured).
- **Cross-source dedup fix:** the amount+date candidate net now includes
  import-stamped transactions, so the same money arriving from a different
  source (CSV one month, QFX the next; a bank that re-issues FITIDs) is caught
  as a `cleared-match` duplicate instead of silently re-added. Trade-off: a
  genuinely-new identical twin row in an overlapping download lands in the
  visible duplicates bucket (recoverable by hand-entry) — chosen over silent
  double-counting.
- Verified against two public fixtures: annacruz/ofx `sample.ofx` (OFX 1.02
  SGML, 36 txns, tz-stamped dates, mixed tag styles) and csingley/ofxtools
  `stmtrs.ofx` (OFX 2.0 XML). Full CSV/XLSX suite re-run green after the
  candidate-net change.

## Phases (build → walkthrough → commit loop)

1. **Engine**: migration 004 + parsers (CSV, XLSX) + reconcile + commit + IPC.
   *Verify (scripted, dev db)*: import the real PNC file → N added; re-import →
   0 added; hand-enter a matching txn, re-import → matched & marked cleared.
2. **UI**: import flow in the Ledger (file → mapping → preview → commit → summary).
   *Verify*: walkthrough in the dev app + screenshots.
3. **OFX**: parser + a generic QFX sample sourced from the web; edge cases
   (encodings, sign conventions, ambiguous matches).

*Test data note: the real PNC file stays outside the repo (private data; repo
may go public). Scripted tests use it locally by absolute path or a sanitized
copy in the session scratchpad — never committed.*
