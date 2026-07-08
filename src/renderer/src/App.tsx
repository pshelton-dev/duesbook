import { useState } from 'react'
import Home from './screens/Home'
import Placeholder from './screens/Placeholder'

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
        {screen === 'home' ? <Home /> : <Placeholder name={SCREENS.find((s) => s.id === screen)!.label} />}
      </main>
    </div>
  )
}
