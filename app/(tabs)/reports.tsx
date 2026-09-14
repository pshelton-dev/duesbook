import { File, Paths } from 'expo-file-system'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { getRoster, listPeriods } from '../../src/data/dues'
import { treasurerReport } from '../../src/data/reports'
import { centsToCsvNumber, toCsv } from '../../src/shared/csv-out'
import { currentFiscalPeriod, fiscalPeriodShifted, monthRange } from '../../src/shared/fiscal'
import { useQuery } from '../../src/ui/books'
import { Button, Card, ChoiceField, DateField, ErrorText, Header, Screen, Segmented } from '../../src/ui/components'
import { formatCents } from '../../src/ui/format'
import { rosterHtml, treasurerReportHtml } from '../../src/ui/report-html'
import { color, statusLabel } from '../../src/ui/theme'

type Kind = 'treasurer' | 'roster' | 'yearend'
type Preset = 'this-month' | 'last-month' | 'this-fy' | 'last-fy' | 'custom'

export default function Reports(): React.JSX.Element {
  const org = useQuery((db) =>
    db.prepare(`SELECT name, fiscal_year_start_month AS fy FROM organization WHERE id = 1`).get<{ name: string; fy: number }>()
  )
  const fyMonth = org?.fy ?? 1
  const periods = useQuery(listPeriods)

  const [kind, setKind] = useState<Kind>('treasurer')
  const [preset, setPreset] = useState<Preset>('last-month')
  const [customFrom, setCustomFrom] = useState(monthRange(1).from)
  const [customTo, setCustomTo] = useState(monthRange(1).to)
  const [fyOffset, setFyOffset] = useState(0)
  const [chosenPeriod, setChosenPeriod] = useState<number | null>(null)
  const periodId = chosenPeriod ?? periods.find((p) => p.isCurrent)?.id ?? periods[0]?.id ?? null
  const [error, setError] = useState<string | null>(null)

  const range = (() => {
    if (kind === 'yearend') {
      const fy = fiscalPeriodShifted(fyMonth, fyOffset)
      return { from: fy.startDate, to: fy.endDate, label: `FY ${fy.label}` }
    }
    switch (preset) {
      case 'this-month': {
        const r = monthRange(0)
        return { ...r, label: 'This month' }
      }
      case 'last-month': {
        const r = monthRange(1)
        return { ...r, label: 'Last month' }
      }
      case 'this-fy': {
        const fy = currentFiscalPeriod(fyMonth)
        return { from: fy.startDate, to: fy.endDate, label: `This fiscal year (${fy.label})` }
      }
      case 'last-fy': {
        const fy = fiscalPeriodShifted(fyMonth, 1)
        return { from: fy.startDate, to: fy.endDate, label: `Last fiscal year (${fy.label})` }
      }
      default:
        return { from: customFrom, to: customTo, label: 'Custom range' }
    }
  })()

  const report = useQuery(
    (db) => {
      try {
        if (kind === 'roster') return null
        return range.from <= range.to ? treasurerReport(db, range.from, range.to) : null
      } catch {
        return null
      }
    },
    [kind, range.from, range.to]
  )
  const roster = useQuery((db) => (kind === 'roster' && periodId ? getRoster(db, periodId) : null), [kind, periodId])
  const period = periods.find((p) => p.id === periodId)
  const title = kind === 'treasurer' ? "Treasurer's report" : kind === 'roster' ? 'Dues status roster' : 'Year-end summary'
  const orgName = org?.name ?? 'Duesbook'

  async function sharePdf(): Promise<void> {
    try {
      const html = kind === 'roster' ? (roster && period ? rosterHtml(orgName, period.label, roster) : null) : report ? treasurerReportHtml(orgName, title, report) : null
      if (!html) return
      const { uri } = await Print.printToFileAsync({ html })
      // expo-print names the file with a UUID; give the share sheet a real name.
      const slug = kind === 'roster' ? `dues-roster-${period?.label ?? ''}` : `${kind === 'yearend' ? 'year-end' : 'treasurer-report'}-${range.from}-to-${range.to}`
      const named = new File(Paths.cache, `${slug.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`)
      if (named.exists) named.delete()
      new File(uri).move(named)
      await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function shareCsv(): Promise<void> {
    try {
      let name: string
      let content: string
      if (kind === 'roster') {
        if (!roster || !period) return
        name = `dues-roster-${period.label.replace(/[^A-Za-z0-9-]+/g, '-')}.csv`
        content = toCsv([
          ['Member', 'Owes', 'Paid', 'Outstanding', 'Status', 'Note'],
          ...roster.rows.map((r) => [`${r.lastName}, ${r.firstName}`, centsToCsvNumber(r.baseCents), centsToCsvNumber(r.paidCents), centsToCsvNumber(r.outstandingCents), statusLabel[r.status], r.overrideNote ?? ''])
        ])
      } else {
        if (!report) return
        name = `${kind === 'yearend' ? 'year-end' : 'treasurer-report'}-${report.dateFrom}-to-${report.dateTo}.csv`
        content = toCsv([
          ['Section', 'Line', 'Amount'],
          ...report.accounts.map((a) => ['Opening balance', a.name, centsToCsvNumber(a.openingCents)]),
          ...report.incomeByCategory.map((r) => ['Income', r.category, centsToCsvNumber(r.cents)]),
          ['Income', 'Total income', centsToCsvNumber(report.totalIncomeCents)],
          ...report.expenseByCategory.map((r) => ['Expenses', r.category, centsToCsvNumber(r.cents)]),
          ['Expenses', 'Total expenses', centsToCsvNumber(report.totalExpenseCents)],
          ['Net', 'Net for period', centsToCsvNumber(report.netCents)],
          ...report.accounts.map((a) => ['Closing balance', a.name, centsToCsvNumber(a.closingCents)])
        ])
      }
      const file = new File(Paths.cache, name)
      file.write(content)
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: name })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Screen>
      <Header title="Reports" />
      <Segmented
        options={[
          { value: 'treasurer', label: "Treasurer's" },
          { value: 'roster', label: 'Dues roster' },
          { value: 'yearend', label: 'Year-end' }
        ]}
        value={kind}
        onChange={setKind}
      />

      {kind === 'treasurer' && (
        <ChoiceField
          label="Period"
          value={preset}
          onChange={setPreset}
          options={[
            { value: 'last-month', label: 'Last month' },
            { value: 'this-month', label: 'This month' },
            { value: 'this-fy', label: 'This fiscal year' },
            { value: 'last-fy', label: 'Last fiscal year' },
            { value: 'custom', label: 'Custom range' }
          ]}
        />
      )}
      {kind === 'treasurer' && preset === 'custom' && (
        <View style={styles.twoUp}>
          <View style={{ flex: 1 }}>
            <DateField label="From" value={customFrom} onChange={setCustomFrom} />
          </View>
          <View style={{ flex: 1 }}>
            <DateField label="To" value={customTo} onChange={setCustomTo} />
          </View>
        </View>
      )}
      {kind === 'yearend' && (
        <ChoiceField
          label="Fiscal year"
          value={fyOffset}
          onChange={setFyOffset}
          options={[0, 1, 2].map((o) => ({ value: o, label: `FY ${fiscalPeriodShifted(fyMonth, o).label}` }))}
        />
      )}
      {kind === 'roster' && (
        <ChoiceField
          label="Dues period"
          value={periodId}
          onChange={setChosenPeriod}
          options={periods.map((p) => ({ value: p.id, label: `${p.label} · ${formatCents(p.amountCents)}` }))}
        />
      )}

      <View style={styles.actions}>
        <Button title="CSV" onPress={shareCsv} style={{ flex: 1 }} />
        <Button title="Share PDF" kind="primary" onPress={sharePdf} style={{ flex: 2, minHeight: 44 }} />
      </View>

      {error && <ErrorText>{error}</ErrorText>}

      <Card style={styles.sheet}>
        <View style={styles.masthead}>
          <Text style={styles.org}>{orgName}</Text>
          <Text style={styles.reportTitle}>{title}</Text>
          <Text style={styles.sub}>{kind === 'roster' ? `Dues period ${period?.label ?? ''}` : `${range.from} through ${range.to}`}</Text>
        </View>

        {kind !== 'roster' && report && (
          <>
            <Section head="Opening balances" headRight={report.dateFrom} rows={report.accounts.map((a) => [a.name, a.openingCents])} total={['Total', report.accounts.reduce((s, a) => s + a.openingCents, 0)]} />
            <Section head="Income" rows={report.incomeByCategory.map((r) => [r.category, r.cents])} total={['Total income', report.totalIncomeCents]} />
            <Section head="Expenses" rows={report.expenseByCategory.map((r) => [r.category, r.cents])} total={['Total expenses', report.totalExpenseCents]} />
            <Text style={styles.net}>
              Net for the period: <Text style={{ fontWeight: '700' }}>{formatCents(report.netCents)}</Text>
            </Text>
            <Section head="Closing balances" headRight={report.dateTo} rows={report.accounts.map((a) => [a.name, a.closingCents])} total={['Total', report.accounts.reduce((s, a) => s + a.closingCents, 0)]} />
          </>
        )}
        {kind !== 'roster' && !report && <Text style={styles.empty}>Pick a range that starts before it ends.</Text>}

        {kind === 'roster' && roster && (
          <View>
            <View style={styles.rh}>
              <Text style={[styles.rhText, { flex: 1 }]}>Member</Text>
              <Text style={[styles.rhText, styles.numCol]}>Owes</Text>
              <Text style={[styles.rhText, styles.numCol]}>Paid</Text>
              <Text style={[styles.rhText, styles.numCol]}>Outst.</Text>
            </View>
            {roster.rows.map((m) => (
              <View key={m.memberId} style={styles.rt}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rtText}>
                    {m.lastName}, {m.firstName}
                  </Text>
                  <Text style={styles.rtSub}>{statusLabel[m.status]}{m.overrideNote ? ` · ${m.overrideNote}` : ''}</Text>
                </View>
                <Text style={[styles.rtText, styles.numCol]}>{formatCents(m.baseCents)}</Text>
                <Text style={[styles.rtText, styles.numCol]}>{m.paidCents ? formatCents(m.paidCents) : '—'}</Text>
                <Text style={[styles.rtText, styles.numCol]}>{m.outstandingCents ? formatCents(m.outstandingCents) : '—'}</Text>
              </View>
            ))}
            <View style={styles.tot}>
              <Text style={[styles.totText, { flex: 1 }]}>
                {roster.summary.paidCount} of {roster.summary.expectedCount} paid
              </Text>
              <Text style={[styles.totText, styles.numCol]}></Text>
              <Text style={[styles.totText, styles.numCol]}>{formatCents(roster.summary.collectedCents)}</Text>
              <Text style={[styles.totText, styles.numCol]}>{formatCents(roster.summary.outstandingCents)}</Text>
            </View>
          </View>
        )}
        {kind === 'roster' && !roster && <Text style={styles.empty}>No dues periods yet.</Text>}
      </Card>
    </Screen>
  )
}

