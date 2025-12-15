import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import noop from 'utils/noop'

import Results from './Results'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  Button: ({ children }: React.PropsWithChildren<{}>) => <button>{children}</button>,
  Icon: ({ children }: React.PropsWithChildren<{}>) => <span>{children}</span>,
  useTheme: () => ({
    breakpoints: { down: () => false },
    spacing: (x: number) => x * 8,
  }),
  useMediaQuery: () => false,
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
  }: React.PropsWithChildren<{ value: string }>) => (
    <div role="group" aria-label="toggle results view" data-selected={value}>
      {children}
    </div>
  ),
  ToggleButton: ({ children, value }: React.PropsWithChildren<{ value: string }>) => (
    <button role="button" data-value={value}>
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
    order: 'BEST_MATCH',
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
    setOrder: vi.fn(),
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

  afterEach(cleanup)

  it('renders with loading state', () => {
    const { getByText } = render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    )
    expect(getByText('Loading…')).toBeTruthy()
  })

  it('renders with data and shows number of results', () => {
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
    expect(getByText('Column Title: 5 results')).toBeTruthy()
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

  it('does not show ToggleResultsView for S3Object result type', () => {
    model.state.resultType = 'o' // S3Object
    model.firstPageQuery = {
      _tag: 'data',
      data: {
        __typename: 'ObjectsSearchResultSet',
        total: 5,
      },
    }

    const { queryByRole } = render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    )
    expect(queryByRole('group', { name: 'toggle results view' })).toBeFalsy()
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
    expect(getByRole('group', { name: 'toggle results view' })).toBeTruthy()
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
