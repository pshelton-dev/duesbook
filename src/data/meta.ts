import type { Db } from './db'

/** Small app preferences that live with the books, in the meta table. */
export function getMeta(db: Db, key: string): string | null {
  const row = db.prepare(`SELECT value FROM meta WHERE key = ?`).get<{ value: string }>(key)
  return row?.value ?? null
}

export function setMeta(db: Db, key: string, value: string | null): void {
  if (value === null) {
    db.prepare(`DELETE FROM meta WHERE key = ?`).run(key)
    return
  }
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}

/** Keys the phone app uses. Backup timestamps share the desktop's key. */
export const META = {
  lastBackupAt: 'last_backup_at',
  snapshotsEnabled: 'snapshots_enabled',
  lastPaymentAccountId: 'last_payment_account_id',
  appLock: 'app_lock'
} as const
