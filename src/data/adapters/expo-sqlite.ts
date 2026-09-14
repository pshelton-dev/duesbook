import type { SQLiteDatabase } from 'expo-sqlite'
import type { Db, NamedParams, Params, RunResult, Statement } from '../db'
import { isNamed } from '../db'

/**
 * App adapter over expo-sqlite's synchronous API. expo-sqlite wants named
 * parameter keys to carry their prefix (`{ '@periodId': 1 }`), so bare keys
 * from the data layer are prefixed here. Each call prepares, executes, and
 * finalizes its own statement; at this app's scale that costs nothing.
 */
export function wrapExpoDb(raw: SQLiteDatabase): Db {
  const bind = (params: Params): NamedParams | unknown[] => {
    if (!isNamed(params)) return params as unknown[]
    const out: NamedParams = {}
    for (const [k, v] of Object.entries(params[0])) out[`@${k}`] = v
    return out
  }

  const prepare = (sql: string): Statement => ({
    get<T>(...params: Params): T | undefined {
      const row = raw.getFirstSync<T>(sql, bind(params) as never)
      return row === null ? undefined : row
    },
    all<T>(...params: Params): T[] {
      return raw.getAllSync<T>(sql, bind(params) as never)
    },
    run(...params: Params): RunResult {
      const r = raw.runSync(sql, bind(params) as never)
      return { changes: r.changes, lastInsertRowid: r.lastInsertRowId }
    }
  })

  return {
    prepare,
    exec: (sql) => raw.execSync(sql),
    transaction<T>(fn: () => T): T {
      let out!: T
      raw.withTransactionSync(() => {
        out = fn()
      })
      return out
    }
  }
}
