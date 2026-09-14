/**
 * Bank import engine: file readers (CSV/XLSX), reconcile, commit.
 * Deliberately Electron-free — the db is passed in and dialogs/backup live in
 * ipc.ts — so the engine is scriptable for verification. BANK-IMPORT-PLAN.md
 * is the design source of truth.
 */
import type { Db } from './db'
import { sha256Hex } from '../shared/sha256'
import { unzipSync, strFromU8 } from 'fflate'
import type { BankGrid, NormalizedBankRow } from '../shared/bank-import'
import { normalizeDescription } from '../shared/bank-import'
import type {
  ImportAddition,
  ImportCommitResult,
  ImportDecisions,
  ImportDuplicate,
  ImportMatch,
  ImportPreview
} from '../shared/types'

/** Days of slack when matching a bank row to a hand-entered transaction. */
const MATCH_WINDOW_DAYS = 4

/* ---------------- CSV ---------------- */

/** RFC-4180-ish CSV → grid. Handles quoted fields, embedded commas/newlines. */
export function readBankGridCsv(text: string): BankGrid {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  const src = text.replace(/^﻿/, '') // strip BOM

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      record.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      record.push(field)
      field = ''
      if (record.some((f) => f.trim() !== '')) records.push(record)
      record = []
    } else {
      field += ch
    }
  }
  record.push(field)
  if (record.some((f) => f.trim() !== '')) records.push(record)

  const [headers = [], ...rows] = records
  return { headers: headers.map((h) => h.trim()), rows }
}

/* ---------------- XLSX ---------------- */

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'"
}

function decodeXml(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m])
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
}

/** All <t>…</t> text inside an <si> or <is> block, concatenated. */
function textRuns(xml: string): string {
  let out = ''
  const re = /<t[^>]*>([\s\S]*?)<\/t>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out += decodeXml(m[1])
  return out
}

function colLetterToIndex(ref: string): number {
  let n = 0
  for (const ch of ref) {
    if (ch < 'A' || ch > 'Z') break
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

/**
 * Minimal XLSX → grid: first worksheet, cached values only. Cells keep their
 * raw stored form (dates stay Excel serials — the mapping step converts).
 * Deliberately not a general xlsx library; bank exports are simple sheets.
 */
export function readBankGridXlsx(data: Uint8Array): BankGrid {
  const files = unzipSync(data)

  const sheetName =
    Object.keys(files)
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort()[0] ?? null
  if (!sheetName) throw new Error('No worksheet found — is this an Excel file?')

  const shared: string[] = []
  if (files['xl/sharedStrings.xml']) {
    const sst = strFromU8(files['xl/sharedStrings.xml'])
    const re = /<si[ >]([\s\S]*?)<\/si>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(sst))) shared.push(textRuns(m[1]))
  }

  const sheet = strFromU8(files[sheetName])
  const rows: string[][] = []
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g
  const cellRe = /<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
  let rm: RegExpExecArray | null
  while ((rm = rowRe.exec(sheet))) {
    const cells: string[] = []
    let cm: RegExpExecArray | null
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1]
      const body = cm[2] ?? ''
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1]
      const col = ref ? colLetterToIndex(ref) : cells.length
      const type = /t="(\w+)"/.exec(attrs)?.[1]
      let value = ''
      if (type === 'inlineStr') {
        value = textRuns(body)
      } else {
        const v = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? ''
        value = type === 's' ? (shared[Number(v)] ?? '') : decodeXml(v)
      }
      while (cells.length < col) cells.push('')
      cells[col] = value
    }
    rows.push(cells)
  }

  const [headers = [], ...dataRows] = rows
  return { headers: headers.map((h) => h.trim()), rows: dataRows }
}

/* ---------------- OFX / QFX ---------------- */

