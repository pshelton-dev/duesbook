import { useState } from 'react'
import type { DuesPeriodInput, DuesPeriodRow } from '../../../../shared/types'
import { parseDollarsToCents } from '../../lib/money'

export default function PeriodDrawer({
  editing,
  suggestion,
  onSaved,
  onClose
}: {
  editing: DuesPeriodRow | null
  suggestion: DuesPeriodInput | null
  onSaved: () => void
  onClose: () => void
}): React.JSX.Element {
  const base = editing ?? suggestion
  const [label, setLabel] = useState(base?.label ?? '')
  const [startDate, setStartDate] = useState(base?.startDate ?? '')
  const [endDate, setEndDate] = useState(base?.endDate ?? '')
  const [amount, setAmount] = useState(
    base ? (base.amountCents / 100).toFixed(2) : ''
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    const cents = parseDollarsToCents(amount)
    if (cents === null || cents < 0) {
      setError('Enter the dues amount, like 50.')
      return
    }
    const input: DuesPeriodInput = { label: label.trim(), startDate, endDate, amountCents: cents }
    setBusy(true)
    setError(null)
    try {
      if (editing) await window.duesbook.updateDuesPeriod(editing.id, input)
      else await window.duesbook.createDuesPeriod(input)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="drawer">
      <div className="drawer-header">
        <h2>{editing ? 'Edit dues period' : 'New dues period'}</h2>
        <button className="btn small" onClick={onClose}>
          Close
        </button>
      </div>

      <label className="field">
        Label
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. 2026–2027"
          autoFocus={!editing}
        />
      </label>
      <div className="field-row">
        <label className="field">
          Starts
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="field">
          Ends
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
      </div>
      <label className="field">
        Dues amount per member
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="e.g. 50"
        />
      </label>
      {editing && (
        <p className="hint">
          Changing the amount changes what every unpaid member owes for this period. Members with
          adjusted or waived dues keep their override.
        </p>
      )}

      {error && <div className="panel error">{error}</div>}

      <div className="drawer-footer">
        <span />
        <button className="btn primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
