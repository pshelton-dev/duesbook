import { useMemo, useState } from 'react'
import type {
  BankGrid,
  BankMapping,
  BankDateFormat,
  NormalizedBankRow
} from '../../../../shared/bank-import'
import { applyMapping } from '../../../../shared/bank-import'
import type { ImportCommitResult, ImportPreview } from '../../../../shared/types'
import { formatCents } from '../../lib/money'

type Step =
  | { kind: 'pick' }
  | { kind: 'map'; fileName: string; grid: BankGrid }
  | { kind: 'preview'; fileName: string; preview: ImportPreview }
  | { kind: 'done'; result: ImportCommitResult }

const DATE_FORMATS: [BankDateFormat, string][] = [
  ['mdy', 'Month/Day/Year'],
  ['dmy', 'Day/Month/Year'],
  ['iso', 'Year-Month-Day'],
  ['excel-serial', 'Excel date number']
]

/** Best-effort mapping guess from header names + first data row. */
function guessMapping(grid: BankGrid): BankMapping {
  const find = (re: RegExp): number => grid.headers.findIndex((h) => re.test(h))
  const withdrawalCol = find(/withdraw|debit/i)
  const depositCol = find(/deposit|credit/i)
  const amountCol = find(/amount/i)
  const dateCol = Math.max(find(/date/i), 0)
  const sample = grid.rows[0]?.[dateCol] ?? ''
  const dateFormat: BankDateFormat = /^4\d{4}(\.0+)?$/.test(sample.trim())
    ? 'excel-serial'
    : /^\d{4}-/.test(sample.trim())
      ? 'iso'
      : 'mdy'
  const split = withdrawalCol >= 0 && depositCol >= 0 && amountCol < 0
  return {
    dateCol,
    dateFormat,
    descriptionCol: Math.max(find(/desc|payee|name|narrat|detail/i), dateCol === 0 ? 1 : 0),
    convention: split ? 'split' : 'signed',
    amountCol: split ? undefined : Math.max(amountCol, 0),
    withdrawalCol: split ? withdrawalCol : undefined,
    depositCol: split ? depositCol : undefined
  }
}