/** First value of a leaf tag inside an SGML/XML OFX block. */
function ofxField(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`).exec(block)
  const v = m ? decodeXml(m[1]).trim() : ''
  return v || null
}

/** "20091019120000[-3:BRT]" | "20051004" → ISO date (time/zone dropped). */
function ofxDateToIso(raw: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim())
  if (!m) return null
  const [, y, mo, d] = m
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null
  return `${y}-${mo}-${d}`
}

/** OFX TRNAMT (dot decimal per spec; lone-comma decimals tolerated) → cents. */
function ofxAmountToCents(raw: string): number | null {
  let s = raw.trim()
  if (!s.includes('.') && (s.match(/,/g) ?? []).length === 1) s = s.replace(',', '.')
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null
  return Math.round(Number(s) * 100)
}

/**
 * OFX 1.x (SGML, unclosed leaf tags) and 2.x (XML) statement files → rows.
 * Only <STMTTRN> blocks matter; the header (colon-style or XML prolog) and
 * everything outside the transaction list is ignored.
 */
export function parseOfx(text: string): NormalizedBankRow[] {
  const body = text.slice(Math.max(text.indexOf('<OFX>'), 0))
  const rows: NormalizedBankRow[] = []
  const blockRe = /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(body))) {
    const block = m[1]
    const date = ofxDateToIso(ofxField(block, 'DTPOSTED') ?? '')
    const amountCents = ofxAmountToCents(ofxField(block, 'TRNAMT') ?? '')
    if (!date || amountCents === null || amountCents === 0) continue

    const name = ofxField(block, 'NAME')
    const memo = ofxField(block, 'MEMO')
    const fallback = [ofxField(block, 'TRNTYPE'), ofxField(block, 'CHECKNUM')]
      .filter(Boolean)
      .join(' ')
    const description = normalizeDescription(name ?? memo ?? fallback) || 'Bank transaction'

    rows.push({
      date,
      amountCents,
      description,
      memo: memo && memo !== description ? normalizeDescription(memo) : null,
      fitid: ofxField(block, 'FITID')
    })
  }
  return rows
}

/* ---------------- Reconcile ---------------- */

interface TxnLite {
  id: number
  date: string
  amount_cents: number
  payee: string | null
  cleared: number
  import_fitid: string | null
  import_fingerprint: string | null
}

/**
 * Fingerprint for CSV/XLSX dedup. `occurrence` distinguishes genuinely
 * identical rows in one file (two identical same-day dues payments — the
 * pilot bank's export shows these are real).
 */
export function fingerprintRow(
  accountId: number,
  row: NormalizedBankRow,
  occurrence: number
): string {
  return sha256Hex(
    `${accountId}|${row.date}|${row.amountCents}|${normalizeDescription(row.description).toUpperCase()}|${occurrence}`
  )
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86400000
}

/**
 * Sort incoming rows into duplicates / matches / additions against one
 * account's existing transactions. Read-only; commitImport applies decisions.
 */
export function reconcileImport(
  db: Db,
  accountId: number,
  rows: NormalizedBankRow[]
): ImportPreview {
  const existing = db
    .prepare(
      `SELECT id, date, amount_cents, payee, cleared, import_fitid, import_fingerprint
       FROM txn WHERE account_id = ?`
    )
    .all(accountId) as TxnLite[]

  const byFitid = new Map<string, TxnLite>()
  const byFingerprint = new Map<string, TxnLite>()
  for (const t of existing) {
    if (t.import_fitid) byFitid.set(t.import_fitid, t)
    if (t.import_fingerprint) byFingerprint.set(t.import_fingerprint, t)
  }

  const additions: ImportAddition[] = []
  const matches: ImportMatch[] = []
  const duplicates: ImportDuplicate[] = []
  const claimed = new Set<number>() // existing txns already matched this run
  const occurrenceSeen = new Map<string, number>()

  for (const row of rows) {
    // Occurrence index among identical rows in THIS file, then fingerprint.
    const key = `${row.date}|${row.amountCents}|${normalizeDescription(row.description).toUpperCase()}`
    const occurrence = occurrenceSeen.get(key) ?? 0
    occurrenceSeen.set(key, occurrence + 1)
    const fingerprint = row.fitid ? null : fingerprintRow(accountId, row, occurrence)

    // 1. Exact dedup: this row was imported before.
    if (row.fitid && byFitid.has(row.fitid)) {
      duplicates.push({ row, reason: 'fitid', existingTxnId: byFitid.get(row.fitid)!.id })
      continue
    }
    if (fingerprint && byFingerprint.has(fingerprint)) {
      duplicates.push({
        row,
        reason: 'fingerprint',
        existingTxnId: byFingerprint.get(fingerprint)!.id
      })
      continue
    }

    // 2. Amount+date candidates — including import-stamped ones, so the same
    // money arriving from a different source (CSV one month, QFX the next;
    // a bank that re-issues FITIDs) is caught as a duplicate instead of
    // silently re-added. Cost: a genuinely-new identical twin row in an
    // overlapping download lands in the visible duplicates bucket.
    const candidates = existing.filter(
      (t) =>
        !claimed.has(t.id) &&
        t.amount_cents === row.amountCents &&
        daysBetween(t.date, row.date) <= MATCH_WINDOW_DAYS
    )
    candidates.sort((a, b) => daysBetween(a.date, row.date) - daysBetween(b.date, row.date))

    const uncleared = candidates.find((t) => t.cleared === 0)
    if (uncleared) {
      claimed.add(uncleared.id)
      matches.push({
        row,
        fingerprint,
        existingTxnId: uncleared.id,
        existingPayee: uncleared.payee,
        existingDate: uncleared.date
      })
      continue
    }
    // Same money already hand-entered AND cleared → adding would double-count.
    if (candidates.length > 0) {
      claimed.add(candidates[0].id)
      duplicates.push({ row, reason: 'cleared-match', existingTxnId: candidates[0].id })
      continue
    }

    additions.push({ row, fingerprint })
  }

  return { additions, matches, duplicates }
}

/* ---------------- Commit ---------------- */

/**
 * Apply accepted decisions in one DB transaction: stamp+clear the matches,
 * insert the additions (cleared, in the locked Uncategorized category).
 * The caller (ipc.ts) runs the pre-import backup first.
 */
export function commitImport(
  db: Db,
  accountId: number,
  decisions: ImportDecisions
): Omit<ImportCommitResult, 'backupPath'> {
  const uncategorized = db
    .prepare(`SELECT id, kind FROM category WHERE name = 'Uncategorized' AND is_system = 1`)
    .all() as { id: number; kind: 'income' | 'expense' }[]
  const categoryFor = (cents: number): number => {
    const kind = cents > 0 ? 'income' : 'expense'
    const cat = uncategorized.find((c) => c.kind === kind)
    if (!cat) throw new Error('Uncategorized category missing — database not migrated?')
    return cat.id
  }

  const markCleared = db.prepare(
    `UPDATE txn SET cleared = 1, import_fitid = ?, import_fingerprint = ?, updated_at = ?
     WHERE id = ? AND account_id = ?`
  )
  const insert = db.prepare(
    `INSERT INTO txn (account_id, date, amount_cents, type, category_id, payee, memo,
                      cleared, import_fitid, import_fingerprint, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
  )

  const now = new Date().toISOString()
  return db.transaction(() => {
    let cleared = 0
    for (const m of decisions.matches) {
      const res = markCleared.run(m.fitid, m.fingerprint, now, m.existingTxnId, accountId)
      cleared += res.changes
    }
    for (const a of decisions.additions) {
      const r = a.row
      insert.run(
        accountId,
        r.date,
        r.amountCents,
        r.amountCents > 0 ? 'income' : 'expense',
        categoryFor(r.amountCents),
        normalizeDescription(r.description),
        r.memo,
        r.fitid,
        a.fingerprint,
        now,
        now
      )
    }
    return { added: decisions.additions.length, markedCleared: cleared }
  })
}
