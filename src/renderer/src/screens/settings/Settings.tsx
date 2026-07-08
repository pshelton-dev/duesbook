import { useCallback, useEffect, useState } from 'react'
import type { AppStatus, BackupFile, CategorySummary } from '../../../../shared/types'
import { MONTH_NAMES } from '../../lib/fiscal'

function friendlyTime(iso: string | null): string {
  if (!iso) return 'never'
  return new Date(iso).toLocaleString()
}

export default function Settings({
  status,
  onChanged
}: {
  status: AppStatus
  onChanged: () => void
}): React.JSX.Element {
  const org = status.organization!
  const [name, setName] = useState(org.name)
  const [fyMonth, setFyMonth] = useState(org.fiscalYearStartMonth)
  const [retention, setRetention] = useState(String(org.backupRetention))
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [editingCat, setEditingCat] = useState<{ id: number; name: string } | null>(null)
  const [backups, setBackups] = useState<BackupFile[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadCategories = useCallback(async () => {
    setCategories(await window.duesbook.listCategories())
  }, [])

  useEffect(() => {
    loadCategories().catch((e) => setError(String(e)))
  }, [loadCategories])

  async function run(action: () => Promise<void>, successNotice?: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await action()
      if (successNotice) setNotice(successNotice)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings">
      <h1>Settings</h1>
      {notice && (
        <div className="panel notice">
          {notice}{' '}
          <button className="btn small" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}
      {error && <div className="panel error">{error}</div>}

      <h2>Organization</h2>
      <div className="panel">
        <label className="field">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          Fiscal year starts in
          <select value={fyMonth} onChange={(e) => setFyMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn primary"
          disabled={busy || (name === org.name && fyMonth === org.fiscalYearStartMonth)}
          onClick={() =>
            run(async () => {
              await window.duesbook.updateOrganization(name, fyMonth)
              onChanged()
            }, 'Organization updated.')
          }
        >
          Save
        </button>
      </div>

      <h2>Categories</h2>
      <div className="panel">
        <table className="mini-table">
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className={c.isActive ? '' : 'inactive-row'}>
                <td>
                  {editingCat?.id === c.id ? (
                    <input
                      value={editingCat.name}
                      autoFocus
                      onChange={(e) => setEditingCat({ id: c.id, name: e.target.value })}
                    />
                  ) : (
                    <>
                      {c.name}
                      {c.isSystem && <span className="chip chip-na">built-in</span>}
                      {!c.isActive && <span className="chip chip-na">inactive</span>}
                    </>
                  )}
                </td>
                <td>{c.kind}</td>
                <td className="row-actions">
                  {!c.isSystem && editingCat?.id !== c.id && (
                    <>
                      <button
                        className="btn small"
                        onClick={() => setEditingCat({ id: c.id, name: c.name })}
                      >
                        Rename
                      </button>
                      <button
                        className="btn small"
                        onClick={() =>
                          run(async () => {
                            await window.duesbook.updateCategory(c.id, { isActive: !c.isActive })
                            await loadCategories()
                          })
                        }
                      >
                        {c.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </>
                  )}
                  {editingCat?.id === c.id && (
                    <>
                      <button
                        className="btn small primary"
                        onClick={() =>
                          run(async () => {
                            await window.duesbook.updateCategory(c.id, { name: editingCat.name })
                            setEditingCat(null)
                            await loadCategories()
                          })
                        }
                      >
                        Save
                      </button>
                      <button className="btn small" onClick={() => setEditingCat(null)}>
                        Cancel
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          Deactivated categories disappear from new-transaction pickers but keep their history.
          New categories are created right in the transaction form.
        </p>
      </div>

      <h2>Backups</h2>
      <div className="panel">
        <div className="field-static">
          Folder: {org.backupDir ? <code>{org.backupDir}</code> : <em>not set</em>}{' '}
          <button
            className="btn small"
            onClick={() =>
              run(async () => {
                const dir = await window.duesbook.chooseBackupDir()
                if (dir) {
                  await window.duesbook.setBackupConfig(dir, Number(retention))
                  onChanged()
                }
              })
            }
          >
            Change…
          </button>
        </div>
        <div className="field-static">Last backup: {friendlyTime(status.lastBackupAt)}</div>
        <label className="field">
          Backups to keep
          <input
            value={retention}
            inputMode="numeric"
            onChange={(e) => setRetention(e.target.value)}
            onBlur={() => {
              const n = Number(retention)
              if (Number.isInteger(n) && n >= 1 && n !== org.backupRetention) {
                run(async () => {
                  await window.duesbook.setBackupConfig(org.backupDir, n)
                  onChanged()
                }, 'Retention updated.')
              }
            }}
          />
        </label>
        <div className="btn-row">
          <button
            className="btn primary"
            disabled={busy || !org.backupDir}
            onClick={() =>
              run(async () => {
                const path = await window.duesbook.backupNow()
                onChanged()
                setNotice(`Backed up to ${path}`)
              })
            }
          >
            Back up now
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              run(async () => {
                setBackups(await window.duesbook.listBackups())
              })
            }
          >
            Restore from backup…
          </button>
        </div>

        {backups !== null && (
          <div className="restore-list">
            {backups.length === 0 ? (
              <p className="hint">No backups found in the backup folder.</p>
            ) : (
              <>
                <div className="panel warn">
                  Restoring replaces the current books with the chosen backup. A safety copy of
                  the current books is kept automatically.
                </div>
                <table className="mini-table">
                  <tbody>
                    {backups.map((b) => (
                      <tr key={b.path}>
                        <td>{b.name}</td>
                        <td className="num">{Math.round(b.sizeBytes / 1024)} KB</td>
                        <td className="row-actions">
                          <button
                            className="btn small danger"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Replace the current books with ${b.name}? Everything entered since that backup will be gone.`
                                )
                              ) {
                                run(async () => {
                                  await window.duesbook.restoreBackup(b.path)
                                  window.location.reload()
                                })
                              }
                            }}
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <button className="btn small" onClick={() => setBackups(null)}>
              Close
            </button>
          </div>
        )}
      </div>

      <h2>Treasurer handoff</h2>
      <div className="panel">
        <p className="hint">
          Exports a complete copy of the books plus plain-language instructions for the next
          treasurer. A USB drive works well.
        </p>
        <button
          className="btn"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const folder = await window.duesbook.exportHandoff()
              if (folder) setNotice(`Handoff files written to ${folder}`)
            })
          }
        >
          Export for new treasurer…
        </button>
      </div>

      <h2>Updates</h2>
      <div className="panel">
        <label className="check-field">
          <input
            type="checkbox"
            checked={org.updateCheckEnabled}
            onChange={(e) =>
              run(async () => {
                await window.duesbook.setUpdateCheck(e.target.checked)
                onChanged()
              })
            }
          />
          Check for new versions (sends no data — only fetches the latest version number)
        </label>
      </div>

      <h2>About</h2>
      <div className="panel meta-panel">
        <div>Duesbook {status.appVersion}</div>
        <div>Data file: {status.dbPath}</div>
        <div>Schema version: {status.schemaVersion}</div>
      </div>
    </div>
  )
}
