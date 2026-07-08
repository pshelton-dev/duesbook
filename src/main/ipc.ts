import { app, dialog, ipcMain } from 'electron'
import type { AppStatus, WizardPayload } from '../shared/types'
import { getDbPath, getSchemaVersion, openDb } from './db'
import { completeWizard } from './wizard'

export function registerIpc(): void {
  ipcMain.handle('app:get-status', (): AppStatus => {
    const db = openDb()
    const org = db
      .prepare(
        `SELECT name,
                fiscal_year_start_month AS fiscalYearStartMonth,
                backup_dir AS backupDir
         FROM organization WHERE id = 1`
      )
      .get() as
      | { name: string; fiscalYearStartMonth: number; backupDir: string | null }
      | undefined
    return {
      appVersion: app.getVersion(),
      dbPath: getDbPath(),
      schemaVersion: getSchemaVersion(db),
      organization: org ?? null
    }
  })

  ipcMain.handle('dialog:choose-directory', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a backup folder',
      message: 'Duesbook will keep timestamped backups of your books in this folder.',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('wizard:complete', (_event, payload: WizardPayload): void => {
    completeWizard(openDb(), payload)
  })
}
