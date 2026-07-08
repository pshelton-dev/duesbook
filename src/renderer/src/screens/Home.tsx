import { useEffect, useState } from 'react'
import type { AppStatus } from '../../../shared/types'

export default function Home(): React.JSX.Element {
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.duesbook
      .getStatus()
      .then(setStatus)
      .catch((e) => setError(String(e)))
  }, [])

  if (error) return <div className="panel error">Could not reach the database: {error}</div>
  if (!status) return <div className="panel">Loading…</div>

  return (
    <div>
      <h1>Home</h1>
      {status.organization === null ? (
        <div className="panel notice">
          <strong>Welcome to Duesbook.</strong> No organization is set up yet — the first-run
          wizard will live here.
        </div>
      ) : (
        <div className="panel">
          Books for <strong>{status.organization.name}</strong>
        </div>
      )}
      <div className="panel meta-panel">
        <div>App version: {status.appVersion}</div>
        <div>Schema version: {status.schemaVersion}</div>
        <div>Data file: {status.dbPath}</div>
      </div>
    </div>
  )
}
