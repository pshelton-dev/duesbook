import { useEffect, useState } from 'react'
import type { AppStatus, HomeSummary, UpdateInfo } from '../../../shared/types'
import { formatCents } from '../lib/money'

const STALE_BACKUP_DAYS = 7

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

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
  const backupNotConfigured = org.backupDir === null
  const backupWarning = backupNotConfigured
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
      <h1>Home</h1>

      <div className="balance-cards">
        {summary.accounts.map((a) => (
          <div key={a.id} className="balance-card">
            <div className="icon-tile">
              <span className="dot" />
            </div>
            <div className="summary-label">{a.name}</div>
            <div className="summary-value">{formatCents(a.balanceCents)}</div>
          </div>
        ))}
        {summary.accounts.length > 1 && (
          <div className="balance-card total">
            <div className="icon-tile on-green">
              <span className="dot" />
            </div>
            <div className="summary-label">Total</div>
            <div className="summary-value">{formatCents(totalCents)}</div>
          </div>
        )}
      </div>

      {summary.dues && (
        <div className="dues-progress">
          <div className="progress-ring" style={{ '--pct': paidPct } as React.CSSProperties} />
          <div className="dues-progress-body">
            <div className="dues-progress-head">
              <h2>Dues · {summary.duesPeriodLabel}</h2>
              <button className="link-btn" onClick={() => onNavigate('dues')}>
                View Dues →
              </button>
            </div>
            <div className="dues-progress-sub">
              {summary.dues.paidCount} of {summary.dues.expectedCount} paid ·{' '}
              {formatCents(summary.dues.collectedCents)} collected ·{' '}
              {formatCents(summary.dues.outstandingCents)} outstanding
            </div>
          </div>
        </div>
      )}

      {summary.arrears.members.length > 0 && (
        <div className="arrears-card">
          <div className="arrears-head">
            <span className="diamond" />
            <h2>Arrears</h2>
          </div>
          {summary.arrears.members.map((m) => (
            <div key={m.memberId} className="arrears-row">
              <span className="who">
                {m.firstName} {m.lastName}{' '}
                <span className="months">· {m.periodsBehind} mo behind</span>
              </span>
              <span className="amount">{formatCents(m.owedCents)}</span>
            </div>
          ))}
        </div>
      )}

      <h2>Recent Transactions</h2>
      {summary.recent.length === 0 ? (
        <div className="panel">No transactions yet.</div>
      ) : (
        <table className="mini-table">
          <tbody>
            {summary.recent.map((r) => (
              <tr key={r.id} className="register-row" onClick={() => onNavigate('ledger')}>
                <td className="tile-cell">
                  <span className="row-tile" />
                </td>
                <td className="date">{shortDate(r.date)}</td>
                <td>{r.description}</td>
                <td className="date">{r.categoryName ?? '—'}</td>
                <td className="date">{r.accountName}</td>
                <td className={`num ${r.amountCents > 0 ? 'pos' : ''}`}>
                  {formatCents(r.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(backupWarning || (update && !updateDismissed) || summary.unallocatedCount > 0) && (
        <div className="health-strip">
          {backupWarning && (
            <div className={`notice-card ${backupNotConfigured ? 'danger' : 'warn'}`}>
              <span className={`diamond ${backupNotConfigured ? '' : 'warn'}`} />
              <span className="grow">{backupWarning}</span>
              <button className="action" onClick={() => onNavigate('settings')}>
                Open backup settings
              </button>
            </div>
          )}
          {summary.unallocatedCount > 0 && (
            <div className="notice-card warn">
              <span className="diamond warn" />
              <span className="grow">
                {summary.unallocatedCount} dues deposit
                {summary.unallocatedCount > 1 ? 's' : ''} not yet allocated to members.
              </span>
              <button className="action" onClick={() => onNavigate('dues')}>
                Allocate
              </button>
            </div>
          )}
          {update && !updateDismissed && (
            <div className="notice-card neutral">
              <span className="grow">
                Update available — v{update.version} ·{' '}
                <a href={update.url} target="_blank" rel="noreferrer">
                  see what changed
                </a>
              </span>
              <button className="dismiss" onClick={() => setUpdateDismissed(true)}>
                ×
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