function Section({ head, headRight, rows, total }: { head: string; headRight?: string; rows: [string, number][]; total: [string, number] }): React.JSX.Element {
  return (
    <View>
      <View style={styles.rh}>
        <Text style={styles.rhText}>{head}</Text>
        <Text style={styles.rhText}>{headRight ?? ''}</Text>
      </View>
      {rows.length === 0 && <Text style={[styles.rtSub, { paddingVertical: 6 }]}>None</Text>}
      {rows.map(([label, cents]) => (
        <View key={label} style={styles.rt}>
          <Text style={styles.rtText}>{label}</Text>
          <Text style={[styles.rtText, { fontVariant: ['tabular-nums'] }]}>{formatCents(cents)}</Text>
        </View>
      ))}
      <View style={styles.tot}>
        <Text style={styles.totText}>{total[0]}</Text>
        <Text style={[styles.totText, { fontVariant: ['tabular-nums'] }]}>{formatCents(total[1])}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  twoUp: { flexDirection: 'row', gap: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  sheet: { padding: 18, gap: 12 },
  masthead: { borderBottomWidth: 2, borderBottomColor: color.ink, paddingBottom: 8 },
  org: { fontFamily: 'Georgia', fontSize: 18, fontWeight: '700', color: color.ink },
  reportTitle: { fontFamily: 'Georgia', fontSize: 14, color: color.ink, marginTop: 2 },
  sub: { fontFamily: 'Georgia', fontSize: 11.5, color: color.muted2, marginTop: 2 },
  rh: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 2, borderBottomColor: color.ink },
  rhText: { fontSize: 12, fontWeight: '600', color: color.ink },
  rt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  rtText: { fontSize: 12.5, color: color.ink },
  rtSub: { fontSize: 11, color: color.muted },
  tot: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 2, borderTopColor: color.ink },
  totText: { fontSize: 12.5, fontWeight: '600', color: color.ink },
  numCol: { width: 62, textAlign: 'right', fontVariant: ['tabular-nums'] },
  net: { fontSize: 14, color: color.ink, textAlign: 'right' },
  empty: { fontSize: 13, color: color.muted }
})
