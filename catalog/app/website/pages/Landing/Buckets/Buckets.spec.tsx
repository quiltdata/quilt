import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import Buckets from './Buckets'

vi.mock('constants/config', () => ({ default: {} }))

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

// Sentinel standing in for the generated query document, so the mocked
// `useQuery` below can dispatch on query identity.
vi.mock('../gql/IsAdmin.generated', () => ({ default: 'IS_ADMIN_QUERY' }))

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
}

const Rows = ({ buckets }: RowsProps) => (
  <div>
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
      <M.MuiThemeProvider theme={style.websiteTheme}>
        <Buckets />
      </M.MuiThemeProvider>
    </MemoryRouter>,
  )
}

describe('website/pages/Landing/Buckets', () => {
  afterEach(cleanup)
  afterEach(() => {
    useQueryMock.mockClear()
    meIsAdminData = { isAdmin: false }
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
})
