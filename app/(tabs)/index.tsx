import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { META, getMeta } from '../../src/data/meta'
import { homeSummary } from '../../src/data/home'
import { useQuery } from '../../src/ui/books'
import {
  Card,
  Header,
  ListRow,
  Notice,
  PinnedButton,
  ProgressBar,
  Screen,
  SectionTitle
} from '../../src/ui/components'
import { fmtDate, formatCents, formatDollars } from '../../src/ui/format'
import { color, shadowStrong } from '../../src/ui/theme'

export default function Home(): React.JSX.Element {
  const router = useRouter()
  const summary = useQuery(homeSummary)
  const orgName = useQuery((db) => db.prepare(`SELECT name FROM organization WHERE id = 1`).get<{ name: string }>()?.name ?? 'Duesbook')
  const snapshotsOn = useQuery((db) => getMeta(db, META.snapshotsEnabled) === '1')

  const total = summary.accounts.reduce((s, a) => s + a.balanceCents, 0)
  const dues = summary.dues
  const arrears = summary.arrears.members
  const shown = arrears.slice(0, 2)

  return (
    <>
      <Screen bottomInset={72}>
        <Header
          title={orgName}
          right={
            <Pressable onPress={() => router.push('/settings')} accessibilityLabel="Settings" style={styles.gear}>
              <Feather name="settings" size={24} color={color.muted2} />
            </Pressable>
          }
        />

        {dues && (
          <Pressable onPress={() => router.push('/dues')}>
            <Card accent style={styles.duesCard}>
              <View style={styles.duesHead}>
                <Text style={styles.duesTitle}>Dues · {summary.duesPeriodLabel}</Text>
                <Feather name="chevron-right" size={16} color={color.muted} />
              </View>
              <ProgressBar fraction={dues.expectedCount ? dues.paidCount / dues.expectedCount : 0} />
              <Text style={styles.duesSub}>
                {dues.paidCount} of {dues.expectedCount} paid · {formatCents(dues.collectedCents)} collected ·{' '}
                {formatCents(dues.outstandingCents)} outstanding
              </Text>
            </Card>
          </Pressable>
        )}

        {arrears.length > 0 && (
          <View style={styles.arrears}>
            <View style={styles.arrearsHead}>
              <View style={styles.diamond} />
              <Text style={styles.arrearsTitle}>Behind on dues</Text>
            </View>
            {shown.map((m) => (
              <View key={m.memberId} style={styles.arrearsRow}>
                <Text style={styles.arrearsWho}>
                  {m.firstName} {m.lastName}{' '}
                  <Text style={styles.arrearsMonths}>· {m.periodsBehind} mo behind</Text>
                </Text>
                <Text style={styles.arrearsAmt}>{formatCents(m.owedCents)}</Text>
              </View>
            ))}
            {arrears.length > shown.length && (
              <Text style={styles.arrearsMore}>and {arrears.length - shown.length} more</Text>
            )}
          </View>
        )}

        <View style={styles.balances}>
          {summary.accounts.map((a) => (
            <View key={a.id} style={styles.balance}>
              <Text style={styles.balanceLabel}>{a.name}</Text>
              <Text style={styles.balanceValue}>{formatDollars(a.balanceCents)}</Text>
            </View>
          ))}
          {summary.accounts.length > 1 && (
            <View style={[styles.balance, styles.balanceTotal]}>
              <Text style={[styles.balanceLabel, { color: 'rgba(255,255,255,0.8)' }]}>Total</Text>
              <Text style={[styles.balanceValue, { color: color.white }]}>{formatDollars(total)}</Text>
            </View>
          )}
        </View>

        {!snapshotsOn && (
          <Notice
            kind="warn"
            text="No copies of your books are being kept yet."
            action="Set up"
            onAction={() => router.push('/settings')}
          />
        )}
        {summary.unallocatedCount > 0 && (
          <Notice
            kind="warn"
            text={`${summary.unallocatedCount} dues deposit${summary.unallocatedCount > 1 ? 's' : ''} not yet allocated to members.`}
            action="Allocate"
            onAction={() => router.push('/dues')}
          />
        )}

        <SectionTitle>Recent activity</SectionTitle>
        <Card>
          {summary.recent.length === 0 ? (
            <ListRow last>
              <Text style={styles.empty}>No transactions yet.</Text>
            </ListRow>
          ) : (
            summary.recent.slice(0, 5).map((r, i, arr) => (
              <ListRow key={r.id} last={i === arr.length - 1} onPress={() => router.push('/ledger')}>
                <View style={styles.tile} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentText}>{r.description || '—'}</Text>
                  <Text style={styles.recentMeta}>
                    {fmtDate(r.date)} · {r.categoryName ?? 'Transfer'} · {r.accountName}
                  </Text>
                </View>
                <Text style={[styles.recentAmt, r.amountCents > 0 && { color: color.green }]}>{formatCents(r.amountCents)}</Text>
              </ListRow>
            ))
          )}
        </Card>
      </Screen>
      <PinnedButton title="Record a payment" onPress={() => router.push('/payment')} />
    </>
  )
}

const styles = StyleSheet.create({
  gear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  duesCard: { padding: 16, paddingLeft: 17, gap: 8 },
  duesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  duesTitle: { fontSize: 15, fontWeight: '700', color: color.ink },
  duesSub: { fontSize: 12.5, color: color.muted },
  arrears: { backgroundColor: color.dangerBg, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12 },
  arrearsHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  diamond: { width: 8, height: 8, backgroundColor: color.danger2, transform: [{ rotate: '45deg' }] },
  arrearsTitle: { fontSize: 14, fontWeight: '700', color: color.danger },
  arrearsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  arrearsWho: { fontSize: 14, color: color.ink },
  arrearsMonths: { fontSize: 11, color: color.dangerSoft },
  arrearsAmt: { fontSize: 14, fontWeight: '700', color: color.danger, fontVariant: ['tabular-nums'] },
  arrearsMore: { fontSize: 12, color: color.dangerSoft, paddingTop: 2 },
  balances: { flexDirection: 'row', gap: 10 },
  balance: { flex: 1, backgroundColor: color.card, borderRadius: 14, padding: 14, paddingHorizontal: 12, shadowColor: '#143c1e', shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 4 } },
  balanceTotal: { backgroundColor: color.green, ...shadowStrong },
  balanceLabel: { fontSize: 11, fontWeight: '600', color: color.muted },
  balanceValue: { fontSize: 18, fontWeight: '700', color: color.ink, marginTop: 4, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  tile: { width: 22, height: 22, borderRadius: 7, backgroundColor: color.greenWash },
  recentText: { fontSize: 14, color: color.ink },
  recentMeta: { fontSize: 11, color: color.muted, marginTop: 1 },
  recentAmt: { fontSize: 14, fontWeight: '600', color: color.ink, fontVariant: ['tabular-nums'] },
  empty: { fontSize: 14, color: color.muted }
})
