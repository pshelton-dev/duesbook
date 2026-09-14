import { presentContactPickerAsync } from 'expo-contacts/legacy'
import type { WizardMember } from '../shared/types'

/**
 * Opens the system contact picker and returns the chosen person as member
 * fields. The legacy picker hands the chosen card's fields straight back,
 * so no Contacts permission is ever requested: the app sees one card, the
 * one the user tapped, and nothing else in the address book.
 */
export async function pickContactAsMember(): Promise<WizardMember | null> {
  const c = await presentContactPickerAsync()
  if (!c) return null
  const email = c.emails?.[0]?.email?.trim() || null
  const phone = c.phoneNumbers?.[0]?.number?.trim() || null
  const a = c.addresses?.[0]
  const address = a
    ? [a.street, [a.city, a.region, a.postalCode].filter(Boolean).join(' ')].filter((s) => s && s.trim()).join(', ') || null
    : null
  return {
    firstName: c.firstName?.trim() ?? '',
    lastName: c.lastName?.trim() ?? '',
    email,
    phone,
    address,
    joinDate: null
  }
}
