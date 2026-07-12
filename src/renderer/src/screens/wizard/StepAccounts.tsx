import { useState } from 'react'
import type { AccountType, WizardAccount } from '../../../../shared/types'
import { formatCents, parseDollarsToCents } from '../../lib/money'

const TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  cash: 'Cash box',
  other: 'Other'
}

export default function StepAccounts({
  accounts,
  onChange,
  booksStart
}: {
  accounts: WizardAccount[]
  onChange: (accounts: WizardAccount[]) => void
  booksStart: string
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [balance, setBalance] = useState('')
  const [error, setError] = useState<string | null>(null)

  function add(): void {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the account a name.')
      return
    }
    if (accounts.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('An account with that name is already in the list.')
      return
    }
    const cents = balance.trim() === '' ? 0 : parseDollarsToCents(balance)
    if (cents === null) {
      setError('Enter the balance as a number, like 1250.75.')
      return
    }
    onChange([
      ...accounts,
      { name: trimmed, type, openingBalanceCents: cents, openingDate: booksStart }
    ])
    setName('')
    setBalance('')
    setError(null)
  }

  return (
    <>
      <h1>Accounts</h1>
      <p className="lead">
        Add each place your organization keeps money — usually a checking account, maybe savings
        or a cash box. Enter each balance <strong>as of {booksStart}</strong>, when your books
        start — use the statement closest to that date.
      </p>

      {accounts.length > 0 && (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Type</th>
              <th className="num">Balance as of {booksStart}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.name}>
                <td>{a.name}</td>
                <td>{TYPE_LABELS[a.type]}</td>
                <td className="num">{formatCents(a.openingBalanceCents)}</td>
                <td>
                  <button
                    className="btn small"
                    onClick={() => onChange(accounts.filter((x) => x !== a))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="add-form">
        <label className="field">
          Account name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Club Checking"
          />
        </label>
        <label className="field">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {(Object.keys(TYPE_LABELS) as AccountType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Balance
          <input
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
          />
        </label>
        <button className="btn" onClick={add}>
          Add account
        </button>
      </div>
      {error && <div className="panel error">{error}</div>}
    </>
  )
}
