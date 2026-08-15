import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

vi.mock('constants/config', () => ({ default: {} }))

// Sentinels standing in for the generated query documents, so the mocked
// `useQuery` below can dispatch on query identity -- the same shape
// `Buckets.spec.tsx` uses.
vi.mock('containers/Search/gql/PackageMetaFacets.generated', () => ({
  default: 'META_FACETS',
}))
vi.mock('containers/Search/gql/PackageMetaFacet.generated', () => ({
  default: 'META_FACET',
}))
vi.mock('containers/Search/gql/FirstPagePackages.generated', () => ({
  default: 'FIRST_PAGE_PACKAGES',
}))

interface QueryState {
  data?: unknown
  fetching: boolean
}

let facetsData: unknown
let firstPageData: unknown

const useQueryMock = vi.fn(
  (query: string, _vars: unknown, opts?: { pause?: boolean }) => {
    if (opts?.pause) return { fetching: false } as QueryState
    switch (query) {
      case 'META_FACETS':
        return { data: facetsData, fetching: false }
      case 'META_FACET':
        return {
          data: { searchPackages: { __typename: 'EmptySearchResultSet' } },
          fetching: false,
        }
      case 'FIRST_PAGE_PACKAGES':
        return { data: firstPageData, fetching: false }
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
    return cases.error(new Error('query failed'), result)
  },
}))

// The debounce would otherwise hold every preview back past the assertion.
vi.mock('use-debounce', () => ({ useDebounce: (v: unknown) => [v] }))

import PredicateBuilder from './PredicateBuilder'
import * as Model from './model'

const BUCKETS = ['bucket-one']

const facets = (
  paths: { path: string; __typename: string }[],
  userMetaTruncated = false,
) => ({
  searchPackages: {
    __typename: 'PackagesSearchResultSet',
    stats: {
      userMetaTruncated,
      userMeta: paths.map((p) => ({ ...p, sortable: true })),
    },
  },
})

const resultSet = (total: number, hits: { name: string; bucket: string }[] = []) => ({
  searchPackages: {
    __typename: 'PackagesSearchResultSet',
    total,
    firstPage: {
      __typename: 'PackagesSearchResultSetPage',
      cursor: null,
      hits: hits.map((h, i) => ({ ...h, id: `hit-${i}`, hash: `hash-${i}` })),
    },
  },
})

function Harness({ initial }: { initial?: Partial<Model.PredicateDraft> }) {
  const [draft, setDraft] = React.useState<Model.PredicateDraft>({
    ...Model.EMPTY_DRAFT,
    ...initial,
  })
  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <PredicateBuilder buckets={BUCKETS} value={draft} onChange={setDraft} />
    </M.MuiThemeProvider>
  )
}

describe('DataProduct/PredicateBuilder/model', () => {
  describe('toGQL', () => {
    it('returns null for an untouched draft rather than a match-everything rule', () => {
      expect(Model.toGQL(Model.EMPTY_DRAFT)).toBeNull()
      expect(Model.isEmpty(Model.EMPTY_DRAFT)).toBe(true)
    })

    it('trims patterns and nulls the blank ones', () => {
      const gql = Model.toGQL({
        ...Model.EMPTY_DRAFT,
        packageNamePattern: '  team/*  ',
        entryPathPattern: '   ',
      })
      expect(gql).toEqual({
        packageNamePattern: 'team/*',
        entryPathPattern: null,
        userMetaFilters: null,
      })
    })

    it('whitespace alone does not make a draft non-empty', () => {
      expect(Model.isEmpty({ ...Model.EMPTY_DRAFT, packageNamePattern: '   ' })).toBe(
        true,
      )
    })
  })
})

describe('DataProduct/PredicateBuilder', () => {
  beforeEach(() => {
    facetsData = facets([
      { path: '/genome/build', __typename: 'KeywordPackageUserMetaFacet' },
    ])
    firstPageData = resultSet(0)
  })
  afterEach(cleanup)
  afterEach(() => useQueryMock.mockClear())

  it('offers the metadata fields the search vocabulary exposes', () => {
    const { queryByText } = render(<Harness />)
    expect(queryByText('genome')).toBeTruthy()
  })

  it('says so when the field list is a sample rather than the whole vocabulary', () => {
    facetsData = facets(
      [{ path: '/genome/build', __typename: 'KeywordPackageUserMetaFacet' }],
      true,
    )
    const { queryByText } = render(<Harness />)
    expect(queryByText('Showing a sample of the available fields.')).toBeTruthy()
  })

  it('previews nothing until the draft says something', () => {
    const { queryByText, queryByTestId } = render(<Harness />)
    expect(queryByTestId('predicate-preview--total')).toBeFalsy()
    expect(
      queryByText(
        'Add a pattern or a metadata filter to preview the members it selects.',
      ),
    ).toBeTruthy()
  })

  it('previews the resolved packages once a pattern is entered', () => {
    firstPageData = resultSet(2, [
      { name: 'team/alpha', bucket: 'bucket-one' },
      { name: 'team/beta', bucket: 'bucket-one' },
    ])
    const { getByTestId, queryByText } = render(
      <Harness initial={{ packageNamePattern: 'team/*' }} />,
    )
    expect(getByTestId('predicate-preview--total').textContent).toBe('2')
    expect(queryByText('matching packages')).toBeTruthy()
    expect(queryByText('team/alpha')).toBeTruthy()
  })

  it('does not claim member counts it cannot compute for an entry path pattern', () => {
    firstPageData = resultSet(2)
    const { queryByText } = render(
      <Harness initial={{ packageNamePattern: 'team/*', entryPathPattern: '*.csv' }} />,
    )
    expect(
      queryByText(/this count is packages, so the member count will be lower/),
    ).toBeTruthy()
  })

  it('surfaces a rejected predicate inline instead of crashing', () => {
    firstPageData = {
      searchPackages: {
        __typename: 'InvalidInput',
        errors: [
          { path: 'filter.name', message: 'Bad wildcard', name: 'x', context: null },
        ],
      },
    }
    const { getByTestId } = render(<Harness initial={{ packageNamePattern: '[' }} />)
    expect(getByTestId('predicate-preview--error').textContent).toBe('Bad wildcard')
  })

  it('renders a save-time rejection from the registry inline', () => {
    const { getByTestId } = render(
      <M.MuiThemeProvider theme={style.appTheme}>
        <PredicateBuilder
          buckets={BUCKETS}
          value={Model.EMPTY_DRAFT}
          onChange={() => {}}
          error="manifest and predicate are mutually exclusive"
        />
      </M.MuiThemeProvider>,
    )
    expect(getByTestId('predicate-builder--error').textContent).toBe(
      'manifest and predicate are mutually exclusive',
    )
  })

  it('activating a field adds a filter, and closing it takes the filter away', () => {
    const { queryByText, getByText, container } = render(<Harness />)
    // The tree groups by JSON pointer segment; open `genome` then pick `build`.
    fireEvent.click(getByText('genome'))
    fireEvent.click(getByText('build'))
    expect(queryByText('genome / build')).toBeTruthy()

    const close = container.querySelector('button')
    expect(close).toBeTruthy()
    fireEvent.click(close as HTMLElement)
    expect(queryByText('genome / build')).toBeFalsy()
  })

  it('typing a package name pattern reaches the draft', () => {
    const { getByTestId } = render(<Harness />)
    const input = getByTestId('predicate-package-name') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'team/*' } })
    expect((getByTestId('predicate-package-name') as HTMLInputElement).value).toBe(
      'team/*',
    )
  })
})
