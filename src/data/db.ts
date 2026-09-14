import { migrations } from './migrations'

/**
 * The one seam between the data layer and a SQLite driver. Shaped like
 * better-sqlite3 (which the desktop app used) so the modules in this folder
 * port line-for-line: `prepare().get/all/run`, `exec`, and a synchronous
 * `transaction`. Two adapters implement it: expo-sqlite for the app, and
 * Node's built-in `node:sqlite` for tests on a desktop with no native build.
 *
 * Parameters: positional `?` bound from arguments, or one object bound to
 * `@name` placeholders with bare keys (`{ periodId }`). Adapters add whatever
 * prefix their driver wants.
 */
export type BindValue = string | number | null | Uint8Array
export type NamedParams = Record<string, BindValue>
export type Params = BindValue[] | [NamedParams]

export interface RunResult {
  changes: number
  lastInsertRowid: number
}

export interface Statement {
  /** First row, or undefined when there is none. */
  get<T = unknown>(...params: Params): T | undefined
  all<T = unknown>(...params: Params): T[]
  run(...params: Params): RunResult
}

export interface Db {
  prepare(sql: string): Statement
  /** Runs one or more statements with no parameters (DDL, PRAGMAs). */
  exec(sql: string): void
  /** Runs `fn` inside BEGIN/COMMIT, rolling back if it throws. */
  transaction<T>(fn: () => T): T
}

export function isNamed(params: Params): params is [NamedParams] {
  return (
    params.length === 1 &&
    typeof params[0] === 'object' &&
    params[0] !== null &&
    !(params[0] instanceof Uint8Array)
  )
}

export function getSchemaVersion(db: Db): number {
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get<{
    value: string
  }>()
  return row ? Number(row.value) : 0
}

/** Applies every migration past the file's current schema_version, atomically. */
export function migrate(db: Db): void {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  const current = getSchemaVersion(db)
  if (current >= migrations.length) return
  db.transaction(() => {
    for (const sql of migrations.slice(current)) {
      db.exec(sql)
    }
    db.prepare(
      `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(String(migrations.length))
  })
}

/** Every connection gets the same pragmas the desktop app set. */
export function configure(db: Db): void {
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
}
