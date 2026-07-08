import type Database from 'better-sqlite3'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  closeSync,
  readdirSync,
  rmSync,
  statSync
} from 'fs'
import { join } from 'path'
import type { BackupFile } from '../shared/types'
import { closeDb, getDbPath, openDb } from './db'

const BACKUP_NAME = /^duesbook-backup-\d{8}-\d{6}\.db$/

function stamp(d = new Date()): string {
  const p = (n: number, w = 2): string => String(n).padStart(w, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`
}

function getConfig(db: Database.Database): { dir: string | null; retention: number } {
  const row = db
    .prepare(`SELECT backup_dir AS dir, backup_retention AS retention FROM organization WHERE id = 1`)
    .get() as { dir: string | null; retention: number } | undefined
  return { dir: row?.dir ?? null, retention: row?.retention ?? 30 }
}

export function getLastBackupAt(db: Database.Database): string | null {
  const row = db
    .prepare(`SELECT value FROM meta WHERE key = 'last_backup_at'`)
    .get() as { value: string } | undefined
  return row?.value ?? null
}

function setLastBackupAt(db: Database.Database, at: string): void {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('last_backup_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(at)
}

function prune(dir: string, retention: number): void {
  const backups = readdirSync(dir)
    .filter((n) => BACKUP_NAME.test(n))
    .sort()
    .reverse()
  for (const name of backups.slice(Math.max(retention, 1))) {
    rmSync(join(dir, name))
  }
}

/**
 * Writes a consistent snapshot via SQLite's online backup API (safe even
 * mid-write, unlike a raw file copy of a WAL database), then prunes old
 * backups beyond the retention count.
 */
export async function backupNow(db: Database.Database): Promise<string> {
  const { dir, retention } = getConfig(db)
  if (!dir) throw new Error('No backup folder is set — choose one first.')
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, `duesbook-backup-${stamp()}.db`)
  await db.backup(dest)
  setLastBackupAt(db, new Date().toISOString())
  prune(dir, retention)
  return dest
}

/** On app start: back up if a folder is configured and the last one is stale. */
export async function maybeAutoBackup(db: Database.Database): Promise<void> {
  const { dir } = getConfig(db)
  if (!dir) return
  const last = getLastBackupAt(db)
  const staleMs = 24 * 60 * 60 * 1000
  if (last && Date.now() - new Date(last).getTime() < staleMs) return
  await backupNow(db)
}

export function listBackups(db: Database.Database): BackupFile[] {
  const { dir } = getConfig(db)
  if (!dir || !existsSync(dir)) return []
  return readdirSync(dir)
    .filter((n) => BACKUP_NAME.test(n))
    .sort()
    .reverse()
    .map((name) => {
      const path = join(dir, name)
      const st = statSync(path)
      return {
        path,
        name,
        sizeBytes: st.size,
        modifiedAt: st.mtime.toISOString()
      }
    })
}

function looksLikeSqlite(path: string): boolean {
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.alloc(16)
    readSync(fd, buf, 0, 16, 0)
    return buf.toString('utf8', 0, 15) === 'SQLite format 3'
  } finally {
    closeSync(fd)
  }
}

/**
 * Replaces the live books with a backup file. The current books are kept as a
 * pre-restore safety copy next to the live db. Reopening runs migrations, so
 * restoring a backup from an older app version upgrades it cleanly.
 */
export function restoreBackup(backupPath: string): void {
  if (!existsSync(backupPath)) throw new Error('That backup file no longer exists.')
  if (!looksLikeSqlite(backupPath)) {
    throw new Error('That file does not look like a Duesbook backup.')
  }
  const dbPath = getDbPath()
  closeDb()
  copyFileSync(dbPath, `${dbPath}.pre-restore-${stamp()}`)
  for (const suffix of ['-wal', '-shm']) {
    rmSync(`${dbPath}${suffix}`, { force: true })
  }
  copyFileSync(backupPath, dbPath)
  openDb()
}

const sanitize = (s: string): string => s.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-|-$/g, '')

/** Copies the books + a plain-language README into `dir` for the next treasurer. */
export async function exportHandoff(db: Database.Database, dir: string): Promise<void> {
  const org = db.prepare(`SELECT name FROM organization WHERE id = 1`).get() as
    | { name: string }
    | undefined
  const orgName = org?.name ?? 'organization'
  const date = new Date().toISOString().slice(0, 10)
  const bookFile = `${sanitize(orgName)}-duesbook-${date}.db`
  await db.backup(join(dir, bookFile))
  const readme = `Duesbook treasurer handoff — ${orgName}
Created ${date}

The file "${bookFile}" contains the complete books for ${orgName}:
every account, transaction, member, and dues record.

To take over as treasurer:

1. Copy the "${bookFile}" file onto your computer.
2. Install Duesbook and open it.
3. On the welcome screen, click "Taking over from a previous
   treasurer? Restore their file" and choose the copied file.
   (Already using Duesbook? Settings → Backups → "Restore from
   backup…" does the same thing.)
4. In Settings → Backups, choose a backup folder on YOUR computer so
   automatic backups continue.

Duesbook stores everything locally on your computer and sends nothing
over the internet. Keep this file somewhere safe until the new
treasurer has confirmed the books opened correctly.
`
  const { writeFileSync } = await import('fs')
  writeFileSync(join(dir, 'READ-ME-FIRST.txt'), readme, 'utf8')
}
