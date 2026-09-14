import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { getRoster, listPeriods, listUnallocated, recordPayment } from '../src/data/dues'
import { listAccounts } from '../src/data/ledger'
import { META, getMeta, setMeta } from '../src/data/meta'
import { useBooks, useQuery } from '../src/ui/books'
import { AmountField, Button, Card, ChoiceField, DateField, ErrorText, ListRow, StatusDot, TextField } from '../src/ui/components'
import { fmtDate, formatCents, parseDollarsToCents, todayIso } from '../src/ui/format'
import { color } from '../src/ui/theme'

interface Picked {
  memberId: number
  name: string
  amount: string
}

/**
 * The ten-second flow. Opened from a roster row everything is prefilled:
 * member, amount owed, the account used last time, today's date. Also serves
 * "allocate this existing deposit" when a txnId is passed.
 */
export default function Payment(): React.JSX.Element {
  const router = useRouter()
  const { db, bump } = useBooks()
  const params = useLocalSearchParams<{ periodId?: string; memberId?: string; txnId?: string }>()

  const periods = useQuery(listPeriods)
  const periodId = Number(params.periodId) || periods.find((p) => p.isCurrent)?.id || periods[0]?.id || 0
  const period = periods.find((p) => p.id === periodId)
  const roster = useQuery((d) => (periodId ? getRoster(d, periodId).rows : []), [periodId])
  const accounts = useQuery((d) => listAccounts(d).filter((a) => a.isActive))
  const allocate = useQuery((d) => (params.txnId ? listUnallocated(d).find((u) => u.txnId === Number(params.txnId)) ?? null : null))
  const lastAccount = useQuery((d) => Number(getMeta(d, META.lastPaymentAccountId)) || null)

  const toPicked = (memberId: number): Picked | null => {
    const r = roster.find((x) => x.memberId === memberId)
    if (!r) return null
    return {
      memberId,
      name: `${r.firstName} ${r.lastName}`.trim(),
      amount: r.outstandingCents > 0 ? (r.outstandingCents / 100).toFixed(2) : ''
    }
  }

  const [picked, setPicked] = useState<Picked[]>(() => {
    const first = params.memberId ? toPicked(Number(params.memberId)) : null
    return first ? [first] : []
  })
  const [query, setQuery] = useState('')
  const [accountId, setAccountId] = useState<number | null>(
    () => accounts.find((a) => a.id === lastAccount)?.id ?? accounts[0]?.id ?? null
  )
  const [date, setDate] = useState(todayIso())
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return roster
      .filter((r) => !picked.some((p) => p.memberId === r.memberId) && `${r.firstName} ${r.lastName}`.toLowerCase().includes(q))
      .slice(0, 6)
  }, [query, roster, picked])

  const totalCents = picked.reduce((s, p) => s + (parseDollarsToCents(p.amount) ?? 0), 0)
  const remaining = allocate ? allocate.amountCents - allocate.allocatedCents : null

  function save(): void {
    const allocations: { memberId: number; amountCents: number }[] = []
    for (const p of picked) {
      const cents = parseDollarsToCents(p.amount)
      if (cents === null || cents <= 0) {
        setError(`Enter an amount for ${p.name}.`)
        return
      }
      allocations.push({ memberId: p.memberId, amountCents: cents })
    }
    setBusy(true)
    setError(null)
    try {
      recordPayment(db, {
        periodId,
        allocations,
        txnId: allocate?.txnId ?? null,
        accountId: allocate ? null : accountId,
        date: allocate ? null : date,
        memo: allocate ? null : memo.trim() || null
      })
      if (!allocate && accountId) setMeta(db, META.lastPaymentAccountId, String(accountId))
      bump()
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={styles.title}>{allocate ? 'Allocate deposit' : 'Record payment'}</Text>
          <Button title="Cancel" kind="link" onPress={() => router.back()} />
        </View>
        {period && <Text style={styles.periodLine}>{period.label} · {formatCents(period.amountCents)} per member</Text>}

        {allocate && (
          <Card style={{ padding: 14 }}>
            <Text style={styles.allocLine}>
              {fmtDate(allocate.date)} · {formatCents(allocate.amountCents)} into {allocate.accountName}
              {allocate.payee ? ` · ${allocate.payee}` : ''}
            </Text>
            <Text style={styles.hint}>{formatCents(remaining!)} left to allocate.</Text>
          </Card>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>{picked.length ? 'Members' : 'Member'}</Text>
          <Card>
            {picked.map((p) => (
              <ListRow key={p.memberId}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  {(() => {
                    const r = roster.find((x) => x.memberId === p.memberId)
                    return r ? (
                      <StatusDot
                        status={r.status}
                        text={r.outstandingCents > 0 ? `Owes ${formatCents(r.outstandingCents)}` : 'Paid up'}
                      />
                    ) : null
                  })()}
                </View>
                <View style={styles.amountBox}>
                  <TextInput
                    value={p.amount}
                    onChangeText={(t) => setPicked(picked.map((x) => (x.memberId === p.memberId ? { ...x, amount: t } : x)))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={color.muted}
                    style={styles.amountInput}
                  />
                </View>
                <Button title="Remove" kind="link" small onPress={() => setPicked(picked.filter((x) => x.memberId !== p.memberId))} />
              </ListRow>
            ))}
            <View style={styles.search}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={picked.length ? 'Add another member…' : 'Type a name…'}
                placeholderTextColor={color.green}
                autoFocus={picked.length === 0}
                style={styles.searchInput}
              />
            </View>
            {matches.map((r, i) => (
              <ListRow
                key={r.memberId}
                last={i === matches.length - 1}
                onPress={() => {
                  const p = toPicked(r.memberId)
                  if (p) setPicked([...picked, p])
                  setQuery('')
                }}
              >
                <Text style={[styles.name, { flex: 1 }]}>
                  {r.firstName} {r.lastName}
                </Text>
                <Text style={styles.hint}>{r.outstandingCents > 0 ? `owes ${formatCents(r.outstandingCents)}` : 'paid up'}</Text>
              </ListRow>
            ))}
          </Card>
        </View>

        {!allocate && (
          <>
            <ChoiceField
              label="Into account"
              value={accountId}
              onChange={setAccountId}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              trailing={accountId === lastAccount ? 'last used' : undefined}
            />
            <View style={styles.twoUp}>
              <View style={{ flex: 1 }}>
                <DateField label="Date" value={date} onChange={setDate} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Check # / note" value={memo} onChangeText={setMemo} placeholder="optional" />
              </View>
            </View>
          </>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCents(totalCents)}</Text>
        </View>

        {error && <ErrorText>{error}</ErrorText>}

        <Button
          title={busy ? 'Saving…' : allocate ? 'Allocate' : 'Save payment'}
          kind="primary"
          disabled={busy || picked.length === 0}
          onPress={save}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: color.bg },
  body: { padding: 16, paddingTop: 12, gap: 14, paddingBottom: 40 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: color.ink, letterSpacing: -0.3 },
  periodLine: { fontSize: 12, color: color.muted, marginTop: -8 },
  allocLine: { fontSize: 14, color: color.ink },
  hint: { fontSize: 12, color: color.muted, marginTop: 2 },
  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: '600', color: color.muted },
  name: { fontSize: 15, fontWeight: '600', color: color.ink },
  amountBox: { width: 96, height: 44, borderWidth: 1, borderColor: color.inputBorder, borderRadius: 9, backgroundColor: color.card, justifyContent: 'center', paddingHorizontal: 10 },
  amountInput: { fontSize: 17, fontWeight: '700', color: color.ink, textAlign: 'right', fontVariant: ['tabular-nums'] },
  search: { paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.rule },
  searchInput: { fontSize: 14, fontWeight: '600', color: color.ink, paddingVertical: 10 },
  twoUp: { flexDirection: 'row', gap: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  totalLabel: { fontSize: 13, color: color.muted2 },
  totalValue: { fontSize: 20, fontWeight: '700', color: color.ink, fontVariant: ['tabular-nums'] }
})
