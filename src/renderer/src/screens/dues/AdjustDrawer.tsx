import { useState } from 'react'
import type { DuesRosterRow } from '../../../../shared/types'
import { parseDollarsToCents } from '../../lib/money'

type Mode = 'standard' | 'adjusted' | 'waived'

export default function AdjustDrawer({
  periodId,
  row,
  onSaved,
  onClose
}: {
  periodId: number
  row: DuesRosterRow
  onSaved: () => void
  onClose: () => void
}): React.JSX.Element {
  const initialMode: Mode =
    row.overrideCents === null ? 'standard' : row.overrideCents === 0 ? 'waived' : 'adjusted'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [amount, setAmount] = useState(
    row.overrideCents !== null && row.overrideCents > 0
      ? (row.overrideCents / 100).toFixed(2)
      : ''
  )
  const [note, setNote] = useState(row.overrideNote ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    let cents: number | null
    if (mode === 'standard') cents = null
    else if (mode === 'waived') cents = 0
    else {
      cents = parseDollarsToCents(amount)
      if (cents === null || cents < 0) {
        setError('Enter the adjusted amount, like 25.')
        return
      }
    }
    setBusy(true)
    setError(null)
    try {
      await window.duesbook.setDuesOverride(
        row.memberId,
        periodId,
        cents,
        mode === 'standard' ? null : note.trim() || null
      )
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="drawer">
      <div className="drawer-header">
        <h2>
          Dues for {row.firstName} {row.lastName}
        </h2>
        <button className="btn small" onClick={onClose}>
          Close
        </button>
      </div>

      <label className="check-field">
        <input
          type="radio"
          name="mode"
          checked={mode === 'standard'}
          onChange={() => setMode('standard')}
        />
        Standard amount for this period
      </label>
      <label className="check-field">
        <input
          type="radio"
          name="mode"
          checked={mode === 'adjusted'}
          onChange={() => setMode('adjusted')}
        />
        Adjusted amount (e.g. prorated mid-year joiner)
      </label>
      {mode === 'adjusted' && (
        <label className="field">
          Amount owed for this period
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 25"
            autoFocus
          />
        </label>
      )}
      <label className="check-field">
        <input
          type="radio"
          name="mode"
          checked={mode === 'waived'}
          onChange={() => setMode('waived')}
        />
        Waived — owes nothing this period
      </label>

      {mode !== 'standard' && (
        <label className="field">
          Reason / note
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. joined in March"
          />
        </label>
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
