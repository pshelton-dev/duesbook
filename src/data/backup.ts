import type { Db } from './db'
import { META, setMeta } from './meta'

/**
 * Snapshot = a consistent single-file copy of the books written by SQLite
 * itself (VACUUM INTO), safe even mid-WAL, exactly like the desktop's online
 * backup. Platform code decides where the file goes; this decides what it is.
 */
export const SNAPSHOT_NAME = /^duesbook-backup-\d{8}-\d{6}\.db$/

export function snapshotStamp(d = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** Writes the books to `absolutePath` (must not exist yet) and records the time. */
export function snapshotTo(db: Db, absolutePath: string): void {
  db.exec(`VACUUM INTO '${absolutePath.replace(/'/g, "''")}'`)
  setMeta(db, META.lastBackupAt, new Date().toISOString())
}

/** Copies the books to a file without touching last_backup_at (exports, handoff). */
export function copyTo(db: Db, absolutePath: string): void {
  db.exec(`VACUUM INTO '${absolutePath.replace(/'/g, "''")}'`)
}

/** True when the first bytes carry SQLite's magic header. */
export function looksLikeSqlite(head: Uint8Array): boolean {
  const magic = 'SQLite format 3'
  if (head.length < magic.length) return false
  for (let i = 0; i < magic.length; i++) if (head[i] !== magic.charCodeAt(i)) return false
  return true
}

/** Whether an automatic snapshot is due: enabled and none in the last day. */
export function snapshotDue(enabled: boolean, lastBackupAt: string | null, now = Date.now()): boolean {
  if (!enabled) return false
  if (!lastBackupAt) return true
  return now - new Date(lastBackupAt).getTime() >= 24 * 60 * 60 * 1000
}

/** Handoff file name: "<org>-duesbook-<date>.duesbook". */
export function handoffFileName(orgName: string, date = new Date().toISOString().slice(0, 10)): string {
  const slug = orgName.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'organization'
  return `${slug}-duesbook-${date}.duesbook`
}
