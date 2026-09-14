/** Build CSV text from rows, quoting anything that needs it. */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number): string => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n'
}

/** Cents → "1234.50" for spreadsheet-friendly CSV (no $ or thousands separators). */
export function centsToCsvNumber(cents: number): string {
  return (cents / 100).toFixed(2)
}
