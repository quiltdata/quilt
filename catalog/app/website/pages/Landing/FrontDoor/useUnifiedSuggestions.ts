import * as React from 'react'

import * as Bookmarks from 'containers/Bookmarks'
import { bucketFile, bucketPackageDetail } from 'constants/routes'
import { handleToS3Url } from 'utils/s3paths'

import useRecentPackages from './useRecentPackages'

export interface UnifiedSuggestion {
  id: string
  label: string
  detail: string
  url?: string
}

export default function useUnifiedSuggestions(query: string): UnifiedSuggestion[] {
  const recentPackages = useRecentPackages()
  const bookmarks = Bookmarks.use()
  const needle = query.trim().toLowerCase()

  return React.useMemo(() => {
    if (!needle) return []

    const recentSuggestions = recentPackages.map((pkg, index) => {
      const label = pkg.title || pkg.name || pkg.url || 'Recent package'
      return {
        id: `recent-${index}-${label}`,
        label,
        detail: 'Recent package',
        url:
          pkg.url ||
          (pkg.bucket && pkg.name
            ? bucketPackageDetail.url(pkg.bucket, pkg.name)
            : undefined),
      }
    })

    const bookmarkEntries = Object.values(bookmarks?.groups.main.entries || {})
    const bookmarkSuggestions = bookmarkEntries.map((handle, index) => ({
      id: `bookmark-${index}-${handleToS3Url(handle)}`,
      label: handle.key,
      detail: `Bookmarked in ${handle.bucket}`,
      url: bucketFile.url(handle.bucket, handle.key),
    }))

    return [...recentSuggestions, ...bookmarkSuggestions]
      .filter((suggestion) =>
        `${suggestion.label} ${suggestion.detail}`.toLowerCase().includes(needle),
      )
      .slice(0, 8)
  }, [bookmarks, needle, recentPackages])
}
