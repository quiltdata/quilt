import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import noop from 'utils/noop'

import Results from './Results'

vi.mock('constants/config', () => ({ default: {} }))

// Mutable so the xs-viewport branch (which drops the button's visible label) can
// be exercised; jsdom has no matchMedia, so MUI's own hook would report false.
const { media } = vi.hoisted(() => ({ media: { narrow: false } }))

// These stubs FORWARD aria-label rather than supplying one. An earlier version
// hardcoded `aria-label="toggle results view"` on the group, which made the
// name assertions below unfalsifiable -- they passed whatever the real component
// did (it set no label at all).
vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  Button: ({ children, ...props }: React.PropsWithChildren<{}>) => (
    <button {...props}>{children}</button>
  ),
  Icon: ({ children }: React.PropsWithChildren<{}>) => <span>{children}</span>,
  useTheme: () => ({
    breakpoints: { down: () => false },
    spacing: (x: number) => x * 8,
  }),
  useMediaQuery: () => media.narrow,
}))

vi.mock('@material-ui/icons', () => ({
  GridOn: () => 'table icon',
  List: () => 'list icon',
}))

vi.mock('@material-ui/lab', () => ({
  Skeleton: () => <div>Loading…</div>,
  ToggleButtonGroup: ({
    value,
    children,
    ...props
  }: React.PropsWithChildren<{ value: string }>) => (
    <div role="group" data-selected={value} {...props}>
      {children}
    </div>
  ),
  ToggleButton: ({
    children,
    value,
    ...props
  }: React.PropsWithChildren<{ value: string }>) => (
    <button role="button" data-value={value} {...props}>
      {children}
    </button>
  ),
}))

const model = {
  state: {
    resultType: 'p', // QuiltPackage
    view: 'l', // List
    searchString: 'test',
    buckets: ['test-bucket'],
    ordering: null,
    filter: {
      predicates: {},
      order: [],
    },
    userMetaFilters: {
      filters: new Map(),
    },
    latestOnly: true,
  },
  actions: {
    setView: vi.fn(),
    setOrdering: vi.fn(),
  },
  firstPageQuery: {
    _tag: 'fetching',
  } as any,
  baseSearchQuery: {
    _tag: 'fetching',
  } as any,
}

vi.mock('../model', () => ({
  use: () => model,
  ResultType: {
    QuiltPackage: 'p',
    S3Object: 'o',
  },
  View: {
    Table: 't',
    List: 'l',
  },
}))

vi.mock('containers/Bucket/PackageDialog', () => ({
  Provider: ({ children }: React.PropsWithChildren<{}>) => <>{children}</>,
  useCreateDialog: () => ({
    open: vi.fn(),
    render: () => <>Don't forget to render dialog</>,
  }),
}))

vi.mock('containers/Bucket/Routes', () => ({
  useBucketStrict: () => 'test-bucket',
}))

vi.mock('./ColumnTitle', () => ({
  default: ({ children }: React.PropsWithChildren<{}>) => (
    <div>Column Title: {children}</div>
  ),
}))

vi.mock('../Sort', () => ({
  default: () => <div>Sort Selector</div>,
}))

vi.mock('utils/NamedRoutes', () => ({
  use: () => ({
    paths: {
      bucketRoot: '/b/:bucket',
    },
  }),
}))

describe('containers/Search/Layout/Results', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    model.firstPageQuery = { _tag: 'fetching' }
    model.state.resultType = 'p'
  })

  afterEach(() => {
    cleanup()
    media.narrow = false
  })

  // Both toggles are icon-only, and MUI's SvgIcon is aria-hidden, so without
  // explicit labels each one computes an empty accessible name -- and the pair
  // has nothing saying what it is for.
  it('names the view toggles and the group they belong to', () => {
    model.firstPageQuery = {
      _tag: 'data',
      data: { __typename: 'PackagesSearchResultSet', total: 5 },
    }
    const { getByRole } = render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    )
    const group = getByRole('group', { name: 'Results view' })
    expect(group).toBeTruthy()
    expect(getByRole('button', { name: 'Table view' })).toBeTruthy()
    expect(getByRole('button', { name: 'List view' })).toBeTruthy()
  })

  // At xs the create button drops its visible label to save width, which leaves
  // an aria-hidden glyph and therefore no name at all.
  it('keeps the create-package button named when its label is dropped at xs', () => {
    media.narrow = true
    model.firstPageQuery = {
      _tag: 'data',
      data: { __typename: 'PackagesSearchResultSet', total: 5 },
    }
    const { getByRole, queryByText } = render(
      <MemoryRouter initialEntries={['/b/test-bucket/packages/my-package']}>
        <Results />
      </MemoryRouter>,
    )
    // Visible text is gone at this width...
    expect(queryByText('Create new package')).toBeFalsy()
    // ...but the control is still named.
    expect(getByRole('button', { name: 'Create new package' })).toBeTruthy()
  })

  it('renders with loading state', () => {
    const { getByText } = render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    )
    expect(getByText('Loading…')).toBeTruthy()
  })

  it('renders with data and shows number of packages', () => {
    model.firstPageQuery = {
      _tag: 'data',
      data: {
        __typename: 'PackagesSearchResultSet',
        total: 5,
      },
    }

    const { getByText } = render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    )
    expect(getByText('Column Title: 5 packages')).toBeTruthy()
  })

  it('renders with FiltersButton when onFilters prop is provided', () => {
    model.firstPageQuery = {
      _tag: 'data',
      data: {
        __typename: 'PackagesSearchResultSet',
        total: 3,
      },
    }

    const { getByText } = render(
      <MemoryRouter>
        <Results onFilters={noop} />
      </MemoryRouter>,
    )
    expect(getByText('Filters')).toBeTruthy()
  })

  it('shows number of objects and no ToggleResultsView for S3Object result type', () => {
    model.state.resultType = 'o' // S3Object
    model.firstPageQuery = {
      _tag: 'data',
      data: {
        __typename: 'ObjectsSearchResultSet',
        total: 5,
      },
    }

    const { queryByRole, getByText } = render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    )
    expect(getByText('Column Title: 5 objects')).toBeTruthy()
    expect(queryByRole('group', { name: 'Results view' })).toBeFalsy()
  })

  it('renders error state', () => {
    model.firstPageQuery = {
      _tag: 'error',
      error: new Error('Test error'),
    }

    const { getByText, getByRole } = render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    )
    // The component still renders with basic structure
    expect(getByText('Column Title:')).toBeTruthy()
    expect(getByText('Sort Selector')).toBeTruthy()
    // Toggle view should still be present for error state (PackageSearchResultSet)
    expect(getByRole('group', { name: 'Results view' })).toBeTruthy()
  })

  it('shows Create Package button in bucket', () => {
    model.firstPageQuery = {
      _tag: 'data',
      data: {
        __typename: 'PackagesSearchResultSet',
        total: 5,
      },
    }
    const { getByText } = render(
      <MemoryRouter initialEntries={['/b/test-bucket/packages/my-package']}>
        <Results />
      </MemoryRouter>,
    )
    expect(getByText('Create new package')).toBeTruthy()
  })
})
