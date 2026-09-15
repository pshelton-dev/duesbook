import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { listPeriods } from '../../data/dues'
import { getMemberDetail, listMembers } from '../../data/members'
import { useQuery } from '../books'
import { Button, Card, ListRow, PinnedButton, Screen, SectionTitle, StatusDot } from '../components'
import { fmtDate, formatCents } from '../format'
import { color, statusLabel } from '../theme'

/**
 * Contact info with tap-to-call, text, and email, plus the dues history by period.
 * On the phone it is the pushed detail screen; on a tablet it sits in the detail pane
 * (`embedded`), with no back button and the payment button inline instead of pinned.
 */
export function MemberDetailView({ memberId, embedded = false }: { memberId: number; embedded?: boolean }): React.JSX.Element {
  const router = useRouter()
  const detail = useQuery((db) => getMemberDetail(db, memberId), [memberId])
  const row = useQuery((db) => listMembers(db).find((m) => m.id === memberId) ?? null, [memberId])
  const current = useQuery((db) => listPeriods(db).find((p) => p.isCurrent) ?? null)

  const digits = detail.phone?.replace(/[^\d+]/g, '') ?? ''
  const owes = (row?.owedCents ?? 0) > 0
  const recordPayment = (): void => {
    if (current) router.push({ pathname: '/payment', params: { periodId: String(current.id), memberId: String(memberId) } })
  }
  const paymentTitle = `Record payment · ${formatCents(row?.owedCents ?? 0)}`

  const IconTap = ({ icon, url, label }: { icon: keyof typeof Feather.glyphMap; url: string; label: string }): React.JSX.Element => (
    <Pressable onPress={() => Linking.openURL(url).catch(() => undefined)} accessibilityLabel={label} style={styles.iconTap}>
      <Feather name={icon} size={20} color={color.green} />
    </Pressable>
  )

  return (
    <>
      <Screen bottomInset={owes && !embedded ? 72 : 0}>
        <View style={styles.nav}>
          {embedded ? (
            <View />
          ) : (
            <Pressable onPress={() => router.back()} style={styles.back}>
              <Feather name="chevron-left" size={20} color={color.green} />
              <Text style={styles.backText}>Members</Text>
            </Pressable>
          )}
          <Button title="Edit" kind="link" onPress={() => router.push({ pathname: '/member-edit', params: { id: String(memberId) } })} />
        </View>

        <View style={styles.title}>
          <Text style={styles.name}>
            {detail.firstName} {detail.lastName}
          </Text>
          <View style={styles.statusLine}>
            {row && <StatusDot status={row.duesStatus} text={owes ? `Owed ${formatCents(row.owedCents)}` : statusLabel[row.duesStatus]} />}
            {row && row.periodsBehind > 0 && (
              <Text style={styles.behind}>
                {row.periodsBehind} month{row.periodsBehind === 1 ? '' : 's'} behind
              </Text>
            )}
            {detail.leftDate && <Text style={styles.behind}>Left {fmtDate(detail.leftDate, true)}</Text>}
          </View>
        </View>

        {embedded && owes && current && <Button title={paymentTitle} kind="primary" onPress={recordPayment} />}

        <Card>
          {detail.phone && (
            <ListRow>
              <Text style={styles.contact}>{detail.phone}</Text>
              <IconTap icon="phone" url={`tel:${digits}`} label="Call" />
              <IconTap icon="message-circle" url={`sms:${digits}`} label="Text" />
            </ListRow>
          )}
          {detail.email && (
            <ListRow>
              <Text style={styles.contact} numberOfLines={1}>
                {detail.email}
              </Text>
              <IconTap icon="mail" url={`mailto:${detail.email}`} label="Email" />
            </ListRow>
          )}
          {detail.address && (
            <ListRow>
              <Text style={styles.contact}>{detail.address}</Text>
            </ListRow>
          )}
          <ListRow last>
            <Text style={styles.muted}>Member since</Text>
            <Text style={[styles.contact, { flex: 0 }]}>{detail.joinDate ? fmtDate(detail.joinDate, true) : '—'}</Text>
          </ListRow>
          {!detail.phone && !detail.email && !detail.address && (
            <ListRow last>
              <Text style={styles.muted}>No contact details. Tap Edit to add some.</Text>
            </ListRow>
          )}
        </Card>

        {detail.duesExempt && <Text style={styles.muted}>Dues exempt: honorary or lifetime member.</Text>}
        {detail.notes && (
          <Card style={{ padding: 14 }}>
            <Text style={styles.notes}>{detail.notes}</Text>
          </Card>
        )}

        <SectionTitle>Dues history</SectionTitle>
        <Card>
          {detail.history.length === 0 ? (
            <ListRow last>
              <Text style={styles.muted}>No dues periods yet.</Text>
            </ListRow>
          ) : (
            detail.history.map((h, i) => (
              <ListRow key={h.periodLabel} last={i === detail.history.length - 1}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contact}>{h.periodLabel}</Text>
                  {h.payments.length > 0 && (
                    <Text style={styles.muted}>{h.payments.map((p) => `${fmtDate(p.date)} · ${p.accountName}`).join(' · ')}</Text>
                  )}
                </View>
                <StatusDot status={h.status} />
                <Text style={styles.amt}>{h.owedCents > 0 ? formatCents(h.owedCents) : '—'}</Text>
              </ListRow>
            ))
          )}
        </Card>
      </Screen>
      {!embedded && owes && current && <PinnedButton title={paymentTitle} onPress={recordPayment} />}
    </>
  )
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingRight: 8 },
  backText: { fontSize: 15, fontWeight: '600', color: color.green },
  title: { gap: 4, paddingHorizontal: 4 },
  name: { fontSize: 23, fontWeight: '700', color: color.ink, letterSpacing: -0.3 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  behind: { fontSize: 12, color: color.dangerSoft },
  contact: { flex: 1, fontSize: 14, color: color.ink },
  muted: { fontSize: 12, color: color.muted, flex: 1 },
  notes: { fontSize: 13, color: color.inkSoft, lineHeight: 19 },
  iconTap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  amt: { width: 64, textAlign: 'right', fontSize: 14, fontWeight: '600', color: color.ink, fontVariant: ['tabular-nums'] }
})
