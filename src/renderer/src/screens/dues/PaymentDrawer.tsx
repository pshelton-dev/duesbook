import { useMemo, useState } from 'react'
import type {
  AccountSummary,
  DuesRosterRow,
  UnallocatedDeposit
} from '../../../../shared/types'
import { formatCents, parseDollarsToCents, todayIso } from '../../lib/money'

interface Picked {
  memberId: number
  name: string
  amount: string
}

export default function PaymentDrawer({
  periodId,
  roster,
  accounts,
  allocateTarget,
  initialMemberId,
  onSaved,
  onClose
}: {
  periodId: number
  roster: DuesRosterRow[]
  accounts: AccountSummary[]
  /** when set, allocate against this existing deposit instead of creating a transaction */
  allocateTarget: UnallocatedDeposit | null
  initialMemberId: number | null
  onSaved: () => void
  onClose: () => void
}): React.JSX.Element {
  const toPicked = (r: DuesRosterRow): Picked => ({
    memberId: r.memberId,
    name: `${r.firstName} ${r.lastName}`.trim(),
    amount: r.outstandingCents > 0 ? (r.outstandingCents / 100).toFixed(2) : ''
  })

  const [picked, setPicked] = useState<Picked[]>(() => {
    const initial = roster.find((r) => r.memberId === initialMemberId)
    return initial ? [toPicked(initial)] : []
  })
  const [query, setQuery] = useState('')
  const [accountId, setAccountId] = useState<number | ''>(
    accounts.find((a) => a.isActive)?.id ?? ''
  )
  const [date, setDate] = useState(todayIso())
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return roster
      .filter(
        (r) =>
          !picked.some((p) => p.memberId === r.memberId) &&
          `${r.firstName} ${r.lastName}`.toLowerCase().includes(q)
      )
      .slice(0, 6)
  }, [query, roster, picked])

  const totalCents = picked.reduce((s, p) => s + (parseDollarsToCents(p.amount) ?? 0), 0)
  const remainingCents = allocateTarget
    ? allocateTarget.amountCents - allocateTarget.allocatedCents
    : null

  async function save(): Promise<void> {
    if (picked.length === 0) {
      setError('Add at least one member.')
      return
    }
    const allocations: { memberId: number; amountCents: number }[] = []
    for (const p of picked) {
      const cents = parseDollarsToCents(p.amount)
      if (cents === null || cents <= 0) {
        setError(`Enter an amount for ${p.name}.`)
        return
      }
      allocations.push({ memberId: p.memberId, amountCents: cents })
    }
    setBusy(true)
    setError(null)
    try {
      await window.duesbook.recordDuesPayment({
        periodId,
        allocations,
        txnId: allocateTarget?.txnId ?? null,
        accountId: allocateTarget ? null : accountId === '' ? null : accountId,
        date: allocateTarget ? null : date,
        memo: allocateTarget ? null : memo.trim() || null
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="drawer">
      <div className="drawer-header">
        <h2>{allocateTarget ? 'Allocate deposit' : 'Record dues payment'}</h2>
        <button className="btn small" onClick={onClose}>
          Close
        </button>
      </div>

      {allocateTarget && (
        <div className="panel">
          {allocateTarget.date} · {formatCents(allocateTarget.amountCents)} into{' '}
          {allocateTarget.accountName}
          {allocateTarget.payee && <> · {allocateTarget.payee}</>}
          <div className="hint">{formatCents(remainingCents!)} left to allocate.</div>
        </div>
      )}

      <label className="field">
        Add member
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a name…"
          autoFocus
        />
      </label>
      {matches.length > 0 && (
        <div className="typeahead">
          {matches.map((r) => (
            <button
              key={r.memberId}
              className="typeahead-item"
              onClick={() => {
                setPicked([...picked, toPicked(r)])
                setQuery('')
              }}
            >
              {r.firstName} {r.lastName}
              <span className="hint">
                {r.outstandingCents > 0 ? ` owes ${formatCents(r.outstandingCents)}` : ' paid up'}
              </span>
            </button>
          ))}
        </div>
      )}

      {picked.length > 0 && (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Member</th>
              <th className="num">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {picked.map((p) => (
              <tr key={p.memberId}>
                <td>{p.name}</td>
                <td className="num">
                  <input
                    className="amount-input"
                    value={p.amount}
                    inputMode="decimal"
                    onChange={(e) =>
                      setPicked(
                        picked.map((x) =>
                          x.memberId === p.memberId ? { ...x, amount: e.target.value } : x
                        )
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    className="btn small"
                    onClick={() => setPicked(picked.filter((x) => x.memberId !== p.memberId))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td className="num">
                <strong>{formatCents(totalCents)}</strong>
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      )}

      {!allocateTarget && (
        <>
          <label className="field">
            Deposited into
            <select
              value={accountId}
              onChange={(e) =>
                setAccountId(e.target.value === '' ? '' : Number(e.target.value))
              }
            >
              {accounts
                .filter((a) => a.isActive)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="field-row">
            <label className="field">
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field">
              Check # / note
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="optional"
              />
            </label>
          </div>
        </>
      )}

      {error && <div className="panel error">{error}</div>}

      <div className="drawer-footer">
        <span />
        <button className="btn primary" onClick={save} disabled={busy || picked.length === 0}>
          {busy ? 'Saving…' : allocateTarget ? 'Allocate' : 'Save payment'}
        </button>
      </div>
    </div>
  )
}
