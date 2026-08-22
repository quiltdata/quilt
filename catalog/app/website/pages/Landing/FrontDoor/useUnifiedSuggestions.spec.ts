import { renderHook } from '@testing-library/react-hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

const bookmarksUse = vi.fn(() => ({
  groups: {
    main: {
      entries: {
        's3://bucket/path/file.csv': { bucket: 'bucket', key: 'path/file.csv' },
      },
    },
  },
}))

vi.mock('containers/Bookmarks', () => ({
  use: () => bookmarksUse(),
}))

vi.mock('./useRecentPackages', () => ({
  default: () => [{ bucket: 'bucket', name: 'owner/drugbank', title: 'DrugBank' }],
}))

import useUnifiedSuggestions from './useUnifiedSuggestions'

describe('website/pages/Landing/FrontDoor/useUnifiedSuggestions', () => {
  afterEach(() => {
    bookmarksUse.mockClear()
  })

  it('returns no suggestions for an empty query', () => {
    const { result } = renderHook(() => useUnifiedSuggestions(''))
    expect(result.current).toEqual([])
  })

  it('merges recent packages and bookmarks client-side', () => {
    const { result } = renderHook(() => useUnifiedSuggestions('drug'))
    expect(result.current).toEqual([
      expect.objectContaining({ label: 'DrugBank', detail: 'Recent package' }),
    ])
  })

  it('includes bookmark suggestions when they match', () => {
    const { result } = renderHook(() => useUnifiedSuggestions('file'))
    expect(result.current).toEqual([
      expect.objectContaining({ label: 'path/file.csv', detail: 'Bookmarked in bucket' }),
    ])
  })
})
