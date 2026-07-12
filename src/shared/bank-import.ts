/**
 * Bank-file mapping & normalization — pure functions shared by the renderer
 * (live mapping preview) and the main process (scripted import). No Electron,
 * no Node APIs. See BANK-IMPORT-PLAN.md.
 */

/** A parsed-but-unmapped tabular file (CSV or XLSX): first row = headers. */
export interface BankGrid {
  headers: string[]
  rows: string[][]
}

/** How the amount is encoded in the file. */
export type AmountConvention = 'signed' | 'split'

export type BankDateFormat = 'iso' | 'mdy' | 'dmy' | 'excel-serial'

export interface BankMapping {
  dateCol: number
  dateFormat: BankDateFormat
  descriptionCol: number
  memoCol?: number
  convention: AmountConvention
  /** convention 'signed': one column, positive = money in. */
  amountCol?: number
  /** convention 'signed': set when the bank exports money OUT as positive. */
  negateAmount?: boolean
  /** convention 'split': two columns, both positive. */
  withdrawalCol?: number
  depositCol?: number
}

/** One normalized bank transaction; amountCents is signed (deposit > 0). */
export interface NormalizedBankRow {
  date: string
  amountCents: number
  description: string
  memo: string | null
  /** OFX only; CSV/XLSX rows get a fingerprint at reconcile time instead. */
  fitid: string | null
}

export interface MappingResult {
  rows: NormalizedBankRow[]
  /** Human-readable problems, referencing 1-based data-row numbers. */
  errors: string[]
}

/** Excel serial day → ISO date (epoch 1899-12-30; fine for modern dates). */
export function excelSerialToIso(serial: number): string | null {
  if (!isFinite(serial) || serial < 61 || serial > 219511) return null // 1900-03-01..2500
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000
  return new Date(ms).toISOString().slice(0, 10)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function parseBankDate(raw: string, format: BankDateFormat): string | null {
  const s = raw.trim()
  if (!s) return null
  if (format === 'excel-serial') return excelSerialToIso(Number(s))
  if (format === 'iso') {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null
  }
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (!m) return null
  const [a, b] = [Number(m[1]), Number(m[2])]
  let year = Number(m[3])
  if (year < 100) year += year >= 70 ? 1900 : 2000
  const [month, day] = format === 'mdy' ? [a, b] : [b, a]
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** "$1,234.56", "(90.00)", "-90" → signed cents; null if unparseable. */
export function parseBankAmountCents(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[$,\s]/g, '')
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  }
  // Allow long decimal tails and round to cents: XLSX stores IEEE-754 cached
  // values, so $76.32 can arrive as "76.319999999999993".
  if (!/^\d*(\.\d+)?$/.test(s) || s === '' || s === '.') return null
  const cents = Math.round(Number(s) * 100)
  return negative ? -cents : cents
}

/** Collapse whitespace; bank descriptions arrive padded and double-spaced. */
export function normalizeDescription(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

export function applyMapping(grid: BankGrid, mapping: BankMapping): MappingResult {
  const rows: NormalizedBankRow[] = []
  const errors: string[] = []

  grid.rows.forEach((cells, i) => {
    const rowNo = i + 1
    const cell = (col: number | undefined): string =>
      col === undefined ? '' : (cells[col] ?? '')

    if (cells.every((c) => c.trim() === '')) return // blank line

    const date = parseBankDate(cell(mapping.dateCol), mapping.dateFormat)
    if (!date) {
      errors.push(`Row ${rowNo}: unreadable date "${cell(mapping.dateCol)}"`)
      return
    }

    let amountCents: number | null
    if (mapping.convention === 'signed') {
      amountCents = parseBankAmountCents(cell(mapping.amountCol))
      if (amountCents !== null && mapping.negateAmount) amountCents = -amountCents
    } else {
      const w = cell(mapping.withdrawalCol).trim()
      const d = cell(mapping.depositCol).trim()
      if (w && d) {
        errors.push(`Row ${rowNo}: both withdrawal and deposit are set`)
        return
      }
      const parsed = parseBankAmountCents(w || d)
      amountCents = parsed === null ? null : w ? -Math.abs(parsed) : Math.abs(parsed)
    }
    if (amountCents === null) {
      errors.push(`Row ${rowNo}: unreadable amount`)
      return
    }
    if (amountCents === 0) {
      errors.push(`Row ${rowNo}: zero amount — skipped`)
      return
    }

    const description = normalizeDescription(cell(mapping.descriptionCol))
    if (!description) {
      errors.push(`Row ${rowNo}: empty description`)
      return
    }

    rows.push({
      date,
      amountCents,
      description,
      memo: mapping.memoCol === undefined ? null : normalizeDescription(cell(mapping.memoCol)) || null,
      fitid: null
    })
  })

  return { rows, errors }
}
