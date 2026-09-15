import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { BooksProvider, useBooks } from '../src/ui/books'
import { LockGate } from '../src/ui/lock'
import { OpenedBooksFileHandler } from '../src/ui/open-file'
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
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="member-edit"
          options={{ presentation: 'modal' }}
        />
        {(['txn-edit', 'account-edit', 'period-edit'] as const).map((name) => (
          <Stack.Screen
            key={name}
            name={name}
            options={{ presentation: 'modal' }}
          />
        ))}
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!hasOrg}>
        <Stack.Screen name="wizard" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      {/* Reachable from the wizard too, so a new treasurer can bring the roster in on day one.
          Declared last: with no organization the router falls back to the first available
          screen, and that must be the wizard, not this modal. */}
      <Stack.Screen name="import-members" options={{ presentation: 'modal' }} />
    </Stack>
  )
}

export default function RootLayout(): React.JSX.Element {
  return (
    <BooksProvider>
      <LockGate>
        <Routes />
        <OpenedBooksFileHandler />
      </LockGate>
      <StatusBar style="dark" />
    </BooksProvider>
  )
}
