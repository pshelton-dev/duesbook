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

export type TxnType = 'income' | 'expense' | 'transfer'
export type CategoryKind = 'income' | 'expense'

export interface AccountSummary {
  id: number
  name: string
  type: AccountType
  isActive: boolean
  balanceCents: number
}

export interface CategorySummary {
  id: number
  name: string
  kind: CategoryKind
  isSystem: boolean
  isActive: boolean
}

export interface TxnRow {
  id: number
  date: string
  /** signed: positive = money in, negative = money out */
  amountCents: number
  type: TxnType
  categoryId: number | null
  categoryName: string | null
  payee: string | null
  memo: string | null
  cleared: boolean
  transferPeerId: number | null
  peerAccountName: string | null
  /** account balance after this transaction (chronological order) */
  runningBalanceCents: number
  duesAllocatedCents: number
}

export interface TxnFilters {
  search?: string
  categoryId?: number
  dateFrom?: string
  dateTo?: string
  unclearedOnly?: boolean
}

export interface NewTxn {
  accountId: number
  date: string
  /** positive magnitude; sign is derived from type/direction */
  amountCents: number
  type: TxnType
  categoryId: number | null
  payee: string | null
  memo: string | null
  cleared: boolean
  /** transfers only: 'out' = money leaves accountId, 'in' = money arrives */
  transferDirection?: 'out' | 'in'
  transferAccountId?: number
}

export interface TxnUpdate {
  id: number
  date: string
  /** positive magnitude */
  amountCents: number
  categoryId: number | null
  payee: string | null
  memo: string | null
  cleared: boolean
}

export interface DuesbookApi {
  getStatus: () => Promise<AppStatus>
  chooseBackupDir: () => Promise<string | null>
  completeWizard: (payload: WizardPayload) => Promise<void>
  listAccounts: () => Promise<AccountSummary[]>
  listCategories: () => Promise<CategorySummary[]>
  createCategory: (name: string, kind: CategoryKind) => Promise<CategorySummary>
  listTxns: (accountId: number, filters: TxnFilters) => Promise<TxnRow[]>
  createTxn: (txn: NewTxn) => Promise<void>
  updateTxn: (txn: TxnUpdate) => Promise<void>
  deleteTxn: (id: number) => Promise<void>
  setTxnCleared: (id: number, cleared: boolean) => Promise<void>
}
