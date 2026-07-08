import { useState } from 'react'
import type {
  AccountSummary,
  CategorySummary,
  NewTxn,
  TxnRow,
  TxnType
} from '../../../../shared/types'
import { formatCents, parseDollarsToCents, todayIso } from '../../lib/money'

const NEW_CATEGORY = '__new__'

export interface DrawerProps {
  accountId: number
  accounts: AccountSummary[]
  categories: CategorySummary[]
  editing: TxnRow | null
  onSaved: () => void
  onClose: () => void
  onCategoryCreated: () => void
}

export default function TxnDrawer({
  accountId,
  accounts,
  categories,
  editing,
  onSaved,
  onClose,
  onCategoryCreated
}: DrawerProps): React.JSX.Element {
  const [type, setType] = useState<TxnType>(editing?.type ?? 'expense')
  const [date, setDate] = useState(editing?.date ?? todayIso())
  const [amount, setAmount] = useState(
    editing ? (Math.abs(editing.amountCents) / 100).toFixed(2) : ''
  )
  const [categoryId, setCategoryId] = useState<number | ''>(editing?.categoryId ?? '')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [payee, setPayee] = useState(editing?.payee ?? '')
  const [memo, setMemo] = useState(editing?.memo ?? '')
  const [cleared, setCleared] = useState(editing?.cleared ?? false)
  const [direction, setDirection] = useState<'out' | 'in'>(
    editing && editing.type === 'transfer' && editing.amountCents > 0 ? 'in' : 'out'
  )
  const [transferAccountId, setTransferAccountId] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isEdit = editing !== null
  const isTransfer = type === 'transfer'
  const kind = type === 'income' ? 'income' : 'expense'
  const categoryChoices = categories.filter((c) => c.isActive && c.kind === kind)
  const otherAccounts = accounts.filter((a) => a.id !== accountId && a.isActive)

  async function save(): Promise<void> {
    const cents = parseDollarsToCents(amount)
    if (cents === null || cents <= 0) {
      setError('Enter an amount greater than zero, like 25 or 25.50.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      let finalCategoryId = categoryId === '' ? null : categoryId
      if (!isTransfer && showNewCategory) {
        const name = newCategoryName.trim()
        if (!name) {
          setError('Name the new category.')
          setBusy(false)
          return
        }
        const created = await window.duesbook.createCategory(name, kind)
        onCategoryCreated()
        finalCategoryId = created.id
      }
      if (isEdit) {
        await window.duesbook.updateTxn({
          id: editing.id,
          date,
          amountCents: cents,
          categoryId: finalCategoryId,
          payee: payee.trim() || null,
          memo: memo.trim() || null,
          cleared
        })
      } else {
        const txn: NewTxn = {
          accountId,
          date,
          amountCents: cents,
          type,
          categoryId: isTransfer ? null : finalCategoryId,
          payee: payee.trim() || null,
          memo: memo.trim() || null,
          cleared
        }
        if (isTransfer) {
          if (transferAccountId === '') {
            setError('Choose the other account.')
            setBusy(false)
            return
          }
          txn.transferDirection = direction
          txn.transferAccountId = transferAccountId
        }
        await window.duesbook.createTxn(txn)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    if (!editing) return
    const what =
      editing.type === 'transfer'
        ? 'Delete this transfer? Both sides of it will be removed.'
        : editing.duesAllocatedCents > 0
          ? `Delete this transaction? ${formatCents(editing.duesAllocatedCents)} of member dues allocations will be removed with it.`
          : 'Delete this transaction?'
    if (!window.confirm(what)) return
    setBusy(true)
    try {
      await window.duesbook.deleteTxn(editing.id)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="drawer">
      <div className="drawer-header">
        <h2>{isEdit ? 'Edit transaction' : 'Add transaction'}</h2>
        <button className="btn small" onClick={onClose}>
          Close
        </button>
      </div>

      {!isEdit && (
        <div className="segmented">
          {(
            [
              ['income', 'Money in'],
              ['expense', 'Money out'],
              ['transfer', 'Transfer']
            ] as [TxnType, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              className={`segment ${type === t ? 'active' : ''}`}
              onClick={() => {
                setType(t)
                setCategoryId('')
                setShowNewCategory(false)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {isEdit && editing.type === 'transfer' && (
        <p className="hint">
          This is one side of a transfer{editing.peerAccountName ? ` with ${editing.peerAccountName}` : ''}.
          Changes to date, amount, payee, and memo update both sides.
        </p>
      )}

      <div className="field-row">
        <label className="field">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          Amount
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            autoFocus
          />
        </label>
      </div>

      {isTransfer && !isEdit && (
        <>
          <label className="field">
            Direction
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'out' | 'in')}
            >
              <option value="out">Out of this account</option>
              <option value="in">Into this account</option>
            </select>
          </label>
          <label className="field">
            {direction === 'out' ? 'To account' : 'From account'}
            <select
              value={transferAccountId}
              onChange={(e) =>
                setTransferAccountId(e.target.value === '' ? '' : Number(e.target.value))
              }
            >
              <option value="">Choose…</option>
              {otherAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {!isTransfer && (
        <label className="field">
          Category
          <select
            value={showNewCategory ? NEW_CATEGORY : categoryId}
            onChange={(e) => {
              if (e.target.value === NEW_CATEGORY) {
                setShowNewCategory(true)
              } else {
                setShowNewCategory(false)
                setCategoryId(e.target.value === '' ? '' : Number(e.target.value))
              }
            }}
          >
            <option value="">Choose…</option>
            {categoryChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>+ New category…</option>
          </select>
        </label>
      )}
      {showNewCategory && (
        <label className="field">
          New category name
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder={kind === 'income' ? 'e.g. Grants' : 'e.g. Printing'}
          />
        </label>
      )}

      <label className="field">
        {type === 'income' ? 'Received from' : type === 'expense' ? 'Paid to' : 'Note'}
        <input
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
          placeholder={type === 'income' ? 'e.g. Jane Smith' : 'e.g. Ace Hardware'}
        />
      </label>
      <label className="field">
        Memo
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="optional" />
      </label>
      <label className="check-field">
        <input type="checkbox" checked={cleared} onChange={(e) => setCleared(e.target.checked)} />
        Cleared (matches the bank statement)
      </label>

      {error && <div className="panel error">{error}</div>}

      <div className="drawer-footer">
        {isEdit ? (
          <button className="btn danger" onClick={remove} disabled={busy}>
            Delete
          </button>
        ) : (
          <span />
        )}
        <button className="btn primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
