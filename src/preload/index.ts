import { contextBridge, ipcRenderer } from 'electron'
import type { DuesbookApi, WizardPayload } from '../shared/types'

const api: DuesbookApi = {
  getStatus: () => ipcRenderer.invoke('app:get-status'),
  chooseBackupDir: () => ipcRenderer.invoke('dialog:choose-directory'),
  completeWizard: (payload: WizardPayload) => ipcRenderer.invoke('wizard:complete', payload)
}

contextBridge.exposeInMainWorld('duesbook', api)
