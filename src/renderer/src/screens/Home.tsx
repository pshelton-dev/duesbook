import { useEffect, useState } from 'react'
import type { AppStatus, HomeSummary, UpdateInfo } from '../../../shared/types'
import { MONTH_NAMES } from '../lib/fiscal'
import { formatCents } from '../lib/money'

const STALE_BACKUP_DAYS = 7

export default function Home({
  status,
  onNavigate
}: {
  status: AppStatus
  onNavigate: (screen: 'ledger' | 'dues' | 'settings') => void
}): React.JSX.Element {
  const org = status.organization!
  const [summary, setSummary] = useState<HomeSummary | null>(null)
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.duesbook
      .getHomeSummary()
      .then(setSummary)
      .catch((e) => setError(String(e)))
    window.duesbook.checkForUpdate().then(setUpdate).catch(() => {})
  }, [])

  if (error) return <div className="panel error">{error}</div>
  if (!summary) return <div className="panel">Loading…</div>

  const totalCents = summary.accounts.reduce((s, a) => s + a.balanceCents, 0)

  const backupAgeDays = status.lastBackupAt
    ? (Date.now() - new Date(status.lastBackupAt).getTime()) / (24 * 60 * 60 * 1000)
    : null
  const backupWarning =
    org.backupDir === null
      ? 'Automatic backups are not set up. If this computer is lost, the books go with it.'
      : backupAgeDays === null
        ? 'No backup has been made yet — one will be written next launch, or back up now.'
        : backupAgeDays > STALE_BACKUP_DAYS
          ? `Last backup was ${Math.floor(backupAgeDays)} days ago.`
          : null

  const paidPct =
    summary.dues && summary.dues.expectedCount > 0
      ? Math.round((summary.dues.paidCount / summary.dues.expectedCount) * 100)
      : 0

  return (
    <div>
      <h1>{org.name}</h1>
      <p className="hint">Fiscal year starts in {MONTH_NAMES[org.fiscalYearStartMonth - 1]}</p>

      {update && !updateDismissed && (
        <div className="panel notice">
          Duesbook {update.version} is available —{' '}
          <a href={update.url} target="_blank" rel="noreferrer">
            see what changed and download it
          </a>
          . Your books are untouched by updates.{' '}
          <button className="btn small" onClick={() => setUpdateDismissed(true)}>
            Dismiss
          </button>
        </div>
      )}
      {backupWarning && (
        <div className="panel warn">
          <strong>{backupWarning}</strong>{' '}
          <button className="btn small" onClick={() => onNavigate('settings')}>
            Open backup settings
          </button>
        </div>
      )}
      {summary.unallocatedCount > 0 && (
        <div className="panel warn">
          {summary.unallocatedCount} dues deposit{summary.unallocatedCount > 1 ? 's' : ''} not
          yet allocated to members.{' '}
          <button className="btn small" onClick={() => onNavigate('dues')}>
            Allocate
          </button>
        </div>
      )}
      {summary.arrears.members.length > 0 && (
        <div className="panel error">
          <strong>
            {summary.arrears.members.length} member
            {summary.arrears.members.length > 1 ? 's are' : ' is'} {summary.arrears.threshold}+
            months behind on dues:
          </strong>
          <ul className="arrears-list">
            {summary.arrears.members.map((m) => (
              <li key={m.memberId}>
                {m.firstName} {m.lastName} — {m.periodsBehind} months,{' '}
                {formatCents(m.owedCents)} owed
              </li>
            ))}
          </ul>
          <button className="btn small" onClick={() => onNavigate('dues')}>
            Open dues
          </button>
        </div>
      )}

      <div className="balance-cards">
        {summary.accounts.map((a) => (
          <div key={a.id} className="balance-card">
            <div className="summary-label">{a.name}</div>
            <div className="summary-value">{formatCents(a.balanceCents)}</div>
          </div>
        ))}
        {summary.accounts.length > 1 && (
          <div className="balance-card total">
            <div className="summary-label">Total</div>
            <div className="summary-value">{formatCents(totalCents)}</div>
          </div>
        )}
      </div>

      {summary.dues && (
        <div className="panel dues-progress">
          <div className="dues-progress-head">
            <strong>Dues · {summary.duesPeriodLabel}</strong>
            <span>
              {summary.dues.paidCount} of {summary.dues.expectedCount} paid in full ·{' '}
              {formatCents(summary.dues.collectedCents)} collected ·{' '}
              {formatCents(summary.dues.outstandingCents)} outstanding
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${paidPct}%` }} />
          </div>
        </div>
      )}

      <h2>Recent activity</h2>
      {summary.recent.length === 0 ? (
        <div className="panel">No transactions yet.</div>
      ) : (
        <table className="register">
          <tbody>
            {summary.recent.map((r) => (
              <tr key={r.id} className="register-row" onClick={() => onNavigate('ledger')}>
                <td className="nowrap">{r.date}</td>
                <td>{r.description}</td>
                <td>{r.categoryName ?? '—'}</td>
                <td>{r.accountName}</td>
                <td className={`num ${r.amountCents > 0 ? 'pos' : ''}`}>
                  {formatCents(r.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
