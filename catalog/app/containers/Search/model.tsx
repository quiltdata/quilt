import invariant from 'invariant'
import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as RR from 'react-router-dom'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
// import * as Types from 'utils/types'
import useMemoEq from 'utils/useMemoEq'

import BASE_SEARCH_QUERY from './gql/BaseSearch.generated'
import FIRST_PAGE_OBJECTS_QUERY from './gql/FirstPageObjects.generated'
import FIRST_PAGE_PACKAGES_QUERY from './gql/FirstPagePackages.generated'
import NEXT_PAGE_OBJECTS_QUERY from './gql/NextPageObjects.generated'
import NEXT_PAGE_PACKAGES_QUERY from './gql/NextPagePackages.generated'

// function ifChanged<T>(newValue: T) {
//   return (oldValue: T) => (R.equals(newValue, oldValue) ? oldValue : newValue)
// }

export enum ResultType {
  QuiltPackage = 'p',
  S3Object = 'o',
}

export const DEFAULT_RESULT_TYPE = ResultType.QuiltPackage

export const DEFAULT_ORDER = Model.GQLTypes.SearchResultOrder.BEST_MATCH

const parseDate = (x: unknown) => {
  if (typeof x !== 'string') return null
  try {
    return dateFns.parseISO(x)
  } catch (e) {
    return null
  }
}

export type ObjectsFilterState = FilterState<typeof ObjectsSearchFilterIO>
export type PackagesFilterState = FilterState<typeof PackagesSearchFilterIO>

export type FilterStateForResultType<T extends ResultType> = T extends ResultType.S3Object
  ? ObjectsFilterState
  : T extends ResultType.QuiltPackage
  ? PackagesFilterState
  : never

export type ObjectsSearchFilter = Model.GQLTypes.ObjectsSearchFilter
export type PackagesSearchFilter = Model.GQLTypes.PackagesSearchFilter

interface ResultTypeAndFilter<T extends ResultType> {
  resultType: T
  filter: FilterStateForResultType<T>
}

interface SearchUrlStateBase<T extends ResultType> extends ResultTypeAndFilter<T> {
  searchString: string | null
  buckets: string[]
  order: Model.GQLTypes.SearchResultOrder
}

export type SearchUrlState =
  | SearchUrlStateBase<ResultType.S3Object>
  | SearchUrlStateBase<ResultType.QuiltPackage>

function parseOrder(input: string | null): Model.GQLTypes.SearchResultOrder {
  return Object.values(Model.GQLTypes.SearchResultOrder).includes(input as any)
    ? (input as Model.GQLTypes.SearchResultOrder)
    : DEFAULT_ORDER
}

function serializeOrder(order: Model.GQLTypes.SearchResultOrder): string | null {
  return order === DEFAULT_ORDER ? null : order
}

type Tagged<Tag extends string, T> = T & { _tag: Tag }

export function addTag<Tag extends string, T>(tag: Tag, t: T): Tagged<Tag, T> {
  return { _tag: tag, ...t }
}

interface PredicateIO<Tag extends string, State, GQLType> {
  readonly _tag: Tag
  initialState: Tagged<Tag, State>
  fromString: (input: string) => Tagged<Tag, State>
  toString: (state: Tagged<Tag, State>) => string | null
  toGQL: (state: Tagged<Tag, State>) => GQLType | null
}

export type PredicateState<PIO extends PredicateIO<any, any, any>> =
  PIO extends PredicateIO<infer Tag, infer State, any> ? Tagged<Tag, State> : never

type PredicateGQLType<PIO extends PredicateIO<any, any, any>> = PIO extends PredicateIO<
  any,
  any,
  infer G
>
  ? G
  : never

function Predicate<Tag extends string, State, GQLType>(input: {
  tag: Tag
  init: State
  fromString: (input: string) => State
  toString: (state: Tagged<Tag, State>) => string | null
  toGQL: (state: Tagged<Tag, State>) => GQLType | null
}): PredicateIO<Tag, State, GQLType> {
  return {
    _tag: input.tag,
    initialState: addTag(input.tag, input.init),
    fromString: (s: string) => addTag(input.tag, input.fromString(s)),
    toString: input.toString,
    toGQL: input.toGQL,
  }
}

