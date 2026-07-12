import { useEffect, useState } from 'react'
import type { AccountSummary, DuesPeriodRow } from '../../../../shared/types'
import { parseDollarsToCents } from '../../lib/money'

/**
 * Settings-only account editor — the repair path for books that started with
 * a mis-struck opening balance (WISHLIST #1). Warns, without blocking, when
 * the opening date sits after existing data: those transactions or dues
 * periods would overlap money already inside the opening balance.
 */
export default function AccountDrawer({
  account,
  onClose,
  onSaved
}: {
  account: AccountSummary
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [name, setName] = useState(account.name)
  const [balance, setBalance] = useState((account.openingBalanceCents / 100).toFixed(2))
  const [date, setDate] = useState(account.openingDate)
  const [earliestTxn, setEarliestTxn] = useState<string | null>(null)
  const [earliestPeriod, setEarliestPeriod] = useState<DuesPeriodRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.duesbook
      .listTxns(account.id, {})
      .then((txns) => {
        if (txns.length > 0) {
          setEarliestTxn(txns.reduce((min, t) => (t.date < min ? t.date : min), txns[0].date))
        }
      })
      .catch(() => {})
    window.duesbook
      .listDuesPeriods()
      .then((periods) => {
        if (periods.length > 0) {
          setEarliestPeriod(
            periods.reduce((min, p) => (p.startDate < min.startDate ? p : min), periods[0])
          )
        }
      })
      .catch(() => {})
  }, [account.id])

  async function save(): Promise<void> {
    const cents = parseDollarsToCents(balance)
    if (cents === null) {
      setError('Enter the opening balance as a number, like 1250.75.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await window.duesbook.updateAccount(account.id, {
        name,
        openingBalanceCents: cents,
        openingDate: date
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <h2>Edit {account.name}</h2>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <label className="field">
          Account name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field-row">
          <label className="field">
            Opening balance
            <input
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="field">
            As of
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <p className="hint">
          The opening balance is the account&rsquo;s statement balance on the &ldquo;as
          of&rdquo; date — everything in these books builds on top of it. To bring in older
          history, move this date back, set the balance from that older statement, then add or
          import the transactions since.
        </p>

        {earliestTxn && date > earliestTxn && (
          <div className="panel warn">
            This account has transactions dated before {date} (earliest {earliestTxn}). If the
            opening balance already includes that money, it will be double-counted.
          </div>
        )}
        {earliestPeriod && date > earliestPeriod.startDate && (
          <div className="panel warn">
            Dues tracking starts {earliestPeriod.startDate} ({earliestPeriod.label}) — before
            this opening date. Payments recorded for those periods may already be inside the
            opening balance.
          </div>
        )}

        {error && <div className="panel error">{error}</div>}

        <div className="drawer-footer">
          <span />
          <div className="btn-row">
            <button className="btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
