import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { listAccounts, listCategories, listTxns } from '../../src/data/ledger'
import { useQuery } from '../../src/ui/books'
import { Card, Chip, ChoiceField, DateField, Header, IconButton, ListRow, Screen, Segmented } from '../../src/ui/components'
import { fmtDate, formatCents } from '../../src/ui/format'
import { color } from '../../src/ui/theme'

export default function Ledger(): React.JSX.Element {
  const router = useRouter()
  const accounts = useQuery((db) => listAccounts(db).filter((a) => a.isActive))
  const categories = useQuery(listCategories)
  const [chosenAccount, setChosenAccount] = useState<number | null>(null)
  const accountId = chosenAccount ?? accounts[0]?.id ?? null
  const account = accounts.find((a) => a.id === accountId) ?? null

  const [search, setSearch] = useState('')
  const [unclearedOnly, setUnclearedOnly] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const rows = useQuery(
    (db) =>
      accountId === null
        ? []
        : listTxns(db, accountId, {
            search: search || undefined,
            unclearedOnly: unclearedOnly || undefined,
            categoryId: categoryId ?? undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined
          }),
    [accountId, search, unclearedOnly, categoryId, dateFrom, dateTo]
  )

  const filtersOn = categoryId !== null || dateFrom !== '' || dateTo !== ''

  return (
    <Screen>
      <Header
        title="Ledger"
        right={
          <>
            <IconButton
              icon="download"
              label="Import from bank file"
              onPress={() => router.push({ pathname: '/import', params: accountId ? { accountId: String(accountId) } : {} })}
            />
            <IconButton
              icon="plus"
              primary
              label="New transaction"
              onPress={() => router.push({ pathname: '/txn-edit', params: accountId ? { accountId: String(accountId) } : {} })}
            />
          </>
        }
      />

      {accounts.length > 1 && (
        <Segmented
          options={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
          value={String(accountId)}
          onChange={(v) => setChosenAccount(Number(v))}
        />
      )}

      {account && (
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>{account.name} balance</Text>
          <Text style={styles.balanceValue}>{formatCents(account.balanceCents)}</Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Feather name="search" size={16} color={color.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search payee or memo" placeholderTextColor={color.muted} style={styles.searchInput} />
        </View>
        <Chip label={filtersOn ? 'Filter •' : 'Filter'} active={showFilter} onPress={() => setShowFilter(!showFilter)} />
      </View>

      <View style={styles.chips}>
        <Chip label="Uncleared only" active={unclearedOnly} onPress={() => setUnclearedOnly(!unclearedOnly)} />
      </View>

      {showFilter && (
        <Card style={styles.filterPanel}>
          <ChoiceField
            label="Category"
            value={categoryId ?? 0}
            onChange={(v) => setCategoryId(v === 0 ? null : v)}
            options={[{ value: 0, label: 'All categories' }, ...categories.filter((c) => c.isActive).map((c) => ({ value: c.id, label: `${c.name} · ${c.kind}` }))]}
          />
          <View style={styles.twoUp}>
            <View style={{ flex: 1 }}>
              <DateField label="From" value={dateFrom || '2000-01-01'} onChange={setDateFrom} />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="To" value={dateTo || '2099-12-31'} onChange={setDateTo} />
            </View>
          </View>
          {filtersOn && (
            <Chip
              label="Clear filters"
              active={false}
              onPress={() => {
                setCategoryId(null)
                setDateFrom('')
                setDateTo('')
              }}
            />
          )}
        </Card>
      )}

      <Card>
        {rows.length === 0 ? (
          <ListRow last>
            <Text style={styles.empty}>{account ? 'No transactions match.' : 'No accounts yet.'}</Text>
          </ListRow>
        ) : (
          rows.map((t, i) => (
            <ListRow key={t.id} last={i === rows.length - 1} onPress={() => router.push({ pathname: '/txn-edit', params: { id: String(t.id) } })}>
              <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                <Text style={styles.payee} numberOfLines={1}>
                  {t.type === 'transfer'
                    ? `Transfer ${t.amountCents < 0 ? 'to' : 'from'} ${t.peerAccountName ?? 'account'}`
                    : t.payee || '—'}
                </Text>
                <View style={styles.meta}>
                  {t.cleared && <Feather name="check" size={12} color={color.green} />}
                  <Text style={styles.metaText}>
                    {fmtDate(t.date)} · {t.type === 'transfer' ? 'Transfer' : (t.categoryName ?? '—')}
                  </Text>
                  {t.duesAllocatedCents > 0 && <Text style={styles.badge}>dues</Text>}
                </View>
              </View>
              <View style={styles.right}>
                <Text style={[styles.amt, t.amountCents > 0 && { color: color.green }]}>{formatCents(t.amountCents)}</Text>
                <Text style={styles.running}>{formatCents(t.runningBalanceCents)}</Text>
              </View>
            </ListRow>
          ))
        )}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  balanceLabel: { fontSize: 11, fontWeight: '600', color: color.muted },
  balanceValue: { fontSize: 21, fontWeight: '700', color: color.ink, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.card, borderWidth: 1, borderColor: color.inputBorder, borderRadius: 9, minHeight: 44, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, color: color.ink, paddingVertical: 10 },
  chips: { flexDirection: 'row', gap: 6 },
  filterPanel: { padding: 14, gap: 12 },
  twoUp: { flexDirection: 'row', gap: 10 },
  payee: { fontSize: 15, fontWeight: '600', color: color.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11.5, color: color.muted },
  badge: { fontSize: 10, fontWeight: '700', color: color.neutral2, backgroundColor: color.neutralBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
  right: { alignItems: 'flex-end', gap: 3 },
  amt: { fontSize: 15, fontWeight: '600', color: color.ink, fontVariant: ['tabular-nums'] },
  running: { fontSize: 11, color: color.muted, fontVariant: ['tabular-nums'] },
  empty: { fontSize: 14, color: color.muted }
})
