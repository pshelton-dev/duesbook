import * as LocalAuthentication from 'expo-local-authentication'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import { META, getMeta } from '../data/meta'
import { useQuery } from './books'
import { color } from './theme'

/**
 * Optional app lock: Face ID / Touch ID with the device passcode as
 * fallback, asked on launch and every time the app comes back from the
 * background. Off by default. Nothing here touches the books; it only
 * covers the screen until the OS says the person is the phone's owner.
 */
export function LockGate({ children }: { children: ReactNode }): React.JSX.Element {
  const enabled = useQuery((db) => getMeta(db, META.appLock) === '1')
  const [locked, setLocked] = useState(enabled)
  const [failed, setFailed] = useState<string | null>(null)
  const asking = useRef(false)

  const unlock = useCallback(async () => {
    if (asking.current) return
    asking.current = true
    setFailed(null)
    try {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Duesbook', cancelLabel: 'Cancel' })
      if (r.success) setLocked(false)
      // A phone with no passcode or Face ID cannot lock at all; never trap the owner behind it.
      else if (r.error === 'not_enrolled' || r.error === 'not_available' || r.error === 'passcode_not_set') setLocked(false)
      else setFailed(r.error === 'user_cancel' ? null : 'Could not confirm it’s you. Try again.')
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e))
    } finally {
      asking.current = false
    }
  }, [])

  // Lock on the way to the background; ask again on the way back.
  useEffect(() => {
    if (!enabled) {
      setLocked(false)
      return
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') setLocked(true)
    })
    return () => sub.remove()
  }, [enabled])

  useEffect(() => {
    if (enabled && locked) void unlock()
  }, [enabled, locked, unlock])

  if (!enabled || !locked) return <>{children}</>
  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>Duesbook</Text>
      <Text style={styles.line}>Locked</Text>
      {failed && <Text style={styles.error}>{failed}</Text>}
      <Pressable onPress={unlock} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}>
        <Text style={styles.btnText}>Unlock</Text>
      </Pressable>
    </View>
  )
}

/** Whether the phone has a passcode or biometrics set, so a lock would mean something. */
export async function canLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE
  } catch {
    return false
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  brand: { fontSize: 23, fontWeight: '700', color: color.ink, letterSpacing: -0.3 },
  line: { fontSize: 14, color: color.muted2 },
  error: { fontSize: 13, color: color.danger, textAlign: 'center' },
  btn: { marginTop: 12, backgroundColor: color.green, borderRadius: 12, minHeight: 50, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: color.white, fontSize: 15, fontWeight: '700' }
})
