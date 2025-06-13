import type { SearchHitPackage } from './model'

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

export interface SearchHitPackageMatchLocations {
  name: boolean
  comment: boolean
  meta: boolean
  workflow: boolean
}

export type SearchHitPackageWithMatches = SearchHitPackage & {
  matchingEntries: readonly SearchHitPackageMatchingEntry[]
  matchLocations: SearchHitPackageMatchLocations
}

export const fakeMatchingEntries: readonly SearchHitPackageMatchingEntry[] = [
  {
    logicalKey: 'README.md',
    meta: null,
    size: 1024,
    physicalKey: 's3://fiskus-sandbox-dev/fiskus/sandbox-dev/README.md',
    matchLocations: {
      logicalKey: true,
      meta: false,
      physicalKey: false,
      contents: false,
    },
  },
  {
    logicalKey: 'ns.json',
    meta: { description: 'test file' },
    size: 2048,
    physicalKey: 's3://fiskus-sandbox-dev/ns.json',
    matchLocations: {
      logicalKey: false,
      meta: true,
      physicalKey: false,
      contents: false,
    },
  },
  {
    logicalKey:
      'some-long/long/long/long/long/long/long/long/long/long/long/long/long/long/name.csv',
    meta: { description: 'test file' },
    size: 2048,
    physicalKey:
      's3://fiskus-sandbox-dev/fiskus/sandbox/ce06f37d-3cf9-4d22-af7a-64a310f8f838.csv',
    matchLocations: {
      logicalKey: false,
      meta: false,
      physicalKey: false,
      contents: true,
    },
  },
]

export function fakeMatchingLocations(): SearchHitPackageMatchLocations {
  const random = Math.random()
  return {
    name: random <= 0.25,
    comment: random > 0.25 && random <= 0.5,
    meta: random > 0.5 && random <= 0.75,
    workflow: random > 0.75,
  }
}