const DatetimePredicate = Predicate({
  tag: 'Datetime',
  init: {
    gte: null as Date | null,
    lte: null as Date | null,
  },
  fromString: (input: string) => {
    const json = JSON.parse(input)
    return {
      gte: parseDate(json.gte),
      lte: parseDate(json.lte),
    }
  },
  toString: ({ _tag, ...state }) => JSON.stringify(state),
  toGQL: ({ _tag, ...state }) =>
    state.gte == null && state.lte === null
      ? null
      : (state as Model.GQLTypes.DatetimeSearchPredicate),
})

const NumberPredicate = Predicate({
  tag: 'Number',
  init: {
    gte: null as number | null,
    lte: null as number | null,
  },
  fromString: (input: string) => {
    const json = JSON.parse(input)
    return {
      gte: (json.gte as number) ?? null,
      lte: (json.lte as number) ?? null,
    }
  },
  toString: ({ _tag, ...state }) => JSON.stringify(state),
  toGQL: ({ _tag, ...state }) =>
    state.gte == null && state.lte === null
      ? null
      : (state as Model.GQLTypes.NumberSearchPredicate),
})

const TextPredicate = Predicate({
  tag: 'Text',
  init: { queryString: '' },
  fromString: (input: string) => ({ queryString: input }),
  toString: ({ _tag, ...state }) => state.queryString.trim(),
  toGQL: ({ _tag, ...state }) => {
    const queryString = state.queryString.trim()
    return queryString ? ({ queryString } as Model.GQLTypes.TextSearchPredicate) : null
  },
})

const KeywordEnumPredicate = Predicate({
  tag: 'KeywordEnum',
  init: { terms: [] as string[] },
  fromString: (input: string) => ({ terms: JSON.parse(`[${input}]`) as string[] }),
  toString: ({ terms }) => JSON.stringify(terms).slice(1, -1),
  toGQL: ({ terms }) =>
    terms.length
      ? ({ terms, wildcard: null } as Model.GQLTypes.KeywordSearchPredicate)
      : null,
})

const KeywordWildcardPredicate = Predicate({
  tag: 'KeywordWildcard',
  init: {
    wildcard: '' as string,
  },
  fromString: (wildcard: string) => ({ wildcard }),
  toString: ({ wildcard }) => wildcard,
  toGQL: ({ wildcard }) =>
    wildcard
      ? ({ wildcard, terms: null } as Model.GQLTypes.KeywordSearchPredicate)
      : null,
})

const BooleanPredicate = Predicate({
  tag: 'Boolean',
  init: { value: null as boolean | null },
  fromString: (input: string) => ({ value: JSON.parse(input) as boolean | null }),
  toString: (state) => JSON.stringify(state.value),
  toGQL: ({ _tag, ...state }) =>
    state.value == null ? null : (state as Model.GQLTypes.BooleanSearchPredicate),
})

const PrimitivePredicates = [
  DatetimePredicate,
  NumberPredicate,
  TextPredicate,
  KeywordEnumPredicate,
  KeywordWildcardPredicate,
  BooleanPredicate,
]

export type PrimitivePredicate = (typeof PrimitivePredicates)[number]

export type Extents =
  | Model.GQLTypes.DatetimeExtents
  | Model.GQLTypes.NumberExtents
  | Model.GQLTypes.KeywordExtents

export type ExtentsForPredicate<P> = P extends typeof DatetimePredicate
  ? Model.GQLTypes.DatetimeExtents
  : P extends typeof NumberPredicate
  ? Model.GQLTypes.NumberExtents
  : P extends typeof KeywordEnumPredicate
  ? Model.GQLTypes.KeywordExtents
  : never

const UserMetaPredicateMap = {
  Datetime: 'datetime' as const,
  Number: 'number' as const,
  Text: 'text' as const,
  KeywordEnum: 'keyword' as const,
  KeywordWildcard: 'keyword' as const,
  Boolean: 'boolean' as const,
}

const UserMetaPredicate = Predicate({
  tag: 'UserMeta',
  init: {
    children: new Map<string, PredicateState<PrimitivePredicate>>(),
  },
  fromString: (input: string) => ({
    children: new Map<string, PredicateState<PrimitivePredicate>>(
      input ? JSON.parse(input) : [],
    ),
  }),
  toString: ({ children }) => JSON.stringify(Array.from(children)),
  toGQL: ({ children }) => {
    const userMeta = Array.from(children).reduce((acc, [path, predicate]) => {
      const gql = Predicates[predicate._tag].toGQL(
        predicate as any,
      ) as PredicateGQLType<PrimitivePredicate>
      if (!gql) return acc
      const obj = {
        path,
        datetime: null,
        number: null,
        text: null,
        keyword: null,
        boolean: null,
        [UserMetaPredicateMap[predicate._tag]]: gql,
      }
      return [...acc, obj]
    }, [] as Model.GQLTypes.PackageUserMetaPredicate[])
    return userMeta.length ? userMeta : null
  },
})

