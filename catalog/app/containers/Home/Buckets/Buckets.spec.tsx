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
// test that only cares about *how many* volumes exist can say so in one line.
// `mkBucket`, not `bucket`: the ordering test below binds `bucket` as a local.
const mkBucket = (name: string): MockBucket => ({
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

// One list of volumes, buckets and products interleaved. The stand-ins echo
// entries *in order*, so a test can assert interleaving rather than only
// membership — the previous shape took two arrays and could not tell the
// difference between "merged" and "products appended".
interface RowsProps {
  entries: ReadonlyArray<
    | { kind: 'bucket'; bucket: { name: string } }
    | { kind: 'product'; product: { id: string } }
  >
}

// Two label vocabularies, kept as the existing tests already spelled them: the
// card view says `bucket:<name>` / `dp:<id>`, the row view `row:<name>` /
// `row-dp:<id>`. Not unified behind one prefix — the point of the difference is
// that a test can tell which renderer the `view` param selected.
type Entry = RowsProps['entries'][number]

const cardLabel = (e: Entry) =>
  e.kind === 'bucket' ? `bucket:${e.bucket.name}` : `dp:${e.product.id}`

const rowLabel = (e: Entry) =>
  e.kind === 'bucket' ? `row:${e.bucket.name}` : `row-dp:${e.product.id}`

// Each entry carries a testid so an order assertion can select the entries
// themselves. Querying `div` would also match the wrapper, whose textContent is
// every child concatenated — it looks like a first entry and silently ruins any
// index-based check.
const Rows = ({ entries }: RowsProps) => (
  <div>
    {entries.map((e) => (
      <div key={cardLabel(e)} data-testid="entry">
        {cardLabel(e)}
      </div>
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
  default: ({ entries }: RowsProps) => (
    <div>
      {entries.map((e) => (
        <div key={rowLabel(e)} data-testid="entry">
          {rowLabel(e)}
        </div>
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

    it('interleaves them by sort rather than appending them after buckets', () => {
      // The point of one list. Sorted A–Z, `acme_cohort_2024` precedes
      // `Bucket One` and `Clinical Cohort 2024` follows it — so a product sits
      // on either side of a bucket. Appending products after buckets (the
      // previous shape) would put both after it, which is two lists wearing one
      // heading.
      dataProductsEnabled = true
      const { getAllByTestId } = renderBuckets('?sort=name-asc')
      const rendered = getAllByTestId('entry').map((d) => d.textContent ?? '')

      const acme = rendered.indexOf(
        'dp:uc:aws-prod-metastore/quilt_demo/acme_cohort_2024',
      )
      const bucket = rendered.indexOf('bucket:bucket-one')
      const clinical = rendered.indexOf('dp:datazone:dzd_4xample/lst_9kq2v')

      expect(acme).toBeGreaterThanOrEqual(0)
      expect(bucket).toBeGreaterThan(acme)
      expect(clinical).toBeGreaterThan(bucket)
    })

    it('ranks a product against buckets under relevance sort', () => {
      // Relevance is the default, and a product has no score of its own. It must
      // still take a position in the one ordering rather than being parked at the
      // end: `bucket-one` has relevanceScore 1, products default to 0, so the
      // bucket leads and products follow *by rank*, not by kind.
      dataProductsEnabled = true
      const { getAllByTestId } = renderBuckets()
      const rendered = getAllByTestId('entry').map((d) => d.textContent ?? '')
      expect(rendered[0]).toBe('bucket:bucket-one')
      expect(rendered.length).toBeGreaterThan(1)
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

  // The teaching state used to tell admins to add a volume while the button that
  // does it sat in a controls row *below* the grid — the two halves of one
  // instruction, separated by the empty space they described.
  it('puts the add path inside the teaching state for admins', () => {
    mockBuckets = []
    meIsAdminData = { isAdmin: true }
    const { queryByText, getAllByText } = renderBuckets()

    expect(queryByText('No volumes yet')).toBeTruthy()
    expect(
      queryByText(
        'Connect an S3 bucket and its packages become searchable and browsable here.',
      ),
    ).toBeTruthy()
    // Exactly one: the row below withholds its copy at zero volumes, so the same
    // instruction never appears twice on one screen.
    expect(getAllByText('Add Bucket')).toHaveLength(1)
  })

  it('keeps one add path once volumes exist', () => {
    meIsAdminData = { isAdmin: true }
    const { getAllByText, queryByText } = renderBuckets()

    expect(queryByText('No volumes yet')).toBeFalsy()
    expect(getAllByText('Add Bucket')).toHaveLength(1)
  })

  // Bucket-specific copy is safe despite a volume also being able to be a data
  // product: `isEmpty` is zero buckets *and* zero products, so a products-only
  // catalog never reaches this state. This pins that — with products present the
  // teaching state stays away entirely.
  it('stays away when products are the only content', () => {
    mockBuckets = []
    dataProductsEnabled = true
    meIsAdminData = { isAdmin: true }
    const { queryByText } = renderBuckets()

    expect(queryByText('No volumes yet')).toBeFalsy()
  })

  // The no-match state used to be one line with nothing on it: the only way out
  // was noticing the small clear button up in the filter field, so the more terms
  // someone stacked the more stuck they were. These pin the recovery.
  describe('when the filter matches nothing', () => {
    it('reports how many volumes it actually searched', () => {
      mockBuckets = [
        mkBucket('bucket-one'),
        mkBucket('bucket-two'),
        mkBucket('bucket-three'),
      ]
      const { queryByText } = renderBuckets('?q=nomatchxyz')
      expect(
        queryByText(
          'Searched all 3 volumes you can reach, across name, description, and tags.',
        ),
      ).toBeTruthy()
    })

    // The count is entries, not buckets: on this branch a data product is a
    // volume everywhere else on the screen, so it has to be one here too.
    it('counts data products among the volumes it searched', () => {
      mockBuckets = [mkBucket('bucket-one')]
      dataProductsEnabled = true
      const { queryByText } = renderBuckets('?q=nomatchxyz')
      // 1 bucket + the 7 fixture products.
      expect(
        queryByText(
          'Searched all 8 volumes you can reach, across name, description, and tags.',
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
      expect(queryByText('Without "genomics"')).toBeFalsy()
    })

    // `set` updates local input state; the URL push happens in an effect gated on
    // the field's 500ms debounce, so this waits for it rather than reading the
    // location synchronously after the click.
    it('drops one term and keeps the rest, preserving their casing', async () => {
      const { getByText, getByTestId } = renderBuckets('?q=Genomics+RNA')
      fireEvent.click(getByText('Without "Genomics"'))
      await waitFor(() => expect(getByTestId('search').textContent).toBe('?q=RNA'))
    })

    // Greptile P1: two drops inside the 500ms debounce window both rebuild from
    // the URL-derived terms, so the second overwrites the first.
    it('applies two drops in a row without resurrecting the first term', async () => {
      const { getByText, getByTestId } = renderBuckets('?q=alpha+beta+gamma')

      fireEvent.click(getByText('Without "alpha"'))
      fireEvent.click(getByText('Without "beta"'))

      await waitFor(() => expect(getByTestId('search').textContent).toBe('?q=gamma'))
    })

    it('offers no per-term drops for a single term, where it would duplicate Clear', () => {
      const { queryByText } = renderBuckets('?q=onlyterm')
      expect(queryByText('Without "onlyterm"')).toBeFalsy()
      expect(queryByText('Clear filter')).toBeTruthy()
    })

    // Clearing empties the field on the click, not a tick later. A bare
    // `filtering.set()` stores `undefined`, which hands the TextField
    // `value={undefined}` — React stops controlling it and the box keeps the text
    // already in it, so the filter looks applied while it is being cleared. The
    // staleness is transient (`usePrevious(init, …)` repairs it from the URL a
    // tick later), which is exactly why this asserts synchronously: an assertion
    // after `waitFor` cannot tell the two variants apart.
    it('empties the filter field on the click, not a tick later', async () => {
      const { getByText, getByPlaceholderText, getByTestId } =
        renderBuckets('?q=alpha+beta')
      const field = getByPlaceholderText('Filter volumes') as HTMLInputElement
      expect(field.value).toBe('alpha beta')

      fireEvent.click(getByText('Clear filter'))

      expect(field.value).toBe('')
      await waitFor(() => expect(getByTestId('search').textContent).toBe(''))
    })
  })

  // Non-admins cannot connect anything, so the honest next step is who can —
  // plus the docs, for what a volume is before they go asking.
  it('points non-admins at the person who can, not a closed door', () => {
    mockBuckets = []
    const { queryByText } = renderBuckets()

    expect(queryByText('No volumes yet')).toBeTruthy()
    expect(
      queryByText(
        'Your workspace admin connects these. Ask them which bucket holds the data you need.',
      ),
    ).toBeTruthy()
    expect(queryByText('Add Bucket')).toBeFalsy()

    const help = queryByText('What is a volume?')
    expect(help).toBeTruthy()
    // A path the app already references, opened safely.
    expect(help!.closest('a')!.getAttribute('href')).toBe(
      'https://docs.quilt.bio/quilt-platform-administrator/technical-reference',
    )
    expect(help!.closest('a')!.getAttribute('rel')).toContain('noopener')
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
