import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { migrations } from './migrations'

let db: Database.Database | null = null

export function getDbPath(): string {
  return join(app.getPath('userData'), 'duesbook.db')
}

export function openDb(): Database.Database {
  if (db) return db
  db = new Database(getDbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

export function getSchemaVersion(database: Database.Database): number {
  const row = database
    .prepare(`SELECT value FROM meta WHERE key = 'schema_version'`)
    .get() as { value: string } | undefined
  return row ? Number(row.value) : 0
}

function migrate(database: Database.Database): void {
  database.exec(
    `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
  )
  const current = getSchemaVersion(database)
  if (current >= migrations.length) return
  const apply = database.transaction(() => {
    for (const sql of migrations.slice(current)) {
      database.exec(sql)
    }
    database
      .prepare(
        `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(String(migrations.length))
  })
  apply()
}

export function closeDb(): void {
  db?.close()
  db = null
}
