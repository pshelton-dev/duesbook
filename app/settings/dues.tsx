import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { listPeriods } from '../../src/data/dues'
import { setArrearsThreshold } from '../../src/data/settings'
import { useBooks, useQuery } from '../../src/ui/books'
import { Button, Card, ChoiceField, Hint, ListRow, Screen } from '../../src/ui/components'
import { fmtDate, formatCents } from '../../src/ui/format'
import { color } from '../../src/ui/theme'

export default function DuesSettings(): React.JSX.Element {
  const router = useRouter()
  const { db, bump } = useBooks()
  const threshold = useQuery((d) => d.prepare(`SELECT arrears_threshold AS t FROM organization WHERE id = 1`).get<{ t: number }>()?.t ?? 2)
  const periods = useQuery(listPeriods)

  return (
    <Screen>
      <ChoiceField
        label="Flag members behind on dues after"
        value={threshold}
        onChange={(v) => {
          setArrearsThreshold(db, v)
          bump()
        }}
        options={[1, 2, 3, 4, 6, 12].map((n) => ({ value: n, label: `${n} period${n === 1 ? '' : 's'}` }))}
        hint="Shown as the Behind-on-dues list on Home."
      />

      <View style={styles.head}>
        <Text style={styles.cap}>Periods</Text>
        <Button title="New period" small onPress={() => router.push('/period-edit')} />
      </View>
      <Card>
        {periods.length === 0 ? (
          <ListRow last>
            <Text style={styles.sub}>No periods yet. Create the first one and later ones follow automatically.</Text>
          </ListRow>
        ) : (
          periods.map((p, i) => (
            <ListRow key={p.id} last={i === periods.length - 1} onPress={() => router.push({ pathname: '/period-edit', params: { id: String(p.id) } })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  {p.label}
                  {p.isCurrent ? '  ·  current' : ''}
                </Text>
                <Text style={styles.sub}>
                  {fmtDate(p.startDate, true)} to {fmtDate(p.endDate, true)} · {formatCents(p.amountCents)}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={color.inputBorder} />
            </ListRow>
          ))
        )}
      </Card>
      <Hint>New periods create themselves as months roll over, copying the last period’s length and amount. Change the amount on the newest period and every later one follows.</Hint>
    </Screen>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cap: { fontSize: 11, fontWeight: '700', color: color.muted, paddingHorizontal: 4 },
  title: { fontSize: 15, fontWeight: '600', color: color.ink },
  sub: { fontSize: 12, color: color.muted, marginTop: 2 }
})
