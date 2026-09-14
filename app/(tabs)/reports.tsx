import { Text } from 'react-native'
import { Card, Header, Screen } from '../../src/ui/components'
import { color } from '../../src/ui/theme'

export default function Reports(): React.JSX.Element {
  return (
    <Screen>
      <Header title="Reports" />
      <Card style={{ padding: 16 }}>
        <Text style={{ color: color.muted }}>Coming next.</Text>
      </Card>
    </Screen>
  )
}
