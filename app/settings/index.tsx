import { Feather } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { Stack, useRouter, type Href } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { listPeriods } from '../../src/data/dues'
import { listAccounts, listCategories } from '../../src/data/ledger'
import { META, getMeta } from '../../src/data/meta'
import { useBooks, useQuery } from '../../src/ui/books'
import { Button, Card, ListRow, Screen } from '../../src/ui/components'
import { shareCopy } from '../../src/ui/snapshots'
import { fmtDate, formatCents } from '../../src/ui/format'
import { MONTH_NAMES } from '../../src/shared/fiscal'
import { color } from '../../src/ui/theme'

export default function SettingsHome(): React.JSX.Element {
  const router = useRouter()
  const { db } = useBooks()
  const org = useQuery((db) =>
    db
      .prepare(`SELECT name, fiscal_year_start_month AS fy, arrears_threshold AS threshold FROM organization WHERE id = 1`)
      .get<{ name: string; fy: number; threshold: number }>()
  )
  const accounts = useQuery((db) => listAccounts(db).filter((a) => a.isActive))
  const categories = useQuery((db) => listCategories(db).filter((c) => c.isActive))
  const periods = useQuery(listPeriods)
  const snapshots = useQuery((db) => getMeta(db, META.snapshotsEnabled) === '1')
  const lastBackup = useQuery((db) => getMeta(db, META.lastBackupAt))
  const current = periods.find((p) => p.isCurrent) ?? periods[0]

  const Row = ({ title, sub, href, last = false }: { title: string; sub: string; href?: Href; last?: boolean }): React.JSX.Element => (
    <ListRow last={last} onPress={href ? () => router.push(href) : undefined}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      {href && <Feather name="chevron-right" size={16} color={color.inputBorder} />}
    </ListRow>
  )

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <Button title="Done" kind="link" onPress={() => router.dismiss()} /> }} />
      <Screen>
        <Text style={styles.cap}>Books</Text>
        <Card>
          <Row title="Organization" sub={`${org?.name ?? ''} · fiscal year from ${MONTH_NAMES[(org?.fy ?? 1) - 1]}`} href="/settings/organization" />
          <Row title="Accounts" sub={accounts.map((a) => a.name).join(', ') || 'None'} href="/settings/accounts" />
          <Row title="Categories" sub={`${categories.length} active`} href="/settings/categories" />
          <Row
            title="Dues"
            sub={current ? `${current.label} · ${formatCents(current.amountCents)} · flag members ${org?.threshold ?? 2} periods behind` : 'Not set up'}
            href="/settings/dues"
            last
          />
        </Card>

        <Text style={styles.cap}>Safety</Text>
        <Card>
          <Row
            title="Backups"
            sub={`${snapshots ? 'iCloud Drive copies on' : 'Copies off'} · ${lastBackup ? `last copy ${fmtDate(lastBackup.slice(0, 10), true)}` : 'no copy yet'}`}
            href="/settings/backups"
          />
          <ListRow onPress={() => shareCopy(db, org?.name ?? 'organization', true).catch(() => undefined)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Handoff</Text>
              <Text style={styles.sub}>Export for the next treasurer</Text>
            </View>
            <Feather name="share" size={16} color={color.muted} />
          </ListRow>
          <Row title="Restore" sub="Open a snapshot, a saved copy, or a handoff file" href="/settings/backups" last />
        </Card>

        <Text style={styles.cap}>About</Text>
        <Card>
          <Row title={`Duesbook ${Constants.expoConfig?.version ?? ''}`} sub="Free and open source · MIT license" />
          <Row title="Privacy" sub="Nothing leaves this phone except your own iCloud copies" last />
        </Card>
      </Screen>
    </>
  )
}

const styles = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: color.muted, paddingHorizontal: 4, marginBottom: -6 },
  title: { fontSize: 15, fontWeight: '600', color: color.ink },
  sub: { fontSize: 12, color: color.muted, marginTop: 2 }
})
