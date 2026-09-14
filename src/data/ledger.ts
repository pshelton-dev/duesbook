import type { Db, NamedParams } from './db'
import type {
  AccountSummary,
  AccountUpdate,
  CategoryKind,
  CategorySummary,
  NewTxn,
  TxnFilters,
  TxnRow,
  TxnUpdate
} from '../shared/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function now(): string {
  return new Date().toISOString()
}

export function listAccounts(db: Db): AccountSummary[] {
  const rows = db
    .prepare(
      `SELECT a.id, a.name, a.type, a.is_active, a.opening_balance_cents, a.opening_date,
              a.opening_balance_cents + COALESCE(SUM(t.amount_cents), 0) AS balance
       FROM account a
       LEFT JOIN txn t ON t.account_id = a.id
       GROUP BY a.id
       ORDER BY a.sort_order, a.id`
    )
    .all() as {
    id: number
    name: string
    type: string
    is_active: number
    opening_balance_cents: number
    opening_date: string
    balance: number
  }[]
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as AccountSummary['type'],
    isActive: r.is_active === 1,
    balanceCents: r.balance,
    openingBalanceCents: r.opening_balance_cents,
    openingDate: r.opening_date
  }))
}

/** Settings-only edit: rename or restrike the opening balance/date. */
export function updateAccount(db: Db, id: number, input: AccountUpdate): void {
  const name = input.name.trim()
  if (!name) throw new Error('The account needs a name.')
  if (!ISO_DATE.test(input.openingDate)) {
    throw new Error('Set the date the opening balance is from.')
  }
  try {
    const res = db
      .prepare(
        `UPDATE account SET name = ?, opening_balance_cents = ?, opening_date = ? WHERE id = ?`
      )
      .run(name, input.openingBalanceCents, input.openingDate, id)
    if (res.changes === 0) throw new Error('Account not found.')
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      throw new Error('Another account already has that name.')
    }
    throw e
  }
}

export function listCategories(db: Db): CategorySummary[] {
  const rows = db
    .prepare(
      `SELECT id, name, kind, is_system, is_active
       FROM category ORDER BY kind, sort_order, name`
    )
    .all() as { id: number; name: string; kind: string; is_system: number; is_active: number }[]
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as CategoryKind,
    isSystem: r.is_system === 1,
    isActive: r.is_active === 1
  }))
}

export function createCategory(
  db: Db,
  name: string,
  kind: CategoryKind
): CategorySummary {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Category name is required.')
  if (kind !== 'income' && kind !== 'expense') throw new Error('Invalid category kind.')
  const result = db
    .prepare(`INSERT INTO category (name, kind, sort_order) VALUES (?, ?, 8)`)
    .run(trimmed, kind)
  return {
    id: Number(result.lastInsertRowid),
    name: trimmed,
    kind,
    isSystem: false,
    isActive: true
  }
}

export function listTxns(
  db: Db,
  accountId: number,
  filters: TxnFilters
): TxnRow[] {
  const where: string[] = ['t.account_id = @accountId']
  const params: NamedParams = { accountId }
  if (filters.search?.trim()) {
    where.push(`(t.payee LIKE @search OR t.memo LIKE @search)`)
    params.search = `%${filters.search.trim()}%`
  }
  if (filters.categoryId !== undefined) {
    where.push(`t.category_id = @categoryId`)
    params.categoryId = filters.categoryId
  }
  if (filters.dateFrom) {
    where.push(`t.date >= @dateFrom`)
    params.dateFrom = filters.dateFrom
  }
  if (filters.dateTo) {
    where.push(`t.date <= @dateTo`)
    params.dateTo = filters.dateTo
  }
  if (filters.unclearedOnly) {
    where.push(`t.cleared = 0`)
  }

  // The running balance window always spans the whole account regardless of
  // filters, so the balance column stays truthful when the list is filtered.
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT t.id, t.date, t.amount_cents, t.type, t.category_id,
                c.name AS category_name,
                t.payee, t.memo, t.cleared, t.transfer_peer_id,
                pa.name AS peer_account_name,
                acc.opening_balance_cents
                  + SUM(t.amount_cents) OVER (ORDER BY t.date, t.id) AS running,
                COALESCE((SELECT SUM(dp.amount_cents) FROM dues_payment dp
                          WHERE dp.txn_id = t.id), 0) AS dues_allocated,
                (${where.join(' AND ')}) AS included
         FROM txn t
         JOIN account acc ON acc.id = t.account_id
         LEFT JOIN category c ON c.id = t.category_id
         LEFT JOIN txn peer ON peer.id = t.transfer_peer_id
         LEFT JOIN account pa ON pa.id = peer.account_id
         WHERE t.account_id = @accountId
       )
       WHERE included
       ORDER BY date DESC, id DESC`
    )
    .all(params) as {
    id: number
    date: string
    amount_cents: number
    type: string
    category_id: number | null
    category_name: string | null
    payee: string | null
    memo: string | null
    cleared: number
    transfer_peer_id: number | null
    peer_account_name: string | null
    running: number
    dues_allocated: number
  }[]

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amountCents: r.amount_cents,
    type: r.type as TxnRow['type'],
    categoryId: r.category_id,
    categoryName: r.category_name,
    payee: r.payee,
    memo: r.memo,
    cleared: r.cleared === 1,
    transferPeerId: r.transfer_peer_id,
    peerAccountName: r.peer_account_name,
    runningBalanceCents: r.running,
    duesAllocatedCents: r.dues_allocated
  }))
}

function validateCommon(date: string, amountCents: number): void {
  if (!ISO_DATE.test(date)) throw new Error('Invalid date.')
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('Amount must be more than zero.')
  }
}

export function createTxn(db: Db, p: NewTxn): number {
  validateCommon(p.date, p.amountCents)
  const ts = now()
  const insert = db.prepare(
    `INSERT INTO txn (account_id, date, amount_cents, type, category_id, payee, memo,
                      cleared, transfer_peer_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  if (p.type === 'transfer') {
    if (!p.transferAccountId) throw new Error('Choose the other account for the transfer.')
    if (p.transferAccountId === p.accountId) {
      throw new Error('A transfer needs two different accounts.')
    }
    const direction = p.transferDirection === 'in' ? 1 : -1
    return db.transaction(() => {
      const here = insert.run(
        p.accountId, p.date, direction * p.amountCents, 'transfer',
        null, p.payee?.trim() || null, p.memo?.trim() || null,
        p.cleared ? 1 : 0, null, ts, ts
      )
      const there = insert.run(
        p.transferAccountId!, p.date, -direction * p.amountCents, 'transfer',
        null, p.payee?.trim() || null, p.memo?.trim() || null,
        0, Number(here.lastInsertRowid), ts, ts
      )
      db.prepare(`UPDATE txn SET transfer_peer_id = ? WHERE id = ?`).run(
        Number(there.lastInsertRowid), Number(here.lastInsertRowid)
      )
      return Number(here.lastInsertRowid)
    })
  }

  if (!p.categoryId) throw new Error('Pick a category.')
  const sign = p.type === 'income' ? 1 : -1
  const r = insert.run(
    p.accountId, p.date, sign * p.amountCents, p.type,
    p.categoryId, p.payee?.trim() || null, p.memo?.trim() || null,
    p.cleared ? 1 : 0, null, ts, ts
  )
  return Number(r.lastInsertRowid)
}

