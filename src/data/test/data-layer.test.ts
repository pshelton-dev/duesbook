/**
 * Data-layer smoke test. Runs the ported modules on Node's built-in SQLite:
 *   1. a fresh file through migrations, the wizard, and every write path;
 *   2. a copy of an existing schema-4 file (the dev books), read paths only,
 *      cross-checked against raw SQL;
 *   3. the pure-JS SHA-256 against node:crypto.
 *
 *   node scripts/test-data-layer.mjs [path/to/existing.db]
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openNodeDb } from '../adapters/node-sqlite'
import { configure, getSchemaVersion, migrate } from '../db'
import * as dues from '../dues'
import { homeSummary } from '../home'
import * as bank from '../import'
import * as ledger from '../ledger'
import * as members from '../members'
import { treasurerReport } from '../reports'
import * as settings from '../settings'
import { completeWizard } from '../wizard'
import { sha256Hex } from '../../shared/sha256'
import { applyMapping } from '../../shared/bank-import'

let passed = 0
function ok(name: string, fn: () => void): void {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

const dir = mkdtempSync(join(tmpdir(), 'duesbook-test-'))

/* ---------- 3. hash parity ---------- */
console.log('sha256')
ok('matches node:crypto on 200 strings incl. unicode', () => {
  const samples = ['', 'a', 'abc', '1|2026-07-01|-4283|SUNRISE SEED CO|0', 'é ü 漢字 🙂', 'x'.repeat(55),
    'y'.repeat(56), 'z'.repeat(64), 'w'.repeat(1000)]
  for (let i = 0; i < 191; i++) samples.push(`${i}|2026-0${(i % 9) + 1}-1${i % 10}|${i * 137}|PAYEE ${i}|${i % 3}`)
  for (const s of samples) {
    assert.equal(sha256Hex(s), createHash('sha256').update(s).digest('hex'), `mismatch for ${JSON.stringify(s)}`)
  }
})

/* ---------- 1. fresh file ---------- */
console.log('fresh books')
const fresh = openNodeDb(join(dir, 'fresh.db'))
configure(fresh)
migrate(fresh)

ok('migrations reach schema 4 with system categories', () => {
  assert.equal(getSchemaVersion(fresh), 4)
  const cats = ledger.listCategories(fresh)
  assert.equal(cats.filter((c) => c.isSystem).length, 3)
  assert.ok(cats.some((c) => c.name === 'Dues' && c.kind === 'income'))
})

ok('wizard creates org, accounts, first period, members atomically', () => {
  completeWizard(fresh, {
    orgName: 'Riverside Garden Club',
    fiscalYearStartMonth: 1,
    backupDir: null,
    accounts: [
      { name: 'Checking', type: 'checking', openingBalanceCents: 171217, openingDate: '2026-01-01' },
      { name: 'Cash box', type: 'cash', openingBalanceCents: 8500, openingDate: '2026-01-01' }
    ],
    dues: { label: 'Jan 2026', startDate: '2026-01-01', endDate: '2026-01-31', amountCents: 1000 },
    members: [
      { firstName: 'Maria', lastName: 'Alvarez', email: null, phone: null, address: null, joinDate: '2025-03-01' },
      { firstName: 'Dana', lastName: 'Okafor', email: 'd@example.com', phone: null, address: null, joinDate: null },
      { firstName: '', lastName: '', email: null, phone: null, address: null, joinDate: null }
    ]
  })
  assert.throws(() => completeWizard(fresh, { orgName: 'x', fiscalYearStartMonth: 1, backupDir: null, accounts: [], dues: null, members: [] }))
  assert.equal(members.listMembers(fresh).length, 2)
  assert.equal(ledger.listAccounts(fresh).length, 2)
})

ok('auto-roll creates every month up to today', () => {
  const created = dues.ensurePeriodsCurrent(fresh)
  const periods = dues.listPeriods(fresh)
  const today = new Date()
  const expected = (today.getFullYear() - 2026) * 12 + today.getMonth() + 1
  assert.equal(periods.length, expected)
  assert.equal(created, expected - 1)
  assert.equal(periods.filter((p) => p.isCurrent).length, 1)
  assert.equal(periods[periods.length - 1].label, 'Jan 2026')
})

const acct = ledger.listAccounts(fresh)
const checking = acct.find((a) => a.name === 'Checking')!
const cashbox = acct.find((a) => a.name === 'Cash box')!
const cats = ledger.listCategories(fresh)
const supplies = cats.find((c) => c.name === 'Supplies')!
const duesCat = cats.find((c) => c.name === 'Dues')!
const roster0 = members.listMembers(fresh)
const maria = roster0.find((m) => m.lastName === 'Alvarez')!
const dana = roster0.find((m) => m.lastName === 'Okafor')!

