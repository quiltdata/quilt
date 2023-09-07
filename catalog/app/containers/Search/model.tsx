import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'
import * as RR from 'react-router-dom'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
// import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import useMemoEq from 'utils/useMemoEq'

import BASE_SEARCH_QUERY from './gql/BaseSearch.generated'
// import FACET_QUERY from './gql/Facet.generated'
import FIRST_PAGE_QUERY from './gql/FirstPage.generated'
// import NEXT_PAGE_QUERY from './gql/NextPage.generated'

function ifChanged<T>(newValue: T) {
  return (oldValue: T) => (R.equals(newValue, oldValue) ? oldValue : newValue)
}

enum ResultType {
  Objects = 'objects',
  Packages = 'packages',
  Any = 'any',
}

interface ResultTypeFacetState {
  selected: ResultType
}

interface BucketFacetState {
  selected: string[]
}

enum WorkflowMatchingStrictness {
  WorkflowOnly,
  WorkflowAndBucket,
  WorkflowAndBucketAndVersion,
}

interface WorkflowFacetState {
  selected: {
    bucket: string | null
    configVersion: string | null
    workflow: string | null
    strictness: WorkflowMatchingStrictness
  }
}

interface NumberFacetState {
  extents: {
    min: number | null
    max: number | null
  }
  selected: {
    min: number | null
    max: number | null
  }
}

interface DateFacetState {
  extents: {
    min: Date | null
    max: Date | null
  }
  selected: {
    min: Date | null
    max: Date | null
  }
}

interface KeywordFacetState {
  selected: string[]
}

interface TextFacetState {
  selected: string
}

type FacetState =
  | ResultTypeFacetState
  | BucketFacetState
  | WorkflowFacetState
  | NumberFacetState
  | DateFacetState
  | KeywordFacetState
  | TextFacetState

interface SearchUrlState {
  searchString: string
  facets: { path: Model.Search.FacetPath; state: FacetState }[]
  pages: number // extra result pages to load and display
  order: Model.GQLTypes.SearchResultOrder
  // retry?: number
}
// TODO: methods to update url state

// XXX: use io-ts or smth for morphisms between url (querystring) and search state
function parseSearchParams(params: Record<string, string | undefined>): SearchUrlState {
  // TODO

  // XXX: support legacy "mode" param (convert to "type")
  // const type = parseSearchType(params.type)
  // const buckets = React.useMemo(
  //   () => (params.buckets ? params.buckets.split(',').sort() : []),
  //   [params.buckets],
  // )
  // const query = params.query || ''
  // const page = params.p ? parseInt(params.p, 10) : 1
  // const retry = (params.retry && parseInt(params.retry, 10)) || undefined
  // return React.useMemo(
  //   () => ({ type, buckets, query, page, retry }),
  //   [type, buckets, query, page, retry],
  // )

  return {
    searchString: params.q || '',
    facets: [],
    pages: 0,
    order: {
      field: Model.GQLTypes.SearchResultOrderField.Relevance,
      direction: Model.GQLTypes.SortDirection.DESC,
    },
  }
}

// function serializeSearchParams(state: SearchUrlState): Record<string, string> {
//   return {}
// }

function useUrlState(): SearchUrlState {
  const l = RR.useLocation()
  return React.useMemo(() => parseSearchParams(parseSearch(l.search, true)), [l.search])
}

// function useMakeUrl() {
//   const { urls } = NamedRoutes.use()
//   return React.useCallback(
//     (state: SearchUrlState) =>
//       urls.search({
//         q: state.query,
//         buckets: state.buckets.join(',') || undefined,
//         type: state.type,
//         retry: state.retry,
//         p: state.page === 1 ? undefined : state.page,
//       }),
//     [urls],
//   )
// }

type FacetPath = Model.Search.FacetPath

export { FacetPath }

export interface ActiveFacet {
  path: Model.Search.FacetPath
  name: string
  type: $TSFixMe
  state: $TSFixMe
  // state: FacetState
  // query parameters to get extents?
  // filter exp? -- compute?
}

function useActiveFacets({ facets }: SearchUrlState): ActiveFacet[] {
  return useMemoEq(
    facets,
    R.map(({ path, state }) => {
      const type = 'tbd' // TODO: compute from path and state
      const name = 'tbd'
      return { path, type, state, name }
    }),
  )
}

