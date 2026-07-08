import type Database from 'better-sqlite3'
import { app, net } from 'electron'
import type { UpdateInfo } from '../shared/types'

/** Set to the real repo when it goes public; until then the check 404s silently. */
const REPO = 'CHANGE-ME/duesbook'

function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/**
 * Notify-only update check: fetches the latest release tag from GitHub and
 * nothing else — no user data is sent. Any failure (offline, disabled, rate
 * limit, repo missing) resolves to null; this must never break the app.
 */
export async function checkForUpdate(db: Database.Database): Promise<UpdateInfo | null> {
  try {
    const org = db
      .prepare(`SELECT update_check_enabled AS enabled FROM organization WHERE id = 1`)
      .get() as { enabled: number } | undefined
    if (!org || org.enabled !== 1) return null

    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return null
    const json = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = String(json.tag_name ?? '').replace(/^v/, '')
    if (!latest || !json.html_url) return null
    if (!isNewer(latest, app.getVersion())) return null
    return { version: latest, url: json.html_url }
  } catch {
    return null
  }
}