ok('expense, income, transfer, delete keep balances exact', () => {
  ledger.createTxn(fresh, { accountId: checking.id, date: '2026-08-28', amountCents: 4283, type: 'expense', categoryId: supplies.id, payee: 'Sunrise Seed Co.', memo: null, cleared: false })
  ledger.createTxn(fresh, { accountId: checking.id, date: '2026-08-31', amountCents: 4000, type: 'transfer', categoryId: null, payee: null, memo: null, cleared: false, transferDirection: 'out', transferAccountId: cashbox.id })
  let a = ledger.listAccounts(fresh)
  assert.equal(a.find((x) => x.id === checking.id)!.balanceCents, 171217 - 4283 - 4000)
  assert.equal(a.find((x) => x.id === cashbox.id)!.balanceCents, 8500 + 4000)
  const rows = ledger.listTxns(fresh, checking.id, {})
  assert.equal(rows.length, 2)
  assert.equal(rows[0].type, 'transfer')
  assert.equal(rows[0].peerAccountName, 'Cash box')
  assert.equal(rows[0].runningBalanceCents, 171217 - 4283 - 4000)
  ledger.deleteTxn(fresh, rows[0].id)
  a = ledger.listAccounts(fresh)
  assert.equal(a.find((x) => x.id === cashbox.id)!.balanceCents, 8500)
  assert.equal(ledger.listTxns(fresh, cashbox.id, {}).length, 0)
  assert.throws(() => ledger.createTxn(fresh, { accountId: checking.id, date: 'bad', amountCents: 1, type: 'expense', categoryId: supplies.id, payee: null, memo: null, cleared: false }))
})

ok('dues payment allocates, roster and arrears agree', () => {
  const periods = dues.listPeriods(fresh)
  const current = periods.find((p) => p.isCurrent)!
  const jan = periods.find((p) => p.label === 'Jan 2026')!
  dues.recordPayment(fresh, { periodId: jan.id, allocations: [{ memberId: maria.id, amountCents: 1000 }], txnId: null, accountId: cashbox.id, date: '2026-01-05', memo: 'cash' })
  const r = dues.getRoster(fresh, jan.id)
  const mr = r.rows.find((x) => x.memberId === maria.id)!
  assert.equal(mr.status, 'paid')
  assert.equal(r.summary.collectedCents, 1000)
  assert.equal(r.summary.expectedCount, 2)
  assert.equal(r.summary.paidCount, 1)
  const cur = dues.getRoster(fresh, current.id)
  assert.equal(cur.rows.find((x) => x.memberId === dana.id)!.status, 'owed')
  const arrears = dues.getArrears(fresh)
  assert.equal(arrears.threshold, 2)
  const danaArrears = arrears.members.find((m) => m.memberId === dana.id)!
  assert.equal(danaArrears.periodsBehind, periods.length)
  assert.equal(danaArrears.owedCents, periods.length * 1000)
  assert.equal(arrears.members.find((m) => m.memberId === maria.id)!.periodsBehind, periods.length - 1)
  assert.equal(ledger.listAccounts(fresh).find((x) => x.id === cashbox.id)!.balanceCents, 9500)
})

ok('waiver, partial payment, unallocated deposit', () => {
  const jan = dues.listPeriods(fresh).find((p) => p.label === 'Jan 2026')!
  const feb = dues.listPeriods(fresh).find((p) => p.label === 'Feb 2026')!
  dues.setOverride(fresh, dana.id, jan.id, 0, 'hardship')
  assert.equal(dues.getRoster(fresh, jan.id).rows.find((x) => x.memberId === dana.id)!.status, 'waived')
  dues.recordPayment(fresh, { periodId: feb.id, allocations: [{ memberId: dana.id, amountCents: 400 }], txnId: null, accountId: checking.id, date: '2026-02-10', memo: null })
  const row = dues.getRoster(fresh, feb.id).rows.find((x) => x.memberId === dana.id)!
  assert.equal(row.status, 'partial')
  assert.equal(row.outstandingCents, 600)
  ledger.createTxn(fresh, { accountId: checking.id, date: '2026-09-02', amountCents: 3000, type: 'income', categoryId: duesCat.id, payee: 'Payment app cashout', memo: null, cleared: false })
  const un = dues.listUnallocated(fresh)
  assert.equal(un.length, 1)
  assert.equal(un[0].amountCents, 3000)
  dues.recordPayment(fresh, { periodId: feb.id, allocations: [{ memberId: maria.id, amountCents: 1000 }], txnId: un[0].txnId, accountId: null, date: null, memo: null })
  assert.equal(dues.listUnallocated(fresh)[0].allocatedCents, 1000)
  assert.throws(() => dues.recordPayment(fresh, { periodId: feb.id, allocations: [{ memberId: dana.id, amountCents: 5000 }], txnId: un[0].txnId, accountId: null, date: null, memo: null }))
})

