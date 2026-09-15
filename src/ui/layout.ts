import { useWindowDimensions } from 'react-native'

/** Windows at least this wide (tablets) get the sidebar and list + detail panes. */
export const WIDE_MIN = 700

export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_MIN
}
