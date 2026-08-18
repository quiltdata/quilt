import * as React from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import Buckets from './Buckets'

vi.mock('constants/config', () => ({ default: {} }))

interface MockBucket {
  name: string
  title: string
  description: string | null
  tags: ReadonlyArray<string> | null
  relevanceScore: number
}

let mockBuckets: MockBucket[] = [
  {
    name: 'bucket-one',
    title: 'Bucket One',
    description: null,
    tags: null,
    relevanceScore: 1,
  },
]

vi.mock('utils/Buckets', () => ({
  useRelevantBuckets: () => mockBuckets,
}))

// `useFeature` reads catalog settings off the service bucket, which needs
// credentials this spec has no business providing. Off by default so the
// existing bucket-only expectations hold; a test opts in per case.
let dataProductsEnabled = false
vi.mock('utils/features', () => ({
  useFeature: () => dataProductsEnabled,
}))

// Stub only the suspending port read. `useProducts` goes through ResourceCache,
// which needs a Provider this spec does not mount, and suspending here would
// make every assertion await a microtask. The `enabled` passthrough is kept
// faithful, because "shows none while the feature is off" depends on it.
vi.mock('model/DataProducts', async () => {
  const actual =
    await vi.importActual<typeof import('model/DataProducts')>('model/DataProducts')
  return {
    ...actual,
    useProducts: (enabled = true) => (enabled ? actual.fixtures.ALL_PRODUCTS : []),
  }
})

vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: () => ({
    urls: {
      adminBuckets: () => '/admin/buckets',
    },
  }),
}))

// Sentinel standing in for the generated query document, so the mocked
// `useQuery` below can dispatch on query identity.
vi.mock('website/pages/Landing/gql/IsAdmin.generated', () => ({
  default: 'IS_ADMIN_QUERY',
}))

interface QueryState {
  data?: unknown
  fetching: boolean
  error?: unknown
}

// `me` is null when signed out — e.g. this component also renders anonymously
// on the OPEN-mode landing.
let meIsAdminData: { isAdmin: boolean } | null = { isAdmin: false }

const useQueryMock = vi.fn((query: string): QueryState => {
  switch (query) {
    case 'IS_ADMIN_QUERY':
      return { data: { me: meIsAdminData }, fetching: false }
    default:
      throw new Error(`unexpected query: ${query}`)
  }
})

vi.mock('utils/GraphQL', () => ({
  useQuery: (...args: Parameters<typeof useQueryMock>) => useQueryMock(...args),
  fold: (
    result: QueryState,
    cases: {
      data: (d: unknown, r: QueryState) => unknown
      fetching: (r: QueryState) => unknown
      error: (e: unknown, r: QueryState) => unknown
    },
  ) => {
    if (result.data) return cases.data(result.data, result)
    if (result.fetching) return cases.fetching(result)
    return cases.error(new Error('query failed'), result)
  },
}))

interface RowsProps {
  buckets: ReadonlyArray<{ name: string }>
  // Both grid renderers take data products alongside buckets; the stand-ins
  // echo them so a test can assert they reached the renderer at all.
  dataProducts?: ReadonlyArray<{ id: string }>
}

const Rows = ({ buckets, dataProducts = [] }: RowsProps) => (
  <div>
    {buckets.map((b) => (
      <div key={b.name}>{`bucket:${b.name}`}</div>
    ))}
    {dataProducts.map((p) => (
      <div key={p.id}>{`dp:${p.id}`}</div>
    ))}
  </div>
)

// NB: `(props) => <Rows ... />` (not `default: Rows`) so the hoisted factories
// only touch `Rows` at render time, after the module body has run.
vi.mock('containers/Home/BucketGrid/BucketList', () => ({
  default: (props: RowsProps) => <Rows {...props} />,
}))

// Distinguishable from the card view's stand-in so a test can tell which
// renderer the `view` param selected.
vi.mock('containers/Home/BucketGrid/BucketRows', () => ({
  default: ({ buckets, dataProducts = [] }: RowsProps) => (
    <div>
      {buckets.map((b) => (
        <div key={b.name}>{`row:${b.name}`}</div>
      ))}
      {dataProducts.map((p) => (
        <div key={p.id}>{`row-dp:${p.id}`}</div>
      ))}
    </div>
  ),
}))

// Surfaces the current query string so a test can assert on what a control
// pushed, without reaching into router internals.
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="search">{location.search}</div>
}

function renderBuckets(search = '') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/', search }]}>
      <M.MuiThemeProvider theme={style.appTheme}>
        <Buckets />
        <LocationProbe />
      </M.MuiThemeProvider>
    </MemoryRouter>,
  )
}

