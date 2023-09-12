import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'
import * as RR from 'react-router-dom'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
// import * as NamedRoutes from 'utils/NamedRoutes'
// import parseSearch from 'utils/parseSearch'
import * as Types from 'utils/types'
import useMemoEq from 'utils/useMemoEq'

import BASE_SEARCH_QUERY from './gql/BaseSearch.generated'
// import FACET_QUERY from './gql/Facet.generated'
import FIRST_PAGE_QUERY from './gql/FirstPage.generated'
import NEXT_PAGE_QUERY from './gql/NextPage.generated'

function ifChanged<T>(newValue: T) {
  return (oldValue: T) => (R.equals(newValue, oldValue) ? oldValue : newValue)
}

enum ResultType {
  Objects = 'objects',
  Packages = 'packages',
}

interface ResultTypeFacetState {
  value: ResultType | null
}

interface BucketFacetState {
  value: string[]
}

// enum WorkflowMatchingStrictness {
//   WorkflowOnly,
//   WorkflowAndBucket,
//   WorkflowAndBucketAndVersion,
// }
//
// interface WorkflowFacetState {
//   selected: {
//     bucket: string | null
//     configVersion: string | null
//     workflow: string | null
//     strictness: WorkflowMatchingStrictness
//   }
// }

interface NumberFacetState {
  extents: {
    min: number
    max: number
  }
  value: {
    min: number | null
    max: number | null
  }
}

// interface DateFacetState {
//   extents: {
//     min: Date
//     max: Date
//   }
//   value: {
//     min: Date | null
//     max: Date | null
//   }
// }
//
// interface KeywordFacetState {
//   selected: string[]
// }
//
// interface TextFacetState {
//   selected: string
// }

type FacetState =
  | ResultTypeFacetState
  | BucketFacetState
  // | WorkflowFacetState
  | NumberFacetState
// | DateFacetState
// | KeywordFacetState
// | TextFacetState

// enum FacetNamespace {
//   Root = '',
//   Package = 'pkg',
//   PackageMeta = 'pkg_meta',
//   Workflow = 'workflow',
//   S3 = 's3',
//   // S3Tags = 's3_tags',
//   // S3Meta = 's3_meta',
// }
//
// // TODO: express facet taxonomy to match against
// const FacetNamespaces = {
//   general: {
//     type: {
//       _t: 'ResultType',
//     },
//     bucket: {
//       _t: 'Bucket',
//     },
//   },
//   pkg: {
//     name: {
//       _t: 'Text', // keyword?
//     },
//     hash: {
//       _t: 'Text', // keyword?
//     },
//     total_size: {
//       _t: 'Number',
//     },
//     total_entries: {
//       _t: 'Number',
//     },
//     comment: {
//       _t: 'Text',
//     },
//     last_modified: {
//       _t: 'Date',
//     },
//     workflow: {
//       _t: 'Workflow',
//     },
//   },
//   // XXX: other facets
// }

interface FacetDescriptor {
  path: Model.Search.FacetPath
  state: FacetState
}

interface SearchUrlState {
  searchString: string | null
  facets: FacetDescriptor[]
  order: Model.GQLTypes.SearchResultOrder
}
// TODO: methods to update url state

const DEFAULT_ORDER: Model.GQLTypes.SearchResultOrder = {
  field: Model.GQLTypes.SearchResultOrderField.Relevance,
  direction: Model.GQLTypes.SortDirection.DESC,
}

// const SearchResultOrderField = Types.enum(
//   Model.GQLTypes.BucketPermissionLevel,
//   'SearchResultOrderField ',
// )

function parseOrder(input: string | null): Model.GQLTypes.SearchResultOrder {
  if (!input) return DEFAULT_ORDER
  let direction = Model.GQLTypes.SortDirection.ASC
  let field = input
  if (input.startsWith('-')) {
    direction = Model.GQLTypes.SortDirection.DESC
    field = input.slice(1)
  }
  if (!Object.values(Model.GQLTypes.SearchResultOrderField).includes(field as any))
    return DEFAULT_ORDER
  return {
    field: field as Model.GQLTypes.SearchResultOrderField,
    direction,
  }
}

// XXX: we use the simplest ser/de logic here, to be optimized later
// f=path:(type?):state
function parseFacetDescriptor(input: string): FacetDescriptor | null {
  let json: Types.JsonRecord
  try {
    json = JSON.parse(input)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('failed to parse facet descriptor', input)
    return null
  }
  invariant(typeof json === 'object', 'facet descriptor must be an object')
  const { path, state } = json
  invariant(Array.isArray(path), 'facet path must be an array')
  invariant(typeof state === 'object', 'facet state must be an object')
  // TODO: proper parsing and validation with io-ts or effect-ts
  // TODO: traverse facets definitions to get missing data
  return { path, state: state as unknown as FacetState }
}

// function serializeFacetDescriptor(f: FacetDescriptor): string {
//   // for built-in static facets we don't need to save the type
//   return JSON.stringify(f)
// }

// XXX: use io-ts or smth for morphisms between url (querystring) and search state
function parseSearchParams(qs: string): SearchUrlState {
  const params = new URLSearchParams(qs)
  // console.log('params', params)

  const searchString = params.get('q')

  // XXX: support legacy "mode" param (convert to "type")
  const typeInput = params.get('t') || params.get('mode')
  const type = Object.values(ResultType).includes(typeInput as any)
    ? (typeInput as ResultType)
    : null

  const bucketsInput = params.get('b')
  const buckets = bucketsInput ? bucketsInput.split(',').sort() : []

  const extraFacets = params
    .getAll('f')
    .map(parseFacetDescriptor)
    .filter((f): f is FacetDescriptor => !!f)

  const order = parseOrder(params.get('o'))

  const facets = [
    { path: ['type'], state: { value: type } },
    { path: ['bucket'], state: { value: buckets } },
    ...extraFacets,
  ]

  return { searchString, facets, order }
}

// // XXX: return string?
// function serializeSearchUrlState(state: SearchUrlState): URLSearchParams {
//   return new URLSearchParams()
// }

function useUrlState(): SearchUrlState {
  const l = RR.useLocation()
  return React.useMemo(() => parseSearchParams(l.search), [l.search])
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

type BoundedSearch = Extract<
  GQL.DataForDoc<typeof FIRST_PAGE_QUERY>['search'],
  { __typename: 'BoundedSearch' }
>

export type SearchHit = BoundedSearch['results']['firstPage']['hits'][number]

export function searchHitId(hit: SearchHit): string {
  const id =
    hit.__typename === 'SearchHitObject' ? [hit.key, hit.version] : [hit.name, hit.hash]
  return [hit.__typename, hit.bucket, ...id].join('/')
}

function useFirstPageQuery(
  { searchString, order }: SearchUrlState,
  filter: Model.Search.FilterExpression | null,
) {
  return GQL.useQuery(FIRST_PAGE_QUERY, { searchString, filter, order })
}

export function useNextPageQuery(after: string) {
  return GQL.useQuery(NEXT_PAGE_QUERY, { after })
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
  const firstPageQuery = useFirstPageQuery(urlState, baseFilter)
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
        order: urlState.order,
        activeFacets,
        availableFacets,
      },
      actions: {
        activateFacet,
      },
      baseSearchQuery,
      firstPageQuery,
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
