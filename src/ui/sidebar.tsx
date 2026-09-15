import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { color } from './theme'

/** The tab navigator's props, structurally: enough to list routes and switch between them. */
interface SidebarProps {
  state: { index: number; routes: { key: string; name: string }[] }
  descriptors: Record<string, { options: { title?: string } }>
  navigation: { navigate: (name: string) => void }
}

/**
 * Tablet navigation: the desktop app's left sidebar returns in place of the tab bar,
 * with Settings as the sixth destination at the bottom (design/mobile/Tablet.dc.html).
 */
export function Sidebar({ state, descriptors, navigation }: SidebarProps): React.JSX.Element {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 22 }]}>
      <Text style={styles.brand}>Duesbook</Text>
      {state.routes.map((route, i) => (
        <Item
          key={route.key}
          label={descriptors[route.key]?.options.title ?? route.name}
          active={i === state.index}
          onPress={() => navigation.navigate(route.name)}
        />
      ))}
      <View style={{ flex: 1 }} />
      <Item label="Settings" active={false} onPress={() => router.push('/settings')} />
    </View>
  )
}

function Item({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={({ pressed }) => [styles.item, active && styles.itemOn, pressed && !active && { backgroundColor: color.greenWash }]}>
      <View style={[styles.dot, active && styles.dotOn]} />
      <Text style={[styles.label, active && styles.labelOn]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: { width: 200, backgroundColor: color.card, borderRightWidth: 1, borderRightColor: color.border },
  brand: { fontSize: 16, fontWeight: '700', color: color.ink, letterSpacing: -0.3, paddingHorizontal: 20, paddingBottom: 22 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 2, marginHorizontal: 14, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, minHeight: 44 },
  itemOn: { backgroundColor: color.green },
  dot: { width: 8, height: 8, borderRadius: 3, backgroundColor: color.green, opacity: 0.5 },
  dotOn: { backgroundColor: color.white, opacity: 1 },
  label: { fontSize: 13, fontWeight: '600', color: color.inkSoft },
  labelOn: { color: color.white }
})
