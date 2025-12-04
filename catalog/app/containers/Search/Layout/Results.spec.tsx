import * as React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, beforeEach } from 'vitest'

import Results from './Results'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('@material-ui/core', async () => {
  const actual = await vi.importActual('@material-ui/core')
  return {
    ...actual,
    Button: ({ children }: React.PropsWithChildren<{}>) => <button>{children}</button>,
    Icon: ({ children }: React.PropsWithChildren<{}>) => <span>{children}</span>,
    makeStyles: () => () => ({}),
    useTheme: () => ({
      breakpoints: { down: () => false },
      spacing: (x: number) => x * 8,
    }),
    useMediaQuery: () => false,
  }
})

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
    <ul data-selected={value}>{children}</ul>
  ),
  ToggleButton: ({ children, value }: React.PropsWithChildren<{ value: string }>) => (
    <li data-value={value}>{children}</li>
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

  it('renders with loading state', () => {
    const { container } = render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    )
    expect(container).toMatchSnapshot()
  })

  it('renders with data and shows number of results', () => {
    model.firstPageQuery = {
      _tag: 'data',
      data: {
        __typename: 'PackagesSearchResultSet',
        total: 5,
      },
    }

    const { container } = render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    )
    expect(container).toMatchSnapshot()
  })

  it('renders with FiltersButton when onFilters prop is provided', () => {
    model.firstPageQuery = {
      _tag: 'data',
      data: {
        __typename: 'PackagesSearchResultSet',
        total: 3,
      },
    }

    const { container } = render(
      <MemoryRouter>
        <Results onFilters={vi.fn()} />
      </MemoryRouter>,
    )
    expect(container).toMatchSnapshot()
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

    const { container } = render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    )
    expect(container).toMatchSnapshot()
  })

  it('renders error state', () => {
    model.firstPageQuery = {
      _tag: 'error',
      error: new Error('Test error'),
    }

    const { container } = render(
      <MemoryRouter>
        <Results />
      </MemoryRouter>,
    )
    expect(container).toMatchSnapshot()
  })

  it('shows Create Package button in bucket', () => {
    model.firstPageQuery = {
      _tag: 'data',
      data: {
        __typename: 'PackagesSearchResultSet',
        total: 5,
      },
    }
    const { container } = render(
      <MemoryRouter initialEntries={['/b/test-bucket/packages/my-package']}>
        <Results />
      </MemoryRouter>,
    )
    expect(container).toMatchSnapshot()
  })
})
