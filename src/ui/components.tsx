import DateTimePicker from '@react-native-community/datetimepicker'
import { Feather } from '@expo/vector-icons'
import { useState, type ReactNode } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { DuesStatus } from '../shared/types'
import { useIsWide } from './layout'
import { color, radius, shadow, shadowStrong, statusColor, statusLabel } from './theme'

/* ---------- layout ---------- */

export function Screen({
  children,
  scroll = true,
  bottomInset = 0
}: {
  children: ReactNode
  scroll?: boolean
  /** space to leave for a pinned bar */
  bottomInset?: number
}): React.JSX.Element {
  const wide = useIsWide()
  const body = <View style={[styles.screenBody, wide && styles.screenBodyWide, { paddingBottom: 24 + bottomInset }]}>{children}</View>
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  )
}

export function Header({
  title,
  right
}: {
  title: string
  right?: ReactNode
}): React.JSX.Element {
  return (
    <View style={styles.header}>
      <Text style={styles.h1}>{title}</Text>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  )
}

export function SectionTitle({ children }: { children: string }): React.JSX.Element {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

export function Card({
  children,
  style,
  accent = false
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** the green left rule used on the dues card */
  accent?: boolean
}): React.JSX.Element {
  return <View style={[styles.card, accent && styles.cardAccent, style]}>{children}</View>
}

export function ListRow({
  children,
  onPress,
  last = false,
  style
}: {
  children: ReactNode
  onPress?: () => void
  last?: boolean
  style?: StyleProp<ViewStyle>
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowRule,
        pressed && onPress && { backgroundColor: color.greenWash },
        style
      ]}
    >
      {children}
    </Pressable>
  )
}

export function Hint({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  return <Text style={[styles.hint, style as never]}>{children}</Text>
}

/* ---------- controls ---------- */

export function Button({
  title,
  onPress,
  kind = 'default',
  small = false,
  disabled = false,
  style
}: {
  title: string
  onPress: () => void
  kind?: 'default' | 'primary' | 'link' | 'danger'
  small?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && styles.btnPrimary,
        kind === 'link' && styles.btnLink,
        kind === 'danger' && styles.btnLink,
        small && styles.btnSmall,
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style
      ]}
    >
      <Text
        style={[
          styles.btnText,
          kind === 'primary' && styles.btnPrimaryText,
          kind === 'link' && styles.btnLinkText,
          kind === 'danger' && { color: color.danger2 },
          small && { fontSize: 12 }
        ]}
      >
        {title}
      </Text>
    </Pressable>
  )
}

/** Full-width green bar pinned above the tab bar (Home, member detail). */
export function PinnedButton({ title, onPress }: { title: string; onPress: () => void }): React.JSX.Element {
  return (
    <View style={styles.pinned}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.pinnedBtn, pressed && { opacity: 0.9 }]}>
        <Text style={styles.pinnedText}>{title}</Text>
      </Pressable>
    </View>
  )
}

export function IconButton({
  icon,
  onPress,
  primary = false,
  label
}: {
  icon: keyof typeof Feather.glyphMap
  onPress: () => void
  primary?: boolean
  label: string
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, primary && styles.iconBtnPrimary, pressed && { opacity: 0.8 }]}
    >
      <Feather name={icon} size={20} color={primary ? color.white : color.inkSoft} />
    </Pressable>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

