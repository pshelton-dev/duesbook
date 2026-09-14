// Bundles the data-layer test with esbuild and runs it on Node's built-in
// SQLite. Usage: node scripts/test-data-layer.mjs [existing.db]
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(mkdtempSync(join(tmpdir(), 'duesbook-build-')), 'test.cjs')
await build({
  entryPoints: ['src/data/test/data-layer.test.ts'],
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
