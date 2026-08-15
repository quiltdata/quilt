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

vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: () => ({
    urls: {
      adminBuckets: () => '/admin/buckets',
    },
  }),
}))

// Sentinels standing in for the generated query documents, so the mocked
// `useQuery` below can dispatch on query identity.
vi.mock('website/pages/Landing/gql/IsAdmin.generated', () => ({
  default: 'IS_ADMIN_QUERY',
}))

vi.mock('website/pages/Landing/gql/DataProducts.generated', () => ({
  default: 'DATA_PRODUCTS_QUERY',
}))

interface MockDataProduct {
  id: string
  name: string
  title: string | null
  description: string | null
  definition: { objects: unknown[]; packages: unknown[] }
}

let mockDataProducts: MockDataProduct[] = []

// The real hook reaches S3 for catalog settings (CatalogSettings -> useS3 ->
// useCredentials), which throws in jsdom; the flag is all this component wants.
let mockDataProductsEnabled = false

vi.mock('utils/CatalogSettings', () => ({
  use: () => ({ dataProducts: mockDataProductsEnabled }),
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
    case 'DATA_PRODUCTS_QUERY':
      return { data: { dataProducts: mockDataProducts }, fetching: false }
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
  dataProducts?: ReadonlyArray<{ id: string; name: string }>
}

// `dp-order` carries the data product run as one joined string, so a test can
// assert on the group's *order* without walking the DOM.
const Rows = ({ buckets, dataProducts = [] }: RowsProps) => (
  <div>
    <div data-testid="dp-order">{dataProducts.map((dp) => dp.name).join(',')}</div>
    {dataProducts.map((dp) => (
      <div key={dp.id}>{`dp:${dp.name}`}</div>
    ))}
    {buckets.map((b) => (
      <div key={b.name}>{`bucket:${b.name}`}</div>
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
      {dataProducts.map((dp) => (
        <div key={dp.id}>{`dprow:${dp.name}`}</div>
      ))}
      {buckets.map((b) => (
        <div key={b.name}>{`row:${b.name}`}</div>
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
    mockDataProducts = []
    mockDataProductsEnabled = false
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
    expect(queryByText('No buckets yet')).toBeTruthy()
    expect(
      queryByText('Add a bucket to make it searchable and browsable here.'),
    ).toBeTruthy()
    expect(queryByText('Add Bucket')).toBeTruthy()
  })

  it('shows a plain line (no add path) for non-admins when there are no buckets', () => {
    mockBuckets = []
    const { queryByText } = renderBuckets()
    expect(queryByText('No buckets yet')).toBeTruthy()
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

  describe('with data products enabled', () => {
    function enableDataProducts() {
      mockDataProductsEnabled = true
      mockDataProducts = [
        {
          id: 'dp-z',
          name: 'zeta-product',
          title: null,
          description: null,
          definition: { objects: [], packages: [] },
        },
        {
          id: 'dp-a',
          name: 'alpha-product',
          title: null,
          description: null,
          definition: { objects: [], packages: [] },
        },
      ]
      mockBuckets = [
        {
          name: 'bucket-one',
          title: 'Bucket One',
          description: null,
          tags: null,
          relevanceScore: 1,
        },
        {
          name: 'bucket-two',
          title: 'Bucket Two',
          description: null,
          tags: null,
          relevanceScore: 2,
        },
      ]
    }

    it('renders data products above the buckets', () => {
      enableDataProducts()
      const { queryByText } = renderBuckets()
      expect(queryByText('dp:alpha-product')).toBeTruthy()
      expect(queryByText('bucket:bucket-one')).toBeTruthy()
    })

    it('offers no group toggle when the catalog has data products switched off', () => {
      const { queryByLabelText } = renderBuckets()
      expect(queryByLabelText('Show data products')).toBeFalsy()
      expect(queryByLabelText('Show buckets')).toBeFalsy()
    })

    it('shows both groups by default, with no `show` param', () => {
      enableDataProducts()
      const { queryByText, getByTestId } = renderBuckets()
      expect(queryByText('dp:alpha-product')).toBeTruthy()
      expect(queryByText('bucket:bucket-one')).toBeTruthy()
      expect(getByTestId('search').textContent).toBe('')
    })

    it('turning off buckets leaves only the data products, and names it in the URL', () => {
      enableDataProducts()
      const { getByLabelText, getByTestId, queryByText } = renderBuckets()
      fireEvent.click(getByLabelText('Show buckets'))
      expect(getByTestId('search').textContent).toContain('show=dataproducts')
      expect(queryByText('dp:alpha-product')).toBeTruthy()
      expect(queryByText('bucket:bucket-one')).toBeFalsy()
    })

    it('honors `show=buckets` from the URL', () => {
      enableDataProducts()
      const { queryByText } = renderBuckets('?show=buckets')
      expect(queryByText('bucket:bucket-one')).toBeTruthy()
      expect(queryByText('dp:alpha-product')).toBeFalsy()
    })

    it('falls back to both groups for an unrecognized `show`', () => {
      enableDataProducts()
      const { queryByText } = renderBuckets('?show=nonsense')
      expect(queryByText('dp:alpha-product')).toBeTruthy()
      expect(queryByText('bucket:bucket-one')).toBeTruthy()
    })

    it('refuses to turn off the last group', () => {
      enableDataProducts()
      const { getByLabelText, getByTestId, queryByText } = renderBuckets('?show=buckets')
      fireEvent.click(getByLabelText('Show buckets'))
      // Nothing pushed, and the group is still on the page.
      expect(getByTestId('search').textContent).toContain('show=buckets')
      expect(queryByText('bucket:bucket-one')).toBeTruthy()
    })

    it('sorts each group within itself rather than interleaving them', () => {
      enableDataProducts()
      const { getByTestId, queryByText } = renderBuckets('?sort=name-desc')
      // Data products reorder on the same control that reorders buckets...
      expect(getByTestId('dp-order').textContent).toBe('zeta-product,alpha-product')
      // ...and both groups are still present, DPs first.
      expect(queryByText('bucket:bucket-two')).toBeTruthy()
    })

    it('leaves the data product order alone for the default relevance sort', () => {
      enableDataProducts()
      const { getByTestId } = renderBuckets()
      expect(getByTestId('dp-order').textContent).toBe('alpha-product,zeta-product')
    })

    it('explains an empty page caused by the toggle rather than quoting an empty filter', () => {
      // Only buckets exist; hiding them leaves nothing, with no filter to blame.
      mockDataProductsEnabled = true
      const { queryByText } = renderBuckets('?show=dataproducts')
      expect(
        queryByText('Nothing to show — turn buckets or data products back on above.'),
      ).toBeTruthy()
    })
  })
})
