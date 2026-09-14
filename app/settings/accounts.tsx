import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { listAccounts } from '../../src/data/ledger'
import { useQuery } from '../../src/ui/books'
import { Card, Hint, ListRow, Screen } from '../../src/ui/components'
import { fmtDate, formatCents } from '../../src/ui/format'
import { color } from '../../src/ui/theme'

export default function Accounts(): React.JSX.Element {
  const router = useRouter()
  const accounts = useQuery(listAccounts)
  return (
    <Screen>
      <Card>
        {accounts.map((a, i) => (
          <ListRow key={a.id} last={i === accounts.length - 1} onPress={() => router.push({ pathname: '/account-edit', params: { id: String(a.id) } })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {a.name}
                {!a.isActive ? ' · closed' : ''}
              </Text>
              <Text style={styles.sub}>
                {a.type} · opened at {formatCents(a.openingBalanceCents)} on {fmtDate(a.openingDate, true)} · now {formatCents(a.balanceCents)}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={color.inputBorder} />
          </ListRow>
        ))}
      </Card>
      <Hint>Tap an account to rename it or restrike its opening balance and date. That is the repair path when the books start later than the first entries.</Hint>
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '600', color: color.ink },
  sub: { fontSize: 12, color: color.muted, marginTop: 2 }
})
