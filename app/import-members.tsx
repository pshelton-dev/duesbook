import { Feather } from '@expo/vector-icons'
import { File, Paths } from 'expo-file-system'
import { useRouter } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { importMembers } from '../src/data/members'
import { parseCsv } from '../src/shared/csv'
import { MEMBER_CSV_TEMPLATE, MEMBER_TARGET_LABEL, applyMemberMapping, guessMemberMapping, type MemberMapping, type MemberTarget } from '../src/shared/member-csv'
import type { WizardMember } from '../src/shared/types'
import { useBooks } from '../src/ui/books'
import { Button, Card, ChoiceField, ErrorText, Hint, ListRow } from '../src/ui/components'
import { color } from '../src/ui/theme'

/**
 * Member spreadsheet import: pick a CSV, say which columns hold names, then
 * the optional details, preview, import. Available before the wizard
 * finishes, so a new treasurer can bring the roster in on day one.
 */
type Stage = 'pick' | 'names' | 'details' | 'review' | 'done'

export default function ImportMembers(): React.JSX.Element {
  const router = useRouter()
  /** Falls back to the root when this modal is the first screen (nothing to go back to). */
  const close = (): void => (router.canGoBack() ? router.back() : router.replace('/'))
  const insets = useSafeAreaInsets()
  const { db, bump } = useBooks()

  const [stage, setStage] = useState<Stage>('pick')
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [map, setMap] = useState<MemberMapping>({})
  const [members, setMembers] = useState<WizardMember[]>([])
  const [added, setAdded] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function pickFile(): Promise<void> {
    setError(null)
    try {
      const picked = await File.pickFileAsync()
      if (picked.canceled) return
      const parsed = parseCsv(picked.result.textSync())
      if (parsed.length < 2) throw new Error('That file needs a header row and at least one member.')
      setFileName(picked.result.name)
      setHeaders(parsed[0])
      setRows(parsed.slice(1))
      setMap(guessMemberMapping(parsed[0]))
    } catch (e) {
      setFileName(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function shareTemplate(): Promise<void> {
    try {
      const file = new File(Paths.cache, 'duesbook-members-template.csv')
      if (file.exists) file.delete()
      file.write(MEMBER_CSV_TEMPLATE)
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Member spreadsheet template' })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function toReview(): void {
    const list = applyMemberMapping(rows, map)
    if (list.length === 0) return setError('No rows had a name. Check which columns hold the names.')
    setError(list.length < rows.length ? `${rows.length - list.length} row${rows.length - list.length === 1 ? '' : 's'} without a name will be skipped.` : null)
    setMembers(list)
    setStage('review')
  }

  function doImport(): void {
    try {
      setAdded(importMembers(db, members))
      bump()
      setStage('done')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const NONE = -1
  const columnOptions = (withNone: boolean) => [
    ...(withNone ? [{ value: NONE, label: 'Not in this file' }] : []),
    ...headers.map((h, i) => ({ value: i, label: h || `Column ${i + 1}`, detail: rows[0]?.[i] ?? '' }))
  ]
  const pick = (t: MemberTarget) => (v: number) => setMap({ ...map, [t]: v === NONE ? undefined : v })
  const namesOk = map.firstName !== undefined || map.lastName !== undefined || map.fullName !== undefined

  const stageIndex = { pick: 0, names: 1, details: 2, review: 3, done: 3 }[stage]
  const stageLabel = ['Pick a file', 'Names', 'Details', 'Review'][stageIndex]

  return (
    <View style={[styles.screen, { paddingTop: Math.min(insets.top, 12) }]}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Button title={stage === 'done' ? 'Done' : 'Cancel'} kind="link" onPress={close} />
          <Text style={styles.title}>Import members</Text>
          <View style={{ width: 60 }} />
        </View>

        {fileName && (
          <View style={styles.fileChip}>
            <Feather name="file-text" size={18} color={color.green} />
            <Text style={styles.fileName} numberOfLines={1}>
              {fileName}
            </Text>
            <Text style={styles.fileMeta}>{rows.length} rows</Text>
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
            <Text style={styles.h1}>Bring in your member list</Text>
            <Card style={{ padding: 14, gap: 6 }}>
              <Text style={styles.body13}>A spreadsheet saved as CSV with a header row. Names are required; email, phone, address, and join date are optional.</Text>
              <Text style={styles.body13}>Anyone on the list owes dues from the first period, so add former members later with a left date instead.</Text>
            </Card>
            <Button title={fileName ? 'Choose a different file…' : 'Choose a file…'} kind={fileName ? 'default' : 'primary'} onPress={pickFile} />
            <Button title="Get the spreadsheet template" kind="link" onPress={shareTemplate} />
          </>
        )}

        {stage === 'names' && (
          <>
            <Text style={styles.h1}>Which columns hold the names?</Text>
            <Text style={styles.lead}>Either first and last, or one full-name column that gets split at the last space.</Text>
            <ChoiceField label={MEMBER_TARGET_LABEL.firstName} value={map.firstName ?? NONE} onChange={pick('firstName')} options={columnOptions(true)} />
            <ChoiceField label={MEMBER_TARGET_LABEL.lastName} value={map.lastName ?? NONE} onChange={pick('lastName')} options={columnOptions(true)} />
            <ChoiceField label={MEMBER_TARGET_LABEL.fullName} value={map.fullName ?? NONE} onChange={pick('fullName')} options={columnOptions(true)} />
          </>
        )}

        {stage === 'details' && (
          <>
            <Text style={styles.h1}>Any of these in the file?</Text>
            <Text style={styles.lead}>Leave anything that is not there as “Not in this file”.</Text>
            {(['email', 'phone', 'address', 'joinDate'] as const).map((t) => (
              <ChoiceField key={t} label={MEMBER_TARGET_LABEL[t]} value={map[t] ?? NONE} onChange={pick(t)} options={columnOptions(true)} />
            ))}
          </>
        )}

        {stage === 'review' && (
          <>
            <Text style={styles.h1}>
              {members.length} member{members.length === 1 ? '' : 's'} ready
            </Text>
            <Card>
              {members.slice(0, 30).map((m, i) => (
                <ListRow key={i} last={i === Math.min(members.length, 30) - 1}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.name}>
                      {m.lastName}
                      {m.lastName && m.firstName ? ', ' : ''}
                      {m.firstName}
                    </Text>
                    <Text style={styles.sub}>{[m.email, m.phone, m.joinDate ? `joined ${m.joinDate}` : null].filter(Boolean).join(' · ') || 'name only'}</Text>
                  </View>
                </ListRow>
              ))}
              {members.length > 30 && (
                <ListRow last>
                  <Text style={styles.sub}>and {members.length - 30} more</Text>
                </ListRow>
              )}
            </Card>
            <Hint>Duplicates are not detected: importing the same file twice adds everyone twice.</Hint>
          </>
        )}

        {stage === 'done' && (
          <Card accent style={{ padding: 16, gap: 6 }}>
            <Text style={styles.h1}>Imported</Text>
            <Text style={styles.body13}>
              {added} member{added === 1 ? '' : 's'} added. They appear on the Members tab and in this period’s dues roster.
            </Text>
          </Card>
        )}

        {error && <ErrorText>{error}</ErrorText>}

        <View style={{ flex: 1, minHeight: 12 }} />

        <View style={styles.footer}>
          {stage === 'names' && <Button title="Back" onPress={() => setStage('pick')} style={{ flex: 1 }} />}
          {stage === 'details' && <Button title="Back" onPress={() => setStage('names')} style={{ flex: 1 }} />}
          {stage === 'review' && <Button title="Back" onPress={() => setStage('details')} style={{ flex: 1 }} />}
          {stage === 'pick' && <Button title="Next" kind="primary" disabled={!fileName} onPress={() => setStage('names')} style={{ flex: 2 }} />}
          {stage === 'names' && <Button title="Next" kind="primary" disabled={!namesOk} onPress={() => setStage('details')} style={{ flex: 2 }} />}
          {stage === 'details' && <Button title="Next" kind="primary" onPress={toReview} style={{ flex: 2 }} />}
          {stage === 'review' && <Button title={`Import ${members.length} member${members.length === 1 ? '' : 's'}`} kind="primary" onPress={doImport} style={{ flex: 2 }} />}
          {stage === 'done' && <Button title="Done" kind="primary" onPress={close} style={{ flex: 1 }} />}
        </View>
      </ScrollView>
    </View>
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
  name: { fontSize: 15, fontWeight: '600', color: color.ink },
  sub: { fontSize: 12, color: color.muted },
  footer: { flexDirection: 'row', gap: 10 }
})
