import { useState } from 'react'
import type { WizardAccount, WizardMember, WizardPayload } from '../../../../shared/types'
import { currentFiscalPeriod, MONTH_NAMES } from '../../lib/fiscal'
import { parseDollarsToCents } from '../../lib/money'
import StepAccounts from './StepAccounts'
import StepMembers from './StepMembers'

const STEPS = ['Organization', 'Accounts', 'Backups', 'Dues', 'Members'] as const

export default function Wizard({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [orgName, setOrgName] = useState('')
  const [fyMonth, setFyMonth] = useState(1)
  const [accounts, setAccounts] = useState<WizardAccount[]>([])
  const [backupDir, setBackupDir] = useState<string | null>(null)
  const [duesEnabled, setDuesEnabled] = useState(true)
  const [duesInitialized, setDuesInitialized] = useState(false)
  const [duesAmount, setDuesAmount] = useState('')
  const [duesLabel, setDuesLabel] = useState('')
  const [duesStart, setDuesStart] = useState('')
  const [duesEnd, setDuesEnd] = useState('')
  const [members, setMembers] = useState<WizardMember[]>([])

  function validateStep(): string | null {
    if (step === 0 && !orgName.trim()) return 'Give your organization a name.'
    if (step === 1 && accounts.length === 0) return 'Add at least one account.'
    if (step === 3 && duesEnabled) {
      if (!duesLabel.trim()) return 'The dues period needs a label.'
      if (!duesStart || !duesEnd) return 'Set the dues period start and end dates.'
      if (duesStart >= duesEnd) return 'The dues period must start before it ends.'
      const cents = parseDollarsToCents(duesAmount)
      if (cents === null || cents < 0) return 'Enter a valid dues amount (like 50 or 49.50).'
    }
    return null
  }

  function next(): void {
    const problem = validateStep()
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    if (step === 2 && !duesInitialized) {
      const period = currentFiscalPeriod(fyMonth)
      setDuesLabel(period.label)
      setDuesStart(period.startDate)
      setDuesEnd(period.endDate)
      setDuesInitialized(true)
    }
    setStep(step + 1)
  }

  function back(): void {
    setError(null)
    if (step > 0) setStep(step - 1)
  }

  async function finish(): Promise<void> {
    const problem = validateStep()
    if (problem) {
      setError(problem)
      return
    }
    const payload: WizardPayload = {
      orgName: orgName.trim(),
      fiscalYearStartMonth: fyMonth,
      backupDir,
      accounts,
      dues: duesEnabled
        ? {
            label: duesLabel.trim(),
            startDate: duesStart,
            endDate: duesEnd,
            amountCents: parseDollarsToCents(duesAmount)!
          }
        : null,
      members
    }
    setBusy(true)
    setError(null)
    try {
      await window.duesbook.completeWizard(payload)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  async function chooseFolder(): Promise<void> {
    const dir = await window.duesbook.chooseBackupDir()
    if (dir) setBackupDir(dir)
  }

  return (
    <div className="wizard-backdrop">
      <div className="wizard">
        <div className="wizard-steps">
          {STEPS.map((label, i) => (
            <div key={label} className={`wizard-step ${i === step ? 'current' : i < step ? 'done' : ''}`}>
              <span className="wizard-step-num">{i + 1}</span> {label}
            </div>
          ))}
        </div>

        <div className="wizard-body">
          {step === 0 && (
            <>
              <h1>Welcome to Duesbook</h1>
              <p className="lead">
                Let&rsquo;s set up your organization&rsquo;s books. This takes about five minutes,
                and everything stays on this computer.
              </p>
              <label className="field">
                Organization name
                <input
                  autoFocus
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Maple Grove Garden Club"
                />
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
              <p className="hint">
                Many organizations run July to June; if yours follows the calendar year, leave
                this on January. You can change it later in Settings.
              </p>
              <p style={{ marginTop: 24 }}>
                <button
                  className="btn small"
                  onClick={async () => {
                    const ok = await window.duesbook.chooseAndRestoreBackup()
                    if (ok) onDone()
                  }}
                >
                  Taking over from a previous treasurer? Restore their file…
                </button>
              </p>
            </>
          )}

          {step === 1 && <StepAccounts accounts={accounts} onChange={setAccounts} />}

          {step === 2 && (
            <>
              <h1>Automatic backups</h1>
              <p className="lead">
                Your books live in a single file on this computer. If this computer fails,
                backups are the only copy — choose a folder and Duesbook will keep timestamped
                backups there automatically. A folder synced to a cloud drive works well if your
                organization is comfortable with that.
              </p>
              {backupDir ? (
                <div className="panel notice">
                  Backups will be saved to: <code>{backupDir}</code>
                </div>
              ) : (
                <div className="panel warn">
                  No backup folder chosen yet. You can skip this, but if this computer is lost,
                  <strong> your organization&rsquo;s records go with it</strong>.
                </div>
              )}
              <button className="btn" onClick={chooseFolder}>
                Choose backup folder…
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <h1>Dues</h1>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={duesEnabled}
                  onChange={(e) => setDuesEnabled(e.target.checked)}
                />
                Track membership dues
              </label>
              {duesEnabled && (
                <>
                  <label className="field">
                    Dues amount per member
                    <input
                      value={duesAmount}
                      onChange={(e) => setDuesAmount(e.target.value)}
                      placeholder="e.g. 50"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="field">
                    Period label
                    <input value={duesLabel} onChange={(e) => setDuesLabel(e.target.value)} />
                  </label>
                  <div className="field-row">
                    <label className="field">
                      Period starts
                      <input
                        type="date"
                        value={duesStart}
                        onChange={(e) => setDuesStart(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Period ends
                      <input
                        type="date"
                        value={duesEnd}
                        onChange={(e) => setDuesEnd(e.target.value)}
                      />
                    </label>
                  </div>
                  <p className="hint">
                    Prefilled from your fiscal year. Individual waivers and prorated amounts can
                    be set per member later.
                  </p>
                </>
              )}
            </>
          )}

          {step === 4 && <StepMembers members={members} onChange={setMembers} />}

          {error && <div className="panel error">{error}</div>}
        </div>

        <div className="wizard-footer">
          <button className="btn" onClick={back} disabled={step === 0 || busy}>
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn primary" onClick={next}>
              Next
            </button>
          ) : (
            <button className="btn primary" onClick={finish} disabled={busy}>
              {busy ? 'Setting up…' : 'Finish setup'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
