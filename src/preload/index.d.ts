import type { DuesbookApi } from '../shared/types'

declare global {
  interface Window {
    duesbook: DuesbookApi
  }
}

export {}
