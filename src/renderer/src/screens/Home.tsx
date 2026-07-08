import type { AppStatus } from '../../../shared/types'
import { MONTH_NAMES } from '../lib/fiscal'

export default function Home({ status }: { status: AppStatus }): React.JSX.Element {
  const org = status.organization!

  return (
    <div>
      <h1>Home</h1>
      <div className="panel">
        Books for <strong>{org.name}</strong> · fiscal year starts in{' '}
        {MONTH_NAMES[org.fiscalYearStartMonth - 1]}
      </div>
      {org.backupDir === null && (
        <div className="panel warn">
          <strong>Automatic backups are not set up.</strong> If this computer is lost, your
          organization&rsquo;s books go with it. Choose a backup folder in Settings.
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