interface TxnDbRow {
  id: number
  account_id: number
  amount_cents: number
  type: string
  transfer_peer_id: number | null
}

function getTxn(db: Db, id: number): TxnDbRow {
  const row = db
    .prepare(`SELECT id, account_id, amount_cents, type, transfer_peer_id FROM txn WHERE id = ?`)
    .get(id) as TxnDbRow | undefined
  if (!row) throw new Error('That transaction no longer exists.')
  return row
}

export function updateTxn(db: Db, p: TxnUpdate): void {
  validateCommon(p.date, p.amountCents)
  const existing = getTxn(db, p.id)
  const ts = now()

  if (existing.type === 'transfer') {
    const sign = existing.amount_cents < 0 ? -1 : 1
    db.transaction(() => {
      db.prepare(
        `UPDATE txn SET date = ?, amount_cents = ?, payee = ?, memo = ?, cleared = ?, updated_at = ?
         WHERE id = ?`
      ).run(p.date, sign * p.amountCents, p.payee?.trim() || null, p.memo?.trim() || null,
            p.cleared ? 1 : 0, ts, p.id)
      if (existing.transfer_peer_id) {
        db.prepare(
          `UPDATE txn SET date = ?, amount_cents = ?, payee = ?, memo = ?, updated_at = ?
           WHERE id = ?`
        ).run(p.date, -sign * p.amountCents, p.payee?.trim() || null, p.memo?.trim() || null,
              ts, existing.transfer_peer_id)
      }
    })
    return
  }

  if (!p.categoryId) throw new Error('Pick a category.')
  const sign = existing.type === 'income' ? 1 : -1
  if (existing.type === 'income') {
    const allocated = (
      db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS s FROM dues_payment WHERE txn_id = ?`)
        .get(p.id) as { s: number }
    ).s
    if (allocated > p.amountCents) {
      throw new Error(
        'This deposit has more dues allocated to members than the new amount. ' +
        'Adjust the member allocations on the Dues screen first.'
      )
    }
  }
  db.prepare(
    `UPDATE txn SET date = ?, amount_cents = ?, category_id = ?, payee = ?, memo = ?,
                    cleared = ?, updated_at = ?
     WHERE id = ?`
  ).run(p.date, sign * p.amountCents, p.categoryId, p.payee?.trim() || null,
        p.memo?.trim() || null, p.cleared ? 1 : 0, ts, p.id)
}

export function deleteTxn(db: Db, id: number): void {
  const existing = getTxn(db, id)
  db.transaction(() => {
    if (existing.transfer_peer_id) {
      db.prepare(`UPDATE txn SET transfer_peer_id = NULL WHERE id IN (?, ?)`).run(
        id, existing.transfer_peer_id
      )
      db.prepare(`DELETE FROM txn WHERE id IN (?, ?)`).run(id, existing.transfer_peer_id)
    } else {
      db.prepare(`DELETE FROM txn WHERE id = ?`).run(id)
    }
  })
}

export function setTxnCleared(db: Db, id: number, cleared: boolean): void {
  db.prepare(`UPDATE txn SET cleared = ?, updated_at = ? WHERE id = ?`).run(
    cleared ? 1 : 0, now(), id
  )
}
