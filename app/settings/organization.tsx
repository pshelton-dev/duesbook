import { useRouter } from 'expo-router'
import { useState } from 'react'
import { updateOrganization } from '../../src/data/settings'
import { MONTH_NAMES } from '../../src/shared/fiscal'
import { useBooks, useQuery } from '../../src/ui/books'
import { Button, ChoiceField, ErrorText, Screen, TextField } from '../../src/ui/components'

export default function Organization(): React.JSX.Element {
  const router = useRouter()
  const { db, bump } = useBooks()
  const org = useQuery((d) =>
    d.prepare(`SELECT name, fiscal_year_start_month AS fy FROM organization WHERE id = 1`).get<{ name: string; fy: number }>()
  )
  const [name, setName] = useState(org?.name ?? '')
  const [fy, setFy] = useState(org?.fy ?? 1)
  const [error, setError] = useState<string | null>(null)

  function save(): void {
    try {
      updateOrganization(db, name, fy)
      bump()
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Screen>
      <TextField label="Organization name" value={name} onChangeText={setName} />
      <ChoiceField label="Fiscal year starts in" value={fy} onChange={setFy} options={MONTH_NAMES.map((m, i) => ({ value: i + 1, label: m }))} hint="Changes which months the year-end report covers." />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Save" kind="primary" onPress={save} />
    </Screen>
  )
}
