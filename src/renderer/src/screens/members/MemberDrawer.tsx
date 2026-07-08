import { useState } from 'react'
import type { MemberDetail, MemberInput } from '../../../../shared/types'
import { todayIso } from '../../lib/money'

export default function MemberDrawer({
  editing,
  onSaved,
  onClose
}: {
  editing: MemberDetail | null
  onSaved: () => void
  onClose: () => void
}): React.JSX.Element {
  const [firstName, setFirstName] = useState(editing?.firstName ?? '')
  const [lastName, setLastName] = useState(editing?.lastName ?? '')
  const [email, setEmail] = useState(editing?.email ?? '')
  const [phone, setPhone] = useState(editing?.phone ?? '')
  const [address, setAddress] = useState(editing?.address ?? '')
  const [joinDate, setJoinDate] = useState(editing?.joinDate ?? '')
  const [leftDate, setLeftDate] = useState(editing?.leftDate ?? '')
  const [duesExempt, setDuesExempt] = useState(editing?.duesExempt ?? false)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isEdit = editing !== null

  function buildInput(): MemberInput {
    return {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      joinDate: joinDate || null,
      leftDate: leftDate || null,
      duesExempt,
      notes: notes.trim() || null
    }
  }

  async function save(): Promise<void> {
    if (!firstName.trim() && !lastName.trim()) {
      setError('A member needs a name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (isEdit) await window.duesbook.updateMember(editing.id, buildInput())
      else await window.duesbook.createMember(buildInput())
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    if (!editing) return
    if (!window.confirm(`Delete ${editing.firstName} ${editing.lastName}?`)) return
    setBusy(true)
    try {
      await window.duesbook.deleteMember(editing.id)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="drawer">
      <div className="drawer-header">
        <h2>{isEdit ? 'Edit member' : 'Add member'}</h2>
        <button className="btn small" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="field-row">
        <label className="field">
          First name
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
        </label>
        <label className="field">
          Last name
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>
      </div>
      <label className="field">
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        Phone
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="field">
        Address
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          Joined
          <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
        </label>
        <label className="field">
          Left
          <input type="date" value={leftDate} onChange={(e) => setLeftDate(e.target.value)} />
        </label>
      </div>
      {isEdit && !leftDate && (
        <button className="btn small" onClick={() => setLeftDate(todayIso())}>
          Mark as left today
        </button>
      )}
      <label className="check-field">
        <input
          type="checkbox"
          checked={duesExempt}
          onChange={(e) => setDuesExempt(e.target.checked)}
        />
        Exempt from dues (honorary/lifetime member)
      </label>
      <label className="field">
        Notes
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
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
