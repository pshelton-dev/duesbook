/**
 * Builds a fictional organization's books for screenshots and demos, using
 * the same data layer the app runs on. Every name here is made up.
 *
 *   node scripts/seed-demo.mjs path/to/duesbook.db
 *
 * Any file at that path is replaced. The app must not be running on it.
 */
import { rmSync } from 'node:fs'
import { openNodeDb } from '../adapters/node-sqlite'
import { configure, migrate } from '../db'
import * as dues from '../dues'
import * as ledger from '../ledger'
import * as members from '../members'
import { META, setMeta } from '../meta'
import { completeWizard } from '../wizard'

const path = process.argv[2]
if (!path) {
  console.error('usage: node scripts/seed-demo.mjs path/to/duesbook.db')
  process.exit(2)
}
for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(path + suffix, { force: true })

const db = openNodeDb(path)
configure(db)
migrate(db)

const YEAR = 2026
const roster = [
  ['Maria', 'Alvarez', 'maria.alvarez@example.com', '614-555-0101', '2019-03-01'],
  ['Dana', 'Okafor', 'dana.okafor@example.com', '614-555-0102', '2021-01-15'],
  ['Tom', 'Reyes', 'tom.reyes@example.com', null, '2018-06-01'],
  ['Priya', 'Natarajan', 'priya.n@example.com', '614-555-0104', '2023-04-10'],
  ['Walt', 'Brennan', null, '614-555-0105', '2016-02-01'],
  ['June', 'Kowalski', 'june.k@example.com', '614-555-0106', '2020-09-01'],
  ['Sam', 'Delgado', 'sam.delgado@example.com', null, '2022-03-01'],
  ['Ruth', 'Adeyemi', 'ruth.adeyemi@example.com', '614-555-0108', '2017-05-01'],
  ['Eli', 'Sørensen', 'eli.s@example.com', '614-555-0109', '2024-01-20'],
  ['Grace', 'Whitfield', 'grace.w@example.com', null, '2015-11-01'],
  ['Omar', 'Haddad', 'omar.haddad@example.com', '614-555-0111', '2025-02-01'],
  ['Bea', 'Lindqvist', 'bea.l@example.com', '614-555-0112', '2026-03-05']
] as const

completeWizard(db, {
  orgName: 'Riverside Garden Club',
  fiscalYearStartMonth: 1,
  backupDir: null,
  accounts: [
    { name: 'Checking', type: 'checking', openingBalanceCents: 171217, openingDate: `${YEAR}-01-01` },
    { name: 'Cash box', type: 'cash', openingBalanceCents: 8500, openingDate: `${YEAR}-01-01` }
  ],
  dues: { label: `Jan ${YEAR}`, startDate: `${YEAR}-01-01`, endDate: `${YEAR}-01-31`, amountCents: 1000 },
  members: roster.map(([firstName, lastName, email, phone, joinDate]) => ({ firstName, lastName, email, phone, address: null, joinDate }))
})
setMeta(db, META.snapshotsEnabled, '1')
dues.ensurePeriodsCurrent(db)

const accounts = ledger.listAccounts(db)
const checking = accounts.find((a) => a.name === 'Checking')!
const cashbox = accounts.find((a) => a.name === 'Cash box')!
const cats = ledger.listCategories(db)
const cat = (name: string, kind: 'income' | 'expense'): number =>
  (cats.find((c) => c.name === name) ?? cats.find((c) => c.kind === kind && c.name !== 'Dues') ?? cats[0]).id

const periods = dues.listPeriods(db).slice().sort((a, b) => a.startDate.localeCompare(b.startDate))
const people = members.listMembers(db)
const byLast = (last: string) => people.find((m) => m.lastName === last)!

/* Dues: most members are current; a few are behind, one paid part of a month. */
const paidThrough: Record<string, number> = { Brennan: periods.length - 3, Delgado: periods.length - 2, Haddad: periods.length - 1 }
periods.forEach((p, i) => {
  for (const m of people) {
    if (m.joinDate && m.joinDate > p.endDate) continue
    const limit = paidThrough[m.lastName] ?? periods.length
    if (i >= limit) continue
    const day = 3 + ((m.id * 7 + i * 3) % 12)
    const cash = (m.id + i) % 3 === 0
    const partial = m.lastName === 'Natarajan' && i === periods.length - 1
    dues.recordPayment(db, {
      periodId: p.id,
      allocations: [{ memberId: m.id, amountCents: partial ? 500 : 1000 }],
      txnId: null,
      accountId: cash ? cashbox.id : checking.id,
      date: `${p.startDate.slice(0, 8)}${String(day).padStart(2, '0')}`,
      memo: cash ? 'cash' : `check ${1400 + m.id * 3 + i}`
    })
  }
})
dues.setOverride(db, byLast('Whitfield').id, periods[periods.length - 1].id, 0, 'Lifetime member')

/* Ledger: the club's ordinary year. */
const month = (m: number, d: number): string => `${YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const expense = (date: string, amountCents: number, category: string, payee: string, memo: string | null = null, account = checking.id): void => {
  ledger.createTxn(db, { accountId: account, date, amountCents, type: 'expense', categoryId: cat(category, 'expense'), payee, memo, cleared: date < month(9, 1) })
}
const income = (date: string, amountCents: number, category: string, payee: string, memo: string | null = null, account = checking.id): void => {
  ledger.createTxn(db, { accountId: account, date, amountCents, type: 'income', categoryId: cat(category, 'income'), payee, memo, cleared: date < month(9, 1) })
}

for (let m = 1; m <= 9; m++) expense(month(m, 1), 7500, 'Rent', 'Riverside Community Center', 'Meeting room')
expense(month(1, 14), 21400, 'Insurance', 'Meridian Mutual', 'Annual liability policy')
expense(month(2, 6), 4283, 'Supplies', 'Sunrise Seed Co.')
expense(month(3, 12), 3650, 'Postage', 'Copy Corner', 'Spring newsletter, printed and mailed')
expense(month(4, 18), 12975, 'Supplies', 'Hollowbrook Nursery', 'Plant sale stock')
income(month(5, 9), 61250, 'Fundraising', 'Spring plant sale', 'Cash and checks at the gate')
expense(month(5, 9), 2200, 'Events', 'Riverside Bakery', 'Plant sale refreshments', cashbox.id)
expense(month(6, 20), 8900, 'Events', 'Parks Department', 'Summer picnic shelter')
income(month(7, 2), 5000, 'Donations', 'Anonymous', 'Left in the cash box', cashbox.id)
expense(month(8, 25), 5140, 'Supplies', 'Sunrise Seed Co.', 'Fall bulbs')
expense(month(9, 8), 3100, 'Postage', 'Copy Corner', 'Fall newsletter, printed and mailed')
ledger.createTxn(db, { accountId: cashbox.id, date: month(6, 2), amountCents: 12000, type: 'transfer', categoryId: null, payee: null, memo: 'Cash box deposit', cleared: true, transferDirection: 'out', transferAccountId: checking.id })

const summary = ledger.listAccounts(db)
db.close()
console.log(`seeded ${path}: ${people.length} members, ${periods.length} periods, balances ${summary.map((a) => `${a.name} ${(a.balanceCents / 100).toFixed(2)}`).join(', ')}`)
