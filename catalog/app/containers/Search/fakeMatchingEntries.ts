export interface SearchHitPackageEntryMatchLocations {
  logicalKey: boolean
  meta: boolean
  physicalKey: boolean
  contents: boolean
}

export interface SearchHitPackageMatchingEntry {
  logicalKey: string
  meta: Record<string, unknown> | null
  size: number
  physicalKey: string
  matchLocations: SearchHitPackageEntryMatchLocations
}

export type SearchHitPackageWithMatches = import('./model').SearchHitPackage & {
  matchingEntries: readonly SearchHitPackageMatchingEntry[]
}

export const fakeMatchingEntries: readonly SearchHitPackageMatchingEntry[] = [
  {
    logicalKey: 'README.md',
    meta: null,
    size: 1024,
    physicalKey: 's3://example-bucket/README.md',
    matchLocations: {
      logicalKey: true,
      meta: false,
      physicalKey: false,
      contents: false,
    },
  },
  {
    logicalKey: 'data/file.csv',
    meta: { description: 'test file' },
    size: 2048,
    physicalKey: 's3://example-bucket/data/file.csv',
    matchLocations: {
      logicalKey: false,
      meta: true,
      physicalKey: false,
      contents: false,
    },
  },
]
