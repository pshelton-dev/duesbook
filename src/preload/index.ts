import { contextBridge, ipcRenderer } from 'electron'
import type {
  CategoryKind,
  DuesbookApi,
  MemberInput,
  NewTxn,
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
  getMemberDetail: (id: number) => ipcRenderer.invoke('members:detail', id)
}

contextBridge.exposeInMainWorld('duesbook', api)
