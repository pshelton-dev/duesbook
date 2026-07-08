import { useCallback, useEffect, useState } from 'react'
import type { AppStatus } from '../../shared/types'
import Home from './screens/Home'
import Dues from './screens/dues/Dues'
import Ledger from './screens/ledger/Ledger'
import Members from './screens/members/Members'
import Reports from './screens/reports/Reports'
import Placeholder from './screens/Placeholder'
import Wizard from './screens/wizard/Wizard'

const SCREENS = [
  { id: 'home', label: 'Home' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'members', label: 'Members' },
  { id: 'dues', label: 'Dues' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' }
] as const

type ScreenId = (typeof SCREENS)[number]['id']

export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<ScreenId>('home')
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    window.duesbook
      .getStatus()
      .then(setStatus)
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(refresh, [refresh])

  if (error) return <div className="panel error">Could not reach the database: {error}</div>
  if (!status) return <div className="panel">Loading…</div>
  if (!status.organization) return <Wizard onDone={refresh} />

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">Duesbook</div>
        {SCREENS.map((s) => (
          <button
            key={s.id}
            className={`nav-item ${screen === s.id ? 'active' : ''}`}
            onClick={() => setScreen(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <main className="content">
        {screen === 'home' ? (
          <Home status={status} />
        ) : screen === 'ledger' ? (
          <Ledger />
        ) : screen === 'members' ? (
          <Members />
        ) : screen === 'dues' ? (
          <Dues />
        ) : screen === 'reports' ? (
          <Reports org={status.organization} />
        ) : (
          <Placeholder name={SCREENS.find((s) => s.id === screen)!.label} />
        )}
      </main>
    </div>
  )
}
