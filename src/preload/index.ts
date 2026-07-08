import { contextBridge, ipcRenderer } from 'electron'
import type {
  CategoryKind,
  DuesbookApi,
  DuesPeriodInput,
  MemberInput,
  NewTxn,
  RecordDuesPayment,
  TxnFilters,
  TxnUpdate,
  WizardMember,
  WizardPayload
} from '../shared/types'

const api: DuesbookApi = {
  getStatus: () => ipcRenderer.invoke('app:get-status'),
  chooseBackupDir: () => ipcRenderer.invoke('dialog:choose-directory'),
  completeWizard: (payload: WizardPayload) => ipcRenderer.invoke('wizard:complete', payload),
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  listCategories: () => ipcRenderer.invoke('categories:list'),
  createCategory: (name: string, kind: CategoryKind) =>
    ipcRenderer.invoke('categories:create', name, kind),
  listTxns: (accountId: number, filters: TxnFilters) =>
    ipcRenderer.invoke('txn:list', accountId, filters),
  createTxn: (txn: NewTxn) => ipcRenderer.invoke('txn:create', txn),
  updateTxn: (txn: TxnUpdate) => ipcRenderer.invoke('txn:update', txn),
  deleteTxn: (id: number) => ipcRenderer.invoke('txn:delete', id),
  setTxnCleared: (id: number, cleared: boolean) =>
    ipcRenderer.invoke('txn:set-cleared', id, cleared),
  listMembers: () => ipcRenderer.invoke('members:list'),
  createMember: (member: MemberInput) => ipcRenderer.invoke('members:create', member),
  updateMember: (id: number, member: MemberInput) =>
    ipcRenderer.invoke('members:update', id, member),
  deleteMember: (id: number) => ipcRenderer.invoke('members:delete', id),
  importMembers: (list: WizardMember[]) => ipcRenderer.invoke('members:import', list),
  getMemberDetail: (id: number) => ipcRenderer.invoke('members:detail', id),
  listDuesPeriods: () => ipcRenderer.invoke('dues:list-periods'),
  createDuesPeriod: (input: DuesPeriodInput) => ipcRenderer.invoke('dues:create-period', input),
  updateDuesPeriod: (id: number, input: DuesPeriodInput) =>
    ipcRenderer.invoke('dues:update-period', id, input),
  suggestNextDuesPeriod: () => ipcRenderer.invoke('dues:suggest-next-period'),
  getDuesRoster: (periodId: number) => ipcRenderer.invoke('dues:roster', periodId),
  recordDuesPayment: (payment: RecordDuesPayment) =>
    ipcRenderer.invoke('dues:record-payment', payment),
  listUnallocatedDuesDeposits: () => ipcRenderer.invoke('dues:unallocated'),
  setDuesOverride: (
    memberId: number,
    periodId: number,
    amountCents: number | null,
    note: string | null
  ) => ipcRenderer.invoke('dues:set-override', memberId, periodId, amountCents, note),
  getTreasurerReport: (dateFrom: string, dateTo: string) =>
    ipcRenderer.invoke('reports:treasurer', dateFrom, dateTo),
  saveCsv: (defaultName: string, content: string) =>
    ipcRenderer.invoke('file:save-csv', defaultName, content),
  updateOrganization: (name: string, fiscalYearStartMonth: number) =>
    ipcRenderer.invoke('org:update', name, fiscalYearStartMonth),
  updateCategory: (id: number, changes: { name?: string; isActive?: boolean }) =>
    ipcRenderer.invoke('categories:update', id, changes),
  setBackupConfig: (backupDir: string | null, retention: number) =>
    ipcRenderer.invoke('backup:set-config', backupDir, retention),
  backupNow: () => ipcRenderer.invoke('backup:now'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restoreBackup: (path: string) => ipcRenderer.invoke('backup:restore', path),
  exportHandoff: () => ipcRenderer.invoke('handoff:export'),
  setUpdateCheck: (enabled: boolean) => ipcRenderer.invoke('app:set-update-check', enabled),
  chooseAndRestoreBackup: () => ipcRenderer.invoke('backup:choose-and-restore'),
  getHomeSummary: () => ipcRenderer.invoke('home:summary'),
  checkForUpdate: () => ipcRenderer.invoke('update:check')
}

contextBridge.exposeInMainWorld('duesbook', api)
