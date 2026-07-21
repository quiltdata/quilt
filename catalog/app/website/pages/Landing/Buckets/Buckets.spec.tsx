import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, type Mock } from 'vitest'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import type * as CatalogSettings from 'utils/CatalogSettings'

import Buckets from './Buckets'

vi.mock('constants/config', () => ({ default: {} }))

const settingsHook: Mock<() => CatalogSettings.CatalogSettings | null> = vi.fn(() => null)

vi.mock('utils/CatalogSettings', () => ({
  use: () => settingsHook(),
}))

vi.mock('utils/Buckets', () => ({
  useRelevantBuckets: () => [
    {
      name: 'bucket-one',
      title: 'Bucket One',
      description: null,
      tags: null,
      relevanceScore: 1,
    },
  ],
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
vi.mock('../gql/DataProducts.generated', () => ({ default: 'DATA_PRODUCTS_QUERY' }))
vi.mock('../gql/IsAdmin.generated', () => ({ default: 'IS_ADMIN_QUERY' }))

interface QueryState {
  data?: unknown
  fetching: boolean
  error?: unknown
}

// `me` is null when signed out — e.g. this component also renders anonymously
// on the OPEN-mode landing.
let meIsAdminData: { isAdmin: boolean } | null = { isAdmin: false }

const useQueryMock = vi.fn(
  (query: string, _variables?: unknown, options?: { pause?: boolean }): QueryState => {
    // urql semantics: a paused query never executes
    if (options?.pause) return { data: undefined, fetching: false, error: undefined }
    switch (query) {
      case 'IS_ADMIN_QUERY':
        return { data: { me: meIsAdminData }, fetching: false }
      case 'DATA_PRODUCTS_QUERY':
        return {
          data: {
            dataProducts: [
              {
                id: 'dp-1',
                name: 'dp-one',
                title: 'DP One',
                description: null,
                definition: { objects: [], packages: [] },
              },
            ],
          },
          fetching: false,
        }
      default:
        throw new Error(`unexpected query: ${query}`)
    }
  },
)

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
    return cases.error(new Error('query failed or paused'), result)
  },
}))

interface RowsProps {
  buckets: ReadonlyArray<{ name: string }>
  dataProducts?: ReadonlyArray<{ id: string; name: string }>
}

const Rows = ({ buckets, dataProducts = [] }: RowsProps) => (
  <div>
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
vi.mock('website/components/BucketGrid', () => ({
  default: (props: RowsProps) => <Rows {...props} />,
}))
vi.mock('website/components/BucketGrid/BucketList', () => ({
  default: (props: RowsProps) => <Rows {...props} />,
}))

function renderBuckets() {
  return render(
    <MemoryRouter>
      <M.MuiThemeProvider theme={style.appTheme}>
        <Buckets />
      </M.MuiThemeProvider>
    </MemoryRouter>,
  )
}

const dpQueryOptions = () =>
  useQueryMock.mock.calls
    .filter(([query]) => query === 'DATA_PRODUCTS_QUERY')
    .map(([, , options]) => options)

describe('website/pages/Landing/Buckets', () => {
  afterEach(cleanup)
  afterEach(() => {
    useQueryMock.mockClear()
    meIsAdminData = { isAdmin: false }
  })

  it('renders no data product rows and pauses the query when the flag is off', () => {
    settingsHook.mockReturnValue(null)
    const { queryByText } = renderBuckets()
    expect(queryByText('bucket:bucket-one')).toBeTruthy()
    expect(queryByText('dp:dp-one')).toBeFalsy()
    // the type toggle collapses (all == buckets), so it's hidden entirely
    expect(queryByText('Data products')).toBeFalsy()
    const opts = dpQueryOptions()
    expect(opts.length).toBeGreaterThan(0)
    opts.forEach((o) => expect(o?.pause).toBe(true))
  })

  it('renders data product rows, the type toggle and fires the query when the flag is on', () => {
    settingsHook.mockReturnValue({ dataProducts: true })
    const { queryByText } = renderBuckets()
    expect(queryByText('bucket:bucket-one')).toBeTruthy()
    expect(queryByText('dp:dp-one')).toBeTruthy()
    expect(queryByText('Data products')).toBeTruthy()
    const opts = dpQueryOptions()
    expect(opts.length).toBeGreaterThan(0)
    opts.forEach((o) => expect(o?.pause).toBe(false))
  })

  it('treats a signed-out (null) me as not-admin instead of crashing', () => {
    // Reachable anonymously: this is the same component OpenLanding mounts,
    // and OPEN mode allows unauthenticated visitors.
    settingsHook.mockReturnValue(null)
    meIsAdminData = null
    const { queryByText } = renderBuckets()
    expect(queryByText('bucket:bucket-one')).toBeTruthy()
    expect(queryByText('Add Bucket')).toBeFalsy()
  })
})
