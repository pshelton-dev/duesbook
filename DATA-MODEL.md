# Treasurer — Data Model (Draft)

*Status: draft for review, 2026-07-08. Companion to [REQUIREMENTS.md](REQUIREMENTS.md).*

One SQLite file = one organization's complete books. Everything below lives in
that file.

## Design principles

1. **Money is stored as signed integer cents** (`amount_cents`), never floats.
   Floating point cannot represent $0.10 exactly; integer cents make sums exact
   and rounding bugs impossible. Positive = money in, negative = money out.
2. **Dates are ISO-8601 text** (`'2026-07-08'`) — SQLite's convention, sorts
   correctly as text, human-readable if anyone opens the file directly.
3. **IDs are plain SQLite `INTEGER PRIMARY KEY`.** Single-user, single-file —
   UUIDs would add noise for zero benefit.
4. **Constraints live in the schema where possible** (CHECKs, foreign keys,
   UNIQUEs). This file will outlive any one treasurer and may be opened by
   other tools; the schema should defend its own invariants.
5. **Derived values are computed, not stored.** Account balances and dues owed
   are always calculated from transactions/payments — there is no stored
   balance column that can drift out of sync.

## Schema

```sql
PRAGMA foreign_keys = ON;      -- enforced at every connection open
PRAGMA journal_mode = WAL;     -- crash-safe writes

-- App metadata: schema_version for future migrations, etc.
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Exactly one row: the organization and its settings.
CREATE TABLE organization (
  id                       INTEGER PRIMARY KEY CHECK (id = 1),
  name                     TEXT NOT NULL,
  fiscal_year_start_month  INTEGER NOT NULL DEFAULT 1
                             CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  backup_dir               TEXT,             -- revalidated when file moves machines
  backup_retention         INTEGER NOT NULL DEFAULT 30,
  update_check_enabled     INTEGER NOT NULL DEFAULT 1,
  created_at               TEXT NOT NULL
);

-- Real-world money locations: checking, savings, the cash box.
CREATE TABLE account (
  id                     INTEGER PRIMARY KEY,
  name                   TEXT NOT NULL UNIQUE,
  type                   TEXT NOT NULL
                           CHECK (type IN ('checking','savings','cash','other')),
  opening_balance_cents  INTEGER NOT NULL DEFAULT 0,
  opening_date           TEXT NOT NULL,
  is_active              INTEGER NOT NULL DEFAULT 1,  -- closed accounts hide, never delete
  sort_order             INTEGER NOT NULL DEFAULT 0
);

-- Income/expense categories. A protected built-in "Dues" income category
-- (is_system = 1) is where dues payments land in the ledger.
CREATE TABLE category (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('income','expense')),
  is_system  INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (name, kind)
);

-- The ledger. ("txn" because TRANSACTION is a SQL keyword.)
CREATE TABLE txn (
  id               INTEGER PRIMARY KEY,
  account_id       INTEGER NOT NULL REFERENCES account(id),
  date             TEXT NOT NULL,
  amount_cents     INTEGER NOT NULL CHECK (amount_cents <> 0),
  type             TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  category_id      INTEGER REFERENCES category(id),
  payee            TEXT,                    -- who paid / who was paid
  memo             TEXT,
  cleared          INTEGER NOT NULL DEFAULT 0,  -- ticked off against bank statement
  transfer_peer_id INTEGER REFERENCES txn(id),  -- the matching half of a transfer
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  -- sign must agree with type; transfers have no category, others require one
  CHECK (
    (type = 'income'   AND amount_cents > 0 AND category_id IS NOT NULL) OR
    (type = 'expense'  AND amount_cents < 0 AND category_id IS NOT NULL) OR
    (type = 'transfer' AND category_id IS NULL)
  )
);
CREATE INDEX idx_txn_account_date ON txn(account_id, date);
CREATE INDEX idx_txn_category     ON txn(category_id);

-- Members. Active/inactive is derived from left_date so history is preserved:
-- someone who left in 2027 still correctly owed dues for 2026.
CREATE TABLE member (
  id          INTEGER PRIMARY KEY,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  join_date   TEXT,
  left_date   TEXT,                       -- NULL = current member
  dues_exempt INTEGER NOT NULL DEFAULT 0, -- honorary/lifetime members
  notes       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- One row per dues cycle, usually per fiscal year: "2026–2027", $50.00.
CREATE TABLE dues_period (
  id           INTEGER PRIMARY KEY,
  label        TEXT NOT NULL UNIQUE,
  start_date   TEXT NOT NULL,
  end_date     TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  CHECK (start_date < end_date)
);

-- Per-member exception for one period: prorated joiner, hardship waiver (0).
CREATE TABLE dues_override (
  member_id      INTEGER NOT NULL REFERENCES member(id),
  dues_period_id INTEGER NOT NULL REFERENCES dues_period(id),
  amount_cents   INTEGER NOT NULL CHECK (amount_cents >= 0),
  note           TEXT,
  PRIMARY KEY (member_id, dues_period_id)
);

-- Links ledger money to member obligations. Separate from txn so ONE check
-- can pay dues for MULTIPLE members (spouse writes one check for two
-- memberships) and partial payments fall out naturally.
CREATE TABLE dues_payment (
  id             INTEGER PRIMARY KEY,
  txn_id         INTEGER NOT NULL REFERENCES txn(id) ON DELETE CASCADE,
  member_id      INTEGER NOT NULL REFERENCES member(id),
  dues_period_id INTEGER NOT NULL REFERENCES dues_period(id),
  amount_cents   INTEGER NOT NULL CHECK (amount_cents > 0)
);
CREATE INDEX idx_dues_payment_member ON dues_payment(member_id, dues_period_id);
CREATE INDEX idx_dues_payment_txn    ON dues_payment(txn_id);
```