export const Predicates = {
  Datetime: DatetimePredicate,
  Number: NumberPredicate,
  Text: TextPredicate,
  KeywordEnum: KeywordEnumPredicate,
  KeywordWildcard: KeywordWildcardPredicate,
  Boolean: BooleanPredicate,
  UserMeta: UserMetaPredicate,
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Predicates = typeof Predicates

export type KnownPredicate = Predicates[keyof Predicates]

type PredicateMap = Record<string, PredicateIO<any, any, any>>

type CombinedState<PM extends PredicateMap> = {
  [K in keyof PM]: PredicateState<PM[K]> | null
}

type OrderedCombinedState<PM extends PredicateMap> = {
  predicates: CombinedState<PM>
  order: (keyof PM)[]
}

type CombinedGQLType<PM extends PredicateMap> = {
  [K in keyof PM]: PredicateGQLType<PM[K]>
}

interface FilterIO<PM extends PredicateMap> {
  fromURLSearchParams: (params: URLSearchParams) => OrderedCombinedState<PM>
  toURLSearchParams: (state: OrderedCombinedState<PM>) => [string, string][]
  toGQL: (state: OrderedCombinedState<PM>) => CombinedGQLType<PM> | null
  children: PM
  initialState: OrderedCombinedState<PM>
  activateFilter: (
    state: OrderedCombinedState<PM>,
    key: keyof PM,
  ) => OrderedCombinedState<PM>
  deactivateFilter: (
    state: OrderedCombinedState<PM>,
    key: keyof PM,
  ) => OrderedCombinedState<PM>
  setFilter: <K extends keyof PM>(
    state: OrderedCombinedState<PM>,
    key: K,
    predicateState: CombinedState<PM>[K],
  ) => OrderedCombinedState<PM>
}

function Filter<PM extends PredicateMap>(children: PM): FilterIO<PM> {
  function forEachChild(fn: (k: keyof PM, v: PM[typeof k]) => void) {
    Object.entries(children).forEach(([k, v]) => fn(k, v as PM[typeof k]))
  }

  function initState(): OrderedCombinedState<PM> {
    const predicates = {} as CombinedState<PM>
    const order: (keyof PM)[] = []
    forEachChild((k) => {
      predicates[k] = null
    })
    return { predicates, order }
  }

  function fromURLSearchParams(params: URLSearchParams): OrderedCombinedState<PM> {
    const state = initState()
    params.forEach((v, k) => {
      const predicate = children[k]
      if (!predicate) return
      state.order.push(k as keyof PM)
      state.predicates[k as keyof PM] = predicate.fromString(v)
    })
    return state
  }

  function toURLSearchParams(state: OrderedCombinedState<PM>): [string, string][] {
    const params: [string, string][] = []
    state.order.forEach((k) => {
      const predicate = children[k]
      const v = state.predicates[k]
      if (v == null) return
      const s = predicate.toString(v)
      if (s == null) return
      params.push([k as string, s])
    })
    return params
  }

  function toGQL(state: OrderedCombinedState<PM>): CombinedGQLType<PM> | null {
    const gqlInput = {} as CombinedGQLType<PM>
    let isEmpty = true
    forEachChild((k, predicate) => {
      const v = state.predicates[k]
      if (v == null) return
      const g = predicate.toGQL(v)
      if (g != null) isEmpty = false
      gqlInput[k] = g
    })
    return isEmpty ? null : gqlInput
  }

  const initialState = initState()

  function setFilter<K extends keyof PM>(
    state: OrderedCombinedState<PM>,
    key: K,
    predicateState: CombinedState<PM>[K],
  ): OrderedCombinedState<PM> {
    invariant(state.order.includes(key), 'key must be in order')
    return {
      ...state,
      predicates: {
        ...state.predicates,
        [key]: predicateState,
      },
    }
  }

  function activateFilter(
    state: OrderedCombinedState<PM>,
    key: keyof PM,
  ): OrderedCombinedState<PM> {
    if (state.predicates[key]) return state
    return {
      predicates: {
        ...state.predicates,
        [key]: children[key].initialState,
      },
      order: [...state.order, key],
    }
  }

  function deactivateFilter(
    state: OrderedCombinedState<PM>,
    key: keyof PM,
  ): OrderedCombinedState<PM> {
    if (!state.predicates[key]) return state
    const { ...predicates } = state.predicates
    predicates[key] = null
    const order = state.order.filter((k) => k !== key)
    return { predicates, order }
  }

  return {
    fromURLSearchParams,
    toURLSearchParams,
    toGQL,
    children,
    initialState,
    activateFilter,
    deactivateFilter,
    setFilter,
  }
}

type FilterState<FIO extends FilterIO<any>> = FIO extends FilterIO<infer PM>
  ? OrderedCombinedState<PM>
  : never

export const ObjectsSearchFilterIO = Filter({
  modified: Predicates.Datetime,
  size: Predicates.Number,
  ext: Predicates.KeywordEnum,
  key: Predicates.KeywordWildcard,
  content: Predicates.Text,
  deleted: Predicates.Boolean,
})

export const PackagesSearchFilterIO = Filter({
  modified: Predicates.Datetime,
  size: Predicates.Number,
  name: Predicates.KeywordWildcard,
  hash: Predicates.KeywordWildcard,
  entries: Predicates.Number,
  comment: Predicates.Text,
  workflow: Predicates.KeywordEnum,
  userMeta: Predicates.UserMeta,
})

// XXX: use io-ts or @effect/schema for morphisms between url (querystring) and search state
export function parseSearchParams(qs: string): SearchUrlState {
  const params = new URLSearchParams(qs)
  const searchString = params.get('q')

  // XXX: support legacy "mode" param
  const resultTypeInput = params.get('t')
  const resultType = Object.values(ResultType).includes(resultTypeInput as any)
    ? (resultTypeInput as ResultType)
    : DEFAULT_RESULT_TYPE

  const bucketsInput = params.get('b')
  const buckets = bucketsInput ? bucketsInput.split(',').sort() : []

  const order = parseOrder(params.get('o'))

  // XXX: try to make this less awkward
  const base = { searchString, buckets, order }
  switch (resultType) {
    case ResultType.S3Object:
      return {
        ...base,
        resultType,
        filter: ObjectsSearchFilterIO.fromURLSearchParams(params),
      }
    case ResultType.QuiltPackage:
      return {
        ...base,
        resultType,
        filter: PackagesSearchFilterIO.fromURLSearchParams(params),
      }
    default:
      assertNever(resultType)
  }
}

// XXX: return string?
function serializeSearchUrlState(state: SearchUrlState): URLSearchParams {
  const params = new URLSearchParams()

  if (state.searchString) params.set('q', state.searchString)

  if (state.resultType !== DEFAULT_RESULT_TYPE) params.set('t', state.resultType)

  if (state.buckets.length) params.set('b', state.buckets.join(','))

  const order = serializeOrder(state.order)
  if (order) params.set('o', order)

  function appendParams(pairs: [string, string][]) {
    pairs.forEach(([k, v]) => params.append(k, v))
  }

  switch (state.resultType) {
    case ResultType.S3Object:
      appendParams(ObjectsSearchFilterIO.toURLSearchParams(state.filter))
      break
    case ResultType.QuiltPackage:
      appendParams(PackagesSearchFilterIO.toURLSearchParams(state.filter))
      break
    default:
      assertNever(state)
  }

  return params
}

function useUrlState(): SearchUrlState {
  const l = RR.useLocation()
  return React.useMemo(() => parseSearchParams(l.search), [l.search])
}

export function useMakeUrl() {
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

function useBaseSearchQuery({ searchString, buckets }: SearchUrlState) {
  return GQL.useQuery(BASE_SEARCH_QUERY, { searchString, buckets })
}

function useFirstPageObjectsQuery({
  searchString,
  buckets,
  order,
  resultType,
  filter,
}: SearchUrlState) {
  const gqlFilter = ObjectsSearchFilterIO.toGQL(
    resultType === ResultType.S3Object ? filter : ObjectsSearchFilterIO.initialState,
  )
  const pause = resultType !== ResultType.S3Object
  return GQL.useQuery(
    FIRST_PAGE_OBJECTS_QUERY,
    { searchString, buckets, order, filter: gqlFilter },
    { pause },
  )
}

function useFirstPagePackagesQuery({
  searchString,
  buckets,
  order,
  resultType,
  filter,
}: SearchUrlState) {
  const gqlFilter = PackagesSearchFilterIO.toGQL(
    resultType === ResultType.QuiltPackage ? filter : PackagesSearchFilterIO.initialState,
  )
  const pause = resultType !== ResultType.QuiltPackage
  return GQL.useQuery(
    FIRST_PAGE_PACKAGES_QUERY,
    { searchString, buckets, order, filter: gqlFilter },
    { pause },
  )
}

export function useNextPageObjectsQuery(after: string) {
  const result = GQL.useQuery(NEXT_PAGE_OBJECTS_QUERY, { after })
  const folded = GQL.fold(result, {
    data: ({ searchMoreObjects: data }) => addTag('data', { data }),
    fetching: () => addTag('fetching', {}),
    error: (error) => addTag('error', { error }),
  })
  return folded
}

export function useNextPagePackagesQuery(after: string) {
  const result = GQL.useQuery(NEXT_PAGE_PACKAGES_QUERY, { after })
  const folded = GQL.fold(result, {
    data: ({ searchMorePackages: data }) => addTag('data', { data }),
    fetching: () => addTag('fetching', {}),
    error: (error) => addTag('error', { error }),
  })
  return folded
}

export type SearhHitObject = Extract<
  GQL.DataForDoc<typeof FIRST_PAGE_OBJECTS_QUERY>['searchObjects'],
  { __typename: 'ObjectsSearchResultSet' }
>['firstPage']['hits'][number]

export type SearhHitPackage = Extract<
  GQL.DataForDoc<typeof FIRST_PAGE_PACKAGES_QUERY>['searchPackages'],
  { __typename: 'PackagesSearchResultSet' }
>['firstPage']['hits'][number]

export type SearchHit = SearhHitObject | SearhHitPackage

export type PackageUserMetaFacet = Extract<
  GQL.DataForDoc<typeof BASE_SEARCH_QUERY>['searchPackages'],
  { __typename: 'PackagesSearchResultSet' }
>['stats']['userMeta'][number]

function useSearchUIModel() {
  const urlState = useUrlState()
  const baseSearchQuery = useBaseSearchQuery(urlState)
  const firstPageObjectsQuery = useFirstPageObjectsQuery(urlState)
  const firstPagePackagesQuery = useFirstPagePackagesQuery(urlState)

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
      // XXX: reset other params? e.g. filters
      updateUrlState((s) => ({ ...s, searchString }))
    },
    [updateUrlState],
  )

  const setOrder = React.useCallback(
    (order: Model.GQLTypes.SearchResultOrder) => {
      updateUrlState((s) => ({ ...s, order }))
    },
    [updateUrlState],
  )

  const setResultType = React.useCallback(
    (resultType: ResultType) => {
      updateUrlState((s) => {
        if (s.resultType === resultType) return s
        switch (resultType) {
          case ResultType.QuiltPackage:
            return {
              ...s,
              resultType,
              filter: PackagesSearchFilterIO.initialState,
            }
          case ResultType.S3Object:
            return {
              ...s,
              resultType,
              filter: ObjectsSearchFilterIO.initialState,
            }
          default:
            return assertNever(resultType)
        }
      })
    },
    [updateUrlState],
  )

  const setBuckets = React.useCallback(
    (buckets: string[]) => {
      // XXX: reset filters or smth?
      updateUrlState((s) => ({ ...s, buckets }))
    },
    [updateUrlState],
  )

  const activatePackagesFilter = React.useCallback(
    (key: keyof PackagesSearchFilter) =>
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.QuiltPackage, 'wrong result type')
        return {
          ...s,
          filter: PackagesSearchFilterIO.activateFilter(s.filter, key),
        }
      }),
    [updateUrlState],
  )

  const activatePackagesMetaFilter = React.useCallback(
    (path: string, type: PrimitivePredicate['_tag']) =>
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.QuiltPackage, 'wrong result type')
        let filter = PackagesSearchFilterIO.activateFilter(s.filter, 'userMeta')
        let { userMeta } = filter.predicates
        invariant(userMeta, 'userMeta filter must not be null at this point')
        if (userMeta.children.has(path)) return s
        const children = new Map(userMeta.children)
        children.set(path, Predicates[type].initialState)
        userMeta = { ...userMeta, children }
        filter = PackagesSearchFilterIO.setFilter(filter, 'userMeta', userMeta)
        return { ...s, filter }
      }),
    [updateUrlState],
  )

  const deactivatePackagesMetaFilter = React.useCallback(
    (path: string) =>
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.QuiltPackage, 'wrong result type')
        const { userMeta } = s.filter.predicates
        if (!userMeta?.children.has(path)) return s
        const children = new Map(userMeta.children)
        children.delete(path)
        const filter = children.size
          ? PackagesSearchFilterIO.setFilter(s.filter, 'userMeta', {
              ...userMeta,
              children,
            })
          : PackagesSearchFilterIO.deactivateFilter(s.filter, 'userMeta')
        return { ...s, filter }
      }),
    [updateUrlState],
  )

  const activateObjectsFilter = React.useCallback(
    (key: keyof ObjectsSearchFilter) =>
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.S3Object, 'wrong result type')
        return {
          ...s,
          filter: ObjectsSearchFilterIO.activateFilter(s.filter, key),
        }
      }),
    [updateUrlState],
  )

  const deactivatePackagesFilter = React.useCallback(
    (key: keyof PackagesSearchFilter) =>
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.QuiltPackage, 'wrong result type')
        return { ...s, filter: PackagesSearchFilterIO.deactivateFilter(s.filter, key) }
      }),
    [updateUrlState],
  )

  const deactivateObjectsFilter = React.useCallback(
    (key: keyof ObjectsSearchFilter) =>
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.S3Object, 'wrong result type')
        return { ...s, filter: ObjectsSearchFilterIO.deactivateFilter(s.filter, key) }
      }),
    [updateUrlState],
  )

  const setPackagesFilter = React.useCallback(
    function setPackagesFilterInternal<K extends keyof PackagesSearchFilter>(
      key: K,
      state: FilterState<typeof PackagesSearchFilterIO>['predicates'][K],
    ) {
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.QuiltPackage, 'wrong result type')
        return { ...s, filter: PackagesSearchFilterIO.setFilter(s.filter, key, state) }
      })
    },
    [updateUrlState],
  )

  const setObjectsFilter = React.useCallback(
    function setObjectsFilterInternal<K extends keyof ObjectsSearchFilter>(
      key: K,
      state: FilterState<typeof ObjectsSearchFilterIO>['predicates'][K],
    ) {
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.S3Object, 'wrong result type')
        return { ...s, filter: ObjectsSearchFilterIO.setFilter(s.filter, key, state) }
      })
    },
    [updateUrlState],
  )

  const setPackagesMetaFilter = React.useCallback(
    function setPackagesMetaFilterInternal(
      path: string,
      state: PredicateState<PrimitivePredicate>,
    ) {
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.QuiltPackage, 'wrong result type')
        const { userMeta } = s.filter.predicates
        if (!userMeta?.children.has(path)) return s
        const children = new Map(userMeta.children)
        children.set(path, state)
        const filter = PackagesSearchFilterIO.setFilter(s.filter, 'userMeta', {
          ...userMeta,
          children,
        })
        return { ...s, filter }
      })
    },
    [updateUrlState],
  )

  const clearFilter = React.useCallback(() => {
    const defaultParams = parseSearchParams('')
    updateUrlState(
      (s) =>
        ({
          ...defaultParams,
          buckets: s.buckets,
          order: s.order,
          resultType: s.resultType,
        }) as SearchUrlState,
    )
  }, [updateUrlState])

  // eslint-disable-next-line no-console
  // console.log('URL STATE', urlState)

  return useMemoEq(
    {
      state: {
        ...urlState,
      },
      actions: {
        setSearchString,
        setOrder,
        setResultType,
        setBuckets,

        activateObjectsFilter,
        deactivateObjectsFilter,
        setObjectsFilter,
        activatePackagesFilter,
        deactivatePackagesFilter,
        setPackagesFilter,
        activatePackagesMetaFilter,
        deactivatePackagesMetaFilter,
        setPackagesMetaFilter,
        clearFilter,
      },
      baseSearchQuery,
      firstPageObjectsQuery,
      firstPagePackagesQuery,
    },
    R.identity,
  )
}

export type SearchUIModel = ReturnType<typeof useSearchUIModel>

export const Context = React.createContext<SearchUIModel | null>(null)

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
