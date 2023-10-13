import invariant from 'invariant'
import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as RR from 'react-router-dom'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import * as JSONPointer from 'utils/JSONPointer'
import * as KTree from 'utils/KeyedTree'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import useMemoEq from 'utils/useMemoEq'

import BASE_SEARCH_QUERY from './gql/BaseSearch.generated'
import FIRST_PAGE_OBJECTS_QUERY from './gql/FirstPageObjects.generated'
import FIRST_PAGE_PACKAGES_QUERY from './gql/FirstPagePackages.generated'
import NEXT_PAGE_OBJECTS_QUERY from './gql/NextPageObjects.generated'
import NEXT_PAGE_PACKAGES_QUERY from './gql/NextPagePackages.generated'
import META_FACETS_QUERY from './gql/PackageMetaFacets.generated'

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

interface SearchUrlStateBase {
  searchString: string | null
  buckets: string[]
  order: Model.GQLTypes.SearchResultOrder
}

interface ObjectsSearchUrlState extends SearchUrlStateBase {
  resultType: ResultType.S3Object
  filter: FilterStateForResultType<ResultType.S3Object>
}

interface PackagesSearchUrlState extends SearchUrlStateBase {
  resultType: ResultType.QuiltPackage
  filter: FilterStateForResultType<ResultType.QuiltPackage>
  userMetaFilters: UserMetaFilters
}

export type SearchUrlState = ObjectsSearchUrlState | PackagesSearchUrlState

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

export type Untag<T extends Tagged<any, any>> = T extends Tagged<any, infer U> ? U : never

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
  init: { true: false, false: false },
  fromString: (input: string) => {
    const values = input.split(',')
    return { true: values.includes('true'), false: values.includes('false') }
  },
  toString: (state) => {
    const values = []
    if (state.true) values.push('true')
    if (state.false) values.push('false')
    return values.join(',')
  },
  toGQL: ({ _tag, ...state }) =>
    state.true || state.false ? (state as Model.GQLTypes.BooleanSearchPredicate) : null,
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

export const Predicates = {
  Datetime: DatetimePredicate,
  Number: NumberPredicate,
  Text: TextPredicate,
  KeywordEnum: KeywordEnumPredicate,
  KeywordWildcard: KeywordWildcardPredicate,
  Boolean: BooleanPredicate,
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
  [K in keyof PM]: PredicateGQLType<PM[K]> | null
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
})

type UserMetaFilterMap = Map<string, PredicateState<PrimitivePredicate>>

class UserMetaFilters {
  filters: UserMetaFilterMap

  static typeMap: Record<string, PrimitivePredicate> = {
    d: Predicates.Datetime,
    n: Predicates.Number,
    t: Predicates.Text,
    e: Predicates.KeywordEnum,
    w: Predicates.KeywordWildcard,
    b: Predicates.Boolean,
  }

  static reverseTypeMap = {
    [Predicates.Datetime._tag]: 'd',
    [Predicates.Number._tag]: 'n',
    [Predicates.Text._tag]: 't',
    [Predicates.KeywordEnum._tag]: 'e',
    [Predicates.KeywordWildcard._tag]: 'w',
    [Predicates.Boolean._tag]: 'b',
  }

  static predicateMap = {
    Datetime: 'datetime' as const,
    Number: 'number' as const,
    Text: 'text' as const,
    KeywordEnum: 'keyword' as const,
    KeywordWildcard: 'keyword' as const,
    Boolean: 'boolean' as const,
  }

  static fromURLSearchParams(params: URLSearchParams, prefix: string): UserMetaFilters {
    const filters: UserMetaFilterMap = new Map()
    // key format: $prefix$type$path
    params.forEach((v, k) => {
      if (!k.startsWith(prefix)) return
      const withoutPrefix = k.slice(prefix.length)
      const idx = withoutPrefix.indexOf('/')
      if (idx === -1) return
      const type = withoutPrefix.slice(0, idx)
      const predicate = UserMetaFilters.typeMap[type]
      if (!predicate) return
      const path = withoutPrefix.slice(idx)
      filters.set(path, predicate.fromString(v))
    })
    return new this(filters)
  }

  constructor(filters?: UserMetaFilterMap) {
    this.filters = filters || new Map()
  }

  copy(): UserMetaFilters {
    return new UserMetaFilters(new Map(this.filters))
  }

  toURLSearchParams(prefix: string): [string, string][] {
    return Array.from(this.filters).reduce(
      (params, [k, v]) => {
        if (v == null) return params
        const s = Predicates[v._tag].toString(v as any)
        if (s == null) return params
        const t = UserMetaFilters.reverseTypeMap[v._tag]
        return [...params, [`${prefix}${t}${k}` as string, s]]
      },
      [] as [string, string][],
    )
  }

