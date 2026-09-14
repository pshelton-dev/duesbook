import { Feather } from '@expo/vector-icons'
import { File } from 'expo-file-system'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { commitImport, parseOfx, readBankGridCsv, readBankGridXlsx, reconcileImport } from '../src/data/import'
import { listAccounts } from '../src/data/ledger'
import { META, getMeta } from '../src/data/meta'
import { applyMapping, type BankDateFormat, type BankGrid, type BankMapping, type NormalizedBankRow } from '../src/shared/bank-import'
import { DATE_FORMAT_LABEL, guessDateFormat, guessMapping } from '../src/shared/bank-guess'
import type { ImportPreview } from '../src/shared/types'
import { useBooks, useQuery } from '../src/ui/books'
import { Button, Card, ChoiceField, ErrorText, Hint, ListRow, Toggle } from '../src/ui/components'
import { fmtDate, formatCents } from '../src/ui/format'
import { snapshotNow } from '../src/ui/snapshots'
import { color } from '../src/ui/theme'

/**
 * Bank import, phone-sized: pick a file, answer one mapping question per
 * page, review the three buckets, import. The engine is the desktop's.
 */
type Stage = 'pick' | 'map' | 'review' | 'done'
const MAP_STEPS = ['date', 'description', 'convention', 'amount'] as const

