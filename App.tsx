import { StatusBar } from 'expo-status-bar'
import { openDatabaseSync } from 'expo-sqlite'
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { wrapExpoDb } from './src/data/adapters/expo-sqlite'
import { configure, getSchemaVersion, migrate } from './src/data/db'
import { listAccounts } from './src/data/ledger'

/**
 * Smoke screen for the data-layer port: opens the books through the
 * expo-sqlite adapter, runs migrations, and reports what it found. The real
 * screens replace this.
 */
function openBooks(): { schema: number; org: string | null; accounts: number } {
  const db = wrapExpoDb(openDatabaseSync('duesbook.db'))
  configure(db)
  migrate(db)
  const org = db.prepare(`SELECT name FROM organization WHERE id = 1`).get<{ name: string }>()
  return { schema: getSchemaVersion(db), org: org?.name ?? null, accounts: listAccounts(db).length }
}

export default function App(): React.JSX.Element {
  const state = useMemo(() => {
    try {
      return openBooks()
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Duesbook</Text>
      {'error' in state ? (
        <Text style={styles.error}>Could not open the books: {state.error}</Text>
      ) : (
        <>
          <Text style={styles.line}>Schema version {state.schema}</Text>
          <Text style={styles.line}>
            {state.org ? `${state.org} · ${state.accounts} accounts` : 'No books yet (wizard next)'}
          </Text>
        </>
      )}
      <StatusBar style="dark" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f5f2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24
  },
  brand: { fontSize: 23, fontWeight: '700', color: '#16281a', letterSpacing: -0.3 },
  line: { fontSize: 14, color: '#3a4a3d' },
  error: { fontSize: 14, color: '#a5402f', textAlign: 'center' }
})
