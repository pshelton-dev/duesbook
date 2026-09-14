import { DatabaseSync } from 'node:sqlite'
import type { Db, Params, RunResult, Statement } from '../db'
import { isNamed } from '../db'

/**
 * Test/dev adapter over Node's built-in SQLite (Node 22.5+). Lets the data
 * layer run on a desktop against a real .db file with no native module.
 * node:sqlite accepts bare keys for @name parameters, so params pass through.
 */
export function openNodeDb(path: string): Db & { close(): void } {
  const raw = new DatabaseSync(path)

  const bind = (params: Params): unknown[] =>
    isNamed(params) ? [params[0]] : (params as unknown[])

  const prepare = (sql: string): Statement => {
    const stmt = raw.prepare(sql)
    return {
      get<T>(...params: Params): T | undefined {
        return stmt.get(...(bind(params) as never[])) as T | undefined
      },
      all<T>(...params: Params): T[] {
        return stmt.all(...(bind(params) as never[])) as T[]
      },
      run(...params: Params): RunResult {
        const r = stmt.run(...(bind(params) as never[]))
        return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }
      }
    }
  }

  return {
    prepare,
    exec: (sql) => raw.exec(sql),
    transaction<T>(fn: () => T): T {
      raw.exec('BEGIN')
      try {
        const out = fn()
        raw.exec('COMMIT')
        return out
      } catch (e) {
        raw.exec('ROLLBACK')
        throw e
      }
    },
    close: () => raw.close()
  }
}
