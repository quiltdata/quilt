import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'
import * as RR from 'react-router-dom'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
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

interface FacetType<Tag extends string, Value, Extents> {
  _tag: Tag
  value: Value
  extents: Extents
}

function FacetValue<Value>(value: Value) {
  return value
}

function FacetExtents<Extents>(extents: Extents) {
  return extents
}

// prettier-ignore
const EmptyExtents = (FacetExtents<null>)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ignore(..._args: any[]) {}

// eslint-disable-next-line @typescript-eslint/no-redeclare
function FacetType<Tag extends string, Value, Extents>(
  _tag: Tag,
  value: typeof FacetValue<Value>,
  extents: typeof FacetExtents<Extents>,
) {
  ignore(value, extents)
  return { _tag } as FacetType<Tag, Value, Extents>
}

// facet type needs:
// - type tag
// - value type
// - extents
// - predicates?

export const FacetTypes = {
  ResultType: FacetType(
    'ResultType' as const,
    FacetValue<ResultType | null>,
    EmptyExtents,
  ),
  Bucket: FacetType('Bucket' as const, FacetValue<string[]>, EmptyExtents),
  Number: FacetType(
    'Number' as const,
    FacetValue<{ min: number | null; max: number | null }>,
    FacetExtents<{ min: number; max: number }>,
  ),
  // Date: FacetType(
  //   'Date' as const,
  //   FacetValue<{ min: Date | null; max: Date | null }>,
  //   FacetExtents<{ min: Date; max: Date }>,
  // ),
  // Keyword: FacetType(
  //   'Keyword' as const,
  //   FacetValue<string[]>,
  //   EmptyExtents,
  // ),
  // Text: FacetType(
  //   'Text' as const,
  //   FacetValue<string[]>,
  //   EmptyExtents,
  // ),
}

export type KnownFacetType = (typeof FacetTypes)[keyof typeof FacetTypes]

interface FacetValueState<Value> {
  value: Value
}

type FacetExtentsState<Extents> = Extents extends null ? {} : { extents: Extents }

export type StateForFacetType<T extends KnownFacetType> = T extends FacetType<
  any,
  infer Value,
  infer Extents
>
  ? FacetValueState<Value> & FacetExtentsState<Extents>
  : never

interface FacetDescriptor<P extends FacetPath, T extends FacetType<any, any, any>> {
  path: P
  type: T
  state: StateForFacetType<T>
}

