import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ensurePeriodsCurrent } from '../src/data/dues'
import { META, setMeta } from '../src/data/meta'
import { completeWizard } from '../src/data/wizard'
import { currentFiscalPeriod, currentMonthPeriod, MONTH_NAMES } from '../src/shared/fiscal'
import type { AccountType, WizardAccount } from '../src/shared/types'
import { useBooks } from '../src/ui/books'
import { pickBooksFile, snapshotNow } from '../src/ui/snapshots'
import {
  AmountField,
  Button,
  Card,
  ChoiceField,
  DateField,
  ErrorText,
  ListRow,
  Segmented,
  TextField,
  Toggle
} from '../src/ui/components'
import { formatCents, parseDollarsToCents } from '../src/ui/format'
import { color } from '../src/ui/theme'

const STEPS = ['Organization', 'Accounts', 'Backups', 'Dues', 'Members'] as const
const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' }
]

/** First-run setup: one step per page, the books-start date anchoring everything. */
export default function Wizard(): React.JSX.Element {
  const { db, bump, restore } = useBooks()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // 1 · organization
  const [orgName, setOrgName] = useState('')
  const [fyMonth, setFyMonth] = useState(1)
  const [booksStart, setBooksStart] = useState(currentMonthPeriod().startDate)

  // 2 · accounts
  const [accounts, setAccounts] = useState<WizardAccount[]>([])
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<AccountType>('checking')
  const [newBalance, setNewBalance] = useState('')

  // 3 · backups
  const [snapshots, setSnapshots] = useState(true)

  // 4 · dues
  const [duesEnabled, setDuesEnabled] = useState(true)
  const [cadence, setCadence] = useState<'monthly' | 'yearly'>('monthly')
  const [duesAmount, setDuesAmount] = useState('')

  function addAccount(): void {
    const name = newName.trim()
    if (!name) return setError('Give the account a name.')
    if (accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) return setError('That account name is already used.')
    const cents = parseDollarsToCents(newBalance || '0')
    if (cents === null) return setError('Enter the balance as dollars and cents.')
    setAccounts([...accounts, { name, type: newType, openingBalanceCents: cents, openingDate: booksStart }])
    setNewName('')
    setNewBalance('')
    setError(null)
  }

  function firstPeriod(): { label: string; startDate: string; endDate: string } {
    const anchor = new Date(`${booksStart}T12:00:00`)
    const p = cadence === 'monthly' ? currentMonthPeriod(anchor) : currentFiscalPeriod(fyMonth, anchor)
    return { ...p, startDate: booksStart > p.startDate ? booksStart : p.startDate }
  }

  function validate(): string | null {
    if (step === 0) {
      if (!orgName.trim()) return 'Enter your organization’s name.'
      if (!booksStart) return 'Set the date your books start.'
    }
    if (step === 1 && accounts.length === 0) return 'Add at least one account.'
    if (step === 3 && duesEnabled && (parseDollarsToCents(duesAmount) ?? -1) < 0) return 'Enter the dues amount.'
    return null
  }

  function next(): void {
    const problem = validate()
    if (problem) return setError(problem)
    setError(null)
    setStep(step + 1)
  }

  function finish(): void {
    try {
      const p = firstPeriod()
      completeWizard(db, {
        orgName: orgName.trim(),
        fiscalYearStartMonth: fyMonth,
        backupDir: null,
        accounts: accounts.map((a) => ({ ...a, openingDate: booksStart })),
        dues: duesEnabled ? { ...p, amountCents: parseDollarsToCents(duesAmount) ?? 0 } : null,
        members: []
      })
      setMeta(db, META.snapshotsEnabled, snapshots ? '1' : '0')
      ensurePeriodsCurrent(db)
      if (snapshots) {
        try {
          snapshotNow(db)
        } catch (e) {
          console.warn('First snapshot failed:', e)
        }
      }
      bump()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const fp = duesEnabled && booksStart ? firstPeriod() : null

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.pips}>
            {STEPS.map((s, i) => (
              <View key={s} style={[styles.pip, i <= step && styles.pipOn]} />
            ))}
          </View>
          <Text style={styles.stepLabel}>
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </Text>

          {step === 0 && (
            <>
              <Text style={styles.h1}>Let’s set up your books</Text>
              <Text style={styles.lead}>About five minutes. You can change any of this later in Settings.</Text>
              <Button
                title="Taking over from a previous treasurer? Open their file"
                kind="link"
                onPress={() =>
                  pickBooksFile()
                    .then((file) => {
                      if (file) restore(file)
                    })
                    .catch((e) => setError(e instanceof Error ? e.message : String(e)))
                }
              />
              <TextField label="Organization name" value={orgName} onChangeText={setOrgName} placeholder="Riverside Garden Club" autoFocus />
              <ChoiceField
                label="Fiscal year starts in"
                value={fyMonth}
                onChange={setFyMonth}
                options={MONTH_NAMES.map((m, i) => ({ value: i + 1, label: m }))}
                hint="Many clubs run July to June. If you’re not sure, leave January."
              />
              <DateField
                label="Your books start on"
                value={booksStart}
                onChange={setBooksStart}
                hint="Every account’s opening balance is as of this date, and dues are counted from it. Pick the date of the statement you’ll copy balances from."
              />
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.h1}>Where does the money live?</Text>
              <Text style={styles.lead}>Add each account and its balance as of {booksStart}, from that statement.</Text>
              {accounts.length > 0 && (
                <Card>
                  {accounts.map((a, i) => (
                    <ListRow key={a.name} last={i === accounts.length - 1}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{a.name}</Text>
                        <Text style={styles.hint}>
                          {formatCents(a.openingBalanceCents)} as of {a.openingDate}
                        </Text>
                      </View>
                      <Button title="Remove" kind="link" small onPress={() => setAccounts(accounts.filter((x) => x !== a))} />
                    </ListRow>
                  ))}
                </Card>
              )}
              <View style={styles.addPanel}>
                <Text style={styles.addTitle}>{accounts.length ? 'Add another account' : 'Add an account'}</Text>
                <TextField label="Name" value={newName} onChangeText={setNewName} placeholder="Checking" />
                <Segmented options={ACCOUNT_TYPES} value={newType} onChange={setNewType} />
                <AmountField label={`Balance on ${booksStart}`} value={newBalance} onChangeText={setNewBalance} />
                <Button title="Add account" onPress={addAccount} />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.h1}>Keep a copy of your books</Text>
              <Text style={styles.lead}>Your books live only on this phone. If it’s lost or replaced, so are they, unless there’s a copy somewhere.</Text>
              <Card style={{ padding: 16, gap: 12 }}>
                <Toggle title="Keep copies in iCloud Drive" subtitle="A timestamped copy each day you use the app" value={snapshots} onValueChange={setSnapshots} />
                <Text style={styles.body13}>
                  Copies go to your own iCloud Drive, in a Duesbook folder you can see in the Files app. That is the only place anything ever leaves this phone, and you can turn it off any time in Settings.
                </Text>
              </Card>
              <View style={styles.infoBox}>
                <View style={styles.infoDot} />
                <Text style={[styles.body13, { flex: 1 }]}>This phone’s own backup covers Duesbook too, if iCloud Backup is on. The copies above are the extra insurance you can hand to the next treasurer.</Text>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.h1}>How are dues billed?</Text>
              <Text style={styles.lead}>One amount, the same for every member. Exceptions come later, per member.</Text>
              <Toggle title="We collect dues" value={duesEnabled} onValueChange={setDuesEnabled} />
              {duesEnabled && (
                <>
                  <Segmented
                    options={[
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'yearly', label: 'Yearly' }
                    ]}
                    value={cadence}
                    onChange={setCadence}
                  />
                  <AmountField label={cadence === 'monthly' ? 'Amount per month' : 'Amount per year'} value={duesAmount} onChangeText={setDuesAmount} />
                  {fp && (
                    <Card accent style={{ padding: 14, paddingLeft: 15, gap: 4 }}>
                      <Text style={styles.label}>First period</Text>
                      <Text style={styles.name}>
                        {fp.label} · {formatCents(parseDollarsToCents(duesAmount) ?? 0)}
                      </Text>
                      <Text style={styles.hint}>
                        Starts {fp.startDate}, when your books do. Every period since then is created too, so anyone who hasn’t paid shows as owing right away.
                      </Text>
                    </Card>
                  )}
                  <View style={styles.infoBox}>
                    <View style={styles.infoDot} />
                    <Text style={[styles.body13, { flex: 1 }]}>New periods create themselves as they arrive. Members two periods behind are flagged on Home; you can change that number in Settings.</Text>
                  </View>
                </>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <Text style={styles.h1}>Who are your members?</Text>
              <Text style={styles.lead}>Add people from the Members tab once setup is done, one at a time or from your Contacts. Anyone you add owes dues from the first period.</Text>
              <View style={styles.infoBox}>
                <View style={styles.infoDot} />
                <Text style={[styles.body13, { flex: 1 }]}>Spreadsheet import is coming; for now the Members tab is the way in.</Text>
              </View>
            </>
          )}

          {error && <ErrorText>{error}</ErrorText>}

          <View style={{ flex: 1, minHeight: 12 }} />

          <View style={styles.footer}>
            {step > 0 && <Button title="Back" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
            {step < STEPS.length - 1 ? (
              <Button title="Next" kind="primary" onPress={next} style={{ flex: 2 }} />
            ) : (
              <Button title="Finish setup" kind="primary" onPress={finish} style={{ flex: 2 }} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { flexGrow: 1, padding: 20, gap: 16 },
  pips: { flexDirection: 'row', gap: 6 },
  pip: { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.greenTrack },
  pipOn: { backgroundColor: color.green },
  stepLabel: { fontSize: 11, fontWeight: '600', color: color.muted, marginTop: -8 },
  h1: { fontSize: 23, fontWeight: '700', color: color.ink, letterSpacing: -0.3 },
  lead: { fontSize: 14, color: color.muted2, lineHeight: 21, marginTop: -10 },
  label: { fontSize: 11, fontWeight: '600', color: color.muted },
  name: { fontSize: 15, fontWeight: '600', color: color.ink },
  hint: { fontSize: 12, color: color.muted, lineHeight: 16, marginTop: 2 },
  body13: { fontSize: 13, color: color.inkSoft, lineHeight: 19 },
  addPanel: { backgroundColor: color.greenWash, borderRadius: 14, padding: 14, gap: 12 },
  addTitle: { fontSize: 12, fontWeight: '700', color: color.inkSoft },
  infoBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: color.greenWash, borderRadius: 12, padding: 12, paddingHorizontal: 16 },
  infoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.green, marginTop: 6 },
  footer: { flexDirection: 'row', gap: 10 }
})
