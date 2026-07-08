import type Database from 'better-sqlite3'
import type { HomeSummary } from '../shared/types'
import * as dues from './dues'
import * as ledger from './ledger'
import { currentPeriod } from './members'

export function homeSummary(db: Database.Database): HomeSummary {
  const accounts = ledger.listAccounts(db).filter((a) => a.isActive)

  const period = currentPeriod(db)
  const roster = period ? dues.getRoster(db, period.id) : null

  const recent = (
    db
      .prepare(
        `SELECT t.id, t.date, a.name AS account_name, t.payee, t.type,
                c.name AS category_name, t.amount_cents
         FROM txn t
         JOIN account a ON a.id = t.account_id
         LEFT JOIN category c ON c.id = t.category_id
         ORDER BY t.date DESC, t.id DESC
         LIMIT 10`
      )
      .all() as {
      id: number
      date: string
      account_name: string
      payee: string | null
      type: string
      category_name: string | null
      amount_cents: number
    }[]
  ).map((r) => ({
    id: r.id,
    date: r.date,
    accountName: r.account_name,
    description: r.type === 'transfer' ? 'Transfer' : (r.payee ?? ''),
    categoryName: r.type === 'transfer' ? null : r.category_name,
    amountCents: r.amount_cents
  }))

  return {
    accounts,
    duesPeriodLabel: period?.label ?? null,
    dues: roster ? roster.summary : null,
    recent,
    unallocatedCount: dues.listUnallocated(db).length
  }
}
