/**
 * Ordered schema migrations. Index N = the migration that brings the db from
 * schema_version N to N+1. Never edit a shipped migration — append a new one.
 * Full rationale for this schema lives in DATA-MODEL.md.
 */
export const migrations: string[] = [
  // 001 — initial schema
  `
  CREATE TABLE organization (
    id                       INTEGER PRIMARY KEY CHECK (id = 1),
    name                     TEXT NOT NULL,
    fiscal_year_start_month  INTEGER NOT NULL DEFAULT 1
                               CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
    backup_dir               TEXT,
    backup_retention         INTEGER NOT NULL DEFAULT 30,
    update_check_enabled     INTEGER NOT NULL DEFAULT 1,
    created_at               TEXT NOT NULL
  );

  CREATE TABLE account (
    id                     INTEGER PRIMARY KEY,
    name                   TEXT NOT NULL UNIQUE,
    type                   TEXT NOT NULL
                             CHECK (type IN ('checking','savings','cash','other')),
    opening_balance_cents  INTEGER NOT NULL DEFAULT 0,
    opening_date           TEXT NOT NULL,
    is_active              INTEGER NOT NULL DEFAULT 1,
    sort_order             INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE category (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('income','expense')),
    is_system  INTEGER NOT NULL DEFAULT 0,
    is_active  INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE (name, kind)
  );

  CREATE TABLE txn (
    id               INTEGER PRIMARY KEY,
    account_id       INTEGER NOT NULL REFERENCES account(id),
    date             TEXT NOT NULL,
    amount_cents     INTEGER NOT NULL CHECK (amount_cents <> 0),
    type             TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
    category_id      INTEGER REFERENCES category(id),
    payee            TEXT,
    memo             TEXT,
    cleared          INTEGER NOT NULL DEFAULT 0,
    transfer_peer_id INTEGER REFERENCES txn(id),
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    CHECK (
      (type = 'income'   AND amount_cents > 0 AND category_id IS NOT NULL) OR
      (type = 'expense'  AND amount_cents < 0 AND category_id IS NOT NULL) OR
      (type = 'transfer' AND category_id IS NULL)
    )
  );
  CREATE INDEX idx_txn_account_date ON txn(account_id, date);
  CREATE INDEX idx_txn_category     ON txn(category_id);

  CREATE TABLE member (
    id          INTEGER PRIMARY KEY,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    address     TEXT,
    join_date   TEXT,
    left_date   TEXT,
    dues_exempt INTEGER NOT NULL DEFAULT 0,
    notes       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE dues_period (
    id           INTEGER PRIMARY KEY,
    label        TEXT NOT NULL UNIQUE,
    start_date   TEXT NOT NULL,
    end_date     TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    CHECK (start_date < end_date)
  );

  CREATE TABLE dues_override (
    member_id      INTEGER NOT NULL REFERENCES member(id),
    dues_period_id INTEGER NOT NULL REFERENCES dues_period(id),
    amount_cents   INTEGER NOT NULL CHECK (amount_cents >= 0),
    note           TEXT,
    PRIMARY KEY (member_id, dues_period_id)
  );

  CREATE TABLE dues_payment (
    id             INTEGER PRIMARY KEY,
    txn_id         INTEGER NOT NULL REFERENCES txn(id) ON DELETE CASCADE,
    member_id      INTEGER NOT NULL REFERENCES member(id),
    dues_period_id INTEGER NOT NULL REFERENCES dues_period(id),
    amount_cents   INTEGER NOT NULL CHECK (amount_cents > 0)
  );
  CREATE INDEX idx_dues_payment_member ON dues_payment(member_id, dues_period_id);
  CREATE INDEX idx_dues_payment_txn    ON dues_payment(txn_id);

  INSERT INTO category (name, kind, is_system, sort_order)
  VALUES ('Dues', 'income', 1, 0);
  `,
  // 002 — starter categories so a fresh org can record transactions
  // immediately; plain rows (is_system = 0), renamable/deactivatable.
  `
  INSERT INTO category (name, kind, sort_order) VALUES
    ('Donations',     'income',  1),
    ('Fundraising',   'income',  2),
    ('Interest',      'income',  3),
    ('Other income',  'income',  9),
    ('Supplies',      'expense', 1),
    ('Events',        'expense', 2),
    ('Rent',          'expense', 3),
    ('Insurance',     'expense', 4),
    ('Fees',          'expense', 5),
    ('Postage',       'expense', 6),
    ('Other expense', 'expense', 9);
  `,
  // 003 — arrears notification threshold (in dues periods, usually months)
  `
  ALTER TABLE organization ADD COLUMN arrears_threshold INTEGER NOT NULL DEFAULT 2;
  `
]
