import { useCallback, useEffect, useState } from 'react'
import type {
  DuesPeriodRow,
  DuesRoster,
  OrganizationSummary,
  TreasurerReport
} from '../../../../shared/types'
import { toCsv, centsToCsvNumber } from '../../lib/csv-out'
import { currentFiscalPeriod, fiscalPeriodShifted, monthRange } from '../../lib/fiscal'
import { formatCents, todayIso } from '../../lib/money'

type ReportKind = 'treasurer' | 'roster' | 'yearend'

const STATUS_TEXT: Record<string, string> = {
  paid: 'Paid',
  partial: 'Partial',
  owed: 'Owed',
  waived: 'Waived',
  exempt: 'Exempt',
  na: '—'
}

export default function Reports({ org }: { org: OrganizationSummary }): React.JSX.Element {
  const [kind, setKind] = useState<ReportKind>('treasurer')

  const lastMonth = monthRange(1)
  const [dateFrom, setDateFrom] = useState(lastMonth.from)
  const [dateTo, setDateTo] = useState(lastMonth.to)
  const [fyOffset, setFyOffset] = useState(0)
  const [periods, setPeriods] = useState<DuesPeriodRow[]>([])
  const [periodId, setPeriodId] = useState<number | null>(null)

  const [treasurer, setTreasurer] = useState<TreasurerReport | null>(null)
  const [roster, setRoster] = useState<DuesRoster | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.duesbook
      .listDuesPeriods()
      .then((list) => {
        setPeriods(list)
        setPeriodId((cur) => cur ?? list.find((p) => p.isCurrent)?.id ?? list[0]?.id ?? null)
      })
      .catch((e) => setError(String(e)))
  }, [])

  const range =
    kind === 'yearend' ? fiscalPeriodShifted(org.fiscalYearStartMonth, fyOffset) : null
  const effectiveFrom = kind === 'yearend' ? range!.startDate : dateFrom
  const effectiveTo = kind === 'yearend' ? range!.endDate : dateTo

  const load = useCallback(async () => {
    setError(null)
    try {
      if (kind === 'roster') {
        if (periodId !== null) setRoster(await window.duesbook.getDuesRoster(periodId))
      } else {
        setTreasurer(await window.duesbook.getTreasurerReport(effectiveFrom, effectiveTo))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [kind, periodId, effectiveFrom, effectiveTo])

  useEffect(() => {
    load()
  }, [load])

  function applyPreset(preset: string): void {
    const fy = currentFiscalPeriod(org.fiscalYearStartMonth)
    const lastFy = fiscalPeriodShifted(org.fiscalYearStartMonth, 1)
    if (preset === 'last-month') {
      const r = monthRange(1)
      setDateFrom(r.from)
      setDateTo(r.to)
    } else if (preset === 'this-month') {
      const r = monthRange(0)
      setDateFrom(r.from)
      setDateTo(r.to)
    } else if (preset === 'this-fy') {
      setDateFrom(fy.startDate)
      setDateTo(fy.endDate)
    } else if (preset === 'last-fy') {
      setDateFrom(lastFy.startDate)
      setDateTo(lastFy.endDate)
    }
  }

  async function exportCsv(): Promise<void> {
    let name: string
    let content: string
    if (kind === 'roster') {
      if (!roster) return
      const period = periods.find((p) => p.id === periodId)
      name = `dues-roster-${period?.label ?? 'period'}.csv`
      content = toCsv([
        ['Member', 'Owes', 'Paid', 'Outstanding', 'Status', 'Note'],
        ...roster.rows.map((r) => [
          `${r.lastName}, ${r.firstName}`,
          centsToCsvNumber(r.baseCents),
          centsToCsvNumber(r.paidCents),
          centsToCsvNumber(r.outstandingCents),
          STATUS_TEXT[r.status],
          r.overrideNote ?? ''
        ])
      ])
    } else {
      if (!treasurer) return
      name = `${kind === 'yearend' ? 'year-end' : 'treasurer-report'}-${treasurer.dateFrom}-to-${treasurer.dateTo}.csv`
      content = toCsv([
        ['Section', 'Line', 'Amount'],
        ...treasurer.accounts.map((a) => ['Opening balance', a.name, centsToCsvNumber(a.openingCents)]),
        ...treasurer.incomeByCategory.map((r) => ['Income', r.category, centsToCsvNumber(r.cents)]),
        ['Income', 'Total income', centsToCsvNumber(treasurer.totalIncomeCents)],
        ...treasurer.expenseByCategory.map((r) => ['Expenses', r.category, centsToCsvNumber(r.cents)]),
        ['Expenses', 'Total expenses', centsToCsvNumber(treasurer.totalExpenseCents)],
        ['Net', 'Net for period', centsToCsvNumber(treasurer.netCents)],
        ...treasurer.accounts.map((a) => ['Closing balance', a.name, centsToCsvNumber(a.closingCents)])
      ])
    }
    const saved = await window.duesbook.saveCsv(name, content)
    if (saved) setNotice(`Saved ${saved}`)
  }

  const title =
    kind === 'treasurer'
      ? "Treasurer's report"
      : kind === 'roster'
        ? 'Dues status roster'
        : 'Year-end summary'
  const subtitle =
    kind === 'roster'
      ? `Dues period ${periods.find((p) => p.id === periodId)?.label ?? ''}`
      : `${effectiveFrom} through ${effectiveTo}`

  return (
    <div>
      <div className="report-controls">
        <div className="segmented">
          {(
            [
              ['treasurer', "Treasurer's report"],
              ['roster', 'Dues roster'],
              ['yearend', 'Year-end summary']
            ] as [ReportKind, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              className={`segment ${kind === k ? 'active' : ''}`}
              onClick={() => setKind(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="filter-bar">
          {kind === 'treasurer' && (
            <>
              <select onChange={(e) => applyPreset(e.target.value)} defaultValue="last-month">
                <option value="last-month">Last month</option>
                <option value="this-month">This month</option>
                <option value="this-fy">This fiscal year</option>
                <option value="last-fy">Last fiscal year</option>
              </select>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="filter-sep">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </>
          )}
          {kind === 'roster' && (
            <select
              value={periodId ?? ''}
              onChange={(e) => setPeriodId(Number(e.target.value))}
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </select>
          )}
          {kind === 'yearend' && (
            <select value={fyOffset} onChange={(e) => setFyOffset(Number(e.target.value))}>
              {[0, 1, 2].map((o) => (
                <option key={o} value={o}>
                  FY {fiscalPeriodShifted(org.fiscalYearStartMonth, o).label}
                </option>
              ))}
            </select>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={exportCsv}>
            Export CSV
          </button>
          <button className="btn primary" onClick={() => window.print()}>
            Print
          </button>
        </div>
        {notice && (
          <div className="panel notice">
            {notice}{' '}
            <button className="btn small" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        )}
        {error && <div className="panel error">{error}</div>}
      </div>

      <div className="report-page">
        <div className="report-head">
          <div className="report-org">{org.name}</div>
          <div className="report-title">{title}</div>
          <div className="report-sub">
            {subtitle} · Generated {todayIso()}
          </div>
        </div>

        {kind !== 'roster' && treasurer && (
          <>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="num">Opening</th>
                  <th className="num">Closing</th>
                </tr>
              </thead>
              <tbody>
                {treasurer.accounts.map((a) => (
                  <tr key={a.name}>
                    <td>{a.name}</td>
                    <td className="num">{formatCents(a.openingCents)}</td>
                    <td className="num">{formatCents(a.closingCents)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Total</td>
                  <td className="num">
                    {formatCents(treasurer.accounts.reduce((s, a) => s + a.openingCents, 0))}
                  </td>
                  <td className="num">
                    {formatCents(treasurer.accounts.reduce((s, a) => s + a.closingCents, 0))}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="report-columns">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Income</th>
                    <th className="num"></th>
                  </tr>
                </thead>
                <tbody>
                  {treasurer.incomeByCategory.length === 0 && (
                    <tr>
                      <td colSpan={2} className="hint">
                        No income in this period.
                      </td>
                    </tr>
                  )}
                  {treasurer.incomeByCategory.map((r) => (
                    <tr key={r.category}>
                      <td>{r.category}</td>
                      <td className="num">{formatCents(r.cents)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>Total income</td>
                    <td className="num">{formatCents(treasurer.totalIncomeCents)}</td>
                  </tr>
                </tbody>
              </table>

              <table className="report-table">
                <thead>
                  <tr>
                    <th>Expenses</th>
                    <th className="num"></th>
                  </tr>
                </thead>
                <tbody>
                  {treasurer.expenseByCategory.length === 0 && (
                    <tr>
                      <td colSpan={2} className="hint">
                        No expenses in this period.
                      </td>
                    </tr>
                  )}
                  {treasurer.expenseByCategory.map((r) => (
                    <tr key={r.category}>
                      <td>{r.category}</td>
                      <td className="num">{formatCents(r.cents)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>Total expenses</td>
                    <td className="num">{formatCents(treasurer.totalExpenseCents)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="report-net">
              Net for period: <strong>{formatCents(treasurer.netCents)}</strong>
            </p>
          </>
        )}

        {kind === 'roster' && roster && (
          <>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="num">Owes</th>
                  <th className="num">Paid</th>
                  <th className="num">Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.rows.map((r) => (
                  <tr key={r.memberId}>
                    <td>
                      {r.lastName}
                      {r.lastName && r.firstName ? ', ' : ''}
                      {r.firstName}
                      {r.overrideNote ? ` (${r.overrideNote})` : ''}
                    </td>
                    <td className="num">{formatCents(r.baseCents)}</td>
                    <td className="num">{r.paidCents > 0 ? formatCents(r.paidCents) : '—'}</td>
                    <td className="num">
                      {r.outstandingCents > 0 ? formatCents(r.outstandingCents) : '—'}
                    </td>
                    <td>{STATUS_TEXT[r.status]}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>
                    {roster.summary.paidCount} of {roster.summary.expectedCount} paid in full
                  </td>
                  <td className="num"></td>
                  <td className="num">{formatCents(roster.summary.collectedCents)}</td>
                  <td className="num">{formatCents(roster.summary.outstandingCents)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
