import { useCallback, useEffect, useState } from 'react'
import type { DuesStatus, MemberDetail, MemberRow, WizardMember } from '../../../../shared/types'
import MemberCsvImport from '../../components/MemberCsvImport'
import { formatCents } from '../../lib/money'
import MemberDrawer from './MemberDrawer'

const STATUS_LABELS: Record<DuesStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  owed: 'Owed',
  waived: 'Waived',
  exempt: 'Exempt',
  na: '—'
}

export function StatusChip({ status }: { status: DuesStatus }): React.JSX.Element {
  return <span className={`status status-${status}`}>{STATUS_LABELS[status]}</span>
}

export default function Members(): React.JSX.Element {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [search, setSearch] = useState('')
  const [showFormer, setShowFormer] = useState(false)
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [drawer, setDrawer] = useState<'closed' | 'new' | 'edit' | 'import'>('closed')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setMembers(await window.duesbook.listMembers())
  }, [])

  useEffect(() => {
    load().catch((e) => setError(String(e)))
  }, [load])

  async function openDetail(id: number): Promise<void> {
    setDetail(await window.duesbook.getMemberDetail(id))
  }

  async function importMembers(list: WizardMember[]): Promise<void> {
    const count = await window.duesbook.importMembers(list)
    setDrawer('closed')
    setNotice(`Imported ${count} members.`)
    await load()
  }

  const visible = members.filter((m) => {
    if (!showFormer && m.leftDate) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const hay = `${m.firstName} ${m.lastName} ${m.email ?? ''} ${m.phone ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  if (error) return <div className="panel error">{error}</div>

  if (detail) {
    return (
      <div>
        <button className="btn small" onClick={() => setDetail(null)}>
          ← All members
        </button>
        <div className="detail-header">
          <h1>
            {detail.firstName} {detail.lastName}
            {detail.leftDate && <span className="tag">Left {detail.leftDate}</span>}
            {detail.duesExempt && <span className="tag">Exempt</span>}
          </h1>
          <button className="btn" onClick={() => setDrawer('edit')}>
            Edit
          </button>
        </div>
        <div className="panel">
          {detail.email && <div>{detail.email}</div>}
          {detail.phone && <div>{detail.phone}</div>}
          {detail.address && <div>{detail.address}</div>}
          {detail.joinDate && <div>Member since {detail.joinDate}</div>}
          {detail.notes && <div className="hint">{detail.notes}</div>}
        </div>

        <h2>Dues history</h2>
        {detail.history.length === 0 ? (
          <div className="panel">No dues periods overlap this membership yet.</div>
        ) : (
          <table className="mini-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Status</th>
                <th className="num">Paid</th>
                <th className="num">Outstanding</th>
                <th>Payments</th>
              </tr>
            </thead>
            <tbody>
              {detail.history.map((h) => (
                <tr key={h.periodLabel}>
                  <td>{h.periodLabel}</td>
                  <td>
                    <StatusChip status={h.status} />
                  </td>
                  <td className="num">{formatCents(h.paidCents)}</td>
                  <td className="num">{h.owedCents > 0 ? formatCents(h.owedCents) : '—'}</td>
                  <td className="memo">
                    {h.payments
                      .map((p) => `${p.date} ${formatCents(p.amountCents)} (${p.accountName})`)
                      .join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {drawer === 'edit' && (
          <MemberDrawer
            editing={detail}
            onClose={() => setDrawer('closed')}
            onSaved={async () => {
              setDrawer('closed')
              await load()
              try {
                await openDetail(detail.id)
              } catch {
                setDetail(null)
              }
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="ledger-header">
        <h1>Members</h1>
        <div className="btn-row">
          <button className="btn" onClick={() => setDrawer('import')}>
            Import CSV
          </button>
          <button className="btn primary" onClick={() => setDrawer('new')}>
            Add member
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="filter-search"
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="check-field compact">
          <input
            type="checkbox"
            checked={showFormer}
            onChange={(e) => setShowFormer(e.target.checked)}
          />
          Show former members
        </label>
        <span className="hint">
          {visible.length} of {members.length} members
        </span>
      </div>

      {notice && (
        <div className="panel notice">
          {notice}{' '}
          <button className="btn small" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="panel">
          {members.length === 0
            ? 'No members yet — add one or import a CSV.'
            : 'Nothing matches.'}
        </div>
      ) : (
        <table className="register">
          <thead>
            <tr>
              <th>Member</th>
              <th>Contact</th>
              <th>Joined</th>
              <th className="right">Status</th>
              <th className="num">Due</th>
              <th className="num">Behind</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr key={m.id} className="register-row" onClick={() => openDetail(m.id)}>
                <td className="strong">
                  {m.lastName}
                  {m.lastName && m.firstName ? ', ' : ''}
                  {m.firstName}
                  {m.leftDate && <span className="tag">left</span>}
                </td>
                <td className="contact">
                  {m.email}
                  {m.email && m.phone ? <br /> : null}
                  {m.phone}
                </td>
                <td className="date">{m.joinDate}</td>
                <td className="right">
                  <StatusChip status={m.duesStatus} />
                </td>
                <td className="num strong">{m.owedCents > 0 ? formatCents(m.owedCents) : '—'}</td>
                <td className="num behind">{m.periodsBehind > 0 ? `${m.periodsBehind} mo` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {drawer === 'new' && (
        <MemberDrawer
          editing={null}
          onClose={() => setDrawer('closed')}
          onSaved={async () => {
            setDrawer('closed')
            await load()
          }}
        />
      )}
      {drawer === 'import' && (
        <>
        <div className="scrim" onClick={() => setDrawer('closed')} />
        <div className="drawer wide">
          <div className="drawer-header">
            <h2>Import members from CSV</h2>
            <button className="drawer-close" onClick={() => setDrawer('closed')} aria-label="Close">
              ×
            </button>
          </div>
          <p className="hint">
            The first row should be column names, like:{' '}
            <code>First Name, Last Name, Email, Phone, Join Date</code>. Imported members are
            added to the roster — this doesn&rsquo;t detect duplicates yet.
          </p>
          <MemberCsvImport onImport={importMembers} importLabel="Import these members" />
        </div>
        </>
      )}
    </div>
  )
}
