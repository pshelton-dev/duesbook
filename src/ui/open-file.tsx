import { File } from 'expo-file-system'
import * as Linking from 'expo-linking'
import { useEffect, useRef } from 'react'
import { Alert } from 'react-native'
import { looksLikeSqlite } from '../data/backup'
import { useBooks } from './books'

/**
 * A `.duesbook` (or `.db`) file opened from Files, Mail, or AirDrop arrives
 * as a file URL. Offer to restore it, with the same loud confirmation and
 * safety copy as Settings → Restore. Needs the document-type declaration in
 * app.json, which only a real build carries.
 */
export function OpenedBooksFileHandler(): null {
  const { restore, hasOrg } = useBooks()
  const handled = useRef<string | null>(null)

  useEffect(() => {
    const consider = (url: string | null): void => {
      if (!url || !url.startsWith('file:') || handled.current === url) return
      if (!/\.(duesbook|db)$/i.test(url.split('?')[0])) return
      handled.current = url
      try {
        const file = new File(url)
        if (!file.exists || !looksLikeSqlite(file.bytesSync().subarray(0, 16))) {
          Alert.alert('Not a Duesbook file', 'That file does not look like a Duesbook backup or handoff file.')
          return
        }
        Alert.alert(
          hasOrg ? 'Restore these books?' : 'Open these books?',
          hasOrg
            ? `This replaces the books on this phone with ${file.name}. A safety copy of the current books is kept in the snapshot folder.`
            : `Set up this phone with the books in ${file.name}.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: hasOrg ? 'Restore' : 'Open', style: hasOrg ? 'destructive' : 'default', onPress: () => restore(file) }
          ]
        )
      } catch (e) {
        Alert.alert('Could not open that file', e instanceof Error ? e.message : String(e))
      }
    }
    Linking.getInitialURL().then(consider).catch(() => undefined)
    const sub = Linking.addEventListener('url', (e) => consider(e.url))
    return () => sub.remove()
  }, [restore, hasOrg])

  return null
}
