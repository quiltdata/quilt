import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import AsyncResult from 'utils/AsyncResult'

import Header from './Header'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('./Readme', () => ({
  default: () => <div data-testid="readme" />,
}))

vi.mock('./RecentPackages', () => ({
  default: () => <div data-testid="recent-packages" />,
}))

vi.mock('../ObjectsByExt', () => ({
  default: () => <div data-testid="objects-by-ext" />,
  COLOR_MAP: [],
  MAX_EXTS: 7,
}))

vi.mock('utils/AWS', () => ({
  S3: { use: () => ({}) },
}))

vi.mock('utils/APIConnector', () => ({
  use: () => vi.fn(),
}))

const statsResult = vi.fn(() => AsyncResult.Ok({ totalBytes: 1024, exts: [] }))

vi.mock('utils/Data', () => ({
  useData: () => ({ result: statsResult() }),
}))

// The header reads the bucket description via `useQueryS`; `useStats` (for the
// charts) uses `useQuery` + `fold` for the package count.
type FoldResult = { fetching?: boolean; error?: unknown; data?: unknown }
type FoldHandlers = {
  data: (d: unknown, r: FoldResult) => unknown
  fetching: (r: FoldResult) => unknown
  error?: (e: unknown, r: FoldResult) => unknown
}
vi.mock('utils/GraphQL', () => ({
  useQueryS: () => ({ bucket: { name: 'test-bucket', description: 'A test bucket' } }),
  useQuery: () => ({
    data: { searchPackages: { __typename: 'PackagesSearchResultSet', total: 7 } },
  }),
  fold: (result: FoldResult, handlers: FoldHandlers) => {
    if (result?.fetching) return handlers.fetching(result)
    if (result?.error) return handlers.error?.(result.error, result)
    return handlers.data(result?.data, result)
  },
}))

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header bucket="test-bucket" />
    </MemoryRouter>,
  )
}

describe('containers/Bucket/Overview/v2/Header', () => {
  afterEach(cleanup)

  it('renders the description', () => {
    const { getByText } = renderHeader()
    expect(getByText('A test bucket')).toBeTruthy()
  })

  it('renders the ObjectsByExt chart and the recent-packages list', () => {
    const { getByTestId } = renderHeader()
    expect(getByTestId('objects-by-ext')).toBeTruthy()
    expect(getByTestId('recent-packages')).toBeTruthy()
  })
})