  toGQL(): Model.GQLTypes.PackageUserMetaPredicate[] | null {
    const predicates = Array.from(this.filters).reduce((acc, [path, predicate]) => {
      const gql = Predicates[predicate._tag].toGQL(predicate as any)
      if (!gql) return acc
      const obj = {
        path,
        datetime: null,
        number: null,
        text: null,
        keyword: null,
        boolean: null,
        [UserMetaFilters.predicateMap[predicate._tag]]: gql,
      }
      return [...acc, obj]
    }, [] as Model.GQLTypes.PackageUserMetaPredicate[])
    return predicates.length ? predicates : null
  }

  activateFilter(path: string, type: PrimitivePredicate['_tag']): UserMetaFilters {
    if (this.filters.has(path)) return this
    const copy = this.copy()
    copy.filters.set(path, Predicates[type].initialState)
    return copy
  }

  deactivateFilter(path: string): UserMetaFilters {
    if (!this.filters.has(path)) return this
    const copy = this.copy()
    copy.filters.delete(path)
    return copy
  }

  setFilter(path: string, state: PredicateState<PrimitivePredicate>): UserMetaFilters {
    if (!this.filters.has(path)) return this
    const copy = this.copy()
    copy.filters.set(path, state)
    return copy
  }
}

function parseResultType(t: string | null, legacy: string | null): ResultType {
  switch (legacy) {
    case 'packages':
      return ResultType.QuiltPackage
    case 'objects':
      return ResultType.S3Object
  }
  switch (t) {
    case ResultType.QuiltPackage:
      return ResultType.QuiltPackage
    case ResultType.S3Object:
      return ResultType.S3Object
  }
  return DEFAULT_RESULT_TYPE
}

const META_PREFIX = 'meta.'

