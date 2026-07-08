import { useCallback, useEffect, useState } from 'react'
import type {
  AccountSummary,
  CategorySummary,
  TxnFilters,
  TxnRow
} from '../../../../shared/types'
import { formatCents } from '../../lib/money'
import TxnDrawer from './TxnDrawer'

const EMPTY_FILTERS: TxnFilters = {}

export default function Ledger(): React.JSX.Element {
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [accountId, setAccountId] = useState<number | null>(null)
  const [txns, setTxns] = useState<TxnRow[]>([])
  const [filters, setFilters] = useState<TxnFilters>(EMPTY_FILTERS)
  const [drawer, setDrawer] = useState<'closed' | 'new' | TxnRow>('closed')
  const [error, setError] = useState<string | null>(null)

  const filtersActive = Object.values(filters).some(
    (v) => v !== undefined && v !== '' && v !== false
  )

  const loadAccounts = useCallback(async () => {
    const list = await window.duesbook.listAccounts()
    setAccounts(list)
    setAccountId((cur) => cur ?? list.find((a) => a.isActive)?.id ?? list[0]?.id ?? null)
  }, [])

  const loadCategories = useCallback(async () => {
    setCategories(await window.duesbook.listCategories())
  }, [])

  const loadTxns = useCallback(async () => {
    if (accountId === null) return
    setTxns(await window.duesbook.listTxns(accountId, filters))
  }, [accountId, filters])

  useEffect(() => {
    Promise.all([loadAccounts(), loadCategories()]).catch((e) => setError(String(e)))
  }, [loadAccounts, loadCategories])

  useEffect(() => {
    loadTxns().catch((e) => setError(String(e)))
  }, [loadTxns])

  async function refreshAll(): Promise<void> {
    await Promise.all([loadAccounts(), loadTxns()])
  }

  async function toggleCleared(row: TxnRow): Promise<void> {
    await window.duesbook.setTxnCleared(row.id, !row.cleared)
    await loadTxns()
  }

  if (error) return <div className="panel error">{error}</div>
  if (accountId === null) return <div className="panel">No accounts yet.</div>

  const account = accounts.find((a) => a.id === accountId)

  return (
    <div className="ledger">
      <div className="ledger-header">
        <div className="account-tabs">
          {accounts
            .filter((a) => a.isActive)
            .map((a) => (
              <button
                key={a.id}
                className={`account-tab ${a.id === accountId ? 'active' : ''}`}
                onClick={() => setAccountId(a.id)}
              >
                <span className="account-tab-name">{a.name}</span>
                <span className="account-tab-balance">{formatCents(a.balanceCents)}</span>
              </button>
            ))}
        </div>
        <button className="btn primary" onClick={() => setDrawer('new')}>
          Add transaction
        </button>
      </div>

      <div className="filter-bar">
        <input
          className="filter-search"
          placeholder="Search payee or memo…"
          value={filters.search ?? ''}
          onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
        />
        <select
          value={filters.categoryId ?? ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              categoryId: e.target.value === '' ? undefined : Number(e.target.value)
            })
          }
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.kind})
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
        />
        <span className="filter-sep">to</span>
        <input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
        />
        <label className="check-field compact">
          <input
            type="checkbox"
            checked={filters.unclearedOnly ?? false}
            onChange={(e) =>
              setFilters({ ...filters, unclearedOnly: e.target.checked || undefined })
            }
          />
          Uncleared only
        </label>
        {filtersActive && (
          <button className="btn small" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </button>
        )}
      </div>

      {txns.length === 0 ? (
        <div className="panel">
          {filtersActive
            ? 'Nothing matches these filters.'
            : `No transactions in ${account?.name ?? 'this account'} yet — add the first one.`}
        </div>
      ) : (
        <table className="register">
          <thead>
            <tr>
              <th>Date</th>
              <th>Payee</th>
              <th>Category</th>
              <th>Memo</th>
              <th className="center" title="Cleared against a bank statement">
                ✓
              </th>
              <th className="num">Amount</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id} onClick={() => setDrawer(t)} className="register-row">
                <td className="nowrap">{t.date}</td>
                <td>
                  {t.type === 'transfer'
                    ? `Transfer ${t.amountCents < 0 ? '→' : '←'} ${t.peerAccountName ?? '?'}`
                    : t.payee}
                  {t.categoryName === 'Dues' && t.type === 'income' && (
                    <span className={`badge ${t.duesAllocatedCents > 0 ? 'ok' : 'warn'}`}>
                      {t.duesAllocatedCents > 0 ? 'dues' : 'dues · unallocated'}
                    </span>
                  )}
                </td>
                <td>{t.type === 'transfer' ? '—' : t.categoryName}</td>
                <td className="memo">{t.memo}</td>
                <td className="center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={t.cleared}
                    onChange={() => toggleCleared(t)}
                    title="Cleared against a bank statement"
                  />
                </td>
                <td className={`num ${t.amountCents > 0 && t.type === 'income' ? 'pos' : ''}`}>
                  {formatCents(t.amountCents)}
                </td>
                <td className="num balance">
                  {filtersActive ? '' : formatCents(t.runningBalanceCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {drawer !== 'closed' && (
        <TxnDrawer
          accountId={accountId}
          accounts={accounts}
          categories={categories}
          editing={drawer === 'new' ? null : drawer}
          onCategoryCreated={loadCategories}
          onClose={() => setDrawer('closed')}
          onSaved={async () => {
            setDrawer('closed')
            await refreshAll()
          }}
        />
      )}
    </div>
  )
}
