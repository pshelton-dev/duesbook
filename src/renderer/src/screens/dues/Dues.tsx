import { useCallback, useEffect, useState } from 'react'
import type {
  AccountSummary,
  DuesPeriodInput,
  DuesPeriodRow,
  DuesRoster,
  DuesRosterRow,
  UnallocatedDeposit
} from '../../../../shared/types'
import { formatCents } from '../../lib/money'
import { StatusChip } from '../members/Members'
import AdjustDrawer from './AdjustDrawer'
import PaymentDrawer from './PaymentDrawer'
import PeriodDrawer from './PeriodDrawer'

type DrawerState =
  | { kind: 'closed' }
  | { kind: 'payment'; memberId: number | null; allocate: UnallocatedDeposit | null }
  | { kind: 'adjust'; row: DuesRosterRow }
  | { kind: 'period'; editing: DuesPeriodRow | null; suggestion: DuesPeriodInput | null }

export default function Dues(): React.JSX.Element {
  const [periods, setPeriods] = useState<DuesPeriodRow[]>([])
  const [periodId, setPeriodId] = useState<number | null>(null)
  const [roster, setRoster] = useState<DuesRoster | null>(null)
  const [unallocated, setUnallocated] = useState<UnallocatedDeposit[]>([])
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [drawer, setDrawer] = useState<DrawerState>({ kind: 'closed' })
  const [error, setError] = useState<string | null>(null)

  const loadPeriods = useCallback(async () => {
    const list = await window.duesbook.listDuesPeriods()
    setPeriods(list)
    setPeriodId((cur) => cur ?? list.find((p) => p.isCurrent)?.id ?? list[0]?.id ?? null)
  }, [])

  const loadRoster = useCallback(async () => {
    if (periodId === null) return
    setRoster(await window.duesbook.getDuesRoster(periodId))
  }, [periodId])

  const loadExtras = useCallback(async () => {
    const [un, acc] = await Promise.all([
      window.duesbook.listUnallocatedDuesDeposits(),
      window.duesbook.listAccounts()
    ])
    setUnallocated(un)
    setAccounts(acc)
  }, [])

  useEffect(() => {
    Promise.all([loadPeriods(), loadExtras()]).catch((e) => setError(String(e)))
  }, [loadPeriods, loadExtras])

  useEffect(() => {
    loadRoster().catch((e) => setError(String(e)))
  }, [loadRoster])

  async function refresh(): Promise<void> {
    await Promise.all([loadRoster(), loadExtras()])
  }

  async function openNewPeriod(): Promise<void> {
    const suggestion = await window.duesbook.suggestNextDuesPeriod()
    setDrawer({ kind: 'period', editing: null, suggestion })
  }

  if (error) return <div className="panel error">{error}</div>

  const period = periods.find((p) => p.id === periodId) ?? null

  if (periods.length === 0) {
    return (
      <div>
        <h1>Dues</h1>
        <div className="panel">
          No dues periods yet — create one to start tracking who has paid.
        </div>
        <button
          className="btn primary"
          onClick={() => setDrawer({ kind: 'period', editing: null, suggestion: null })}
        >
          New dues period
        </button>
        {drawer.kind === 'period' && (
          <PeriodDrawer
            editing={drawer.editing}
            suggestion={drawer.suggestion}
            accounts={accounts}
            onClose={() => setDrawer({ kind: 'closed' })}
            onSaved={async () => {
              setDrawer({ kind: 'closed' })
              await loadPeriods()
            }}
          />
        )}
      </div>
    )
  }

  const rows = roster?.rows ?? []
  const visible = unpaidOnly ? rows.filter((r) => r.outstandingCents > 0) : rows
  const summary = roster?.summary

  return (
    <div>
      <div className="detail-header">
        <h1>Dues</h1>
        <div className="btn-row">
          <select
            value={periodId ?? ''}
            onChange={(e) => setPeriodId(Number(e.target.value))}
            className="period-select"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {formatCents(p.amountCents)}
                {p.isCurrent ? ' (current)' : ''}
              </option>
            ))}
          </select>
          {period && (
            <button
              className="btn small"
              onClick={() => setDrawer({ kind: 'period', editing: period, suggestion: null })}
            >
              Edit
            </button>
          )}
          <button className="btn small" onClick={openNewPeriod}>
            New period
          </button>
          <button
            className="btn primary"
            onClick={() => setDrawer({ kind: 'payment', memberId: null, allocate: null })}
          >
            Record payment
          </button>
        </div>
      </div>

      {summary && (
        <div className="summary-bar">
          <div className="summary-item">
            <span className="summary-label">Collected</span>
            <span className="summary-value pos">{formatCents(summary.collectedCents)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Outstanding</span>
            <span className="summary-value">{formatCents(summary.outstandingCents)}</span>
          </div>
          <div className="summary-item hero">
            <span className="summary-label">Paid in full</span>
            <span className="summary-value">
              {summary.paidCount} of {summary.expectedCount}
            </span>
          </div>
        </div>
      )}

      {unallocated.length > 0 && (
        <div className="panel warn">
          <strong>
            {unallocated.length} dues deposit{unallocated.length > 1 ? 's' : ''} not yet allocated
            to members:
          </strong>
          {unallocated.map((u) => (
            <div key={u.txnId} className="unallocated-row">
              {u.date} · {formatCents(u.amountCents)} into {u.accountName}
              {u.payee && <> · {u.payee}</>}
              {u.allocatedCents > 0 && <> ({formatCents(u.allocatedCents)} allocated)</>}
              <button
                className="btn small"
                onClick={() => setDrawer({ kind: 'payment', memberId: null, allocate: u })}
              >
                Allocate
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="filter-bar">
        <label className="check-field compact">
          <input
            type="checkbox"
            checked={unpaidOnly}
            onChange={(e) => setUnpaidOnly(e.target.checked)}
          />
          Hasn&rsquo;t paid in full
        </label>
        <span className="hint">
          {visible.length} of {rows.length} members
        </span>
      </div>

      <table className="register">
        <thead>
          <tr>
            <th>Member</th>
            <th className="num">Owed</th>
            <th className="num">Paid</th>
            <th className="num">Outstanding</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.memberId}>
              <td className="strong">
                {r.lastName}
                {r.lastName && r.firstName ? ', ' : ''}
                {r.firstName}
                {r.overrideNote && <span className="hint"> — {r.overrideNote}</span>}
              </td>
              <td className="num">{formatCents(r.baseCents)}</td>
              <td className="num">{r.paidCents > 0 ? formatCents(r.paidCents) : '—'}</td>
              <td className="num">
                {r.outstandingCents > 0 ? formatCents(r.outstandingCents) : '—'}
              </td>
              <td>
                <StatusChip status={r.status} />
              </td>
              <td className="row-actions">
                {r.outstandingCents > 0 && (
                  <button
                    className="btn small"
                    onClick={() =>
                      setDrawer({ kind: 'payment', memberId: r.memberId, allocate: null })
                    }
                  >
                    Record payment
                  </button>
                )}
                <button
                  className="btn small"
                  onClick={() => setDrawer({ kind: 'adjust', row: r })}
                >
                  Adjust…
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {drawer.kind === 'payment' && periodId !== null && (
        <PaymentDrawer
          periodId={periodId}
          roster={rows}
          accounts={accounts}
          allocateTarget={drawer.allocate}
          initialMemberId={drawer.memberId}
          onClose={() => setDrawer({ kind: 'closed' })}
          onSaved={async () => {
            setDrawer({ kind: 'closed' })
            await refresh()
          }}
        />
      )}
      {drawer.kind === 'adjust' && periodId !== null && (
        <AdjustDrawer
          periodId={periodId}
          row={drawer.row}
          onClose={() => setDrawer({ kind: 'closed' })}
          onSaved={async () => {
            setDrawer({ kind: 'closed' })
            await refresh()
          }}
        />
      )}
      {drawer.kind === 'period' && (
        <PeriodDrawer
          editing={drawer.editing}
          suggestion={drawer.suggestion}
          accounts={accounts}
          onClose={() => setDrawer({ kind: 'closed' })}
          onSaved={async () => {
            setDrawer({ kind: 'closed' })
            await loadPeriods()
            await refresh()
          }}
        />
      )}
    </div>
  )
}
