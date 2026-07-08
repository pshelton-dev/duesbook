export interface OrganizationSummary {
  name: string
  fiscalYearStartMonth: number
  backupDir: string | null
}

export interface AppStatus {
  appVersion: string
  dbPath: string
  schemaVersion: number
  /** null means no organization row yet — i.e. first run, wizard required */
  organization: OrganizationSummary | null
}

export type AccountType = 'checking' | 'savings' | 'cash' | 'other'

export interface WizardAccount {
  name: string
  type: AccountType
  openingBalanceCents: number
  openingDate: string
}

export interface WizardMember {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  address: string | null
  joinDate: string | null
}

export interface WizardDues {
  label: string
  startDate: string
  endDate: string
  amountCents: number
}

export interface WizardPayload {
  orgName: string
  fiscalYearStartMonth: number
  backupDir: string | null
  accounts: WizardAccount[]
  dues: WizardDues | null
  members: WizardMember[]
}

export interface DuesbookApi {
  getStatus: () => Promise<AppStatus>
  chooseBackupDir: () => Promise<string | null>
  completeWizard: (payload: WizardPayload) => Promise<void>
}
