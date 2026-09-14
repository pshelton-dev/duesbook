import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { createPeriod, listPeriods, suggestNextPeriod, updatePeriod } from '../src/data/dues'
import { useBooks, useQuery } from '../src/ui/books'
import { AmountField, Button, DateField, ErrorText, Notice, TextField } from '../src/ui/components'
import { parseDollarsToCents } from '../src/ui/format'
import { color } from '../src/ui/theme'

/** Create the next dues period (prefilled from the last) or edit one. */
export default function PeriodEdit(): React.JSX.Element {
  const router = useRouter()
  const { db, bump } = useBooks()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const editId = id ? Number(id) : null
  const existing = useQuery((d) => (editId ? listPeriods(d).find((p) => p.id === editId) ?? null : null), [editId])
  const suggestion = useQuery((d) => (editId ? null : suggestNextPeriod(d)))
  const booksStart = useQuery((d) => d.prepare(`SELECT MIN(opening_date) AS d FROM account`).get<{ d: string | null }>()?.d ?? null)

  const seed = existing ?? suggestion
  const [label, setLabel] = useState(seed?.label ?? '')
  const [startDate, setStartDate] = useState(seed?.startDate ?? '')
  const [endDate, setEndDate] = useState(seed?.endDate ?? '')
  const [amount, setAmount] = useState(seed ? (seed.amountCents / 100).toFixed(2) : '')
  const [error, setError] = useState<string | null>(null)

  function save(): void {
    const cents = parseDollarsToCents(amount || '0')
    if (cents === null) return setError('Enter the dues amount as dollars and cents.')
    try {
      const input = { label, startDate, endDate, amountCents: cents }
      if (editId) updatePeriod(db, editId, input)
      else createPeriod(db, input)
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
          <Text style={styles.title}>{editId ? 'Edit period' : 'New dues period'}</Text>
          <Button title="Cancel" kind="link" onPress={() => router.back()} />
        </View>
        <TextField label="Label" value={label} onChangeText={setLabel} placeholder="Oct 2026" />
        <View style={styles.twoUp}>
          <View style={{ flex: 1 }}>
            <DateField label="Starts" value={startDate || '2026-01-01'} onChange={setStartDate} />
          </View>
          <View style={{ flex: 1 }}>
            <DateField label="Ends" value={endDate || '2026-01-31'} onChange={setEndDate} />
          </View>
        </View>
        <AmountField label="Dues amount" value={amount} onChangeText={setAmount} />
        {booksStart && startDate && startDate < booksStart && (
          <Notice kind="warn" text={`This period starts before the books do (${booksStart}). Members will owe for months you have no records for.`} />
        )}
        {error && <ErrorText>{error}</ErrorText>}
        <Button title={editId ? 'Save changes' : 'Create period'} kind="primary" onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: color.bg },
  body: { padding: 16, paddingTop: 12, gap: 14, paddingBottom: 40 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: color.ink, letterSpacing: -0.3 },
  twoUp: { flexDirection: 'row', gap: 10 }
})