export default function Import(): React.JSX.Element {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { db, bump } = useBooks()
  const params = useLocalSearchParams<{ accountId?: string }>()
  const accounts = useQuery((d) => listAccounts(d).filter((a) => a.isActive))
  const snapshotsOn = useQuery((d) => getMeta(d, META.snapshotsEnabled) === '1')

  const [stage, setStage] = useState<Stage>('pick')
  const [accountId, setAccountId] = useState<number | null>(Number(params.accountId) || accounts[0]?.id || null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [grid, setGrid] = useState<BankGrid | null>(null)
  const [rows, setRows] = useState<NormalizedBankRow[] | null>(null)
  const [mapping, setMapping] = useState<BankMapping | null>(null)
  const [mapStep, setMapStep] = useState(0)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [checkedAdds, setCheckedAdds] = useState<Set<number>>(new Set())
  const [checkedMatches, setCheckedMatches] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<{ added: number; cleared: number; snapshot: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function pickFile(): Promise<void> {
    setError(null)
    try {
      const picked = await File.pickFileAsync()
      if (picked.canceled) return
      const file = picked.result
      const ext = file.name.toLowerCase().split('.').pop()
      setFileName(file.name)
      if (ext === 'ofx' || ext === 'qfx') {
        const parsed = parseOfx(file.textSync())
        if (parsed.length === 0) throw new Error('No transactions found in that OFX file. It may be a request file or an empty statement.')
        setGrid(null)
        setRows(parsed)
        setMapping(null)
      } else {
        const g = ext === 'xlsx' ? readBankGridXlsx(file.bytesSync()) : readBankGridCsv(file.textSync())
        if (g.headers.length === 0 || g.rows.length === 0) throw new Error('That file has no rows to import.')
        setGrid(g)
        setRows(null)
        setMapping(guessMapping(g))
        setMapStep(0)
      }
    } catch (e) {
      setFileName(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function reconcile(normalized: NormalizedBankRow[]): void {
    if (!accountId) return setError('Choose the account this file is for.')
    const p = reconcileImport(db, accountId, normalized)
    setPreview(p)
    setCheckedAdds(new Set(p.additions.map((_, i) => i)))
    setCheckedMatches(new Set(p.matches.map((_, i) => i)))
    setStage('review')
  }

  function fromPick(): void {
    if (!accountId) return setError('Choose the account this file is for.')
    if (rows) return reconcile(rows)
    if (grid && mapping) return setStage('map')
    setError('Choose a file first.')
  }

  function mapNext(): void {
    if (!grid || !mapping) return
    if (mapStep < MAP_STEPS.length - 1) return setMapStep(mapStep + 1)
    const applied = applyMapping(grid, mapping)
    if (applied.rows.length === 0) return setError(`Nothing could be read with that mapping. ${applied.errors[0] ?? ''}`)
    if (applied.errors.length > 0) setError(`${applied.errors.length} row${applied.errors.length === 1 ? '' : 's'} skipped: ${applied.errors[0]}`)
    else setError(null)
    setRows(applied.rows)
    reconcile(applied.rows)
  }

  function doImport(): void {
    if (!preview || !accountId) return
    setBusy(true)
    setError(null)
    try {
      let snapshot = false
      if (snapshotsOn) {
        try {
          snapshotNow(db)
          snapshot = true
        } catch (e) {
          throw new Error(`Import cancelled: the pre-import copy failed (${e instanceof Error ? e.message : String(e)}). Nothing was changed.`)
        }
      }
      const r = commitImport(db, accountId, {
        additions: preview.additions.filter((_, i) => checkedAdds.has(i)),
        matches: preview.matches.filter((_, i) => checkedMatches.has(i)).map((m) => ({ existingTxnId: m.existingTxnId, fitid: m.row.fitid, fingerprint: m.fingerprint }))
      })
      bump()
      setResult({ added: r.added, cleared: r.markedCleared, snapshot })
      setStage('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (set: Set<number>, i: number, apply: (s: Set<number>) => void): void => {
    const next = new Set(set)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    apply(next)
  }

  const stageIndex = stage === 'pick' ? 0 : stage === 'map' ? 1 : stage === 'review' ? 2 : 3
  const stageLabel = ['Pick a file', 'Map columns', 'Review', 'Import'][stageIndex]
  const account = accounts.find((a) => a.id === accountId)

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Button title={stage === 'done' ? 'Done' : 'Cancel'} kind="link" onPress={() => router.back()} />
          <Text style={styles.title}>Import from bank file</Text>
          <View style={{ width: 60 }} />
        </View>

        {fileName && (
          <View style={styles.fileChip}>
            <Feather name="file-text" size={18} color={color.green} />
            <Text style={styles.fileName} numberOfLines={1}>
              {fileName}
            </Text>
            <Text style={styles.fileMeta}>
              {rows ? `${rows.length} rows` : grid ? `${grid.rows.length} rows` : ''}
              {account ? ` · ${account.name}` : ''}
            </Text>
          </View>
        )}

        <View style={styles.pips}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.pip, i <= stageIndex && styles.pipOn]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>
          Step {stageIndex + 1} of 4 · {stageLabel}
        </Text>

        {stage === 'pick' && (
          <>
            <Text style={styles.h1}>Which account is this for?</Text>
            <ChoiceField label="Account" value={accountId} onChange={setAccountId} options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
            <Card style={{ padding: 14, gap: 6 }}>
              <Text style={styles.body13}>Download a statement from your bank’s app or website as CSV, Excel, or OFX/QFX (sometimes called “Quicken”), save it to Files, then choose it here.</Text>
              <Text style={styles.body13}>Duesbook matches it against this account so nothing is counted twice, and every new row lands in Uncategorized for you to sort.</Text>
            </Card>
            <Button title={fileName ? 'Choose a different file…' : 'Choose a file…'} kind={fileName ? 'default' : 'primary'} onPress={pickFile} />
          </>
        )}

        {stage === 'map' && grid && mapping && (
          <MapQuestion grid={grid} mapping={mapping} step={mapStep} onChange={setMapping} />
        )}

        {stage === 'review' && preview && (
          <>
            {preview.matches.length > 0 && (
              <Bucket
                title="Match your entries"
                count={`${checkedMatches.size} of ${preview.matches.length}`}
                hint="Rows that look like something you already typed in. Checked ones mark your entry as cleared instead of adding a duplicate."
              >
                {preview.matches.map((m, i) => (
                  <ImportRow
                    key={i}
                    checked={checkedMatches.has(i)}
                    onToggle={() => toggle(checkedMatches, i, setCheckedMatches)}
                    row={m.row}
                    note={`Matches ${m.existingPayee || 'your entry'} · ${fmtDate(m.existingDate)}`}
                    last={i === preview.matches.length - 1}
                  />
                ))}
              </Bucket>
            )}
            <Bucket title="New" count={`${checkedAdds.size} of ${preview.additions.length}`} hint={preview.additions.length === 0 ? 'Nothing new in this file.' : undefined}>
              {preview.additions.map((a, i) => (
                <ImportRow key={i} checked={checkedAdds.has(i)} onToggle={() => toggle(checkedAdds, i, setCheckedAdds)} row={a.row} last={i === preview.additions.length - 1} />
              ))}
            </Bucket>
            {preview.duplicates.length > 0 && (
              <Bucket title="Already in the books" count={String(preview.duplicates.length)} hint="Skipped automatically: imported before, or matching a cleared entry.">
                {preview.duplicates.map((d, i) => (
                  <ImportRow key={i} row={d.row} muted last={i === preview.duplicates.length - 1} />
                ))}
              </Bucket>
            )}
            <Hint>{snapshotsOn ? 'A copy of your books is saved before anything changes.' : 'Copies are off, so no pre-import copy will be made.'}</Hint>
          </>
        )}

        {stage === 'done' && result && (
          <Card accent style={{ padding: 16, gap: 6 }}>
            <Text style={styles.h1}>Imported</Text>
            <Text style={styles.body13}>
              {result.added} new transaction{result.added === 1 ? '' : 's'} added
              {result.cleared > 0 ? ` and ${result.cleared} of your entries marked cleared` : ''}.
            </Text>
            {result.snapshot && <Text style={styles.body13}>A copy of the books from before the import is in Backups.</Text>}
            <Text style={styles.body13}>New rows are in Uncategorized: open the Ledger to sort them.</Text>
          </Card>
        )}

        {error && <ErrorText>{error}</ErrorText>}

        <View style={{ flex: 1, minHeight: 12 }} />

        <View style={styles.footer}>
          {stage === 'map' && <Button title="Back" onPress={() => (mapStep > 0 ? setMapStep(mapStep - 1) : setStage('pick'))} style={{ flex: 1 }} />}
          {stage === 'review' && <Button title="Back" onPress={() => (grid ? setStage('map') : setStage('pick'))} style={{ flex: 1 }} />}
          {stage === 'pick' && <Button title="Next" kind="primary" onPress={fromPick} disabled={!fileName} style={{ flex: 2 }} />}
          {stage === 'map' && <Button title="Next" kind="primary" onPress={mapNext} style={{ flex: 2 }} />}
          {stage === 'review' && (
            <Button
              title={busy ? 'Importing…' : `Import ${checkedAdds.size + checkedMatches.size} row${checkedAdds.size + checkedMatches.size === 1 ? '' : 's'}`}
              kind="primary"
              onPress={doImport}
              disabled={busy || checkedAdds.size + checkedMatches.size === 0}
              style={{ flex: 2 }}
            />
          )}
          {stage === 'done' && <Button title="Done" kind="primary" onPress={() => router.back()} style={{ flex: 1 }} />}
        </View>
      </ScrollView>
    </View>
  )
}

/** One mapping question per page, each column shown with a value from the file. */
function MapQuestion({ grid, mapping, step, onChange }: { grid: BankGrid; mapping: BankMapping; step: number; onChange: (m: BankMapping) => void }): React.JSX.Element {
  const guess = guessMapping(grid)
  const sample = (col: number): string => grid.rows[0]?.[col] ?? ''
  const columns = grid.headers.map((h, i) => ({ index: i, header: h || `Column ${i + 1}`, sample: sample(i) }))

  const ColumnList = ({ value, guessValue, onPick }: { value: number | undefined; guessValue: number | undefined; onPick: (i: number) => void }): React.JSX.Element => (
    <Card>
      {columns.map((c, i) => (
        <ListRow key={c.index} last={i === columns.length - 1} onPress={() => onPick(c.index)}>
          <View style={[styles.radio, value === c.index && styles.radioOn]} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.colName}>{c.header}</Text>
            <Text style={styles.colSample} numberOfLines={1}>
              {c.sample || '—'}
            </Text>
          </View>
          {guessValue === c.index && <Text style={styles.guess}>Best guess</Text>}
        </ListRow>
      ))}
    </Card>
  )

  const kind = MAP_STEPS[step]
  if (kind === 'date') {
    return (
      <>
        <Text style={styles.h1}>Which column is the date?</Text>
        <Text style={styles.lead}>A value from your file is shown under each column name.</Text>
        <ColumnList value={mapping.dateCol} guessValue={guess.dateCol} onPick={(i) => onChange({ ...mapping, dateCol: i, dateFormat: guessDateFormat(grid, i) })} />
        <ChoiceField
          label="Dates are written as"
          value={mapping.dateFormat}
          onChange={(f) => onChange({ ...mapping, dateFormat: f as BankDateFormat })}
          options={(Object.keys(DATE_FORMAT_LABEL) as BankDateFormat[]).map((f) => ({ value: f, label: DATE_FORMAT_LABEL[f] }))}
        />
      </>
    )
  }
  if (kind === 'description') {
    return (
      <>
        <Text style={styles.h1}>Which column is the description?</Text>
        <Text style={styles.lead}>The payee or memo text your bank shows for each line.</Text>
        <ColumnList value={mapping.descriptionCol} guessValue={guess.descriptionCol} onPick={(i) => onChange({ ...mapping, descriptionCol: i })} />
      </>
    )
  }
  if (kind === 'convention') {
    const pick = (convention: BankMapping['convention']): void =>
      onChange(
        convention === 'signed'
          ? { ...mapping, convention, amountCol: mapping.amountCol ?? guess.amountCol ?? 0, withdrawalCol: undefined, depositCol: undefined }
          : { ...mapping, convention, amountCol: undefined, withdrawalCol: mapping.withdrawalCol ?? guess.withdrawalCol ?? 0, depositCol: mapping.depositCol ?? guess.depositCol ?? 0 }
      )
    return (
      <>
        <Text style={styles.h1}>How is the amount shown?</Text>
        <Card>
          <ListRow onPress={() => pick('signed')}>
            <View style={[styles.radio, mapping.convention === 'signed' && styles.radioOn]} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.colName}>One column</Text>
              <Text style={styles.colSample}>Money out is negative, or marked some other way</Text>
            </View>
            {guess.convention === 'signed' && <Text style={styles.guess}>Best guess</Text>}
          </ListRow>
          <ListRow last onPress={() => pick('split')}>
            <View style={[styles.radio, mapping.convention === 'split' && styles.radioOn]} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.colName}>Two columns</Text>
              <Text style={styles.colSample}>Withdrawals in one, deposits in another, both positive</Text>
            </View>
            {guess.convention === 'split' && <Text style={styles.guess}>Best guess</Text>}
          </ListRow>
        </Card>
      </>
    )
  }
  if (mapping.convention === 'signed') {
    return (
      <>
        <Text style={styles.h1}>Which column is the amount?</Text>
        <ColumnList value={mapping.amountCol} guessValue={guess.amountCol} onPick={(i) => onChange({ ...mapping, amountCol: i })} />
        <Toggle title="Money out is shown as positive" subtitle="Some banks flip the sign. Turn this on if deposits look negative." value={mapping.negateAmount ?? false} onValueChange={(v) => onChange({ ...mapping, negateAmount: v })} />
      </>
    )
  }
  return (
    <>
      <Text style={styles.h1}>Which columns hold the amounts?</Text>
      <ChoiceField label="Money out (withdrawals)" value={mapping.withdrawalCol ?? null} onChange={(i) => onChange({ ...mapping, withdrawalCol: i })} options={columns.map((c) => ({ value: c.index, label: c.header, detail: c.sample }))} />
      <ChoiceField label="Money in (deposits)" value={mapping.depositCol ?? null} onChange={(i) => onChange({ ...mapping, depositCol: i })} options={columns.map((c) => ({ value: c.index, label: c.header, detail: c.sample }))} />
    </>
  )
}

function Bucket({ title, count, hint, children }: { title: string; count: string; hint?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.bucketHead}>
        <Text style={styles.bucketTitle}>{title}</Text>
        <Text style={styles.bucketCount}>{count}</Text>
      </View>
      {hint && <Text style={styles.colSample}>{hint}</Text>}
      <Card>{children}</Card>
    </View>
  )
}

function ImportRow({ row, checked, onToggle, note, muted = false, last = false }: { row: NormalizedBankRow; checked?: boolean; onToggle?: () => void; note?: string; muted?: boolean; last?: boolean }): React.JSX.Element {
  return (
    <ListRow onPress={onToggle} last={last}>
      {onToggle && (
        <Pressable onPress={onToggle} style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked && <Feather name="check" size={14} color={color.white} />}
        </Pressable>
      )}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={[styles.rowText, muted && { color: color.muted }]} numberOfLines={1}>
          {row.description}
        </Text>
        <Text style={styles.colSample}>
          {fmtDate(row.date)}
          {row.memo ? ` · ${row.memo}` : ''}
        </Text>
        {note && <Text style={styles.note}>{note}</Text>}
      </View>
      <Text style={[styles.amt, row.amountCents > 0 && { color: color.green }, muted && { color: color.muted }]}>{formatCents(row.amountCents)}</Text>
    </ListRow>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { flexGrow: 1, padding: 16, gap: 14, paddingBottom: 34 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: color.ink },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  fileName: { flex: 1, fontSize: 13, fontWeight: '600', color: color.ink },
  fileMeta: { fontSize: 12, color: color.muted },
  pips: { flexDirection: 'row', gap: 6 },
  pip: { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.greenTrack },
  pipOn: { backgroundColor: color.green },
  stepLabel: { fontSize: 11, fontWeight: '600', color: color.muted, marginTop: -8 },
  h1: { fontSize: 20, fontWeight: '700', color: color.ink, letterSpacing: -0.3 },
  lead: { fontSize: 13, color: color.muted2, marginTop: -8 },
  body13: { fontSize: 13, color: color.inkSoft, lineHeight: 19 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.inputBorder },
  radioOn: { borderColor: color.green, borderWidth: 7 },
  colName: { fontSize: 15, fontWeight: '600', color: color.ink },
  colSample: { fontSize: 12, color: color.muted, fontVariant: ['tabular-nums'] },
  guess: { fontSize: 10, fontWeight: '700', color: color.green, backgroundColor: color.greenSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  bucketHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  bucketTitle: { fontSize: 14, fontWeight: '700', color: color.ink },
  bucketCount: { fontSize: 12, color: color.muted },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: color.inputBorder, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: color.green, borderColor: color.green },
  rowText: { fontSize: 14, fontWeight: '600', color: color.ink },
  note: { fontSize: 11.5, color: color.warn, backgroundColor: color.warnBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', marginTop: 4, alignSelf: 'flex-start' },
  amt: { fontSize: 14, fontWeight: '600', color: color.ink, fontVariant: ['tabular-nums'] },
  footer: { flexDirection: 'row', gap: 10 }
})
