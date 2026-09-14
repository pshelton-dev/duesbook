import { Text } from 'react-native'
import { META, getMeta, setMeta } from '../../src/data/meta'
import { useBooks, useQuery } from '../../src/ui/books'
import { Card, Hint, Notice, Screen, Toggle } from '../../src/ui/components'
import { fmtDate } from '../../src/ui/format'
import { color } from '../../src/ui/theme'

/**
 * Preference only for now: the snapshot writer (iCloud Drive folder, retention,
 * Snapshot now, Save a copy, Restore) is the next piece of platform work.
 */
export default function Backups(): React.JSX.Element {
  const { db, bump } = useBooks()
  const enabled = useQuery((d) => getMeta(d, META.snapshotsEnabled) === '1')
  const last = useQuery((d) => getMeta(d, META.lastBackupAt))

  return (
    <Screen>
      <Card style={{ padding: 16, gap: 12 }}>
        <Toggle
          title="Keep copies in iCloud Drive"
          subtitle="A timestamped copy each day you use the app"
          value={enabled}
          onValueChange={(v) => {
            setMeta(db, META.snapshotsEnabled, v ? '1' : '0')
            bump()
          }}
        />
        <Text style={{ fontSize: 13, color: color.inkSoft, lineHeight: 19 }}>
          Copies go to your own iCloud Drive, in a Duesbook folder you can see in the Files app. That is the only place anything ever leaves this phone.
        </Text>
        <Text style={{ fontSize: 12, color: color.muted }}>{last ? `Last copy ${fmtDate(last.slice(0, 10), true)}` : 'No copy has been made yet.'}</Text>
      </Card>
      <Notice kind="neutral" text="Snapshot now, Save a copy, and Restore are being built. Until then this phone’s own iCloud Backup is what protects the books." />
      <Hint>Retention and the snapshot folder location will appear here once the writer ships.</Hint>
    </Screen>
  )
}