export function TextField({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & TextInputProps): React.JSX.Element {
  return (
    <Field label={label} hint={hint}>
      <TextInput placeholderTextColor={color.muted} {...input} style={[styles.input, input.style]} />
    </Field>
  )
}

/** Dollar amount entry: right-aligned, decimal keypad, bold. */
export function AmountField({
  label,
  value,
  onChangeText,
  autoFocus = false,
  large = false
}: {
  label: string
  value: string
  onChangeText: (t: string) => void
  autoFocus?: boolean
  large?: boolean
}): React.JSX.Element {
  return (
    <Field label={label}>
      <View style={[styles.input, styles.amountWrap, large && { minHeight: 56 }]}>
        <Text style={[styles.amountSign, large && { fontSize: 20 }]}>$</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          placeholder="0.00"
          placeholderTextColor={color.muted}
          style={[styles.amountInput, large && { fontSize: 26 }]}
        />
      </View>
    </Field>
  )
}

export interface Option<V extends string | number> {
  value: V
  label: string
  detail?: string
}

/** A field that opens a native-feeling list to pick one option. */
export function ChoiceField<V extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  hint,
  trailing
}: {
  label: string
  value: V | null
  options: Option<V>[]
  onChange: (v: V) => void
  placeholder?: string
  hint?: string
  /** small muted note on the right, e.g. "last used" */
  trailing?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <Field label={label} hint={hint}>
      <Pressable onPress={() => setOpen(true)} style={[styles.input, styles.choice]}>
        <Text style={[styles.choiceText, !current && { color: color.muted }]}>{current?.label ?? placeholder}</Text>
        {trailing ? <Text style={styles.choiceTrailing}>{trailing}</Text> : null}
        <Feather name="chevron-down" size={16} color={color.muted2} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {options.map((o, i) => (
                <ListRow
                  key={String(o.value)}
                  last={i === options.length - 1}
                  onPress={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowText}>{o.label}</Text>
                    {o.detail ? <Text style={styles.hint}>{o.detail}</Text> : null}
                  </View>
                  {o.value === value ? <Feather name="check" size={18} color={color.green} /> : null}
                </ListRow>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Field>
  )
}

export function DateField({
  label,
  value,
  onChange,
  hint
}: {
  label: string
  value: string
  onChange: (iso: string) => void
  hint?: string
}): React.JSX.Element {
  const [y, m, d] = value.split('-').map(Number)
  const date = y && m && d ? new Date(y, m - 1, d, 12) : new Date()
  return (
    <Field label={label} hint={hint}>
      <View style={[styles.input, styles.dateWrap]}>
        <DateTimePicker
          value={date}
          mode="date"
          display="compact"
          accentColor={color.green}
          onValueChange={(_e, picked) => {
            const iso = `${picked.getFullYear()}-${String(picked.getMonth() + 1).padStart(2, '0')}-${String(picked.getDate()).padStart(2, '0')}`
            onChange(iso)
          }}
        />
      </View>
    </Field>
  )
}

export function Toggle({
  title,
  subtitle,
  value,
  onValueChange
}: {
  title: string
  subtitle?: string
  value: boolean
  onValueChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: color.green, false: color.inputBorder }} />
    </View>
  )
}

export function Segmented<V extends string>({
  options,
  value,
  onChange
}: {
  options: Option<V>[]
  value: V
  onChange: (v: V) => void
}): React.JSX.Element {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, o.value === value && styles.segmentOn]}>
          <Text style={[styles.segmentText, o.value === value && { color: color.ink }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && { color: color.white, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  )
}

/* ---------- display ---------- */

export function StatusDot({ status, text }: { status: DuesStatus; text?: string }): React.JSX.Element {
  const c = statusColor[status]
  return (
    <View style={styles.status}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.statusText, { color: c }]}>{text ?? statusLabel[status]}</Text>
    </View>
  )
}

export function SummaryTile({
  label,
  value,
  hero = false,
  positive = false
}: {
  label: string
  value: string
  hero?: boolean
  positive?: boolean
}): React.JSX.Element {
  return (
    <View style={[styles.tile, hero && styles.tileHero]}>
      <Text style={[styles.tileLabel, hero && { color: 'rgba(255,255,255,0.8)' }]}>{label}</Text>
      <Text style={[styles.tileValue, hero && { color: color.white }, positive && { color: color.green }]}>{value}</Text>
    </View>
  )
}

export function ProgressBar({ fraction }: { fraction: number }): React.JSX.Element {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  )
}

export function Notice({
  kind,
  text,
  action,
  onAction
}: {
  kind: 'warn' | 'danger' | 'neutral'
  text: string
  action?: string
  onAction?: () => void
}): React.JSX.Element {
  const palette = {
    warn: { bg: color.warnBg, rule: color.warnAccent, fg: color.warn },
    danger: { bg: color.dangerBg, rule: color.danger2, fg: color.danger },
    neutral: { bg: color.neutralBg, rule: color.neutral2, fg: color.neutral }
  }[kind]
  return (
    <Pressable
      onPress={onAction}
      disabled={!onAction}
      style={[styles.notice, { backgroundColor: palette.bg, borderLeftColor: palette.rule }]}
    >
      <View style={[styles.diamond, { backgroundColor: palette.rule }]} />
      <Text style={[styles.noticeText, { color: palette.fg }]}>{text}</Text>
      {action ? <Text style={[styles.noticeAction, { color: palette.fg }]}>{action}</Text> : null}
    </Pressable>
  )
}