export default function ImportDrawer({
  accountId,
  accountName,
  onClose,
  onSaved
}: {
  accountId: number
  accountName: string
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [mapping, setMapping] = useState<BankMapping | null>(null)
  const [rows, setRows] = useState<NormalizedBankRow[]>([])
  const [checkedAdds, setCheckedAdds] = useState<Set<number>>(new Set())
  const [checkedMatches, setCheckedMatches] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const mapped = useMemo(
    () => (step.kind === 'map' && mapping ? applyMapping(step.grid, mapping) : null),
    [step, mapping]
  )

  async function pickFile(): Promise<void> {
    setError(null)
    try {
      const file = await window.duesbook.openBankFile()
      if (!file) return
      if (!file.grid) {
        setError('That file type is not supported yet.')
        return
      }
      setMapping(guessMapping(file.grid))
      setStep({ kind: 'map', fileName: file.fileName, grid: file.grid })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function toPreview(): Promise<void> {
    if (!mapped || step.kind !== 'map') return
    setBusy(true)
    setError(null)
    try {
      const preview = await window.duesbook.previewBankImport(accountId, mapped.rows)
      setRows(mapped.rows)
      setCheckedAdds(new Set(preview.additions.map((_, i) => i)))
      setCheckedMatches(new Set(preview.matches.map((_, i) => i)))
      setStep({ kind: 'preview', fileName: step.fileName, preview })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function commit(): Promise<void> {
    if (step.kind !== 'preview') return
    setBusy(true)
    setError(null)
    try {
      const result = await window.duesbook.commitBankImport(accountId, {
        additions: step.preview.additions.filter((_, i) => checkedAdds.has(i)),
        matches: step.preview.matches
          .filter((_, i) => checkedMatches.has(i))
          .map((m) => ({
            existingTxnId: m.existingTxnId,
            fitid: m.row.fitid,
            fingerprint: m.fingerprint
          }))
      })
      setStep({ kind: 'done', result })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function toggle(set: Set<number>, i: number, update: (s: Set<number>) => void): void {
    const next = new Set(set)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    update(next)
  }

  const colSelect = (
    value: number | undefined,
    onChange: (col: number | undefined) => void,
    headers: string[],
    allowNone = false
  ): React.JSX.Element => (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    >
      {allowNone && <option value="">—</option>}
      {headers.map((h, i) => (
        <option key={i} value={i}>
          {h || `Column ${i + 1}`}
        </option>
      ))}
    </select>
  )

  const rowLine = (row: NormalizedBankRow): React.JSX.Element => (
    <>
      <td className="date">{row.date}</td>
      <td className="memo" title={row.description}>
        {row.description}
      </td>
      <td className={`num ${row.amountCents > 0 ? 'pos' : ''}`}>
        {formatCents(row.amountCents)}
      </td>
    </>
  )

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer xwide">
        <div className="drawer-header">
          <h2>Import transactions · {accountName}</h2>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {step.kind === 'pick' && (
          <>
            <p className="lead">
              Choose a file downloaded from your bank — CSV or Excel. Duesbook matches it
              against this account so nothing is counted twice.
            </p>
            <div className="btn-row">
              <button className="btn primary" onClick={pickFile}>
                Choose file…
              </button>
            </div>
          </>
        )}

        {step.kind === 'map' && mapping && (
          <>
            <p className="hint">
              {step.fileName} · {step.grid.rows.length} rows. Tell Duesbook which column is
              which — it has taken a guess.
            </p>
            <div className="field-row">
              <label className="field">
                Date column
                {colSelect(mapping.dateCol, (c) => setMapping({ ...mapping, dateCol: c ?? 0 }), step.grid.headers)}
              </label>
              <label className="field">
                Date format
                <select
                  value={mapping.dateFormat}
                  onChange={(e) =>
                    setMapping({ ...mapping, dateFormat: e.target.value as BankDateFormat })
                  }
                >
                  {DATE_FORMATS.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              Description column
              {colSelect(
                mapping.descriptionCol,
                (c) => setMapping({ ...mapping, descriptionCol: c ?? 0 }),
                step.grid.headers
              )}
            </label>
            <label className="field">
              Amounts are…
              <select
                value={mapping.convention}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    convention: e.target.value as BankMapping['convention'],
                    amountCol: e.target.value === 'signed' ? 0 : undefined,
                    withdrawalCol: e.target.value === 'split' ? 0 : undefined,
                    depositCol: e.target.value === 'split' ? 1 : undefined
                  })
                }
              >
                <option value="split">Two columns (withdrawals and deposits)</option>
                <option value="signed">One column (negative = money out)</option>
              </select>
            </label>
            {mapping.convention === 'split' ? (
              <div className="field-row">
                <label className="field">
                  Withdrawals column
                  {colSelect(
                    mapping.withdrawalCol,
                    (c) => setMapping({ ...mapping, withdrawalCol: c }),
                    step.grid.headers
                  )}
                </label>
                <label className="field">
                  Deposits column
                  {colSelect(
                    mapping.depositCol,
                    (c) => setMapping({ ...mapping, depositCol: c }),
                    step.grid.headers
                  )}
                </label>
              </div>
            ) : (
              <>
                <label className="field">
                  Amount column
                  {colSelect(
                    mapping.amountCol,
                    (c) => setMapping({ ...mapping, amountCol: c }),
                    step.grid.headers
                  )}
                </label>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={mapping.negateAmount ?? false}
                    onChange={(e) => setMapping({ ...mapping, negateAmount: e.target.checked })}
                  />
                  Flip the sign (this bank shows money out as positive)
                </label>
              </>
            )}

            {mapped && (
              <>
                <h2>Preview</h2>
                {mapped.errors.length > 0 && (
                  <p className="hint">
                    {mapped.errors.length} row{mapped.errors.length > 1 ? 's' : ''} skipped:{' '}
                    {mapped.errors.slice(0, 3).join(' · ')}
                    {mapped.errors.length > 3 ? ' · …' : ''}
                  </p>
                )}
                <table className="mini-table">
                  <tbody>
                    {mapped.rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>{rowLine(r)}</tr>
                    ))}
                  </tbody>
                </table>
                <p className="hint">
                  {mapped.rows.length} readable transaction{mapped.rows.length === 1 ? '' : 's'}.
                </p>
              </>
            )}
          </>
        )}

        {step.kind === 'preview' && (
          <>
            {step.preview.matches.length > 0 && (
              <>
                <h2>
                  Match your entries · {checkedMatches.size} of {step.preview.matches.length}
                </h2>
                <p className="hint">
                  These bank rows look like transactions you already entered. Checked rows mark
                  your entry as cleared instead of adding a duplicate.
                </p>
                <table className="mini-table">
                  <tbody>
                    {step.preview.matches.map((m, i) => (
                      <tr key={i}>
                        <td className="center">
                          <input
                            type="checkbox"
                            checked={checkedMatches.has(i)}
                            onChange={() => toggle(checkedMatches, i, setCheckedMatches)}
                          />
                        </td>
                        {rowLine(m.row)}
                        <td className="date">
                          → {m.existingPayee ?? 'your entry'} on {m.existingDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <h2>
              New transactions · {checkedAdds.size} of {step.preview.additions.length}
            </h2>
            {step.preview.additions.length === 0 ? (
              <p className="hint">Nothing new — these books already have every row.</p>
            ) : (
              <table className="mini-table">
                <tbody>
                  {step.preview.additions.map((a, i) => (
                    <tr key={i}>
                      <td className="center">
                        <input
                          type="checkbox"
                          checked={checkedAdds.has(i)}
                          onChange={() => toggle(checkedAdds, i, setCheckedAdds)}
                        />
                      </td>
                      {rowLine(a.row)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {step.preview.duplicates.length > 0 && (
              <>
                <h2>Already in the books · {step.preview.duplicates.length}</h2>
                <p className="hint">Skipped automatically — imported before, or matching a cleared entry.</p>
                <table className="mini-table">
                  <tbody>
                    {step.preview.duplicates.map((d, i) => (
                      <tr key={i} className="inactive-row">
                        {rowLine(d.row)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <p className="hint">Unchecked rows are skipped — nothing happens to them.</p>
          </>
        )}

        {step.kind === 'done' && (
          <>
            <p className="lead">
              Import finished: {step.result.added} added, {step.result.markedCleared} of your
              entries marked cleared.
            </p>
            <p className="hint">
              {step.result.backupPath
                ? `A backup was written first: ${step.result.backupPath}`
                : 'No backup folder is set up, so no pre-import backup was written.'}
            </p>
          </>
        )}

        {error && <div className="panel error">{error}</div>}

        <div className="drawer-footer">
          <span />
          <div className="btn-row">
            {step.kind === 'done' ? (
              <button className="btn primary" onClick={onSaved}>
                Done
              </button>
            ) : (
              <>
                <button className="btn" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                {step.kind === 'map' && (
                  <button
                    className="btn primary"
                    onClick={toPreview}
                    disabled={busy || !mapped || mapped.rows.length === 0}
                  >
                    {busy ? 'Checking…' : 'Continue'}
                  </button>
                )}
                {step.kind === 'preview' && (
                  <button
                    className="btn primary"
                    onClick={commit}
                    disabled={busy || checkedAdds.size + checkedMatches.size === 0}
                  >
                    {busy
                      ? 'Importing…'
                      : `Import ${checkedAdds.size + checkedMatches.size} row${checkedAdds.size + checkedMatches.size === 1 ? '' : 's'}`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
