import { Feather } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import type { ColorValue } from 'react-native'
import { useIsWide } from '../../src/ui/layout'
import { Sidebar } from '../../src/ui/sidebar'
import { color } from '../../src/ui/theme'

const icon =
  (name: keyof typeof Feather.glyphMap) =>
  ({ color: c }: { color: ColorValue }): React.JSX.Element => <Feather name={name} size={22} color={c} />

/** Five tabs on the phone; on a tablet the same routes hang off a left sidebar instead. */
export default function TabsLayout(): React.JSX.Element {
  const wide = useIsWide()
  return (
    <Tabs
      tabBar={wide ? (props) => <Sidebar {...props} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarActiveTintColor: color.green,
        tabBarInactiveTintColor: color.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarStyle: { backgroundColor: color.card, borderTopColor: color.border },
        sceneStyle: { backgroundColor: color.bg }
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="dues" options={{ title: 'Dues', tabBarIcon: icon('dollar-sign') }} />
      <Tabs.Screen name="ledger" options={{ title: 'Ledger', tabBarIcon: icon('book-open') }} />
      <Tabs.Screen name="members" options={{ title: 'Members', tabBarIcon: icon('users') }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: icon('file-text') }} />
    </Tabs>
  )
}
