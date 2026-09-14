import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { BooksProvider, useBooks } from '../src/ui/books'
import { color } from '../src/ui/theme'

/**
 * Route guard: with no organization row the only reachable screen is the
 * wizard; once it completes (and bumps the books version) the tabs take over.
 */
function Routes(): React.JSX.Element {
  const { hasOrg } = useBooks()
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
      <Stack.Protected guard={hasOrg}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="payment"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true }}
        />
        <Stack.Screen
          name="member-edit"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true }}
        />
        {(['txn-edit', 'account-edit', 'period-edit'] as const).map((name) => (
          <Stack.Screen
            key={name}
            name={name}
            options={{ presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true }}
          />
        ))}
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!hasOrg}>
        <Stack.Screen name="wizard" options={{ gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout(): React.JSX.Element {
  return (
    <BooksProvider>
      <Routes />
      <StatusBar style="dark" />
    </BooksProvider>
  )
}
