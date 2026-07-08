import type Database from 'better-sqlite3'
import type {
  DuesPeriodInput,
  DuesPeriodRow,
  DuesRoster,
  DuesRosterRow,
  RecordDuesPayment,
  UnallocatedDeposit
} from '../shared/types'
import {
  currentPeriod,
  duesFor,
  membershipOverlaps,
  type MemberDbRow,
  type PeriodRow
} from './members'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function listPeriods(db: Database.Database): DuesPeriodRow[] {
  const current = currentPeriod(db)
  const rows = db
    .prepare(`SELECT * FROM dues_period ORDER BY start_date DESC`)
    .all() as PeriodRow[]
  return rows.map((p) => ({
    id: p.id,
    label: p.label,
    startDate: p.start_date,
    endDate: p.end_date,
    amountCents: p.amount_cents,
    isCurrent: p.id === current?.id
  }))
}

function validatePeriod(input: DuesPeriodInput): void {
  if (!input.label.trim()) throw new Error('The period needs a label.')
  if (!ISO_DATE.test(input.startDate) || !ISO_DATE.test(input.endDate)) {
    throw new Error('Period dates must be valid dates.')
  }
  if (input.startDate >= input.endDate) throw new Error('The period must start before it ends.')
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    throw new Error('Dues amount must be zero or more.')
  }
}

export function createPeriod(db: Database.Database, input: DuesPeriodInput): number {
  validatePeriod(input)
  const result = db
    .prepare(
      `INSERT INTO dues_period (label, start_date, end_date, amount_cents) VALUES (?, ?, ?, ?)`
    )
    .run(input.label.trim(), input.startDate, input.endDate, input.amountCents)
  return Number(result.lastInsertRowid)
}

export function updatePeriod(db: Database.Database, id: number, input: DuesPeriodInput): void {
  validatePeriod(input)
  const result = db
    .prepare(
      `UPDATE dues_period SET label = ?, start_date = ?, end_date = ?, amount_cents = ?
       WHERE id = ?`
    )
    .run(input.label.trim(), input.startDate, input.endDate, input.amountCents, id)
  if (result.changes === 0) throw new Error('That period no longer exists.')
}

/** Prefill for "create next period": the year after the latest one. */
export function suggestNextPeriod(db: Database.Database): DuesPeriodInput | null {
  const latest = db
    .prepare(`SELECT * FROM dues_period ORDER BY start_date DESC LIMIT 1`)
    .get() as PeriodRow | undefined
  if (!latest) return null
  const [y, m, d] = latest.start_date.split('-').map(Number)
  const start = `${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const endExclusive = new Date(y + 2, m - 1, d)
  const endInclusive = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000)
  const end = `${endInclusive.getFullYear()}-${String(endInclusive.getMonth() + 1).padStart(2, '0')}-${String(endInclusive.getDate()).padStart(2, '0')}`
  const label = /^\d{4}$/.test(latest.label)
    ? String(Number(latest.label) + 1)
    : latest.label.replace(/\d{4}(–|-)\d{4}/, `${y + 1}$1${y + 2}`)
  return {
    label: label === latest.label ? `${latest.label} +1` : label,
    startDate: start,
    endDate: end,
    amountCents: latest.amount_cents
  }
}

export function getRoster(db: Database.Database, periodId: number): DuesRoster {
  const period = db
    .prepare(`SELECT * FROM dues_period WHERE id = ?`)
    .get(periodId) as PeriodRow | undefined
  if (!period) throw new Error('That period no longer exists.')

  const members = db
    .prepare(
      `SELECT m.*,
              ov.amount_cents AS override_cents,
              ov.note AS override_note,
              COALESCE(pay.total, 0) AS paid_cents
       FROM member m
       LEFT JOIN dues_override ov
         ON ov.member_id = m.id AND ov.dues_period_id = @periodId
       LEFT JOIN (
         SELECT member_id, SUM(amount_cents) AS total
         FROM dues_payment WHERE dues_period_id = @periodId GROUP BY member_id
       ) pay ON pay.member_id = m.id
       ORDER BY m.last_name COLLATE NOCASE, m.first_name COLLATE NOCASE`
    )
    .all({ periodId }) as (MemberDbRow & {
    override_cents: number | null
    override_note: string | null
    paid_cents: number
  })[]

  const rows: DuesRosterRow[] = []
  for (const m of members) {
    const included =
      membershipOverlaps(m, period) || m.paid_cents > 0 || m.override_cents !== null
    if (!included) continue
    const dues = duesFor(m, period, m.override_cents, m.paid_cents)
    const base =
      m.override_cents !== null ? m.override_cents : m.dues_exempt === 1 ? 0 : period.amount_cents
    rows.push({
      memberId: m.id,
      firstName: m.first_name,
      lastName: m.last_name,
      duesExempt: m.dues_exempt === 1,
      overrideCents: m.override_cents,
      overrideNote: m.override_note,
      baseCents: base,
      paidCents: m.paid_cents,
      outstandingCents: dues.owedCents,
      status: dues.status
    })
  }

  const expected = rows.filter((r) => r.baseCents > 0)
  return {
    rows,
    summary: {
      collectedCents: rows.reduce((s, r) => s + r.paidCents, 0),
      outstandingCents: rows.reduce((s, r) => s + r.outstandingCents, 0),
      paidCount: expected.filter((r) => r.outstandingCents <= 0).length,
      expectedCount: expected.length
    }
  }
}

export function listUnallocated(db: Database.Database): UnallocatedDeposit[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.date, t.amount_cents, t.payee, a.name AS account_name,
              COALESCE((SELECT SUM(dp.amount_cents) FROM dues_payment dp
                        WHERE dp.txn_id = t.id), 0) AS allocated
       FROM txn t
       JOIN account a ON a.id = t.account_id
       JOIN category c ON c.id = t.category_id
       WHERE t.type = 'income' AND c.is_system = 1 AND c.name = 'Dues'
       ORDER BY t.date DESC`
    )
    .all() as {
    id: number
    date: string
    amount_cents: number
    payee: string | null
    account_name: string
    allocated: number
  }[]
  return rows
    .filter((r) => r.allocated < r.amount_cents)
    .map((r) => ({
      txnId: r.id,
      date: r.date,
      amountCents: r.amount_cents,
      allocatedCents: r.allocated,
      payee: r.payee,
      accountName: r.account_name
    }))
}

