import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { listMembers } from '../../../src/data/members'
import { useQuery } from '../../../src/ui/books'
import { Card, Chip, Header, IconButton, ListRow, Screen, StatusDot } from '../../../src/ui/components'
import { formatCents } from '../../../src/ui/format'
import { useIsWide } from '../../../src/ui/layout'
import { MemberDetailView } from '../../../src/ui/screens/member-detail'
import { EmptyDetail, Split } from '../../../src/ui/split'
import { color } from '../../../src/ui/theme'

export default function Members(): React.JSX.Element {
  const router = useRouter()
  const wide = useIsWide()
  const members = useQuery(listMembers)
  const [search, setSearch] = useState('')
  const [former, setFormer] = useState(false)
  const [chosen, setChosen] = useState<number | null>(null)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter(
      (m) =>
        (former ? m.leftDate !== null : m.leftDate === null) &&
        (!q || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q))
    )
  }, [members, search, former])

  // Tablet: the selected member shows in the detail pane; the first visible one until a tap.
  const selectedId = visible.some((m) => m.id === chosen) ? chosen : (visible[0]?.id ?? null)
  const open = (id: number): void => {
    if (wide) setChosen(id)
    else router.push({ pathname: '/members/[id]', params: { id: String(id) } })
  }

  const list = (
    <Screen>
      <Header
        title="Members"
        right={
          <>
            <IconButton icon="download" label="Import members" onPress={() => router.push('/import-members')} />
            <IconButton icon="plus" primary label="Add member" onPress={() => router.push('/member-edit')} />
          </>
        }
      />
      <View style={styles.search}>
        <Feather name="search" size={16} color={color.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search members"
          placeholderTextColor={color.muted}
          style={styles.searchInput}
        />
      </View>
      <View style={styles.filterBar}>
        <View style={styles.chips}>
          <Chip label="Current" active={!former} onPress={() => setFormer(false)} />
          <Chip label="Former" active={former} onPress={() => setFormer(true)} />
        </View>
        <Text style={styles.count}>
          {visible.length} member{visible.length === 1 ? '' : 's'}
        </Text>
      </View>
      <Card>
        {visible.length === 0 ? (
          <ListRow last>
            <Text style={styles.empty}>{members.length === 0 ? 'No members yet. Tap + to add the first one.' : 'No one matches.'}</Text>
          </ListRow>
        ) : (
          visible.map((m, i) => (
            <ListRow key={m.id} last={i === visible.length - 1} onPress={() => open(m.id)} style={wide && m.id === selectedId && styles.selected}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name}>
                  {m.lastName}
                  {m.lastName && m.firstName ? ', ' : ''}
                  {m.firstName}
                </Text>
                <StatusDot status={m.duesStatus} />
              </View>
              <View style={styles.right}>
                <Text style={[styles.due, m.owedCents <= 0 && styles.dueNone]}>{m.owedCents > 0 ? formatCents(m.owedCents) : '—'}</Text>
                {m.periodsBehind > 0 && (
                  <Text style={styles.behind}>
                    {m.periodsBehind} mo behind
                  </Text>
                )}
              </View>
              {!wide && <Feather name="chevron-right" size={16} color={color.inputBorder} />}
            </ListRow>
          ))
        )}
      </Card>
    </Screen>
  )

  if (!wide) return list
  return (
    <Split
      list={list}
      detail={selectedId === null ? <EmptyDetail text="Select a member to see their contact details and dues history." /> : <MemberDetailView key={selectedId} memberId={selectedId} embedded />}
    />
  )
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.card, borderWidth: 1, borderColor: color.inputBorder, borderRadius: 9, minHeight: 44, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, color: color.ink, paddingVertical: 10 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', gap: 6 },
  count: { fontSize: 12, color: color.muted },
  selected: { backgroundColor: color.greenWash },
  name: { fontSize: 15, fontWeight: '600', color: color.ink },
  right: { alignItems: 'flex-end', gap: 3 },
  due: { fontSize: 15, fontWeight: '700', color: color.ink, fontVariant: ['tabular-nums'] },
  dueNone: { color: color.muted, fontWeight: '500' },
  behind: { fontSize: 11, color: color.dangerSoft },
  empty: { fontSize: 14, color: color.muted }
})
