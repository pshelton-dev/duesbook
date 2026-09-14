import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { createTxn, deleteTxn, listAccounts, listCategories, listTxns, updateTxn } from '../src/data/ledger'
import type { TxnType } from '../src/shared/types'
import { useBooks, useQuery } from '../src/ui/books'
import { AmountField, Button, ChoiceField, DateField, ErrorText, Segmented, TextField, Toggle } from '../src/ui/components'
import { parseDollarsToCents, todayIso } from '../src/ui/format'
import { color } from '../src/ui/theme'

/**
 * New-transaction and edit-transaction sheet. Amount first, because that is
 * what the treasurer knows when they open it. Income in the system Dues
 * category hands off to the allocate sheet on save, as the desktop did.
 */
export default function TxnEdit(): React.JSX.Element {
  const router = useRouter()
  const { db, bump } = useBooks()
  const params = useLocalSearchParams<{ id?: string; accountId?: string }>()
  const editId = params.id ? Number(params.id) : null

  const accounts = useQuery((d) => listAccounts(d).filter((a) => a.isActive))
  const categories = useQuery((d) => listCategories(d).filter((c) => c.isActive))
  const existing = useQuery(
    (d) => {
      if (!editId) return null
      for (const a of listAccounts(d)) {
        const row = listTxns(d, a.id, {}).find((t) => t.id === editId)
        if (row) return { ...row, accountId: a.id }
      }
      return null
    },
    [editId]
  )

  const [type, setType] = useState<TxnType>(existing?.type ?? 'expense')
  const [amount, setAmount] = useState(existing ? (Math.abs(existing.amountCents) / 100).toFixed(2) : '')
  const [categoryId, setCategoryId] = useState<number | null>(existing?.categoryId ?? null)
  const [payee, setPayee] = useState(existing?.payee ?? '')
  const [accountId, setAccountId] = useState<number | null>(existing?.accountId ?? (Number(params.accountId) || accounts[0]?.id || null))
  const [otherAccountId, setOtherAccountId] = useState<number | null>(null)
  const [direction, setDirection] = useState<'out' | 'in'>('out')
  const [date, setDate] = useState(existing?.date ?? todayIso())
  const [memo, setMemo] = useState(existing?.memo ?? '')
  const [cleared, setCleared] = useState(existing?.cleared ?? false)
  const [error, setError] = useState<string | null>(null)

  const kind = type === 'income' ? 'income' : 'expense'
  const categoryOptions = categories.filter((c) => c.kind === kind).map((c) => ({ value: c.id, label: c.name }))
  const duesCategory = categories.find((c) => c.isSystem && c.name === 'Dues')

  function save(): void {
    const cents = parseDollarsToCents(amount)
    if (cents === null || cents <= 0) return setError('Enter an amount greater than zero.')
    try {
      if (editId) {
        updateTxn(db, { id: editId, date, amountCents: cents, categoryId: type === 'transfer' ? null : categoryId, payee: payee || null, memo: memo || null, cleared })
        bump()
        router.back()
        return
      }
      if (!accountId) return setError('Choose an account.')
      const newId = createTxn(db, {
        accountId,
        date,
        amountCents: cents,
        type,
        categoryId: type === 'transfer' ? null : categoryId,
        payee: payee || null,
        memo: memo || null,
        cleared,
        transferAccountId: type === 'transfer' ? (otherAccountId ?? undefined) : undefined,
        transferDirection: type === 'transfer' ? direction : undefined
      })
      bump()
      if (type === 'income' && duesCategory && categoryId === duesCategory.id) {
        router.replace({ pathname: '/payment', params: { txnId: String(newId) } })
      } else {
        router.back()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function remove(): void {
    if (!editId) return
    try {
      deleteTxn(db, editId)
      bump()
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const saveTitle = editId ? 'Save changes' : type === 'income' ? 'Save income' : type === 'expense' ? 'Save expense' : 'Save transfer'

  return (
    <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={styles.title}>{editId ? 'Edit transaction' : 'New transaction'}</Text>
          <Button title="Cancel" kind="link" onPress={() => router.back()} />
        </View>

        {!editId ? (
          <Segmented
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
              { value: 'transfer', label: 'Transfer' }
            ]}
            value={type}
            onChange={(v) => {
              setType(v)
              setCategoryId(null)
            }}
          />
        ) : (
          <Text style={styles.typeLine}>{type === 'transfer' ? `Transfer with ${existing?.peerAccountName ?? 'another account'}` : type === 'income' ? 'Income' : 'Expense'}</Text>
        )}

        <AmountField label="Amount" value={amount} onChangeText={setAmount} autoFocus={!editId} large />

        {type !== 'transfer' && (
          <ChoiceField label="Category" value={categoryId} onChange={setCategoryId} options={categoryOptions} placeholder="Pick a category" />
        )}

        {type === 'transfer' && !editId && (
          <>
            <Segmented
              options={[
                { value: 'out', label: 'Money leaves this account' },
                { value: 'in', label: 'Money arrives here' }
              ]}
              value={direction}
              onChange={setDirection}
            />
            <ChoiceField
              label={direction === 'out' ? 'To account' : 'From account'}
              value={otherAccountId}
              onChange={setOtherAccountId}
              options={accounts.filter((a) => a.id !== accountId).map((a) => ({ value: a.id, label: a.name }))}
            />
          </>
        )}

        {type !== 'transfer' && <TextField label={type === 'income' ? 'Received from' : 'Paid to'} value={payee} onChangeText={setPayee} placeholder="optional" />}

        <View style={styles.twoUp}>
          {!editId && (
            <View style={{ flex: 1 }}>
              <ChoiceField label={type === 'transfer' ? 'This account' : 'Account'} value={accountId} onChange={setAccountId} options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <DateField label="Date" value={date} onChange={setDate} />
          </View>
        </View>

        <TextField label="Memo" value={memo} onChangeText={setMemo} placeholder="optional · check # or note" />
        <Toggle title="Cleared" subtitle="Already on the bank statement" value={cleared} onValueChange={setCleared} />

        {error && <ErrorText>{error}</ErrorText>}

        <Button title={saveTitle} kind="primary" onPress={save} />
        {editId && <Button title="Delete transaction" kind="danger" onPress={remove} />}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: color.bg },
  body: { padding: 16, paddingTop: 12, gap: 14, paddingBottom: 40 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: color.ink, letterSpacing: -0.3 },
  typeLine: { fontSize: 13, color: color.muted2, marginTop: -6 },
  twoUp: { flexDirection: 'row', gap: 10 }
})
