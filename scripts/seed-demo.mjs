// Bundles the demo seeder with esbuild and runs it on Node's built-in SQLite.
// Usage: node scripts/seed-demo.mjs path/to/duesbook.db   (replaces the file)
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(mkdtempSync(join(tmpdir(), 'duesbook-build-')), 'seed.cjs')
await build({
  entryPoints: ['src/data/test/seed-demo.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
  logLevel: 'error'
})
const r = spawnSync(process.execPath, ['--no-warnings', out, ...process.argv.slice(2)], {
  stdio: 'inherit'
})
process.exit(r.status ?? 1)
