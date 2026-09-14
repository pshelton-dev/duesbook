import { useRouter } from 'expo-router'
import { Text } from 'react-native'
import { Button, Card, Header, Screen } from '../src/ui/components'
import { color } from '../src/ui/theme'

export default function Settings(): React.JSX.Element {
  const router = useRouter()
  return (
    <Screen>
      <Header title="Settings" right={<Button title="Done" kind="link" onPress={() => router.back()} />} />
      <Card style={{ padding: 16 }}>
        <Text style={{ color: color.muted }}>Coming next.</Text>
      </Card>
    </Screen>
  )
}
