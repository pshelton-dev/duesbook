import { app, dialog, ipcMain } from 'electron'
import type {
  AppStatus,
  CategoryKind,
  DuesPeriodInput,
  MemberInput,
  NewTxn,
  RecordDuesPayment,
  TxnFilters,
  TxnUpdate,
  WizardMember,
  WizardPayload
} from '../shared/types'
import { writeFileSync } from 'fs'
import { getDbPath, getSchemaVersion, openDb } from './db'
import * as dues from './dues'
import * as ledger from './ledger'
import * as members from './members'
import { treasurerReport } from './reports'
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

  ipcMain.handle('dues:list-periods', () => dues.listPeriods(openDb()))
  ipcMain.handle('dues:create-period', (_e, input: DuesPeriodInput) =>
    dues.createPeriod(openDb(), input)
  )
  ipcMain.handle('dues:update-period', (_e, id: number, input: DuesPeriodInput) =>
    dues.updatePeriod(openDb(), id, input)
  )
  ipcMain.handle('dues:suggest-next-period', () => dues.suggestNextPeriod(openDb()))
  ipcMain.handle('dues:roster', (_e, periodId: number) => dues.getRoster(openDb(), periodId))
  ipcMain.handle('dues:record-payment', (_e, payment: RecordDuesPayment) =>
    dues.recordPayment(openDb(), payment)
  )
  ipcMain.handle('dues:unallocated', () => dues.listUnallocated(openDb()))
  ipcMain.handle(
    'dues:set-override',
    (_e, memberId: number, periodId: number, amountCents: number | null, note: string | null) =>
      dues.setOverride(openDb(), memberId, periodId, amountCents, note)
  )

  ipcMain.handle('reports:treasurer', (_e, dateFrom: string, dateTo: string) =>
    treasurerReport(openDb(), dateFrom, dateTo)
  )

  ipcMain.handle(
    'file:save-csv',
    async (_e, defaultName: string, content: string): Promise<string | null> => {
      const result = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (result.canceled || !result.filePath) return null
      writeFileSync(result.filePath, content, 'utf8')
      return result.filePath
    }
  )
}
