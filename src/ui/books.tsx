import { Directory, File } from 'expo-file-system'
import { defaultDatabaseDirectory, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { wrapExpoDb } from '../data/adapters/expo-sqlite'
import { copyTo, snapshotStamp } from '../data/backup'
import { configure, migrate, type Db } from '../data/db'
import { ensurePeriodsCurrent } from '../data/dues'
import { maybeAutoSnapshot, pathOf, snapshotDir } from './snapshots'

/**
 * Opens the books once for the whole app and hands out the connection.
 * Screens read through `useQuery`, which re-runs after any write bumps the
 * version, mirroring the desktop's "refresh after save" pattern with one
 * counter instead of per-screen reloads.
 */
interface Books {
  db: Db
  version: number
  /** Call after any write so every screen re-reads. */
  bump: () => void
  hasOrg: boolean
  /** Replace the live books with `file` (a snapshot or handoff), keeping a safety copy. */
  restore: (file: File) => void
}

const BooksContext = createContext<Books | null>(null)

export const DB_NAME = 'duesbook.db'

interface Opened {
  raw: SQLiteDatabase
  db: Db
}

function open(): Opened {
  // A fresh connection every time: expo-sqlite caches handles by name, and a
  // cached handle would keep reading the file a restore just replaced.
  const raw = openDatabaseSync(DB_NAME, { useNewConnection: true })
  const db = wrapExpoDb(raw)
  configure(db)
  migrate(db)
  if (orgExists(db)) {
    ensurePeriodsCurrent(db)
    maybeAutoSnapshot(db)
  }
  return { raw, db }
}

function orgExists(db: Db): boolean {
  return db.prepare(`SELECT 1 FROM organization WHERE id = 1`).get() !== undefined
}

function dbDirectory(): Directory {
  const p = String(defaultDatabaseDirectory)
  return new Directory(p.startsWith('file:') ? p : `file://${p}`)
}

export function BooksProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [opened, setOpened] = useState<Opened>(open)
  const openedRef = useRef(opened)
  openedRef.current = opened
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const restore = useCallback((file: File) => {
    const dir = dbDirectory()
    const live = new File(dir, DB_NAME)
    // Safety copy of the current books next to the snapshots, written by
    // SQLite so it is consistent even with a WAL in flight.
    const safety = new File(snapshotDir(), `duesbook-pre-restore-${snapshotStamp()}.db`)
    if (safety.exists) safety.delete()
    copyTo(openedRef.current.db, pathOf(safety.uri))
    openedRef.current.raw.closeSync()
    for (const suffix of ['-wal', '-shm']) {
      const side = new File(dir, `${DB_NAME}${suffix}`)
      if (side.exists) side.delete()
    }
    if (live.exists) live.delete()
    file.copySync(live)
    const next = open() // reopening runs migrations, so older files upgrade cleanly
    setOpened(next)
    setVersion((v) => v + 1)
  }, [])

  const hasOrg = useMemo(() => orgExists(opened.db), [opened, version])
  const value = useMemo(
    () => ({ db: opened.db, version, bump, hasOrg, restore }),
    [opened, version, bump, hasOrg, restore]
  )
  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>
}

export function useBooks(): Books {
  const ctx = useContext(BooksContext)
  if (!ctx) throw new Error('useBooks must be used inside BooksProvider')
  return ctx
}

/** Synchronous read that re-runs when the books change or `deps` change. */
export function useQuery<T>(read: (db: Db) => T, deps: unknown[] = []): T {
  const { db, version } = useBooks()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => read(db), [db, version, ...deps])
}