// XXX: use io-ts or @effect/schema for morphisms between url (querystring) and search state
export function parseSearchParams(qs: string): SearchUrlState {
  const params = new URLSearchParams(qs)
  const searchString = params.get('q')

  const resultType = parseResultType(params.get('t'), params.get('mode'))

  const bucketsInput = params.get('b')
  const buckets = bucketsInput ? bucketsInput.split(',').sort() : []

  const order = parseOrder(params.get('o'))

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
        userMetaFilters: UserMetaFilters.fromURLSearchParams(params, META_PREFIX),
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
      appendParams(state.userMetaFilters.toURLSearchParams(META_PREFIX))
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

function useFirstPagePackagesQuery(state: SearchUrlState) {
  return GQL.useQuery(
    FIRST_PAGE_PACKAGES_QUERY,
    {
      searchString: state.searchString,
      buckets: state.buckets,
      order: state.order,
      filter: PackagesSearchFilterIO.toGQL(
        state.resultType === ResultType.QuiltPackage
          ? state.filter
          : PackagesSearchFilterIO.initialState,
      ),
      userMetaFilters:
        state.resultType === ResultType.QuiltPackage
          ? state.userMetaFilters.toGQL()
          : null,
    },
    {
      pause: state.resultType !== ResultType.QuiltPackage,
    },
  )
}

function useFirstPageQuery(state: SearchUrlState) {
  const firstPageObjectsQuery = useFirstPageObjectsQuery(state)
  const firstPagePackagesQuery = useFirstPagePackagesQuery(state)

  switch (state.resultType) {
    case ResultType.S3Object:
      return GQL.fold(firstPageObjectsQuery, {
        data: ({ searchObjects: data }, { fetching }) =>
          fetching ? addTag('fetching', {}) : addTag('data', { data }),
        fetching: () => addTag('fetching', {}),
        error: (error) => addTag('error', { error }),
      })
    case ResultType.QuiltPackage:
      return GQL.fold(firstPagePackagesQuery, {
        data: ({ searchPackages: data }, { fetching }) =>
          fetching ? addTag('fetching', {}) : addTag('data', { data }),
        fetching: () => addTag('fetching', {}),
        error: (error) => addTag('error', { error }),
      })
    default:
      assertNever(state)
  }
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

interface MetaFacetsQueryProps {
  searchString: SearchUrlState['searchString']
  buckets: SearchUrlState['buckets']
  filter: PackagesFilterState
}

function useMetaFacetsQuery({ searchString, buckets, filter }: MetaFacetsQueryProps) {
  const gqlFilter = PackagesSearchFilterIO.toGQL(filter)
  return GQL.useQuery(META_FACETS_QUERY, { searchString, buckets, filter: gqlFilter })
}

const NO_FACETS: PackageUserMetaFacet[] = []

export function usePackagesMetaFilters() {
  const model = useSearchUIModel()
  invariant(model.state.resultType === ResultType.QuiltPackage, 'Filter type mismatch')

  const query = useMetaFacetsQuery(model.state)

  const all = GQL.fold(query, {
    data: ({ searchPackages: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
          return NO_FACETS
        case 'InvalidInput':
          return NO_FACETS
        case 'PackagesSearchResultSet':
          return r.stats.userMeta
        default:
          assertNever(r)
      }
    },
    fetching: () => NO_FACETS,
    error: () => NO_FACETS,
  })
  const activated = model.state.userMetaFilters.filters
  const activatedPaths = React.useMemo(() => Array.from(activated.keys()), [activated])

  const available = React.useMemo(
    () => all.filter((f) => !activatedPaths.includes(f.path)),
    [all, activatedPaths],
  )

  return { all, activated, activatedPaths, available, fetching: query.fetching }
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

const PackageUserMetaFacetTypeDisplay = {
  NumberPackageUserMetaFacet: 'Number' as const,
  DatetimePackageUserMetaFacet: 'Date' as const,
  KeywordPackageUserMetaFacet: 'Keyword' as const,
  TextPackageUserMetaFacet: 'Text' as const,
  BooleanPackageUserMetaFacet: 'Boolean' as const,
}

type FacetTree = KTree.Tree<PackageUserMetaFacet, string>
type FacetNode = KTree.Node<PackageUserMetaFacet, string>

function normalizeFacetNode(node: FacetNode): FacetTree {
  return node._tag === 'Tree'
    ? node
    : KTree.fromLeaf(
        [`type:${PackageUserMetaFacetTypeDisplay[node.value.__typename]}`],
        node,
      )
}

function resolveFacetConflict(existing: FacetNode, conflict: FacetNode): FacetNode {
  return KTree.merge(
    normalizeFacetNode(existing),
    normalizeFacetNode(conflict),
    resolveFacetConflict,
  )
}

export function groupFacets(
  facets: PackageUserMetaFacet[],
  visible?: number,
): [FacetTree, FacetTree] {
  const grouped = facets.reduce(
    (acc, f) =>
      KTree.merge(
        acc,
        KTree.fromLeaf(
          JSONPointer.parse(f.path).map((p) => `path:${p}`),
          KTree.Leaf(f),
        ),
        resolveFacetConflict,
      ),
    KTree.Tree<PackageUserMetaFacet, string>([]),
  )
  if (!visible) return [grouped, KTree.Tree([])]
  if (grouped.children.size <= visible) return [grouped, KTree.Tree([])]
  const [head, tail] = R.splitAt(visible, Array.from(grouped.children))
  return [KTree.Tree(head), KTree.Tree(tail)]
}

export const PackageUserMetaFacetMap = {
  NumberPackageUserMetaFacet: 'Number' as const,
  DatetimePackageUserMetaFacet: 'Datetime' as const,
  KeywordPackageUserMetaFacet: 'KeywordEnum' as const,
  TextPackageUserMetaFacet: 'Text' as const,
  BooleanPackageUserMetaFacet: 'Boolean' as const,
}

export function usePackageUserMetaFacetExtents(path: string): Extents | undefined {
  const { all, activated } = usePackagesMetaFilters()

  // XXX: query extents
  const facet = all.find(
    (f) =>
      f.path === path &&
      activated.get(path)?._tag === PackageUserMetaFacetMap[f.__typename],
  )
  switch (facet?.__typename) {
    case 'NumberPackageUserMetaFacet':
      return facet.numberExtents
    case 'DatetimePackageUserMetaFacet':
      return facet.datetimeExtents
    case 'KeywordPackageUserMetaFacet':
      return facet.extents
    default:
      return
  }
}

function useSearchUIModel() {
  const urlState = useUrlState()
  const baseSearchQuery = useBaseSearchQuery(urlState)
  const firstPageQuery = useFirstPageQuery(urlState)

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
              userMetaFilters: new UserMetaFilters(),
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
        return { ...s, userMetaFilters: s.userMetaFilters.activateFilter(path, type) }
      }),
    [updateUrlState],
  )

  const deactivatePackagesMetaFilter = React.useCallback(
    (path: string) =>
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.QuiltPackage, 'wrong result type')
        return { ...s, userMetaFilters: s.userMetaFilters.deactivateFilter(path) }
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
    (path: string, state: PredicateState<PrimitivePredicate>) => {
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.QuiltPackage, 'wrong result type')
        return { ...s, userMetaFilters: s.userMetaFilters.setFilter(path, state) }
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
      firstPageQuery,
    },
    R.identity,
  )
}

export type SearchUIModel = ReturnType<typeof useSearchUIModel>

export const Context = React.createContext<SearchUIModel | null>(null)

export function SearchUIModelProvider({ children }: React.PropsWithChildren<{}>) {
  const state = useSearchUIModel()
  return React.createElement(Context.Provider, { value: state }, children)
}

export function useSearchUIModelContext(): SearchUIModel {
  const model = React.useContext(Context)
  invariant(model, 'SearchUIModel accessed outside of provider')
  return model
}

export { SearchUIModelProvider as Provider, useSearchUIModelContext as use }
