import * as React from 'react'
import { MemoryRouter, Route } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, type Mock } from 'vitest'

import * as NamedRoutes from 'utils/NamedRoutes'
import AsyncResult from 'utils/AsyncResult'
import type * as CatalogSettings from 'utils/CatalogSettings'
import * as BucketPreferences from 'utils/BucketPreferences'

import Bucket from './Bucket'

vi.mock('constants/config', () => ({ default: {} }))

// The real shell pulls the sidebar, search bar and theme roots; only its `pre`
// slot and children carry the header card under test.
vi.mock('components/Layout', () => ({
  default: ({ pre }: { pre?: React.ReactNode }) => <>{pre}</>,
  Container: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('containers/Bucket/Nav', () => ({
  Tabs: () => <div data-testid="tabs" />,
}))

vi.mock('containers/NotFound', () => ({
  NotFoundInTabs: () => <div data-testid="not-found" />,
}))

vi.mock('utils/MetaTitle', () => ({
  default: () => null,
}))

vi.mock('./AssistantContext', () => ({
  BucketContext: () => null,
}))

vi.mock('utils/BucketCache', () => ({
  useBucketExistence: () => ({
    case: ({ Ok }: { Ok: () => React.ReactNode }) => Ok(),
  }),
}))

const settingsHook: Mock<() => CatalogSettings.CatalogSettings | null> = vi.fn(() => null)

vi.mock('utils/CatalogSettings', () => ({
  use: () => settingsHook(),
}))

vi.mock('utils/BucketPreferences', async () => ({
  ...(await vi.importActual<typeof BucketPreferences>('utils/BucketPreferences')),
  Provider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  use: () => ({
    prefs: BucketPreferences.Result.Ok({
      ui: { nav: { queries: false } },
    } as unknown as BucketPreferences.BucketPreferences),
  }),
}))

// Header's stats plumbing, mocked to resolve immediately so the stats row is
// either fully present or absent — never mid-flight.
vi.mock('components/Skeleton', () => ({
  default: () => <div data-testid="skeleton" />,
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

vi.mock('utils/Data', () => ({
  useData: () => ({
    result: AsyncResult.Ok({ totalBytes: 1024, totalObjects: 42, exts: [] }),
  }),
}))

type FoldResult = { fetching?: boolean; error?: unknown; data?: unknown }
type FoldHandlers = {
  data: (d: unknown, r: FoldResult) => unknown
  fetching: (r: FoldResult) => unknown
  error?: (e: unknown, r: FoldResult) => unknown
}
vi.mock('utils/GraphQL', () => ({
  useQuery: () => ({
    data: { searchPackages: { __typename: 'PackagesSearchResultSet', total: 7 } },
  }),
  fold: (result: FoldResult, handlers: FoldHandlers) => {
    if (result?.fetching) return handlers.fetching(result)
    if (result?.error) return handlers.error?.(result.error, result)
    return handlers.data(result?.data, result)
  },
}))

vi.mock('./Tabulator/requests', () => ({
  useTabulatorTables: () => ({ _tag: 'ready', tables: [] }),
}))

// Every tab path is unreachable from the rendered location, so the Switch lands
// on the catch-all and no `RT.mkLazy` route is imported.
const mkRoute = (name: string) => ({
  path: `/never/${name}`,
  url: (bucket: string) => `/${name}/${bucket}`,
})

const routes = {
  bucketFile: mkRoute('file'),
  bucketDir: { path: '/never/dir', url: (bucket: string) => `/dir/${bucket}` },
  bucketOverview: mkRoute('overview'),
  bucketPackageList: {
    path: '/never/packages',
    url: (bucket: string) => `/packages/${bucket}`,
  },
  bucketPackageAddFiles: mkRoute('add-files'),
  bucketPackageDetail: mkRoute('detail'),
  bucketPackageTree: mkRoute('tree'),
  bucketPackageRevisions: mkRoute('revisions'),
  bucketPackageCompare: mkRoute('compare'),
  bucketWorkflowList: mkRoute('workflows'),
  bucketWorkflowDetail: mkRoute('workflow'),
  adminBucketEdit: mkRoute('admin'),
  queriesAthena: {
    path: '/never/athena',
    url: ({ bucket }: { bucket?: string } = {}) => `/queries/athena?bucket=${bucket}`,
  },
}

function renderBucket() {
  return render(
    <MemoryRouter initialEntries={['/b/test-bucket']}>
      <NamedRoutes.Provider routes={routes}>
        <Route path="/b/:bucket">
          <Bucket />
        </Route>
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

describe('containers/Bucket: header card gate', () => {
  afterEach(() => {
    cleanup()
    settingsHook.mockReturnValue(null)
  })

  it('names the bucket when the beta flag is on', () => {
    settingsHook.mockReturnValue({ beta: true })
    const { queryByText } = renderBucket()
    expect(queryByText('test-bucket')).toBeTruthy()
  })

  it('shows the stats row when the beta flag is on', () => {
    settingsHook.mockReturnValue({ beta: true })
    const { queryByText } = renderBucket()
    expect(queryByText(/objects/)).toBeTruthy()
    expect(queryByText('Create package')).toBeTruthy()
  })

  it('hides the stats row when the beta flag is off', () => {
    settingsHook.mockReturnValue({ beta: false })
    const { queryByText } = renderBucket()
    expect(queryByText(/objects/)).toBeNull()
    expect(queryByText('Create package')).toBeNull()
  })

  it('hides the stats row when there are no catalog settings', () => {
    settingsHook.mockReturnValue(null)
    const { queryByText } = renderBucket()
    expect(queryByText(/objects/)).toBeNull()
    expect(queryByText('Create package')).toBeNull()
  })

  // The bucket name is not a beta feature: the tabs below it are the only other
  // place a tab could name its bucket, and they don't. Asserted as the desired
  // behavior via `it.fails` so each flips red once the gate covers stats only.
  it.fails('names the bucket when the beta flag is off', () => {
    settingsHook.mockReturnValue({ beta: false })
    const { queryByText } = renderBucket()
    expect(queryByText('test-bucket')).toBeTruthy()
  })

  it.fails('names the bucket when there are no catalog settings', () => {
    settingsHook.mockReturnValue(null)
    const { queryByText } = renderBucket()
    expect(queryByText('test-bucket')).toBeTruthy()
  })
})
