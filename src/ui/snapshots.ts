import { Directory, File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import type { Db } from '../data/db'
import { META, getMeta } from '../data/meta'
import { SNAPSHOT_NAME, copyTo, handoffFileName, looksLikeSqlite, snapshotDue, snapshotStamp, snapshotTo } from '../data/backup'

/**
 * Where snapshots live and how they get there. Today: the app's own
 * Documents/Snapshots folder, which the Files app shows under "On My iPhone"
 * once the Info.plist keys in app.json are in a real build. Moving this to the
 * iCloud Drive container is a one-line change here plus an iCloud entitlement.
 */
export const SNAPSHOT_RETENTION = 30

export function snapshotDir(): Directory {
  const dir = new Directory(Paths.document, 'Snapshots')
  if (!dir.exists) dir.create()
  return dir
}

/** `file:///…` → filesystem path for SQLite. */
export function pathOf(uri: string): string {
  return decodeURI(uri.replace(/^file:\/\//, ''))
}

/** The YYYYMMDD-HHMMSS part of a snapshot name, so newest sorts first whatever the prefix. */
const stampOf = (name: string): string => name.match(/(\d{8}-\d{6})/)?.[1] ?? ''

export interface SnapshotFile {
  file: File
  name: string
  sizeBytes: number
  modifiedAt: string | null
}

export function listSnapshots(): SnapshotFile[] {
  return snapshotDir()
    .list()
    .filter((e): e is File => e instanceof File && SNAPSHOT_NAME.test(e.name))
    .map((f) => ({
      file: f,
      name: f.name,
      sizeBytes: f.size,
      modifiedAt: f.modificationTime ? new Date(f.modificationTime).toISOString() : null
    }))
    .sort((a, b) => stampOf(b.name).localeCompare(stampOf(a.name)))
}

/** Writes a new snapshot and prunes beyond the retention count. */
export function snapshotNow(db: Db): SnapshotFile {
  const dir = snapshotDir()
  const target = new File(dir, `duesbook-backup-${snapshotStamp()}.db`)
  snapshotTo(db, pathOf(target.uri))
  const all = listSnapshots()
  for (const old of all.slice(SNAPSHOT_RETENTION)) old.file.delete()
  return all[0]
}

/** On launch: snapshot if the preference is on and the last one is stale. Never throws. */
export function maybeAutoSnapshot(db: Db): void {
  try {
    const enabled = getMeta(db, META.snapshotsEnabled) === '1'
    if (snapshotDue(enabled, getMeta(db, META.lastBackupAt))) snapshotNow(db)
  } catch (e) {
    console.warn('Automatic snapshot failed:', e)
  }
}

/** "Save a copy" and "Export for new treasurer": a fresh copy handed to the share sheet. */
export async function shareCopy(db: Db, orgName: string, handoff: boolean): Promise<void> {
  const name = handoff ? handoffFileName(orgName) : `duesbook-copy-${snapshotStamp()}.db`
  const file = new File(Paths.cache, name)
  if (file.exists) file.delete()
  copyTo(db, pathOf(file.uri))
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/octet-stream',
    dialogTitle: handoff ? 'Export for the next treasurer' : 'Save a copy of your books'
  })
}

/** Opens the system file picker and validates the pick as a SQLite file. */
export async function pickBooksFile(): Promise<File | null> {
  const picked = await File.pickFileAsync()
  if (picked.canceled) return null
  const file = picked.result
  if (!looksLikeSqlite(file.bytesSync().subarray(0, 16))) {
    throw new Error('That file does not look like a Duesbook backup or handoff file.')
  }
  return file
}
