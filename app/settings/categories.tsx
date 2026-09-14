import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { createCategory, listCategories } from '../../src/data/ledger'
import { updateCategory } from '../../src/data/settings'
import type { CategoryKind } from '../../src/shared/types'
import { useBooks, useQuery } from '../../src/ui/books'
import { Button, Card, ErrorText, ListRow, Screen, Segmented, TextField } from '../../src/ui/components'
import { color } from '../../src/ui/theme'

export default function Categories(): React.JSX.Element {
  const { db, bump } = useBooks()
  const categories = useQuery(listCategories)
  const [editing, setEditing] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [newKind, setNewKind] = useState<CategoryKind>('expense')
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = (fn: () => void): void => {
    try {
      fn()
      bump()
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const group = (kind: CategoryKind): React.JSX.Element => {
    const items = categories.filter((c) => c.kind === kind)
    return (
      <>
        <Text style={styles.cap}>{kind === 'income' ? 'Income' : 'Expense'}</Text>
        <Card>
          {items.map((c, i) => (
            <View key={c.id}>
              <ListRow
                last={i === items.length - 1 && editing !== c.id}
                onPress={
                  c.isSystem
                    ? undefined
                    : () => {
                        setEditing(editing === c.id ? null : c.id)
                        setEditName(c.name)
                      }
                }
              >
                <Text style={[styles.name, !c.isActive && { color: color.muted }]}>
                  {c.name}
                  {!c.isActive ? ' · inactive' : ''}
                </Text>
                {c.isSystem && <Text style={styles.locked}>built in</Text>}
              </ListRow>
              {editing === c.id && (
                <View style={styles.editPanel}>
                  <TextField label="Rename" value={editName} onChangeText={setEditName} autoFocus />
                  <View style={styles.row}>
                    <Button title={c.isActive ? 'Deactivate' : 'Reactivate'} onPress={() => run(() => updateCategory(db, c.id, { isActive: !c.isActive }))} style={{ flex: 1 }} />
                    <Button
                      title="Save"
                      kind="primary"
                      style={{ flex: 1, minHeight: 44 }}
                      onPress={() =>
                        run(() => {
                          updateCategory(db, c.id, { name: editName })
                          setEditing(null)
                        })
                      }
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </Card>
      </>
    )
  }

  return (
    <Screen>
      {group('income')}
      {group('expense')}
      <Text style={styles.cap}>Add a category</Text>
      <Card style={{ padding: 14, gap: 12 }}>
        <Segmented
          options={[
            { value: 'income', label: 'Income' },
            { value: 'expense', label: 'Expense' }
          ]}
          value={newKind}
          onChange={setNewKind}
        />
        <TextField label="Name" value={newName} onChangeText={setNewName} placeholder="e.g. Printing" />
        <Button
          title="Add"
          onPress={() =>
            run(() => {
              createCategory(db, newName, newKind)
              setNewName('')
            })
          }
        />
      </Card>
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  )
}

const styles = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: color.muted, paddingHorizontal: 4, marginBottom: -6 },
  name: { flex: 1, fontSize: 15, color: color.ink },
  locked: { fontSize: 11, color: color.muted },
  editPanel: { backgroundColor: color.greenWash, padding: 14, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.rule },
  row: { flexDirection: 'row', gap: 8 }
})
