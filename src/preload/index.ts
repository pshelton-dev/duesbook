import { contextBridge, ipcRenderer } from 'electron'
import type {
  CategoryKind,
  DuesbookApi,
  NewTxn,
  TxnFilters,
  TxnUpdate,
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
    ipcRenderer.invoke('txn:set-cleared', id, cleared)
}

contextBridge.exposeInMainWorld('duesbook', api)
