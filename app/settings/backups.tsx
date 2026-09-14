import { useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { META, getMeta, setMeta } from '../../src/data/meta'
import { useBooks, useQuery } from '../../src/ui/books'
import { Button, Card, ErrorText, Hint, ListRow, Screen, Toggle } from '../../src/ui/components'
import { fmtDate } from '../../src/ui/format'
import { SNAPSHOT_RETENTION, listSnapshots, pickBooksFile, shareCopy, snapshotNow, type SnapshotFile } from '../../src/ui/snapshots'
import { color } from '../../src/ui/theme'

export default function Backups(): React.JSX.Element {
  const { db, bump, restore } = useBooks()
  const enabled = useQuery((d) => getMeta(d, META.snapshotsEnabled) === '1')
  const last = useQuery((d) => getMeta(d, META.lastBackupAt))
  const orgName = useQuery((d) => d.prepare(`SELECT name FROM organization WHERE id = 1`).get<{ name: string }>()?.name ?? 'organization')
  const [tick, setTick] = useState(0)
  const snapshots = useQuery(listSnapshots, [tick])
  const [error, setError] = useState<string | null>(null)

  const run = (fn: () => void | Promise<void>): void => {
    Promise.resolve()
      .then(fn)
      .then(() => {
        setError(null)
        setTick((t) => t + 1)
        bump()
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  const confirmRestore = (what: string, apply: () => void): void => {
    Alert.alert(
      'Restore these books?',
      `This replaces the books on this phone with ${what}. A safety copy of the current books is kept in the snapshot folder.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: () => run(apply) }
      ]
    )
  }

  return (
    <Screen>
      <Card style={{ padding: 16, gap: 12 }}>
        <Toggle
          title="Keep timestamped copies"
          subtitle="One copy each day you use the app"
          value={enabled}
          onValueChange={(v) => run(() => setMeta(db, META.snapshotsEnabled, v ? '1' : '0'))}
        />
        <Text style={styles.body}>
          Copies live in the Duesbook folder you can see in the Files app under On My iPhone. The newest {SNAPSHOT_RETENTION} are kept.
        </Text>
        <Text style={styles.muted}>{last ? `Last copy ${fmtDate(last.slice(0, 10), true)}` : 'No copy has been made yet.'}</Text>
        <View style={styles.row}>
          <Button title="Snapshot now" onPress={() => run(() => void snapshotNow(db))} style={{ flex: 1 }} />
          <Button title="Save a copy…" onPress={() => run(() => shareCopy(db, orgName, false))} style={{ flex: 1 }} />
        </View>
      </Card>

      <Text style={styles.cap}>Restore</Text>
      <Card>
        {snapshots.length === 0 ? (
          <ListRow>
            <Text style={styles.muted}>No snapshots on this phone yet.</Text>
          </ListRow>
        ) : (
          snapshots.map((s: SnapshotFile) => (
            <ListRow key={s.name}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.modifiedAt ? fmtDate(s.modifiedAt.slice(0, 10), true) : s.name}</Text>
                <Text style={styles.muted}>
                  {s.name} · {Math.max(1, Math.round(s.sizeBytes / 1024))} KB
                </Text>
              </View>
              <Button title="Restore" small onPress={() => confirmRestore(`the copy from ${s.modifiedAt ? fmtDate(s.modifiedAt.slice(0, 10), true) : s.name}`, () => restore(s.file))} />
            </ListRow>
          ))
        )}
        <ListRow last>
          <Button
            title="Restore from a file…"
            kind="link"
            onPress={() =>
              run(async () => {
                const file = await pickBooksFile()
                if (file) confirmRestore(`the file ${file.name}`, () => restore(file))
              })
            }
          />
        </ListRow>
      </Card>
      <Hint>A handoff file from another treasurer, or a copy saved elsewhere, restores the same way. Older files are upgraded on open.</Hint>

      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  )
}

const styles = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: color.muted, paddingHorizontal: 4, marginBottom: -6 },
  body: { fontSize: 13, color: color.inkSoft, lineHeight: 19 },
  muted: { fontSize: 12, color: color.muted, marginTop: 2 },
  name: { fontSize: 15, fontWeight: '600', color: color.ink },
  row: { flexDirection: 'row', gap: 8 }
})
