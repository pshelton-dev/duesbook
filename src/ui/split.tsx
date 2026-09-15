import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { color } from './theme'

/** Tablet list + detail: a fixed-width list pane with the detail beside it. Each pane scrolls on its own. */
export function Split({ list, detail }: { list: ReactNode; detail: ReactNode }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.list}>{list}</View>
      <View style={styles.detail}>{detail}</View>
    </View>
  )
}

/** What the detail pane shows before anything is selected. */
export function EmptyDetail({ text }: { text: string }): React.JSX.Element {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', backgroundColor: color.bg },
  list: { width: 400, borderRightWidth: 1, borderRightColor: color.border },
  detail: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyText: { fontSize: 14, color: color.muted, textAlign: 'center' }
})