interface FacetMatcher<P extends FacetPath, T extends FacetType<any, any, any>> {
  path: P
  type: T
  match: (p: any) => p is P
  cast: ({ path, state }: any) => FacetDescriptor<P, T>
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
function FacetMatcher<P extends FacetPath, T extends FacetType<any, any, any>>(
  path: P,
  type: T,
): FacetMatcher<P, T> {
  const match = (p: any): p is P => R.equals(path, p)
  const cast = ({ path: p, state }: any) =>
    ({
      path: p,
      type,
      state,
    }) as FacetDescriptor<P, T>
  return { path, type, match, cast } as const
}

export const KNOWN_FACETS = [
  FacetMatcher(['type'] as const, FacetTypes.ResultType),
  FacetMatcher(['bucket'] as const, FacetTypes.Bucket),
  FacetMatcher(['pkg', 'total_size'] as const, FacetTypes.Number),
  FacetMatcher(['pkg', 'total_entries'] as const, FacetTypes.Number),
  // // comment: Text
  // // last_modified: Date
  // // workflow: Workflow
  // // XXX: other facets
]

export type KnownFacetMatcher = (typeof KNOWN_FACETS)[number]

type KnownFacetPath = KnownFacetMatcher['path']

type FacetMatcherForPath<P extends KnownFacetPath> = Extract<
  KnownFacetMatcher,
  { path: P }
>

type FacetTypeForPath<P extends KnownFacetPath> = FacetMatcherForPath<P>['type']

type FacetStateForPath<P extends KnownFacetPath> = StateForFacetType<FacetTypeForPath<P>>

function getMatcher<P extends KnownFacetPath>(path: P): FacetMatcherForPath<P> {
  return KNOWN_FACETS.filter((m): m is FacetMatcherForPath<P> =>
    R.equals(m.path, path),
  )[0]
}

type FacetDescriptorFromMatcher<M> = M extends FacetMatcher<infer P, infer T>
  ? FacetDescriptor<P, T>
  : never

export type KnownFacetDescriptor = FacetDescriptorFromMatcher<KnownFacetMatcher>

type FacetDescriptorFromPath<P extends KnownFacetPath> = Extract<
  KnownFacetDescriptor,
  { path: P }
>

// type FacetStateFromPath<P> = FacetDescriptorFromPath<P>['state']

// function updateFacetDescriptorState<F extends KnownFacetDescriptor>(
//   facet: F,
//   updater: (state: F['state']) => F['state'],
// ): F {
//   return {
//     ...facet,
//     state: updater(facet.state),
//   }
// }

function matchFacet(path: any, state: any): KnownFacetDescriptor | null {
  for (const matcher of KNOWN_FACETS) {
    if (matcher.match(path)) return matcher.cast({ path, state })
  }
  return null
}

function makeFacet<P extends KnownFacetPath>(path: P, state: FacetStateForPath<P>) {
  const matcher = getMatcher(path)
  return matcher.cast({ path, state }) as FacetDescriptorFromPath<P>
}

export function facetIs<P extends KnownFacetPath>(
  path: P,
  f: KnownFacetDescriptor,
): f is FacetDescriptorFromPath<P> {
  return R.equals(path, f.path)
}

export function getFacetType<F extends KnownFacetDescriptor>(facet: F): F['type'] {
  return facet.type
}

interface SearchUrlState {
  searchString: string | null
  facets: KnownFacetDescriptor[]
  order: Model.GQLTypes.SearchResultOrder
}

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

function serializeOrder(order: Model.GQLTypes.SearchResultOrder): string | null {
  if (R.equals(order, DEFAULT_ORDER)) return null
  const direction = order.direction === Model.GQLTypes.SortDirection.ASC ? '' : '-'
  return `${direction}${order.field}`
}

// XXX: using the simplest ser/de logic here, to be optimized later
// f=path:(type?):state
function parseFacetDescriptor(input: string): KnownFacetDescriptor | null {
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
  return matchFacet(path, state)
}

function serializeFacetDescriptor(f: KnownFacetDescriptor): string {
  // for built-in static facets we don't need to save the type
  // XXX: move serailization to FacetType or FacetMatcher?
  return JSON.stringify(f)
}

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
    .filter((f): f is KnownFacetDescriptor => !!f)

  const order = parseOrder(params.get('o'))

  const facets = [
    makeFacet(['type'] as const, { value: type }),
    makeFacet(['bucket'] as const, { value: buckets }),
    ...extraFacets,
  ]

  return { searchString, facets, order }
}

// XXX: return string?
function serializeSearchUrlState(state: SearchUrlState): URLSearchParams {
  const params = new URLSearchParams()

  if (state.searchString) params.set('q', state.searchString)

  for (const f of state.facets) {
    if (R.equals(f.path, ['type'])) {
      const fstate = f.state as StateForFacetType<typeof FacetTypes.ResultType>
      if (fstate.value) params.set('t', fstate.value)
      continue
    }
    if (R.equals(f.path, ['bucket'])) {
      const fstate = f.state as StateForFacetType<typeof FacetTypes.Bucket>
      if (fstate.value.length) params.set('b', fstate.value.join(','))
      continue
    }
    params.append('f', serializeFacetDescriptor(f))
  }

  const order = serializeOrder(state.order)
  if (order) params.set('o', order)

  return params
}

function useUrlState(): SearchUrlState {
  const l = RR.useLocation()
  return React.useMemo(() => parseSearchParams(l.search), [l.search])
}

