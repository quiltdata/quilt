import * as React from 'react'

export const RECENT_PACKAGES_STORAGE_KEY = 'QUILT_RECENT_PACKAGES'

export interface RecentPackage {
  bucket?: string
  name?: string
  title?: string
  url?: string
}

function isRecentPackage(input: unknown): input is RecentPackage {
  if (!input || typeof input !== 'object') return false
  const candidate = input as Record<string, unknown>
  return (
    typeof candidate.title === 'string' ||
    typeof candidate.name === 'string' ||
    typeof candidate.url === 'string'
  )
}

export function readRecentPackages(): RecentPackage[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(RECENT_PACKAGES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecentPackage)
  } catch (_err) {
    return []
  }
}

export default function useRecentPackages() {
  return React.useMemo(readRecentPackages, [])
}
