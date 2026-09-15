import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { getRoster, listPeriods, listUnallocated } from '../../src/data/dues'
import { useQuery } from '../../src/ui/books'
import {
  Button,
  Card,
  Chip,
  ChoiceField,
  Header,
  ListRow,
  Notice,
  Screen,
  StatusDot,
  SummaryTile
} from '../../src/ui/components'
import { fmtDate, formatCents, formatDollars } from '../../src/ui/format'
import { useIsWide } from '../../src/ui/layout'
import { MemberDetailView } from '../../src/ui/screens/member-detail'
import { EmptyDetail, Split } from '../../src/ui/split'
import { color } from '../../src/ui/theme'

type Filter = 'all' | 'owes' | 'paid'

export default function Dues(): React.JSX.Element {
  const router = useRouter()
  const wide = useIsWide()
  const periods = useQuery(listPeriods)
  const unallocated = useQuery(listUnallocated)
  const [chosenPeriod, setChosenPeriod] = useState<number | null>(null)
  const periodId = chosenPeriod ?? periods.find((p) => p.isCurrent)?.id ?? periods[0]?.id ?? null
  const roster = useQuery((db) => (periodId === null ? null : getRoster(db, periodId)), [periodId])

  const anyOwes = (roster?.rows ?? []).some((r) => r.outstandingCents > 0)
  const [chosenFilter, setChosenFilter] = useState<Filter | null>(null)
  const filter: Filter = chosenFilter ?? (anyOwes ? 'owes' : 'all')
  const [chosenMember, setChosenMember] = useState<number | null>(null)

  const visible = useMemo(() => {
    const rows = roster?.rows ?? []
    const kept =
      filter === 'owes'
        ? rows.filter((r) => r.outstandingCents > 0)
        : filter === 'paid'
          ? rows.filter((r) => r.outstandingCents <= 0 && r.baseCents > 0)
          : rows
    // owing members first, then the desktop's last-name order
    return [...kept].sort((a, b) => Number(b.outstandingCents > 0) - Number(a.outstandingCents > 0))
  }, [roster, filter])

  if (periods.length === 0) {
    return (
      <Screen>
        <Header title="Dues" />
        <Card style={{ padding: 16 }}>
          <Text style={styles.empty}>No dues periods yet. Set up dues in Settings to start tracking who has paid.</Text>
        </Card>
        <Button title="Open Settings" onPress={() => router.push('/settings')} />
      </Screen>
    )
  }

  const summary = roster?.summary

  // Tablet: a row selects the member for the detail pane instead of opening the payment sheet.
  const selectedId = visible.some((r) => r.memberId === chosenMember) ? chosenMember : (visible[0]?.memberId ?? null)
  const open = (memberId: number): void => {
    if (wide) setChosenMember(memberId)
    else router.push({ pathname: '/payment', params: { periodId: String(periodId), memberId: String(memberId) } })
  }

  const list = (
    <Screen>
      <Header title="Dues" />
      <ChoiceField
        label="Period"
        value={periodId}
        onChange={setChosenPeriod}
        options={periods.map((p) => ({
          value: p.id,
          label: `${p.label} · ${formatCents(p.amountCents)}${p.isCurrent ? ' (current)' : ''}`
        }))}
      />

      {summary && (
        <View style={styles.tiles}>
          <SummaryTile label="Collected" value={formatDollars(summary.collectedCents)} positive />
          <SummaryTile label="Outstanding" value={formatDollars(summary.outstandingCents)} />
          <SummaryTile label="Paid in full" value={`${summary.paidCount} of ${summary.expectedCount}`} hero />
        </View>
      )}

      {unallocated.map((u) => (
        <Notice
          key={u.txnId}
          kind="warn"
          text={`${fmtDate(u.date)} · ${formatCents(u.amountCents)}${u.payee ? ` ${u.payee}` : ''} not allocated`}
          action="Allocate"
          onAction={() => router.push({ pathname: '/payment', params: { periodId: String(periodId), txnId: String(u.txnId) } })}
        />
      ))}

      <View style={styles.filterBar}>
        <View style={styles.chips}>
          <Chip label="All" active={filter === 'all'} onPress={() => setChosenFilter('all')} />
          <Chip label="Owes" active={filter === 'owes'} onPress={() => setChosenFilter('owes')} />
          <Chip label="Paid" active={filter === 'paid'} onPress={() => setChosenFilter('paid')} />
        </View>
        <Text style={styles.count}>
          {visible.length} of {roster?.rows.length ?? 0}
        </Text>
      </View>

      <Card>
        {visible.length === 0 ? (
          <ListRow last>
            <Text style={styles.empty}>{filter === 'owes' ? 'Everyone is paid up.' : 'No members in this period.'}</Text>
          </ListRow>
        ) : (
          visible.map((r, i) => (
            <ListRow key={r.memberId} last={i === visible.length - 1} onPress={() => open(r.memberId)} style={wide && r.memberId === selectedId && styles.selected}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name}>
                  {r.lastName}
                  {r.lastName && r.firstName ? ', ' : ''}
                  {r.firstName}
                </Text>
                <View style={styles.statusLine}>
                  <StatusDot status={r.status} />
                  {r.overrideNote ? <Text style={styles.note}>· {r.overrideNote}</Text> : null}
                </View>
              </View>
              <Text style={styles.amt}>{r.outstandingCents > 0 ? formatCents(r.outstandingCents) : '—'}</Text>
            </ListRow>
          ))
        )}
      </Card>

      <Button title="Record payment" kind="primary" onPress={() => router.push({ pathname: '/payment', params: { periodId: String(periodId) } })} />
    </Screen>
  )

  if (!wide) return list
  return (
    <Split
      list={list}
      detail={selectedId === null ? <EmptyDetail text="Select a member to see their dues history." /> : <MemberDetailView key={selectedId} memberId={selectedId} embedded />}
    />
  )
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', gap: 6 },
  count: { fontSize: 12, color: color.muted },
  selected: { backgroundColor: color.greenWash },
  name: { fontSize: 15, fontWeight: '600', color: color.ink },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  note: { fontSize: 11, color: color.muted },
  amt: { fontSize: 15, fontWeight: '700', color: color.ink, fontVariant: ['tabular-nums'] },
  empty: { fontSize: 14, color: color.muted }
})
