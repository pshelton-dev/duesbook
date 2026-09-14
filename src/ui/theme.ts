/** Design tokens, lifted from the desktop stylesheet (design_handoff_duesbook_redesign). */
export const color = {
  bg: '#f4f5f2',
  card: '#ffffff',
  ink: '#16281a',
  inkSoft: '#3a4a3d',
  muted: '#8a938c',
  muted2: '#6f7a72',
  border: '#e7e9e4',
  inputBorder: '#dde3dc',
  rule: '#f0f2ee',
  green: '#2e7d46',
  greenHover: '#256339',
  greenSoft: '#e3f2e6',
  greenWash: '#eef2ec',
  greenTrack: '#dcecdf',
  greenBright: '#379a55',
  dangerBg: '#fdf0ed',
  danger: '#a5402f',
  danger2: '#c1523f',
  dangerSoft: '#b56a5c',
  warnBg: '#fff9e9',
  warn: '#8a6420',
  warnAccent: '#cf9a3e',
  neutralBg: '#eef0f4',
  neutral: '#4a5568',
  neutral2: '#7a8a94',
  white: '#ffffff'
} as const

export const radius = { card: 14, ctl: 10, input: 9, pill: 999 } as const

/** The soft green card shadow. iOS reads the shadow* props; Android uses elevation. */
export const shadow = {
  shadowColor: '#143c1e',
  shadowOpacity: 0.06,
  shadowRadius: 7,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2
} as const

export const shadowStrong = {
  ...shadow,
  shadowOpacity: 0.16,
  elevation: 4
} as const

/** Dues status colours match the desktop StatusChip. */
export const statusColor = {
  paid: color.green,
  partial: color.warnAccent,
  owed: color.danger2,
  waived: color.neutral2,
  exempt: color.neutral2,
  na: color.muted
} as const

export const statusLabel = {
  paid: 'Paid',
  partial: 'Partial',
  owed: 'Owed',
  waived: 'Waived',
  exempt: 'Exempt',
  na: '—'
} as const
