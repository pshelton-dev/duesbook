import { useMemo, useState } from 'react'
import type { WizardMember } from '../../../shared/types'
import { normalizeDate, parseCsv } from '../lib/csv'

type Target = 'firstName' | 'lastName' | 'fullName' | 'email' | 'phone' | 'address' | 'joinDate'

const TARGET_LABELS: Record<Target, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  fullName: 'Full name (will be split)',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  joinDate: 'Join date'
}

const NONE = ''

function guessMapping(headers: string[]): Partial<Record<Target, number>> {
  const map: Partial<Record<Target, number>> = {}
  headers.forEach((raw, i) => {
    const h = raw.trim().toLowerCase()
    const set = (t: Target): void => {
      if (map[t] === undefined) map[t] = i
    }
    if (h.includes('first')) set('firstName')
    else if (h.includes('last') || h.includes('surname')) set('lastName')
    else if (h === 'name' || h.includes('full')) set('fullName')
    else if (h.includes('mail')) set('email')
    else if (h.includes('phone') || h.includes('tel')) set('phone')
    else if (h.includes('address') || h.includes('street')) set('address')
    else if (h.includes('join') || h.includes('since')) set('joinDate')
  })
  return map
}

function applyMapping(
  rows: string[][],
  map: Partial<Record<Target, number>>
): WizardMember[] {
  const cell = (row: string[], t: Target): string =>
    map[t] !== undefined ? (row[map[t]!] ?? '').trim() : ''
  const members: WizardMember[] = []
  for (const row of rows) {
    let first = cell(row, 'firstName')
    let last = cell(row, 'lastName')
    if (!first && !last) {
      const full = cell(row, 'fullName')
      if (full) {
        const space = full.lastIndexOf(' ')
        if (space === -1) {
          last = full
        } else {
          first = full.slice(0, space)
          last = full.slice(space + 1)
        }
      }
    }
    if (!first && !last) continue
    members.push({
      firstName: first,
      lastName: last,
      email: cell(row, 'email') || null,
      phone: cell(row, 'phone') || null,
      address: cell(row, 'address') || null,
      joinDate: normalizeDate(cell(row, 'joinDate'))
    })
  }
  return members
}

export default function MemberCsvImport({
  onImport,
  importLabel
}: {
  onImport: (members: WizardMember[]) => void | Promise<void>
  importLabel?: string
}): React.JSX.Element {
  const [headers, setHeaders] = useState<string[] | null>(null)
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Partial<Record<Target, number>>>({})
  const [fileError, setFileError] = useState<string | null>(null)

  const preview = useMemo(() => applyMapping(rows.slice(0, 5), mapping), [rows, mapping])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = parseCsv(await file.text())
      if (parsed.length < 2) {
        setFileError('That file needs a header row plus at least one member row.')
        return
      }
      setHeaders(parsed[0])
      setRows(parsed.slice(1))
      setMapping(guessMapping(parsed[0]))
      setFileError(null)
    } catch {
      setFileError('Could not read that file as CSV.')
    }
  }

  async function importAll(): Promise<void> {
    const result = applyMapping(rows, mapping)
    if (result.length === 0) {
      setFileError(
        'No members found — check that a name column is mapped under "Match your columns".'
      )
      return
    }
    setFileError(null)
    await onImport(result)
  }

  const nameMapped =
    mapping.fullName !== undefined ||
    mapping.firstName !== undefined ||
    mapping.lastName !== undefined

  return (
    <>
      <label className="field">
        Member list (.csv)
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
      </label>

      {headers && (
        <>
          <h2>Match your columns</h2>
          <div className="mapping-grid">
            {(Object.keys(TARGET_LABELS) as Target[]).map((t) => (
              <label key={t} className="field">
                {TARGET_LABELS[t]}
                <select
                  value={mapping[t] ?? NONE}
                  onChange={(e) => {
                    const v = e.target.value
                    setMapping((m) => {
                      const next = { ...m }
                      if (v === NONE) delete next[t]
                      else next[t] = Number(v)
                      return next
                    })
                  }}
                >
                  <option value={NONE}>— not in file —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {!nameMapped && (
            <div className="panel warn">Map at least a name column to import members.</div>
          )}

          {preview.length > 0 && (
            <>
              <h2>
                Preview (first {preview.length} of {rows.length} rows)
              </h2>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>First</th>
                    <th>Last</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((m, i) => (
                    <tr key={i}>
                      <td>{m.firstName}</td>
                      <td>{m.lastName}</td>
                      <td>{m.email}</td>
                      <td>{m.phone}</td>
                      <td>{m.joinDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn primary" onClick={importAll} disabled={!nameMapped}>
                {importLabel ?? `Use these ${rows.length} members`}
              </button>
            </>
          )}
        </>
      )}
      {fileError && <div className="panel error">{fileError}</div>}
    </>
  )
}
