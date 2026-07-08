import { contextBridge, ipcRenderer } from 'electron'
import type { DuesbookApi } from '../shared/types'

const api: DuesbookApi = {
  getStatus: () => ipcRenderer.invoke('app:get-status')
}

contextBridge.exposeInMainWorld('duesbook', api)
