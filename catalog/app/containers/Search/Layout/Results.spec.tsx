import * as React from 'react'
import { render } from '@testing-library/react'

import Results from './Results'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Switch: ({ children }: React.PropsWithChildren<{}>) => <>{children}</>,
  Route: ({ children }: React.PropsWithChildren<{}>) => <>{children}</>,
}))

jest.mock('@material-ui/core', () => ({
  Button: ({ children }: React.PropsWithChildren<{}>) => <button>{children}</button>,
  Icon: ({ children }: React.PropsWithChildren<{}>) => <span>{children}</span>,
  makeStyles: () => () => ({}),
  useTheme: () => ({
    breakpoints: { down: () => false },
    spacing: (x: number) => x * 8,
  }),
  useMediaQuery: () => false,
}))

jest.mock('@material-ui/icons', () => ({
  GridOn: () => 'table icon',
  List: () => 'list icon',
}))

jest.mock('@material-ui/lab', () => ({
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
    setView: jest.fn(),
    setOrder: jest.fn(),
  },
  firstPageQuery: {
    _tag: 'fetching',
  } as any,
  baseSearchQuery: {
    _tag: 'fetching',
  } as any,
}

jest.mock('../model', () => ({
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

jest.mock('containers/Bucket/PackageDialog/PackageCreationForm', () => ({
  usePackageCreationDialog: () => ({
    open: jest.fn(),
    render: () => <></>, // TODO: throw error if we init dialog and don't render it
  }),
}))

jest.mock('containers/Bucket/Routes', () => ({
  useBucketStrict: () => 'test-bucket',
}))

jest.mock('./ColumnTitle', () => ({ children }: React.PropsWithChildren<{}>) => (
  <div>Column Title: {children}</div>
))

jest.mock('../Sort', () => () => <div>Sort Selector</div>)

jest.mock('utils/NamedRoutes', () => ({
  use: () => ({
    paths: {
      bucketRoot: '/bucket/:bucket',
    },
  }),
}))

describe('containers/Search/Layout/Results', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    model.firstPageQuery = { _tag: 'fetching' }
    model.state.resultType = 'p'
  })

  it('renders with loading state', () => {
    const { container } = render(<Results />)
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

    const { container } = render(<Results />)
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

    const { container } = render(<Results onFilters={jest.fn()} />)
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

    const { container } = render(<Results />)
    expect(container).toMatchSnapshot()
  })

  it('renders error state', () => {
    model.firstPageQuery = {
      _tag: 'error',
      error: new Error('Test error'),
    }

    const { container } = render(<Results />)
    expect(container).toMatchSnapshot()
  })
})