function computeFilterExpression(
  activeFacets: ActiveFacet[],
): Model.Search.FilterExpression | null {
  return activeFacets.reduce((filter: Model.Search.FilterExpression | null, facet) => {
    // TODO: compute filter expression from active facets
    // eslint-disable-next-line no-console
    console.log('facet', facet)
    return filter
  }, null)
}

function useFilterExpression(
  activeFacets: ActiveFacet[],
): Model.Search.FilterExpression | null {
  return useMemoEq(activeFacets, computeFilterExpression)
}

function useBaseSearchQuery(
  { searchString }: SearchUrlState,
  filter: Model.Search.FilterExpression | null,
) {
  return GQL.useQuery(BASE_SEARCH_QUERY, { searchString, filter })
}

export interface AvailableFacet {
  path: Model.Search.FacetPath
  name: string
  type: $TSFixMe
}

// XXX: async?
function useAvailableFacets(searchQueryResult: ReturnType<typeof useBaseSearchQuery>) {
  const [facets, setFacets] = React.useState<AvailableFacet[]>([])
  const [fetching, setFetching] = React.useState<boolean>(false)

  // XXX: we can assume some facets exist regardless of search params / results
  React.useEffect(() => {
    GQL.fold(searchQueryResult, {
      data: ({ search: r }) => {
        switch (r.__typename) {
          case 'BoundedSearch':
            // TODO: compute
            const newFacets = r.facets.map((f) => ({
              path: f.path,
              name: f.name,
              type: f.type,
            }))
            setFacets(ifChanged(newFacets))
            setFetching(false)
            return
          default:
            return
        }
      },
      fetching: () => {
        setFetching(true)
      },
      error: () => {
        // error to be handled elsewhere
        setFacets(ifChanged<AvailableFacet[]>([]))
        setFetching(false)
      },
    })
  }, [searchQueryResult])

  return useMemoEq({ facets, fetching }, R.identity)
}

function useSearchUIModel() {
  const urlState = useUrlState()
  const activeFacets = useActiveFacets(urlState)
  const baseFilter = useFilterExpression(activeFacets)
  const baseSearchQuery = useBaseSearchQuery(urlState, baseFilter)
  const availableFacets = useAvailableFacets(baseSearchQuery)

  // TODO: actions
  // const setSearchString = React.useCallback(
  //   (searchString: string) => {
  //     // change url -> trigger state recompute
  //   },
  //   [],
  // )

  const activateFacet = React.useCallback((path: FacetPath) => {
    // eslint-disable-next-line no-console
    console.log('activateFacet', path)
  }, [])

  // const deactivateFacet = React.useCallback(
  //   (facet: any) => {
  //   },
  //   [],
  // )
  //
  // const adjustFacetFilter = React.useCallback(
  //   (facet: any, adjustment: any) => {
  //   },
  //   [],
  // )
  //
  // const loadMore = React.useCallback(
  //   () => {
  //   },
  //   [],
  // )

  return useMemoEq(
    {
      state: {
        searchString: urlState.searchString,
        filter: baseFilter,
        pages: urlState.pages,
        order: urlState.order,
        activeFacets,
        availableFacets,
      },
      actions: {
        activateFacet,
      },
      baseSearchQuery,
    },
    R.identity,
  )
}

export type SearchUIModel = ReturnType<typeof useSearchUIModel>

const Context = React.createContext<SearchUIModel | null>(null)

export function SearchUIModelProvider({ children }: React.PropsWithChildren<{}>) {
  const state = useSearchUIModel()
  return <Context.Provider value={state}>{children}</Context.Provider>
}

export function useSearchUIModelContext(): SearchUIModel {
  const model = React.useContext(Context)
  invariant(model, 'SearchUIModel accessed outside of provider')
  return model
}

export { SearchUIModelProvider as Provider, useSearchUIModelContext as use }

// XXX: pre-fetch first page along with the base search
export function useFirstPage() {
  const model = useSearchUIModelContext()
  const { searchString, filter, order } = model.state
  const query = GQL.useQuery(FIRST_PAGE_QUERY, { searchString, filter, order })
  return { query }
}

export function useNextPage() {
  // TODO
}

export function useResultsPage(
  { searchString }: SearchUrlState,
  filter: Model.Search.FilterExpression | null,
) {
  return GQL.useQuery(BASE_SEARCH_QUERY, { searchString, filter })
}
