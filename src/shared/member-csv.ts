import { normalizeDate } from './csv'
import type { WizardMember } from './types'

/**
 * Member spreadsheet import: header guessing and row mapping, lifted from the
 * desktop's MemberCsvImport so both apps read the same files the same way.
 */
export type MemberTarget = 'firstName' | 'lastName' | 'fullName' | 'email' | 'phone' | 'address' | 'joinDate'
export type MemberMapping = Partial<Record<MemberTarget, number>>

export const MEMBER_TARGET_LABEL: Record<MemberTarget, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  fullName: 'Full name (split at the last space)',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  joinDate: 'Join date'
}

export function guessMemberMapping(headers: string[]): MemberMapping {
  const map: MemberMapping = {}
  headers.forEach((raw, i) => {
    const h = raw.trim().toLowerCase()
    const set = (t: MemberTarget): void => {
      if (map[t] === undefined) map[t] = i
    }
    if (h.includes('first')) set('firstName')
    else if (h.includes('last') || h.includes('surname')) set('lastName')
    else if (h === 'name' || h.includes('full')) set('fullName')
    else if (h.includes('mail')) set('email')
    else if (h.includes('phone') || h.includes('tel')) set('phone')
    else if (h.includes('address') || h.includes('street')) set('address')
    else if (h.includes('join') || h.includes('since')) set('joinDate')
  })
  return map
}

export function applyMemberMapping(rows: string[][], map: MemberMapping): WizardMember[] {
  const cell = (row: string[], t: MemberTarget): string => (map[t] !== undefined ? (row[map[t]!] ?? '').trim() : '')
  const members: WizardMember[] = []
  for (const row of rows) {
    let first = cell(row, 'firstName')
    let last = cell(row, 'lastName')
    if (!first && !last) {
      const full = cell(row, 'fullName')
      if (full) {
        const space = full.lastIndexOf(' ')
        if (space === -1) last = full
        else {
          first = full.slice(0, space)
          last = full.slice(space + 1)
        }
      }
    }
    if (!first && !last) continue
    members.push({
      firstName: first,
      lastName: last,
      email: cell(row, 'email') || null,
      phone: cell(row, 'phone') || null,
      address: cell(row, 'address') || null,
      joinDate: normalizeDate(cell(row, 'joinDate'))
    })
  }
  return members
}

/** The starter spreadsheet offered from the wizard and the Members tab. */
export const MEMBER_CSV_TEMPLATE =
  'First name,Last name,Email,Phone,Address,Join date\n' +
  'Maria,Alvarez,maria@example.com,614-555-0101,12 Elm St,2024-03-01\n' +
  'Dana,Okafor,,614-555-0142,,2025-01-15\n'
