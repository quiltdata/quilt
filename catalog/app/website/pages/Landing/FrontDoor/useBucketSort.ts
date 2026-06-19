import * as React from 'react'

export type BucketSort = 'relevant' | 'recent' | 'az'

export const BUCKET_SORT_STORAGE_KEY = 'QUILT_FRONTDOOR_BUCKET_SORT'

const VALID: ReadonlySet<BucketSort> = new Set(['relevant', 'recent', 'az'])

function read(): BucketSort {
  try {
    const raw = window.localStorage.getItem(BUCKET_SORT_STORAGE_KEY)
    if (raw && VALID.has(raw as BucketSort)) return raw as BucketSort
  } catch {
    // localStorage may be unavailable; fall through to default
  }
  return 'relevant'
}

/**
 * Remembers the user's Buckets-tile sort choice in localStorage. This is a
 * lightweight, reversible UI preference only — not authoritative server state.
 */
export default function useBucketSort() {
  const [sort, setSort] = React.useState<BucketSort>(read)

  const update = React.useCallback((next: BucketSort) => {
    setSort(next)
    try {
      window.localStorage.setItem(BUCKET_SORT_STORAGE_KEY, next)
    } catch {
      // ignore persistence failures
    }
  }, [])

  return [sort, update] as const
}
