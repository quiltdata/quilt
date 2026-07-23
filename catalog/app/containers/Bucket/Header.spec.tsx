import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as NamedRoutes from 'utils/NamedRoutes'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'

import Header from './Header'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('components/Skeleton', () => ({
  default: () => <div data-testid="skeleton" />,
}))

let navQueries = true
vi.mock('utils/BucketPreferences', async () => ({
  ...(await vi.importActual<typeof BucketPreferences>('utils/BucketPreferences')),
  use: () => ({
    prefs: BucketPreferences.Result.Ok({
      ui: { nav: { queries: navQueries } },
    } as unknown as BucketPreferences.BucketPreferences),
  }),
}))

vi.mock('./PackageDialog', () => ({
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

// `useQuery` feeds the package-count stat; `fold` dispatches by result shape so both
// the package query and the folded tabulator-tables result resolve correctly.
type FoldResult = { fetching?: boolean; error?: unknown; data?: unknown }
type FoldHandlers = {
  data: (d: unknown, r: FoldResult) => unknown
  fetching: (r: FoldResult) => unknown
  error?: (e: unknown, r: FoldResult) => unknown
}
vi.mock('utils/GraphQL', () => ({
  useQuery: () => ({
    data: {
      searchPackages: { __typename: 'PackagesSearchResultSet', total: packagesTotal },
    },
  }),
  fold: (result: FoldResult, handlers: FoldHandlers) => {
    if (result?.fetching) return handlers.fetching(result)
    if (result?.error) return handlers.error?.(result.error, result)
    return handlers.data(result?.data, result)
  },
}))

// `useTabulatorTables` returns a tagged result the component switches on.
const useTabulatorTables = vi.fn<() => unknown>(() => ({ _tag: 'ready', tables: [] }))
vi.mock('./Tabulator/requests', () => ({
  useTabulatorTables: () => useTabulatorTables(),
}))

const routes = {
  bucketDir: { path: '', url: (bucket: string) => `/dir/${bucket}` },
  bucketPackageList: { path: '', url: (bucket: string) => `/packages/${bucket}` },
  queriesAthena: {
    path: '',
    url: ({ bucket }: { bucket?: string } = {}) => `/queries/athena?bucket=${bucket}`,
  },
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

describe('containers/Bucket/Header', () => {
  afterEach(() => {
    cleanup()
    statsResult.mockReturnValue(AsyncResult.Ok(OBJECTS_PLURAL))
    packagesTotal = 7
    useTabulatorTables.mockReturnValue({ _tag: 'ready', tables: [] })
    navQueries = true
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

  it('shows the Tabulator tables count linked to the global Athena console scoped to this bucket', () => {
    useTabulatorTables.mockReturnValue({
      _tag: 'ready',
      tables: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
    })
    const { getByText } = renderHeader()
    expect(getByText('3')).toBeTruthy()
    const link = getByText(/tables/).closest('a')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('/queries/athena?bucket=test-bucket')
  })

  it('hides the tables stat when there are no tabulator tables', () => {
    const { queryByText } = renderHeader()
    expect(queryByText(/tables/)).toBeNull()
  })

  it('shows a skeleton (not the count) while tabulator tables load', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'fetching' })
    const { queryByText, getAllByTestId } = renderHeader()
    // Stats and packages are loaded, so the tables stat owns the only skeleton.
    expect(getAllByTestId('skeleton')).toHaveLength(1)
    expect(queryByText(/tables/)).toBeNull()
  })

  it('hides the tables stat when Queries is disabled (ui.nav.queries=false)', () => {
    navQueries = false
    useTabulatorTables.mockReturnValue({
      _tag: 'ready',
      tables: [{ name: 'a' }, { name: 'b' }],
    })
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
})