export function recordPayment(db: Database.Database, p: RecordDuesPayment): void {
  if (p.allocations.length === 0) throw new Error('Add at least one member to the payment.')
  for (const a of p.allocations) {
    if (!Number.isInteger(a.amountCents) || a.amountCents <= 0) {
      throw new Error('Each member amount must be more than zero.')
    }
  }
  const seen = new Set<number>()
  for (const a of p.allocations) {
    if (seen.has(a.memberId)) throw new Error('A member appears twice in this payment.')
    seen.add(a.memberId)
  }
  const period = db.prepare(`SELECT id FROM dues_period WHERE id = ?`).get(p.periodId)
  if (!period) throw new Error('That dues period no longer exists.')
  const total = p.allocations.reduce((s, a) => s + a.amountCents, 0)
  const ts = new Date().toISOString()

  const commit = db.transaction(() => {
    let txnId: number
    if (p.txnId !== null) {
      const txn = db
        .prepare(`SELECT id, amount_cents, type FROM txn WHERE id = ?`)
        .get(p.txnId) as { id: number; amount_cents: number; type: string } | undefined
      if (!txn || txn.type !== 'income') throw new Error('That deposit no longer exists.')
      const allocated = (
        db.prepare(`SELECT COALESCE(SUM(amount_cents),0) AS s FROM dues_payment WHERE txn_id = ?`)
          .get(p.txnId) as { s: number }
      ).s
      if (allocated + total > txn.amount_cents) {
        throw new Error(
          'These allocations add up to more than what is left of that deposit.'
        )
      }
      txnId = txn.id
    } else {
      if (!p.accountId) throw new Error('Choose the account the money went into.')
      if (!p.date || !ISO_DATE.test(p.date)) throw new Error('Invalid date.')
      const duesCategory = db
        .prepare(`SELECT id FROM category WHERE is_system = 1 AND name = 'Dues'`)
        .get() as { id: number } | undefined
      if (!duesCategory) throw new Error('The system Dues category is missing.')
      const names = db
        .prepare(
          `SELECT first_name || ' ' || last_name AS n FROM member
           WHERE id IN (${p.allocations.map(() => '?').join(',')})`
        )
        .all(...p.allocations.map((a) => a.memberId)) as { n: string }[]
      const payee = names.map((x) => x.n.trim()).join(', ')
      const result = db
        .prepare(
          `INSERT INTO txn (account_id, date, amount_cents, type, category_id, payee, memo,
                            cleared, created_at, updated_at)
           VALUES (?, ?, ?, 'income', ?, ?, ?, 0, ?, ?)`
        )
        .run(p.accountId, p.date, total, duesCategory.id, payee, p.memo?.trim() || null, ts, ts)
      txnId = Number(result.lastInsertRowid)
    }

    const insert = db.prepare(
      `INSERT INTO dues_payment (txn_id, member_id, dues_period_id, amount_cents)
       VALUES (?, ?, ?, ?)`
    )
    for (const a of p.allocations) {
      insert.run(txnId, a.memberId, p.periodId, a.amountCents)
    }
  })
  commit()
}

export function setOverride(
  db: Database.Database,
  memberId: number,
  periodId: number,
  amountCents: number | null,
  note: string | null
): void {
  if (amountCents === null) {
    db.prepare(`DELETE FROM dues_override WHERE member_id = ? AND dues_period_id = ?`).run(
      memberId, periodId
    )
    return
  }
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error('The adjusted amount must be zero or more.')
  }
  db.prepare(
    `INSERT INTO dues_override (member_id, dues_period_id, amount_cents, note)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(member_id, dues_period_id)
     DO UPDATE SET amount_cents = excluded.amount_cents, note = excluded.note`
  ).run(memberId, periodId, amountCents, note?.trim() || null)
}
