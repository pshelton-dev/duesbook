import { openDatabaseSync } from 'expo-sqlite'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { wrapExpoDb } from '../data/adapters/expo-sqlite'
import { configure, migrate, type Db } from '../data/db'
import { ensurePeriodsCurrent } from '../data/dues'

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
}

const BooksContext = createContext<Books | null>(null)

export const DB_NAME = 'duesbook.db'

function open(): Db {
  const db = wrapExpoDb(openDatabaseSync(DB_NAME))
  configure(db)
  migrate(db)
  ensurePeriodsCurrent(db)
  return db
}

function orgExists(db: Db): boolean {
  return db.prepare(`SELECT 1 FROM organization WHERE id = 1`).get() !== undefined
}

export function BooksProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const db = useMemo(open, [])
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])
  const hasOrg = useMemo(() => orgExists(db), [db, version])
  const value = useMemo(() => ({ db, version, bump, hasOrg }), [db, version, bump, hasOrg])
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
