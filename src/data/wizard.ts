import type { Db } from './db'
import type { WizardPayload } from '../shared/types'

const ACCOUNT_TYPES = new Set(['checking', 'savings', 'cash', 'other'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Commits the entire first-run wizard in one transaction: either the org,
 * its accounts, the optional dues period, and all imported members exist
 * afterward, or nothing does.
 */
export function completeWizard(db: Db, p: WizardPayload): void {
  const existing = db.prepare(`SELECT 1 FROM organization WHERE id = 1`).get()
  if (existing) throw new Error('Setup has already been completed.')

  const orgName = p.orgName.trim()
  if (!orgName) throw new Error('Organization name is required.')
  if (
    !Number.isInteger(p.fiscalYearStartMonth) ||
    p.fiscalYearStartMonth < 1 ||
    p.fiscalYearStartMonth > 12
  ) {
    throw new Error('Fiscal year start month must be between 1 and 12.')
  }
  if (p.accounts.length === 0) throw new Error('At least one account is required.')
  for (const a of p.accounts) {
    if (!a.name.trim()) throw new Error('Every account needs a name.')
    if (!ACCOUNT_TYPES.has(a.type)) throw new Error(`Unknown account type: ${a.type}`)
    if (!Number.isInteger(a.openingBalanceCents)) {
      throw new Error(`Invalid opening balance for account "${a.name}".`)
    }
    if (!ISO_DATE.test(a.openingDate)) {
      throw new Error(`Invalid opening date for account "${a.name}".`)
    }
  }
  if (p.dues) {
    if (!p.dues.label.trim()) throw new Error('The dues period needs a label.')
    if (!ISO_DATE.test(p.dues.startDate) || !ISO_DATE.test(p.dues.endDate)) {
      throw new Error('Dues period dates must be valid dates.')
    }
    if (p.dues.startDate >= p.dues.endDate) {
      throw new Error('The dues period must start before it ends.')
    }
    if (!Number.isInteger(p.dues.amountCents) || p.dues.amountCents < 0) {
      throw new Error('Dues amount must be zero or more.')
    }
  }

  const now = new Date().toISOString()
  db.transaction(() => {
    db.prepare(
      `INSERT INTO organization (id, name, fiscal_year_start_month, backup_dir, created_at)
       VALUES (1, ?, ?, ?, ?)`
    ).run(orgName, p.fiscalYearStartMonth, p.backupDir, now)

    const insertAccount = db.prepare(
      `INSERT INTO account (name, type, opening_balance_cents, opening_date, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    )
    p.accounts.forEach((a, i) => {
      insertAccount.run(a.name.trim(), a.type, a.openingBalanceCents, a.openingDate, i)
    })

    if (p.dues) {
      db.prepare(
        `INSERT INTO dues_period (label, start_date, end_date, amount_cents)
         VALUES (?, ?, ?, ?)`
      ).run(p.dues.label.trim(), p.dues.startDate, p.dues.endDate, p.dues.amountCents)
    }

    const insertMember = db.prepare(
      `INSERT INTO member (first_name, last_name, email, phone, address, join_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const m of p.members) {
      const first = m.firstName.trim()
      const last = m.lastName.trim()
      if (!first && !last) continue
      insertMember.run(
        first,
        last,
        m.email?.trim() || null,
        m.phone?.trim() || null,
        m.address?.trim() || null,
        m.joinDate && ISO_DATE.test(m.joinDate) ? m.joinDate : null,
        now,
        now
      )
    }
  })
}
