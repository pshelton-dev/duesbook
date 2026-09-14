import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { createMember, deleteMember, getMemberDetail, updateMember } from '../src/data/members'
import type { MemberInput } from '../src/shared/types'
import { useBooks, useQuery } from '../src/ui/books'
import { Button, DateField, ErrorText, TextField, Toggle } from '../src/ui/components'
import { todayIso } from '../src/ui/format'
import { color } from '../src/ui/theme'

/** New-member and edit-member sheet. Edit adds "mark as left" and Delete. */
export default function MemberEdit(): React.JSX.Element {
  const router = useRouter()
  const { db, bump } = useBooks()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const memberId = id ? Number(id) : null
  const existing = useQuery((d) => (memberId ? getMemberDetail(d, memberId) : null), [memberId])

  const [form, setForm] = useState<MemberInput>(() => ({
    firstName: existing?.firstName ?? '',
    lastName: existing?.lastName ?? '',
    email: existing?.email ?? null,
    phone: existing?.phone ?? null,
    address: existing?.address ?? null,
    joinDate: existing?.joinDate ?? todayIso(),
    leftDate: existing?.leftDate ?? null,
    duesExempt: existing?.duesExempt ?? false,
    notes: existing?.notes ?? null
  }))
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof MemberInput>(k: K, v: MemberInput[K]): void => setForm({ ...form, [k]: v })
  const text = (v: string | null): string => v ?? ''
  const orNull = (v: string): string | null => (v.trim() ? v : null)

  function save(): void {
    try {
      if (memberId) updateMember(db, memberId, form)
      else createMember(db, form)
      bump()
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function remove(): void {
    if (!memberId) return
    try {
      deleteMember(db, memberId)
      bump()
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={styles.title}>{memberId ? 'Edit member' : 'New member'}</Text>
          <Button title="Cancel" kind="link" onPress={() => router.back()} />
        </View>

        <View style={styles.twoUp}>
          <View style={{ flex: 1 }}>
            <TextField label="First name" value={form.firstName} onChangeText={(v) => set('firstName', v)} autoFocus={!memberId} autoCapitalize="words" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Last name" value={form.lastName} onChangeText={(v) => set('lastName', v)} autoCapitalize="words" />
          </View>
        </View>
        <TextField label="Email" value={text(form.email)} onChangeText={(v) => set('email', orNull(v))} keyboardType="email-address" autoCapitalize="none" placeholder="optional" />
        <TextField label="Phone" value={text(form.phone)} onChangeText={(v) => set('phone', orNull(v))} keyboardType="phone-pad" placeholder="optional" />
        <TextField label="Address" value={text(form.address)} onChangeText={(v) => set('address', orNull(v))} placeholder="optional" />
        <DateField label="Joined" value={form.joinDate ?? todayIso()} onChange={(v) => set('joinDate', v)} />
        <Toggle title="Dues exempt" subtitle="Honorary or lifetime member, never owes" value={form.duesExempt} onValueChange={(v) => set('duesExempt', v)} />
        {memberId && (
          <>
            <Toggle
              title="Has left the organization"
              subtitle={form.leftDate ? `Left ${form.leftDate}. History is kept.` : 'Stops new dues; history is kept.'}
              value={form.leftDate !== null}
              onValueChange={(v) => set('leftDate', v ? todayIso() : null)}
            />
            {form.leftDate && <DateField label="Left on" value={form.leftDate} onChange={(v) => set('leftDate', v)} />}
          </>
        )}
        <TextField label="Notes" value={text(form.notes)} onChangeText={(v) => set('notes', orNull(v))} placeholder="optional" multiline />

        {error && <ErrorText>{error}</ErrorText>}

        <Button title={memberId ? 'Save changes' : 'Save member'} kind="primary" onPress={save} />
        {memberId && <Button title="Delete member" kind="danger" onPress={remove} />}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: color.bg },
  body: { padding: 16, paddingTop: 12, gap: 14, paddingBottom: 40 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: color.ink, letterSpacing: -0.3 },
  twoUp: { flexDirection: 'row', gap: 10 }
})