App-enforced invariant (can't be a CHECK across rows): for any transaction,
`SUM(dues_payment.amount_cents) ≤ txn.amount_cents` — allocations never exceed
the deposit they came from.

## How the pieces answer the real questions

**Account balance** = `opening_balance_cents + SUM(txn.amount_cents)` for that
account. Signed amounts make this a single SUM; transfers cancel across
accounts automatically (−$500 from checking, +$500 to savings).

**What does member M owe for period P?**
```
owed = COALESCE(override.amount_cents,
                CASE WHEN member.dues_exempt THEN 0
                     ELSE period.amount_cents END)
       − SUM(payments for M in P)
```
Partial payments, waivers ($0 override), prorated joiners, and honorary
members all fall out of this one formula.

**Dues roster for period P** = every member whose membership interval
(`join_date`..`left_date`, open-ended) overlaps P, plus anyone with a payment
or override in P. Mid-year joiners appear from their join date; departed
members keep their historical rows.

**Treasurer's report for a date range** = per category:
`SUM(txn.amount_cents)` where `type <> 'transfer'`, grouped by category kind;
opening/closing balances from the balance formula at the range edges.
Transfers are excluded so moving money between your own accounts never shows
as income or spending.

## Decisions embedded here (and their tradeoffs)

1. **Dues payments are a join table, not columns on the transaction.**
   Costs one extra table and an allocation step when recording a dues deposit.
   Buys: one check covering several members, one member paying across several
   checks, and a clean "unallocated deposit" state the UI can flag.

2. **Transfers are a linked pair of transactions.** Each account's register
   shows its own row (as a bank statement would), balances need no special
   cases, and reports skip them by type. Cost: the app must keep the pair in
   sync on edit/delete — handled in one place in the data layer.

3. **Nothing user-facing is hard-deleted if history depends on it.** Accounts
   and categories deactivate rather than delete once referenced; members with
   payment history can't be deleted (set `left_date` instead). Transactions
   CAN be deleted (volunteers make typos), with automatic backups as the
   safety net.

4. **`dues_override` exists** even though flat dues are the v1 model — it's
   the escape hatch for the exceptions every real org has (prorated
   mid-year joiners, waivers) without building a tiers system.

## Resolved questions (2026-07-08)

- Member record fields: baseline set — name, email, phone, address, join
  date, notes. No household grouping or custom fields in v1.
- Audit trail: timestamps only; auto-backups provide point-in-time recovery.
- Receipt/document attachments: deferred entirely.

## Deferred (data model is ready for them, no migration pain expected)

- Membership tiers → add a `dues_tier` table, point members at it.
- Budget vs. actual → add a `budget` table keyed by category + fiscal year.
- Double-entry upgrade → txn rows become splits; signed cents already align.
- Multi-org → it's a different file, not a schema change.
- Attachments → add an `attachment` table (txn_id, filename, blob or sidecar
  path); purely additive.
- Household grouping / custom member fields → additive tables if ever needed.
