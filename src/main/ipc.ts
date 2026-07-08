import { app, dialog, ipcMain } from 'electron'
import type {
  AppStatus,
  CategoryKind,
  MemberInput,
  NewTxn,
  TxnFilters,
  TxnUpdate,
  WizardMember,
  WizardPayload
} from '../shared/types'
import { getDbPath, getSchemaVersion, openDb } from './db'
import * as ledger from './ledger'
import * as members from './members'
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

  ipcMain.handle('accounts:list', () => ledger.listAccounts(openDb()))
  ipcMain.handle('categories:list', () => ledger.listCategories(openDb()))
  ipcMain.handle('categories:create', (_e, name: string, kind: CategoryKind) =>
    ledger.createCategory(openDb(), name, kind)
  )
  ipcMain.handle('txn:list', (_e, accountId: number, filters: TxnFilters) =>
    ledger.listTxns(openDb(), accountId, filters)
  )
  ipcMain.handle('txn:create', (_e, txn: NewTxn) => ledger.createTxn(openDb(), txn))
  ipcMain.handle('txn:update', (_e, txn: TxnUpdate) => ledger.updateTxn(openDb(), txn))
  ipcMain.handle('txn:delete', (_e, id: number) => ledger.deleteTxn(openDb(), id))
  ipcMain.handle('txn:set-cleared', (_e, id: number, cleared: boolean) =>
    ledger.setTxnCleared(openDb(), id, cleared)
  )

  ipcMain.handle('members:list', () => members.listMembers(openDb()))
  ipcMain.handle('members:create', (_e, m: MemberInput) => members.createMember(openDb(), m))
  ipcMain.handle('members:update', (_e, id: number, m: MemberInput) =>
    members.updateMember(openDb(), id, m)
  )
  ipcMain.handle('members:delete', (_e, id: number) => members.deleteMember(openDb(), id))
  ipcMain.handle('members:import', (_e, list: WizardMember[]) =>
    members.importMembers(openDb(), list)
  )
  ipcMain.handle('members:detail', (_e, id: number) => members.getMemberDetail(openDb(), id))
}