function useMakeUrl() {
  const { urls } = NamedRoutes.use()
  const base = urls.search({})
  return React.useCallback(
    (state: SearchUrlState) => {
      const parts = [base]
      const qs = serializeSearchUrlState(state).toString()
      if (qs) parts.push(qs)
      return parts.join('?')
    },
    [base],
  )
}

type FacetPath = Model.Search.FacetPath

export { FacetPath }

// export interface ActiveFacet {
//   path: Model.Search.FacetPath
//   name: string
//   type: $TSFixMe
//   state: $TSFixMe
//   // state: FacetState
//   // query parameters to get extents?
//   // filter exp? -- compute?
// }

function useActiveFacets({ facets }: SearchUrlState): KnownFacetDescriptor[] {
  return facets
  // return useMemoEq(
  //   facets,
  //   R.map(({ path, state }) => {
  //     const type = 'tbd' // TODO: compute from path and state
  //     const name = 'tbd'
  //     return { path, type, state, name }
  //   }),
  // )
}

function computeFilterExpression(
  activeFacets: KnownFacetDescriptor[],
): Model.Search.FilterExpression | null {
  return activeFacets.reduce((filter: Model.Search.FilterExpression | null, facet) => {
    // TODO: compute filter expression from active facets
    // eslint-disable-next-line no-console
    console.log('facet', facet)
    return filter
  }, null)
}

function useFilterExpression(
  activeFacets: KnownFacetDescriptor[],
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
  descriptor: KnownFacetDescriptor
  // path: Model.Search.FacetPath
  name: string
  // type: $TSFixMe
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
            // available fields:
            // - path
            // - extents
            // - type -> drop? can be computed from path
            // - name -> drop? compute in ui?
            // - source -> drop
            const newFacets = r.facets
              .map((f) => ({
                descriptor: matchFacet(f.path, { extents: f.extents }),
                // path: f.path,
                name: f.name,
                // type: f.type,
              }))
              .filter((f): f is AvailableFacet => !!f.descriptor)
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

  const makeUrl = useMakeUrl()

  const history = RR.useHistory()

  const updateUrlState = React.useCallback(
    (updater: (s: SearchUrlState) => SearchUrlState) => {
      const newState = updater(urlState)
      if (R.equals(newState, urlState)) return
      history.push(makeUrl(newState))
    },
    [urlState, makeUrl, history],
  )

  const setSearchString = React.useCallback(
    (searchString: string | null) => {
      updateUrlState((s) => ({ ...s, searchString }))
    },
    [updateUrlState],
  )

  const activateFacet = React.useCallback(
    (path: KnownFacetPath) => {
      // eslint-disable-next-line no-console
      console.log('activateFacet', path)
      const facet = availableFacets.facets.find((f) => R.equals(f.descriptor.path, path))
      if (!facet) return
      updateUrlState(
        R.evolve({ facets: R.append(facet.descriptor)<KnownFacetDescriptor> }),
      )
    },
    [availableFacets.facets, updateUrlState],
  )

  const deactivateFacet = React.useCallback(
    (path: KnownFacetPath) => {
      // eslint-disable-next-line no-console
      console.log('deactivateFacet', path)
      // add to active facets
      updateUrlState(
        R.evolve({
          facets: R.reject((f: KnownFacetDescriptor) => R.equals(f.path, path)),
        }),
      )
    },
    [updateUrlState],
  )

  const updateActiveFacet = React.useCallback(
    // eslint-disable-next-line prefer-arrow-callback
    function <P extends KnownFacetPath>(
      path: P,
      updater: (f: FacetDescriptorFromPath<P>) => FacetDescriptorFromPath<P>,
    ) {
      updateUrlState(
        R.evolve({
          facets: R.map((f: KnownFacetDescriptor) => (facetIs(path, f) ? updater(f) : f)),
        }),
      )
    },
    [updateUrlState],
  )

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
        setSearchString,
        activateFacet,
        deactivateFacet,
        updateActiveFacet,
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
