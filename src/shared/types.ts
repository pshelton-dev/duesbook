export interface OrganizationSummary {
  name: string
  fiscalYearStartMonth: number
}

export interface AppStatus {
  appVersion: string
  dbPath: string
  schemaVersion: number
  /** null means no organization row yet — i.e. first run, wizard required */
  organization: OrganizationSummary | null
}

export interface DuesbookApi {
  getStatus: () => Promise<AppStatus>
}
