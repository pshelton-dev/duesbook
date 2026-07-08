import type Database from 'better-sqlite3'
import type {
  DuesStatus,
  MemberDetail,
  MemberInput,
  MemberPeriodHistory,
  MemberRow,
  WizardMember
} from '../shared/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface PeriodRow {
  id: number
  label: string
  start_date: string
  end_date: string
  amount_cents: number
}

export interface MemberDbRow {
  id: number
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address: string | null
  join_date: string | null
  left_date: string | null
  dues_exempt: number
  notes: string | null
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/** The dues period containing today, else the most recent one. */
export function currentPeriod(db: Database.Database): PeriodRow | null {
  const today = todayIso()
  const containing = db
    .prepare(
      `SELECT * FROM dues_period WHERE start_date <= ? AND end_date >= ?
       ORDER BY start_date DESC LIMIT 1`
    )
    .get(today, today) as PeriodRow | undefined
  if (containing) return containing
  const latest = db
    .prepare(`SELECT * FROM dues_period ORDER BY start_date DESC LIMIT 1`)
    .get() as PeriodRow | undefined
  return latest ?? null
}

export function membershipOverlaps(m: MemberDbRow, p: PeriodRow): boolean {
  if (m.join_date && m.join_date > p.end_date) return false
  if (m.left_date && m.left_date < p.start_date) return false
  return true
}

/** owed = COALESCE(override, exempt ? 0 : period amount) − payments (see DATA-MODEL.md) */
export function duesFor(
  m: MemberDbRow,
  p: PeriodRow | null,
  override: number | null,
  paid: number
): { status: DuesStatus; owedCents: number; paidCents: number } {
  if (!p || !membershipOverlaps(m, p)) return { status: 'na', owedCents: 0, paidCents: paid }
  if (override === null && m.dues_exempt === 1) {
    return { status: 'exempt', owedCents: 0, paidCents: paid }
  }
  const base = override ?? p.amount_cents
  const owed = base - paid
  if (override === 0) return { status: 'waived', owedCents: 0, paidCents: paid }
  if (owed <= 0) return { status: 'paid', owedCents: 0, paidCents: paid }
  if (paid > 0) return { status: 'partial', owedCents: owed, paidCents: paid }
  return { status: 'owed', owedCents: owed, paidCents: paid }
}

export function listMembers(db: Database.Database): MemberRow[] {
  const period = currentPeriod(db)
  const rows = db
    .prepare(
      `SELECT m.*,
              ov.amount_cents AS override_cents,
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
    .all({ periodId: period?.id ?? -1 }) as (MemberDbRow & {
    override_cents: number | null
    paid_cents: number
  })[]

  return rows.map((r) => {
    const dues = duesFor(r, period, r.override_cents, r.paid_cents)
    return {
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      joinDate: r.join_date,
      leftDate: r.left_date,
      duesExempt: r.dues_exempt === 1,
      duesStatus: dues.status,
      owedCents: dues.owedCents,
      paidCents: dues.paidCents
    }
  })
}

function validate(m: MemberInput): void {
  if (!m.firstName.trim() && !m.lastName.trim()) throw new Error('A member needs a name.')
  for (const [label, value] of [
    ['join date', m.joinDate],
    ['left date', m.leftDate]
  ] as const) {
    if (value !== null && !ISO_DATE.test(value)) throw new Error(`Invalid ${label}.`)
  }
  if (m.joinDate && m.leftDate && m.leftDate < m.joinDate) {
    throw new Error('The left date cannot be before the join date.')
  }
}

const clean = (s: string | null): string | null => (s?.trim() ? s.trim() : null)

export function createMember(db: Database.Database, m: MemberInput): void {
  validate(m)
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO member (first_name, last_name, email, phone, address, join_date, left_date,
                         dues_exempt, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    m.firstName.trim(), m.lastName.trim(), clean(m.email), clean(m.phone), clean(m.address),
    m.joinDate, m.leftDate, m.duesExempt ? 1 : 0, clean(m.notes), now, now
  )
}

export function updateMember(db: Database.Database, id: number, m: MemberInput): void {
  validate(m)
  const result = db
    .prepare(
      `UPDATE member SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ?,
                         join_date = ?, left_date = ?, dues_exempt = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      m.firstName.trim(), m.lastName.trim(), clean(m.email), clean(m.phone), clean(m.address),
      m.joinDate, m.leftDate, m.duesExempt ? 1 : 0, clean(m.notes),
      new Date().toISOString(), id
    )
  if (result.changes === 0) throw new Error('That member no longer exists.')
}

export function deleteMember(db: Database.Database, id: number): void {
  const hasHistory = db
    .prepare(
      `SELECT 1 FROM dues_payment WHERE member_id = ?
       UNION SELECT 1 FROM dues_override WHERE member_id = ? LIMIT 1`
    )
    .get(id, id)
  if (hasHistory) {
    throw new Error(
      'This member has dues history, which the books need to keep. ' +
      'Mark them as having left instead of deleting.'
    )
  }
  db.prepare(`DELETE FROM member WHERE id = ?`).run(id)
}

export function importMembers(db: Database.Database, members: WizardMember[]): number {
  const now = new Date().toISOString()
  const insert = db.prepare(
    `INSERT INTO member (first_name, last_name, email, phone, address, join_date,
                         created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  let count = 0
  const commit = db.transaction(() => {
    for (const m of members) {
      const first = m.firstName.trim()
      const last = m.lastName.trim()
      if (!first && !last) continue
      insert.run(
        first, last, clean(m.email), clean(m.phone), clean(m.address),
        m.joinDate && ISO_DATE.test(m.joinDate) ? m.joinDate : null, now, now
      )
      count++
    }
  })
  commit()
  return count
}

export function getMemberDetail(db: Database.Database, id: number): MemberDetail {
  const m = db.prepare(`SELECT * FROM member WHERE id = ?`).get(id) as MemberDbRow | undefined
  if (!m) throw new Error('That member no longer exists.')

  const periods = db
    .prepare(`SELECT * FROM dues_period ORDER BY start_date DESC`)
    .all() as PeriodRow[]

  const history: MemberPeriodHistory[] = []
  for (const p of periods) {
    const override = db
      .prepare(
        `SELECT amount_cents FROM dues_override WHERE member_id = ? AND dues_period_id = ?`
      )
      .get(id, p.id) as { amount_cents: number } | undefined
    const payments = db
      .prepare(
        `SELECT t.date, dp.amount_cents, dp.txn_id, a.name AS account_name
         FROM dues_payment dp
         JOIN txn t ON t.id = dp.txn_id
         JOIN account a ON a.id = t.account_id
         WHERE dp.member_id = ? AND dp.dues_period_id = ?
         ORDER BY t.date`
      )
      .all(id, p.id) as { date: string; amount_cents: number; txn_id: number; account_name: string }[]
    const paid = payments.reduce((s, x) => s + x.amount_cents, 0)
    const dues = duesFor(m, p, override?.amount_cents ?? null, paid)
    if (dues.status === 'na' && payments.length === 0 && !override) continue
    history.push({
      periodLabel: p.label,
      owedCents: dues.owedCents,
      paidCents: paid,
      status: dues.status,
      payments: payments.map((x) => ({
        date: x.date,
        amountCents: x.amount_cents,
        txnId: x.txn_id,
        accountName: x.account_name
      }))
    })
  }

  return {
    id: m.id,
    firstName: m.first_name,
    lastName: m.last_name,
    email: m.email,
    phone: m.phone,
    address: m.address,
    joinDate: m.join_date,
    leftDate: m.left_date,
    duesExempt: m.dues_exempt === 1,
    notes: m.notes,
    history
  }
}
