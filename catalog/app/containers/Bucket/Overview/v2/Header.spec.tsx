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

vi.mock('./RecentPackages', () => ({
  default: () => <div data-testid="recent-packages" />,
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

const OBJECTS_PLURAL = { totalBytes: 1024, totalObjects: 42, exts: [] }
const statsResult = vi.fn(() => AsyncResult.Ok(OBJECTS_PLURAL))
let packagesTotal = 7

vi.mock('utils/Data', () => ({
  useData: () => ({ result: statsResult() }),
}))

vi.mock('utils/GraphQL', () => ({
  useQueryS: () => ({ bucket: { name: 'test-bucket', description: 'A test bucket' } }),
  useQuery: () => [{ fetching: false, error: undefined, data: undefined }],
  fold: (_q: unknown, handlers: { data: (d: unknown) => unknown }) =>
    handlers.data({
      searchPackages: { __typename: 'PackagesSearchResultSet', total: packagesTotal },
    }),
}))

const tabulatorTables = vi.fn<() => unknown>(() => [])
vi.mock('../../Tabulator/requests', () => ({
  useTabulatorTables: () => tabulatorTables(),
}))

const routes = {
  bucketDir: { path: '', url: (bucket: string) => `/dir/${bucket}` },
  bucketPackageList: { path: '', url: (bucket: string) => `/packages/${bucket}` },
  bucketQueries: { path: '', url: (bucket: string) => `/queries/${bucket}` },
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
  afterEach(() => {
    cleanup()
    statsResult.mockReturnValue(AsyncResult.Ok(OBJECTS_PLURAL))
    packagesTotal = 7
    tabulatorTables.mockReturnValue([])
  })

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

  it('links Objects stat to bucketDir', () => {
    const { getByText } = renderHeader()
    const link = getByText(/objects/).closest('a')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('/dir/test-bucket')
  })

  it('links Packages stat to bucketPackageList', () => {
    const { getByText } = renderHeader()
    const link = getByText(/packages/).closest('a')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('/packages/test-bucket')
  })

  it('shows the Tabulator tables count linked to queries', () => {
    tabulatorTables.mockReturnValue([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
    const { getByText } = renderHeader()
    expect(getByText('3')).toBeTruthy()
    const link = getByText(/tables/).closest('a')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('/queries/test-bucket')
  })

  it('hides the tables stat when there are no tabulator tables', () => {
    const { queryByText } = renderHeader()
    expect(queryByText(/tables/)).toBeNull()
  })

  it('uses singular stat labels when the count is 1', () => {
    statsResult.mockReturnValue(
      AsyncResult.Ok({ totalBytes: 1024, totalObjects: 1, exts: [] }),
    )
    packagesTotal = 1
    const { getByText, queryByText } = renderHeader()
    expect(getByText('object')).toBeTruthy()
    expect(getByText('package')).toBeTruthy()
    expect(queryByText('objects')).toBeNull()
    expect(queryByText('packages')).toBeNull()
  })

  it('renders the Create package button', () => {
    const { getByText } = renderHeader()
    expect(getByText('Create package')).toBeTruthy()
  })

  it('renders the ObjectsByExt chart and the recent-packages list', () => {
    const { getByTestId } = renderHeader()
    expect(getByTestId('objects-by-ext')).toBeTruthy()
    expect(getByTestId('recent-packages')).toBeTruthy()
  })
})
