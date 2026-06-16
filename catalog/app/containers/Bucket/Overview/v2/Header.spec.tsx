import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as NamedRoutes from 'utils/NamedRoutes'
import AsyncResult from 'utils/AsyncResult'

import Header from './Header'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('./Readme', () => ({
  default: () => <div data-testid="readme" />,
}))

vi.mock('../Downloads', () => ({
  default: () => <div data-testid="downloads" />,
}))

vi.mock('../ObjectsByExt', () => ({
  default: () => <div data-testid="objects-by-ext" />,
  COLOR_MAP: [],
  MAX_EXTS: 7,
}))

vi.mock('../../PackageDialog', () => ({
  useCreateDialog: () => ({ open: vi.fn(), render: () => null }),
}))

vi.mock('react-redux', () => ({
  useSelector: () => false,
}))

vi.mock('utils/AWS', () => ({
  S3: { use: () => ({}) },
}))

vi.mock('utils/APIConnector', () => ({
  use: () => vi.fn(),
}))

const statsResult = vi.fn(() =>
  AsyncResult.Ok({ totalBytes: 1024, totalObjects: 42, exts: [] }),
)

vi.mock('utils/Data', () => ({
  useData: () => ({ result: statsResult() }),
}))

vi.mock('utils/GraphQL', () => ({
  useQueryS: () => ({ bucket: { name: 'test-bucket', description: 'A test bucket' } }),
  useQuery: () => [{ fetching: false, error: undefined, data: undefined }],
  fold: (_q: unknown, handlers: { data: (d: unknown) => unknown }) =>
    handlers.data({
      searchPackages: { __typename: 'PackagesSearchResultSet', total: 7 },
    }),
}))

const routes = {
  bucketDir: { path: '', url: (bucket: string) => `/dir/${bucket}` },
  bucketPackageList: { path: '', url: (bucket: string) => `/packages/${bucket}` },
  adminBucketEdit: { path: '', url: (bucket: string) => `/admin/${bucket}` },
}

function renderHeader() {
  return render(
    <MemoryRouter>
      <NamedRoutes.Provider routes={routes}>
        <Header bucket="test-bucket" />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

describe('containers/Bucket/Overview/v2/Header', () => {
  afterEach(cleanup)

  it('does not link the total-size stat', () => {
    const { getAllByText } = renderHeader()
    // readableBytes(1024) renders "1 kB" split across text nodes
    const sizeNodes = getAllByText(
      (_content, el) =>
        el?.tagName === 'SPAN' && el.textContent?.replace(/\s/g, '') === '1kB',
    )
    expect(sizeNodes.length).toBeGreaterThan(0)
    sizeNodes.forEach((node) => expect(node.closest('a')).toBeNull())
  })

  it('renders the Objects stat as a link-button to bucketDir', () => {
    const { getByRole } = renderHeader()
    const link = getByRole('button', { name: /Objects/ })
    expect(link.closest('a')).toBe(link)
    expect(link.getAttribute('href')).toBe('/dir/test-bucket')
  })

  it('renders the Packages stat as a link-button to bucketPackageList', () => {
    const { getByRole } = renderHeader()
    const link = getByRole('button', { name: /Packages/ })
    expect(link.closest('a')).toBe(link)
    expect(link.getAttribute('href')).toBe('/packages/test-bucket')
  })

  it('renders the Create package button', () => {
    const { getByText } = renderHeader()
    expect(getByText('Create package')).toBeTruthy()
  })

  it('renders the ObjectsByExt and Downloads charts', () => {
    const { getByTestId } = renderHeader()
    expect(getByTestId('objects-by-ext')).toBeTruthy()
    expect(getByTestId('downloads')).toBeTruthy()
  })
})
