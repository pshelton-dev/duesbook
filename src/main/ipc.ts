import { app, ipcMain } from 'electron'
import type { AppStatus } from '../shared/types'
import { getDbPath, getSchemaVersion, openDb } from './db'

export function registerIpc(): void {
  ipcMain.handle('app:get-status', (): AppStatus => {
    const db = openDb()
    const org = db
      .prepare(
        `SELECT name, fiscal_year_start_month AS fiscalYearStartMonth
         FROM organization WHERE id = 1`
      )
      .get() as { name: string; fiscalYearStartMonth: number } | undefined
    return {
      appVersion: app.getVersion(),
      dbPath: getDbPath(),
      schemaVersion: getSchemaVersion(db),
      organization: org ?? null
    }
  })
}
