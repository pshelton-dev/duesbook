import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { listAccounts, updateAccount } from '../src/data/ledger'
import { useBooks, useQuery } from '../src/ui/books'
import { AmountField, Button, DateField, ErrorText, Notice, TextField } from '../src/ui/components'
import { parseDollarsToCents } from '../src/ui/format'
import { color } from '../src/ui/theme'

/** Rename an account or restrike its opening balance and as-of date. */
export default function AccountEdit(): React.JSX.Element {
  const router = useRouter()
  const { db, bump } = useBooks()
  const { id } = useLocalSearchParams<{ id: string }>()
  const accountId = Number(id)
  const account = useQuery((d) => listAccounts(d).find((a) => a.id === accountId) ?? null, [accountId])
  const earliest = useQuery(
    (d) => d.prepare(`SELECT MIN(date) AS d FROM txn WHERE account_id = ?`).get<{ d: string | null }>(accountId)?.d ?? null,
    [accountId]
  )

  const [name, setName] = useState(account?.name ?? '')
  const [balance, setBalance] = useState(account ? (account.openingBalanceCents / 100).toFixed(2) : '')
  const [date, setDate] = useState(account?.openingDate ?? '')
  const [error, setError] = useState<string | null>(null)

  function save(): void {
    const cents = parseDollarsToCents(balance || '0')
    if (cents === null) return setError('Enter the opening balance as dollars and cents.')
    try {
      updateAccount(db, accountId, { name, openingBalanceCents: cents, openingDate: date })
      bump()
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={styles.title}>Edit account</Text>
          <Button title="Cancel" kind="link" onPress={() => router.back()} />
        </View>
        <TextField label="Name" value={name} onChangeText={setName} />
        <AmountField label="Opening balance" value={balance} onChangeText={setBalance} />
        <DateField label="As of" value={date} onChange={setDate} hint="The statement date the opening balance comes from." />
        {earliest && date && earliest < date && (
          <Notice kind="warn" text={`This account has transactions from ${earliest}, before the opening date. The balance will double-count them until you move the date earlier.`} />
        )}
        {error && <ErrorText>{error}</ErrorText>}
        <Button title="Save" kind="primary" onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: color.bg },
  body: { padding: 16, paddingTop: 12, gap: 14, paddingBottom: 40 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: color.ink, letterSpacing: -0.3 }
})
