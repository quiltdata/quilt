import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

import { bucketFile, bucketDir } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import { List } from './List'

// Mock useBookmarks so tests control the bookmarks state without touching localStorage.
// This matches the pattern seen in the codebase for hooks-under-test that are hard to
// seed via a real provider. (ListingActions.spec.tsx uses the real Bookmarks.Provider
// instead, but that requires append() calls — mocking is simpler here.)
vi.mock('./Provider', () => ({
  useBookmarks: vi.fn(),
}))

import * as Provider from './Provider'

const mockUseBookmarks = vi.mocked(Provider.useBookmarks)

function TestWrapper({ children }: React.PropsWithChildren<{}>) {
  return (
    <MemoryRouter>
      <NamedRoutes.Provider routes={{ bucketFile, bucketDir }}>
        {children}
      </NamedRoutes.Provider>
    </MemoryRouter>
  )
}

const noop = () => {}

const baseBookmarks = {
  append: noop,
  clear: noop,
  hasUpdates: false,
  hide: noop,
  isBookmarked: () => false,
  isOpened: false,
  remove: noop,
  show: noop,
  toggle: noop,
}

describe('containers/Bookmarks/List', () => {
  afterEach(cleanup)

  it('renders bookmarked entries and no empty-state when entries exist', () => {
    mockUseBookmarks.mockReturnValue({
      ...baseBookmarks,
      groups: {
        main: {
          entries: {
            's3://my-bucket/path/to/file.txt': {
              bucket: 'my-bucket',
              key: 'path/to/file.txt',
            },
            's3://other-bucket/some/dir/': { bucket: 'other-bucket', key: 'some/dir/' },
          },
        },
      },
    })

    const { getByText, queryByText } = render(
      <TestWrapper>
        <List />
      </TestWrapper>,
    )

    expect(getByText(/my-bucket/)).toBeTruthy()
    expect(getByText(/other-bucket/)).toBeTruthy()
    expect(queryByText('No bookmarks')).toBeNull()
  })

  it('renders "No bookmarks" when entries are empty', () => {
    mockUseBookmarks.mockReturnValue({
      ...baseBookmarks,
      groups: {
        main: {
          entries: {},
        },
      },
    })

    const { getByText } = render(
      <TestWrapper>
        <List />
      </TestWrapper>,
    )

    expect(getByText('No bookmarks')).toBeTruthy()
  })
})