export function ErrorText({ children }: { children: string }): React.JSX.Element {
  return (
    <View style={styles.errorBox}>
      <Text style={{ color: color.danger, fontSize: 13 }}>{children}</Text>
    </View>
  )
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  screenBody: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  // tablets: a little more breathing room, and reading-width content on the single-pane screens
  screenBodyWide: { paddingHorizontal: 20, maxWidth: 840 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4, minHeight: 44 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { fontSize: 23, fontWeight: '700', color: color.ink, letterSpacing: -0.3, flexShrink: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: color.ink, marginTop: 2, marginBottom: -4 },
  card: { backgroundColor: color.card, borderRadius: radius.card, ...shadow },
  cardAccent: { borderLeftWidth: 3, borderLeftColor: color.green },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 56 },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.rule },
  rowText: { fontSize: 15, color: color.ink },
  hint: { fontSize: 12, color: color.muted, lineHeight: 16, marginTop: 2 },

  btn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.ctl,
    borderWidth: 1,
    borderColor: color.inputBorder,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnText: { fontSize: 14, fontWeight: '600', color: color.ink },
  btnPrimary: { backgroundColor: color.green, borderColor: color.green, minHeight: 50, borderRadius: 12 },
  btnPrimaryText: { color: color.white, fontWeight: '700', fontSize: 15 },
  btnLink: { backgroundColor: 'transparent', borderColor: 'transparent' },
  btnLinkText: { color: color.green },
  btnSmall: { minHeight: 32, paddingHorizontal: 10, borderRadius: 8 },
  pinned: { position: 'absolute', left: 16, right: 16, bottom: 12 },
  pinnedBtn: { backgroundColor: color.green, borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center', ...shadowStrong },
  pinnedText: { color: color.white, fontSize: 15, fontWeight: '700' },
  iconBtn: { width: 44, height: 44, borderRadius: radius.ctl, backgroundColor: color.card, borderWidth: 1, borderColor: color.inputBorder, alignItems: 'center', justifyContent: 'center' },
  iconBtnPrimary: { backgroundColor: color.green, borderColor: color.green },

  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: '600', color: color.muted },
  input: {
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.inputBorder,
    borderRadius: radius.input,
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    color: color.ink
  },
  amountWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountSign: { color: color.muted, fontSize: 15 },
  amountInput: { flex: 1, fontSize: 17, fontWeight: '700', color: color.ink, fontVariant: ['tabular-nums'], paddingVertical: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  choiceText: { flex: 1, fontSize: 15, color: color.ink },
  choiceTrailing: { fontSize: 12, color: color.muted },
  dateWrap: { justifyContent: 'center', alignItems: 'flex-start' },
  scrim: { flex: 1, backgroundColor: 'rgba(22,40,26,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 34, paddingTop: 12 },
  sheetTitle: { fontSize: 13, fontWeight: '700', color: color.muted2, paddingHorizontal: 16, paddingBottom: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 44, paddingHorizontal: 4 },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: color.ink },
  segmented: { flexDirection: 'row', borderRadius: radius.ctl, backgroundColor: color.greenWash, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8 },
  segmentOn: { backgroundColor: color.card, shadowColor: '#143c1e', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segmentText: { fontSize: 13, fontWeight: '600', color: color.inkSoft },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: color.card, borderWidth: 1, borderColor: color.inputBorder, justifyContent: 'center' },
  chipOn: { backgroundColor: color.green, borderColor: color.green },
  chipText: { fontSize: 13, fontWeight: '600', color: color.inkSoft },

  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  tile: { flex: 1, backgroundColor: color.card, borderRadius: radius.card, padding: 14, paddingHorizontal: 12, ...shadow },
  tileHero: { backgroundColor: color.green, shadowOpacity: 0 },
  tileLabel: { fontSize: 11, fontWeight: '600', color: color.muted },
  tileValue: { fontSize: 18, fontWeight: '700', color: color.ink, marginTop: 4, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: color.greenTrack, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: color.green },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderLeftWidth: 3, paddingVertical: 12, paddingHorizontal: 15, minHeight: 44 },
  diamond: { width: 8, height: 8, transform: [{ rotate: '45deg' }] },
  noticeText: { flex: 1, fontSize: 13 },
  noticeAction: { fontSize: 13, fontWeight: '700' },
  errorBox: { backgroundColor: color.dangerBg, borderRadius: 12, padding: 12 }
})
