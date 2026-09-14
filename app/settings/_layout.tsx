import { Stack } from 'expo-router'
import { color } from '../../src/ui/theme'

/** Settings is a modal holding its own stack, so sub-screens get native headers and back. */
export default function SettingsLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.bg },
        headerShadowVisible: false,
        headerTintColor: color.green,
        headerTitleStyle: { color: color.ink, fontWeight: '700' },
        contentStyle: { backgroundColor: color.bg }
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="organization" options={{ title: 'Organization' }} />
      <Stack.Screen name="accounts" options={{ title: 'Accounts' }} />
      <Stack.Screen name="categories" options={{ title: 'Categories' }} />
      <Stack.Screen name="dues" options={{ title: 'Dues' }} />
      <Stack.Screen name="backups" options={{ title: 'Backups' }} />
    </Stack>
  )
}
