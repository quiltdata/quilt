import * as React from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
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

// Named `bucket-N` with a title of `Bucket N`, matching the default below, so a
// test that only cares about *how many* buckets exist can say so in one line.
const bucket = (name: string): MockBucket => ({
  name,
  title: name.replace(
    /(^|-)([a-z])/g,
    (_m, sep, c) => (sep ? ' ' : '') + c.toUpperCase(),
  ),
  description: null,
  tags: null,
  relevanceScore: 1,
})

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
vi.mock('containers/Home/BucketGrid/BucketList', () => ({
  default: (props: RowsProps) => <Rows {...props} />,
}))

// Distinguishable from the card view's stand-in so a test can tell which
// renderer the `view` param selected.
vi.mock('containers/Home/BucketGrid/BucketRows', () => ({
  default: ({ buckets }: RowsProps) => (
    <div>
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

  // This page is what `/` renders whenever the `front-door` flag is off, so it
  // is the catalog's landing page for most stacks -- and it had no `h1` at all.
  // Two things went wrong at once when the old `Explore your buckets` heading
  // was dropped in the shell re-home: a page with no top-level heading is a
  // WCAG 1.3.1 / 2.4.6 failure for anyone navigating by heading, and the
  // end-to-end canaries used that heading as their "login landed" signal
  // (quiltdata/e2e `shared/auth.ts`, `waitForHomePage`), so all four went red
  // on deploy. Nothing in this spec asserted a heading, which is why neither
  // was caught here.
  it('gives the page a top-level heading, as an h1 sized to the ramp', () => {
    const { getByRole } = renderBuckets()

    const heading = getByRole('heading', { level: 1, name: 'Volumes' })
    expect(heading).toBeTruthy()
    // Semantically the page's h1; visually an h5. DESIGN.md's No-Display-Font
    // Rule caps the app at Headline, so this must not come back as the old
    // `variant="h1"` display size.
    expect(heading.classList.contains('MuiTypography-h5')).toBe(true)
  })

  // A `data-testid` rather than the heading text, because the text is a product
  // decision that has already moved twice ("Explore your buckets" -> nothing,
  // "Volumes" <-> "Buckets"), while the canary only needs to know the landing
  // page rendered. FrontDoor.tsx carries the same hook, so `waitForHomePage`
  // works whichever side of the `front-door` flag a stack is on.
  it('marks the heading as the landing-page anchor the canaries wait on', () => {
    const { getByTestId } = renderBuckets()

    const anchor = getByTestId('landing-heading')
    expect(anchor.tagName).toBe('H1')
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

  // The no-match state used to be one line with nothing on it: the only way out
  // was noticing the small clear button up in the filter field, so the more terms
  // someone stacked the more stuck they were. These pin the recovery.
  describe('when the filter matches nothing', () => {
    it('reports how many volumes it actually searched', () => {
      mockBuckets = [bucket('bucket-one'), bucket('bucket-two'), bucket('bucket-three')]
      const { queryByText } = renderBuckets('?q=nomatchxyz')
      // The exact count, not "no volumes" -- the filter ran against 3.
      expect(
        queryByText(
          'Searched all 3 volumes you can reach, across title, name, description, and tags.',
        ),
      ).toBeTruthy()
    })

    it('offers to drop each term when more than one narrowed it', () => {
      const { queryByText } = renderBuckets('?q=alpha+beta')
      expect(queryByText('Without "alpha"')).toBeTruthy()
      expect(queryByText('Without "beta"')).toBeTruthy()
    })

    it('quotes terms back in the casing they were typed', () => {
      // `terms` is lowercased for matching; showing that back would rewrite the
      // reader's own input at them.
      const { queryByText } = renderBuckets('?q=Genomics+RNA')
      expect(queryByText('Without "Genomics"')).toBeTruthy()
      expect(queryByText('Without "alpha"')).toBeFalsy()
    })

    // `set` updates local input state; the URL push happens in an effect gated on
    // the field's 500ms debounce, so these assertions have to wait for it rather
    // than read the location synchronously after the click.
    it('drops one term and keeps the rest, preserving their casing', async () => {
      const { getByText, getByTestId } = renderBuckets('?q=Genomics+RNA')
      fireEvent.click(getByText('Without "Genomics"'))
      await waitFor(() => expect(getByTestId('search').textContent).toBe('?q=RNA'))
    })

    it('offers no per-term drops for a single term, where it would duplicate Clear', () => {
      const { queryByText } = renderBuckets('?q=onlyterm')
      expect(queryByText('Without "onlyterm"')).toBeFalsy()
      expect(queryByText('Clear filter')).toBeTruthy()
    })

    it('clears the whole filter, dropping `q` from the URL', async () => {
      const { getByText, getByTestId } = renderBuckets('?q=alpha+beta')
      fireEvent.click(getByText('Clear filter'))
      await waitFor(() => expect(getByTestId('search').textContent).toBe(''))
    })

    // Clearing empties the field on the click, not a tick later.
    //
    // `set` is a `useState` setter, so a bare `set()` stores `undefined`, handing
    // the TextField `value={undefined}` — and an input React has stopped
    // controlling keeps whatever text is already in it. The field goes stale: it
    // still reads "alpha beta" while the filter is being cleared underneath it.
    //
    // The staleness is transient — `useDebouncedInput`'s `usePrevious(init, …)`
    // re-syncs from the URL and repairs the value a tick later — which is exactly
    // why this asserts *synchronously* after the click. Measured on a probe
    // mirroring this component: bare `set()` reads "alpha beta" immediately after
    // the click and "" after the round-trip, while `set('')` reads "" at both
    // points. An assertion placed after `waitFor` cannot tell them apart.
    //
    // Not asserted via React's "controlled input to be uncontrolled" warning:
    // `didWarnControlledToUncontrolled` (react-dom.development.js) is a
    // module-scoped one-shot, so the first test to trip it consumes it and every
    // later one passes regardless. Mutation testing caught both dead ends.
    it('empties the filter field on the click, not a tick later', async () => {
      const { getByText, getByPlaceholderText, getByTestId } =
        renderBuckets('?q=alpha+beta')
      const field = getByPlaceholderText('Filter volumes') as HTMLInputElement
      expect(field.value).toBe('alpha beta')

      fireEvent.click(getByText('Clear filter'))

      // Synchronous: the window where a bare `set()` leaves the box stale.
      expect(field.value).toBe('')
      await waitFor(() => expect(getByTestId('search').textContent).toBe(''))
    })
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
