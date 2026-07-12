export interface OrganizationSummary {
  name: string
  fiscalYearStartMonth: number
  backupDir: string | null
  backupRetention: number
  updateCheckEnabled: boolean
  /** flag members with outstanding dues in this many periods (usually months) */
  arrearsThreshold: number
}

export interface AppStatus {
  appVersion: string
  dbPath: string
  schemaVersion: number
  /** null means no organization row yet — i.e. first run, wizard required */
  organization: OrganizationSummary | null
  lastBackupAt: string | null
}

export interface BackupFile {
  path: string
  name: string
  sizeBytes: number
  modifiedAt: string
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
  openingBalanceCents: number
  openingDate: string
}

export interface AccountUpdate {
  name: string
  openingBalanceCents: number
  openingDate: string
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

export type DuesStatus = 'paid' | 'partial' | 'owed' | 'waived' | 'exempt' | 'na'

export interface MemberRow {
  id: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  joinDate: string | null
  leftDate: string | null
  duesExempt: boolean
  duesStatus: DuesStatus
  /** total outstanding across ALL started periods, not just the current one */
  owedCents: number
  /** total paid across all periods */
  paidCents: number
  /** count of started periods with an outstanding balance */
  periodsBehind: number
}

export interface MemberInput {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  address: string | null
  joinDate: string | null
  leftDate: string | null
  duesExempt: boolean
  notes: string | null
}

export interface MemberPayment {
  date: string
  amountCents: number
  txnId: number
  accountName: string
}

export interface MemberPeriodHistory {
  periodLabel: string
  owedCents: number
  paidCents: number
  status: DuesStatus
  payments: MemberPayment[]
}

export interface MemberDetail extends MemberInput {
  id: number
  history: MemberPeriodHistory[]
}

export interface DuesPeriodRow {
  id: number
  label: string
  startDate: string
  endDate: string
  amountCents: number
  isCurrent: boolean
}

export interface DuesPeriodInput {
  label: string
  startDate: string
  endDate: string
  amountCents: number
}

export interface DuesRosterRow {
  memberId: number
  firstName: string
  lastName: string
  duesExempt: boolean
  overrideCents: number | null
  overrideNote: string | null
  /** what this member is expected to pay for the period (after override/exemption) */
  baseCents: number
  paidCents: number
  outstandingCents: number
  status: DuesStatus
}

export interface DuesRoster {
  rows: DuesRosterRow[]
  summary: {
    collectedCents: number
    outstandingCents: number
    paidCount: number
    expectedCount: number
  }
}

export interface UnallocatedDeposit {
  txnId: number
  date: string
  amountCents: number
  allocatedCents: number
  payee: string | null
  accountName: string
}

export interface DuesAllocation {
  memberId: number
  amountCents: number
}

export interface RecordDuesPayment {
  periodId: number
  allocations: DuesAllocation[]
  /** allocate against this existing deposit; null = create a new ledger transaction */
  txnId: number | null
  /** required when txnId is null */
  accountId: number | null
  date: string | null
  /** check number / note — becomes the transaction memo */
  memo: string | null
}

export interface TreasurerReport {
  dateFrom: string
  dateTo: string
  accounts: { name: string; openingCents: number; closingCents: number }[]
  incomeByCategory: { category: string; cents: number }[]
  /** positive numbers */
  expenseByCategory: { category: string; cents: number }[]
  totalIncomeCents: number
  totalExpenseCents: number
  netCents: number
}

export interface HomeSummary {
  accounts: AccountSummary[]
  duesPeriodLabel: string | null
  dues: {
    collectedCents: number
    outstandingCents: number
    paidCount: number
    expectedCount: number
  } | null
  recent: {
    id: number
    date: string
    accountName: string
    description: string
    categoryName: string | null
    amountCents: number
  }[]
  unallocatedCount: number
  arrears: {
    threshold: number
    members: {
      memberId: number
      firstName: string
      lastName: string
      periodsBehind: number
      owedCents: number
    }[]
  }
}

export interface UpdateInfo {
  version: string
  url: string
}

/* ---------- Bank import (see BANK-IMPORT-PLAN.md) ---------- */

import type { BankGrid, NormalizedBankRow } from './bank-import'

export type BankFileFormat = 'csv' | 'xlsx' | 'ofx'

/** Result of the open-file dialog + parse; null when the dialog is cancelled. */
export interface BankFileResult {
  fileName: string
  format: BankFileFormat
  /** csv/xlsx: raw table for the mapping step. */
  grid: BankGrid | null
  /** ofx: rows arrive already normalized (no mapping step). Phase 3. */
  rows: NormalizedBankRow[] | null
}

/** A row the engine will insert; fingerprint computed at reconcile time. */
export interface ImportAddition {
  row: NormalizedBankRow
  fingerprint: string | null
}

export interface ImportDuplicate {
  row: NormalizedBankRow
  reason: 'fingerprint' | 'fitid' | 'cleared-match'
  existingTxnId: number
}

/** Proposed reconcile: mark this existing uncleared txn cleared. */
export interface ImportMatch {
  row: NormalizedBankRow
  fingerprint: string | null
  existingTxnId: number
  existingPayee: string | null
  existingDate: string
}

export interface ImportPreview {
  additions: ImportAddition[]
  matches: ImportMatch[]
  duplicates: ImportDuplicate[]
}

/** What the user accepted in the preview. */
export interface ImportDecisions {
  additions: ImportAddition[]
  matches: { existingTxnId: number; fitid: string | null; fingerprint: string | null }[]
}

export interface ImportCommitResult {
  added: number
  markedCleared: number
  /** Path of the pre-import backup, or null when no backup folder is configured. */
  backupPath: string | null
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
  listMembers: () => Promise<MemberRow[]>
  createMember: (member: MemberInput) => Promise<void>
  updateMember: (id: number, member: MemberInput) => Promise<void>
  deleteMember: (id: number) => Promise<void>
  importMembers: (members: WizardMember[]) => Promise<number>
  getMemberDetail: (id: number) => Promise<MemberDetail>
  listDuesPeriods: () => Promise<DuesPeriodRow[]>
  createDuesPeriod: (input: DuesPeriodInput) => Promise<number>
  updateDuesPeriod: (id: number, input: DuesPeriodInput) => Promise<void>
  suggestNextDuesPeriod: () => Promise<DuesPeriodInput | null>
  getDuesRoster: (periodId: number) => Promise<DuesRoster>
  recordDuesPayment: (payment: RecordDuesPayment) => Promise<void>
  listUnallocatedDuesDeposits: () => Promise<UnallocatedDeposit[]>
  setDuesOverride: (
    memberId: number,
    periodId: number,
    amountCents: number | null,
    note: string | null
  ) => Promise<void>
  getTreasurerReport: (dateFrom: string, dateTo: string) => Promise<TreasurerReport>
  /** opens a save dialog; returns the saved path or null if cancelled */
  saveCsv: (defaultName: string, content: string) => Promise<string | null>
  updateOrganization: (name: string, fiscalYearStartMonth: number) => Promise<void>
  updateCategory: (id: number, changes: { name?: string; isActive?: boolean }) => Promise<void>
  setBackupConfig: (backupDir: string | null, retention: number) => Promise<void>
  /** returns the path of the backup written */
  backupNow: () => Promise<string>
  listBackups: () => Promise<BackupFile[]>
  restoreBackup: (path: string) => Promise<void>
  /** returns the folder exported into, or null if cancelled */
  exportHandoff: () => Promise<string | null>
  setUpdateCheck: (enabled: boolean) => Promise<void>
  /** file picker + restore in one step (used on the wizard's welcome step); false if cancelled */
  chooseAndRestoreBackup: () => Promise<boolean>
  getHomeSummary: () => Promise<HomeSummary>
  /** null = up to date, disabled, or offline (never an error) */
  checkForUpdate: () => Promise<UpdateInfo | null>
  setArrearsThreshold: (periods: number) => Promise<void>
  updateAccount: (id: number, input: AccountUpdate) => Promise<void>
  /** file picker + parse; null if cancelled */
  openBankFile: () => Promise<BankFileResult | null>
  previewBankImport: (accountId: number, rows: NormalizedBankRow[]) => Promise<ImportPreview>
  commitBankImport: (accountId: number, decisions: ImportDecisions) => Promise<ImportCommitResult>
}