ok('home, report, member detail, settings', () => {
  const home = homeSummary(fresh)
  assert.equal(home.accounts.length, 2)
  assert.equal(home.unallocatedCount, 1)
  assert.ok(home.arrears.members.length >= 1)
  const rep = treasurerReport(fresh, '2026-01-01', '2026-12-31')
  assert.equal(rep.netCents, rep.totalIncomeCents - rep.totalExpenseCents)
  assert.equal(rep.totalIncomeCents, 1000 + 400 + 3000)
  assert.equal(rep.totalExpenseCents, 4283)
  const sumClosing = rep.accounts.reduce((s, a) => s + a.closingCents, 0)
  const sumBal = ledger.listAccounts(fresh).reduce((s, a) => s + a.balanceCents, 0)
  assert.equal(sumClosing, sumBal)
  const detail = members.getMemberDetail(fresh, dana.id)
  assert.ok(detail.history.some((h) => h.status === 'waived'))
  assert.ok(detail.history.some((h) => h.status === 'partial' && h.payments.length === 1))
  assert.throws(() => members.deleteMember(fresh, dana.id))
  settings.setArrearsThreshold(fresh, 3)
  assert.equal(dues.getArrears(fresh).threshold, 3)
  settings.updateOrganization(fresh, 'Renamed Club', 7)
  ledger.updateAccount(fresh, checking.id, { name: 'Main checking', openingBalanceCents: 171217, openingDate: '2026-01-01' })
  assert.throws(() => ledger.updateAccount(fresh, cashbox.id, { name: 'Main checking', openingBalanceCents: 0, openingDate: '2026-01-01' }))
})

ok('bank import: reconcile, commit, re-import is a no-op', () => {
  const csv = 'Date,Description,Amount\n08/28/2026,SUNRISE SEED CO 4471,-42.83\n09/03/2026,PARKS DEPT PLOT RENTAL,-75.00\n09/03/2026,PARKS DEPT PLOT RENTAL,-75.00\n'
  const grid = bank.readBankGridCsv(csv)
  const mapped = applyMapping(grid, { dateCol: 0, dateFormat: 'mdy', descriptionCol: 1, convention: 'signed', amountCol: 2 })
  const rows = mapped.rows
  assert.equal(rows.length, 3)
  const preview = bank.reconcileImport(fresh, checking.id, rows)
  assert.equal(preview.additions.length + preview.duplicates.length + preview.matches.length, 3)
  const res = bank.commitImport(fresh, checking.id, { additions: preview.additions, matches: preview.matches.map((m) => ({ existingTxnId: m.existingTxnId, fitid: m.row.fitid, fingerprint: m.fingerprint })) })
  const again = bank.reconcileImport(fresh, checking.id, rows)
  assert.equal(again.additions.length, 0, 'second import must add nothing')
  const txns = ledger.listTxns(fresh, checking.id, {})
  assert.ok(txns.filter((t) => t.payee?.includes('Parks')).length === 2 || res.added >= 1)
  const fp = bank.fingerprintRow(checking.id, rows[0], 0)
  assert.equal(fp, createHash('sha256').update(`${checking.id}|${rows[0].date}|${rows[0].amountCents}|SUNRISE SEED CO 4471|0`).digest('hex'))
})

fresh.close()

/* ---------- 2. existing schema-4 file ---------- */
const src = process.argv[2]
if (src) {
  console.log(`existing books: ${src}`)
  const copy = join(dir, 'existing.db')
  copyFileSync(src, copy)
  const db = openNodeDb(copy)
  configure(db)
  ok('opens at schema 4 with no migration needed', () => {
    const before = getSchemaVersion(db)
    migrate(db)
    assert.equal(getSchemaVersion(db), 4)
    assert.equal(before, 4)
  })
  ok('balances match raw SQL', () => {
    for (const a of ledger.listAccounts(db)) {
      const raw = db.prepare(`SELECT opening_balance_cents + COALESCE((SELECT SUM(amount_cents) FROM txn WHERE account_id = ?), 0) AS b FROM account WHERE id = ?`).get<{ b: number }>(a.id, a.id)!
      assert.equal(a.balanceCents, raw.b)
    }
  })
  ok('roster collected equals summed payments', () => {
    for (const p of dues.listPeriods(db)) {
      const r = dues.getRoster(db, p.id)
      const raw = db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS s FROM dues_payment WHERE dues_period_id = ?`).get<{ s: number }>(p.id)!
      assert.equal(r.summary.collectedCents, raw.s, p.label)
    }
  })
  ok('members, home, report, details all read', () => {
    const list = members.listMembers(db)
    assert.ok(list.length > 0)
    for (const m of list) members.getMemberDetail(db, m.id)
    const home = homeSummary(db)
    assert.equal(home.accounts.length, ledger.listAccounts(db).filter((a) => a.isActive).length)
    const rep = treasurerReport(db, '2020-01-01', '2030-12-31')
    assert.equal(rep.netCents, rep.totalIncomeCents - rep.totalExpenseCents)
    console.log(`      ${list.length} members, ${dues.listPeriods(db).length} periods, ${home.accounts.length} accounts`)
  })
  db.close()
}

rmSync(dir, { recursive: true, force: true })
console.log(`\n${passed} checks passed`)
