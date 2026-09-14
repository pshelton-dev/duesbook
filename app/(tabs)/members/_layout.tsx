import { Stack } from 'expo-router'
import { color } from '../../../src/ui/theme'

/** The Members tab has its own stack so member detail pushes with the tab bar still visible. */
export default function MembersLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
}