describe('website/pages/Landing/Buckets', () => {
  afterEach(cleanup)
  afterEach(() => {
    useQueryMock.mockClear()
    meIsAdminData = { isAdmin: false }
    dataProductsEnabled = false
    mockBuckets = [
      {
        name: 'bucket-one',
        title: 'Bucket One',
        description: null,
        tags: null,
        relevanceScore: 1,
      },
    ]
  })

  it('renders the volume rows', () => {
    const { queryByText } = renderBuckets()
    expect(queryByText('bucket:bucket-one')).toBeTruthy()
  })

  describe('data products in the volume list', () => {
    it('shows none while the feature is off', () => {
      // The flag is the whole gate: with it off the volume list must look
      // exactly as it did before data products existed.
      const { queryByText } = renderBuckets()
      expect(queryByText('bucket:bucket-one')).toBeTruthy()
      expect(queryByText(/^dp:/)).toBeFalsy()
    })

    it('lists them alongside buckets when the feature is on', () => {
      // Products share the volume grid rather than getting their own wall:
      // both are things a user browses into.
      dataProductsEnabled = true
      const { queryByText } = renderBuckets()
      expect(queryByText('bucket:bucket-one')).toBeTruthy()
      expect(queryByText('dp:datazone:dzd_4xample/lst_9kq2v')).toBeTruthy()
    })

    it('answers the same filter box as buckets', () => {
      // A user typing a term means it about everything on the page. Filtering
      // buckets only would leave a product visible that does not match.
      dataProductsEnabled = true
      const { queryByText } = renderBuckets('?q=restricted')
      expect(queryByText('bucket:bucket-one')).toBeFalsy()
      expect(
        queryByText('dp:uc:aws-prod-metastore/quilt_demo/restricted_cohort'),
      ).toBeTruthy()
    })

    it('keeps the page non-empty when only products match', () => {
      // ZeroState teaches "add a bucket", which would be wrong (and would hide
      // real content) on a catalog whose products are the only things here.
      dataProductsEnabled = true
      mockBuckets = []
      const { queryByText } = renderBuckets()
      expect(queryByText('Add Bucket')).toBeFalsy()
      expect(queryByText('dp:datazone:dzd_4xample/lst_9kq2v')).toBeTruthy()
    })
  })

  it('treats a signed-out (null) me as not-admin instead of crashing', () => {
    // Reachable anonymously: this is the same component OpenLanding mounts,
    // and OPEN mode allows unauthenticated visitors.
    meIsAdminData = null
    const { queryByText } = renderBuckets()
    expect(queryByText('bucket:bucket-one')).toBeTruthy()
    expect(queryByText('Add Bucket')).toBeFalsy()
  })

  it('renders a sort control defaulting to Relevance, with no `sort` param', () => {
    const { getAllByText, getByText } = renderBuckets()
    // The shared SelectDropdown (as on /search) renders "Sort by:" + the value.
    expect(getAllByText('Sort by:').length).toBeGreaterThan(0)
    expect(getByText('Relevance')).toBeTruthy()
  })

  it('shows a teaching empty state with the add path for admins when there are no buckets', () => {
    mockBuckets = []
    meIsAdminData = { isAdmin: true }
    const { queryByText } = renderBuckets()
    expect(queryByText('No volumes yet')).toBeTruthy()
    expect(
      queryByText('Add a volume to make it searchable and browsable here.'),
    ).toBeTruthy()
    expect(queryByText('Add Bucket')).toBeTruthy()
  })

  it('shows a plain line (no add path) for non-admins when there are no buckets', () => {
    mockBuckets = []
    const { queryByText } = renderBuckets()
    expect(queryByText('No volumes yet')).toBeTruthy()
    expect(queryByText('Add Bucket')).toBeFalsy()
  })

  describe('the card/list view toggle', () => {
    it('defaults to the card grid, with no `view` param', () => {
      const { queryByText, getByTestId } = renderBuckets()
      expect(queryByText('bucket:bucket-one')).toBeTruthy()
      expect(queryByText('row:bucket-one')).toBeFalsy()
      expect(getByTestId('search').textContent).toBe('')
    })

    it('renders dense rows for `view=list`', () => {
      const { queryByText } = renderBuckets('?view=list')
      expect(queryByText('row:bucket-one')).toBeTruthy()
      expect(queryByText('bucket:bucket-one')).toBeFalsy()
    })

    it('falls back to the card grid for an unrecognized `view`', () => {
      const { queryByText } = renderBuckets('?view=nonsense')
      expect(queryByText('bucket:bucket-one')).toBeTruthy()
    })

    it('switching view keeps the filter and sort in the URL', () => {
      const { getByLabelText, getByTestId } = renderBuckets('?q=one&sort=name-asc')
      fireEvent.click(getByLabelText('List view'))
      const search = getByTestId('search').textContent
      expect(search).toContain('view=list')
      expect(search).toContain('q=one')
      expect(search).toContain('sort=name-asc')
    })

    it('switching back to cards drops the `view` param rather than pinning it', () => {
      const { getByLabelText, getByTestId } = renderBuckets('?view=list')
      fireEvent.click(getByLabelText('Card view'))
      expect(getByTestId('search').textContent).toBe('')
    })
  })
})
