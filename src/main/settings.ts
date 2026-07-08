import type Database from 'better-sqlite3'

export function updateOrganization(
  db: Database.Database,
  name: string,
  fiscalYearStartMonth: number
): void {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Organization name is required.')
  if (
    !Number.isInteger(fiscalYearStartMonth) ||
    fiscalYearStartMonth < 1 ||
    fiscalYearStartMonth > 12
  ) {
    throw new Error('Fiscal year start month must be between 1 and 12.')
  }
  const result = db
    .prepare(`UPDATE organization SET name = ?, fiscal_year_start_month = ? WHERE id = 1`)
    .run(trimmed, fiscalYearStartMonth)
  if (result.changes === 0) throw new Error('Setup has not been completed yet.')
}

export function updateCategory(
  db: Database.Database,
  id: number,
  changes: { name?: string; isActive?: boolean }
): void {
  const cat = db
    .prepare(`SELECT id, is_system FROM category WHERE id = ?`)
    .get(id) as { id: number; is_system: number } | undefined
  if (!cat) throw new Error('That category no longer exists.')
  if (cat.is_system === 1) throw new Error('The built-in Dues category cannot be changed.')
  if (changes.name !== undefined) {
    const trimmed = changes.name.trim()
    if (!trimmed) throw new Error('Category name is required.')
    db.prepare(`UPDATE category SET name = ? WHERE id = ?`).run(trimmed, id)
  }
  if (changes.isActive !== undefined) {
    db.prepare(`UPDATE category SET is_active = ? WHERE id = ?`).run(changes.isActive ? 1 : 0, id)
  }
}

export function setBackupConfig(
  db: Database.Database,
  backupDir: string | null,
  retention: number
): void {
  if (!Number.isInteger(retention) || retention < 1 || retention > 365) {
    throw new Error('Keep between 1 and 365 backups.')
  }
  db.prepare(`UPDATE organization SET backup_dir = ?, backup_retention = ? WHERE id = 1`).run(
    backupDir, retention
  )
}

export function setUpdateCheck(db: Database.Database, enabled: boolean): void {
  db.prepare(`UPDATE organization SET update_check_enabled = ? WHERE id = 1`).run(enabled ? 1 : 0)
}

export function setArrearsThreshold(db: Database.Database, periods: number): void {
  if (!Number.isInteger(periods) || periods < 1 || periods > 24) {
    throw new Error('The arrears threshold must be between 1 and 24 periods.')
  }
  db.prepare(`UPDATE organization SET arrears_threshold = ? WHERE id = 1`).run(periods)
}
