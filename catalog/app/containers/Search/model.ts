import invariant from 'invariant'
import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as RR from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import * as Sentry from '@sentry/react'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import * as JSONPointer from 'utils/JSONPointer'
import * as KTree from 'utils/KeyedTree'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import * as tagged from 'utils/taggedV2'
import useMemoEq from 'utils/useMemoEq'

import BASE_SEARCH_QUERY from './gql/BaseSearch.generated'
import FIRST_PAGE_OBJECTS_QUERY from './gql/FirstPageObjects.generated'
import FIRST_PAGE_PACKAGES_QUERY from './gql/FirstPagePackages.generated'
import NEXT_PAGE_OBJECTS_QUERY from './gql/NextPageObjects.generated'
import NEXT_PAGE_PACKAGES_QUERY from './gql/NextPagePackages.generated'
import META_FACETS_QUERY from './gql/PackageMetaFacets.generated'
import META_FACETS_FIND_QUERY from './gql/PackageMetaFacetsFind.generated'
import META_FACET_QUERY from './gql/PackageMetaFacet.generated'

export enum ResultType {
  QuiltPackage = 'p',
  S3Object = 'o',
}

export enum View {
  Table = 't',
  List = 'l',
}

export const DEFAULT_RESULT_TYPE = ResultType.QuiltPackage

export const DEFAULT_VIEW = View.List

type Defaults = Omit<SearchUrlState, 'filter' | 'userMetaFilters'>

const createFallbacks = (defaults?: Partial<Defaults>): Defaults => ({
  searchString: defaults?.searchString || null,
  resultType: defaults?.resultType || DEFAULT_RESULT_TYPE,
  view: defaults?.view || DEFAULT_VIEW,
  buckets: defaults?.buckets || [],
  order: defaults?.order || DEFAULT_ORDER,
})

export const ResultOrder = Model.GQLTypes.SearchResultOrder
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ResultOrder = Model.GQLTypes.SearchResultOrder

export const DEFAULT_ORDER = ResultOrder.BEST_MATCH

const FACETS_VISIBLE = 5
// don't show facet filter if under this threshold
const FACETS_FILTER_THRESHOLD = 10

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
  buckets: readonly string[]
  order: ResultOrder
  view: View
}

interface ObjectsSearchUrlState extends SearchUrlStateBase {
  resultType: ResultType.S3Object
  filter: FilterStateForResultType<ResultType.S3Object>
}

interface PackagesSearchUrlState extends SearchUrlStateBase {
  resultType: ResultType.QuiltPackage
  filter: FilterStateForResultType<ResultType.QuiltPackage>
  userMetaFilters: UserMetaFilters
  latestOnly: boolean
}

export type SearchUrlState = ObjectsSearchUrlState | PackagesSearchUrlState

function parseOrder(input: string | null, fallback: ResultOrder): ResultOrder {
  return Object.values(ResultOrder).includes(input as any)
    ? (input as ResultOrder)
    : fallback
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

type PredicateGQLType<PIO extends PredicateIO<any, any, any>> =
  PIO extends PredicateIO<any, any, infer G> ? G : never

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

const STRICT_MARKER = '$s$:'

export const Predicates = {
  Datetime: Predicate({
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
  }),

  Number: Predicate({
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
  }),

  Text: Predicate({
    tag: 'Text',
    init: { queryString: '' },
    fromString: (input: string) => ({ queryString: input }),
    toString: ({ _tag, ...state }) => state.queryString.trim(),
    toGQL: ({ _tag, ...state }) => {
      const queryString = addMagicWildcardsQS(state.queryString.trim())
      return queryString ? ({ queryString } as Model.GQLTypes.TextSearchPredicate) : null
    },
  }),

  KeywordEnum: Predicate({
    tag: 'KeywordEnum',
    init: { terms: [] as string[] },
    fromString: (input: string) => ({ terms: JSON.parse(`[${input}]`) as string[] }),
    toString: ({ terms }) => JSON.stringify(terms).slice(1, -1),
    toGQL: ({ terms }) =>
      terms.length
        ? ({ terms, wildcard: null } as Model.GQLTypes.KeywordSearchPredicate)
        : null,
  }),

  KeywordWildcard: Predicate({
    tag: 'KeywordWildcard',
    init: {
      wildcard: '' as string,
      strict: false,
    },
    fromString: (wildcard: string) => {
      const strict = wildcard.startsWith(STRICT_MARKER)
      if (strict) wildcard = wildcard.slice(STRICT_MARKER.length)
      return { wildcard, strict }
    },
    toString: ({ wildcard, strict }) => (strict ? STRICT_MARKER : '') + (wildcard ?? ''),
    toGQL: ({ wildcard, strict }) =>
      wildcard
        ? ({
            wildcard: strict ? wildcard : addMagicWildcardsKW(wildcard),
            terms: null,
          } as Model.GQLTypes.KeywordSearchPredicate)
        : null,
  }),

  Boolean: Predicate({
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
  }),
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Predicates = typeof Predicates

export type Extents =
  | Model.GQLTypes.DatetimeExtents
  | Model.GQLTypes.NumberExtents
  | Model.GQLTypes.KeywordExtents

export type ExtentsForPredicate<P> = P extends Predicates['Datetime']
  ? Model.GQLTypes.DatetimeExtents
  : P extends Predicates['Number']
    ? Model.GQLTypes.NumberExtents
    : P extends Predicates['KeywordEnum']
      ? Model.GQLTypes.KeywordExtents
      : never

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

type FilterState<FIO extends FilterIO<any>> =
  FIO extends FilterIO<infer PM> ? OrderedCombinedState<PM> : never

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

type UserMetaFilterMap = Map<string, PredicateState<KnownPredicate>>

export class UserMetaFilters {
  filters: UserMetaFilterMap

  static typeMap: Record<string, KnownPredicate> = {
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

  activateFilter(path: string, type: KnownPredicate['_tag']): UserMetaFilters {
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

  setFilter(path: string, state: PredicateState<KnownPredicate>): UserMetaFilters {
    if (!this.filters.has(path)) return this
    const copy = this.copy()
    copy.filters.set(path, state)
    return copy
  }
}

function parseResultType(
  t: string | null,
  legacy: string | null,
  fallback: ResultType,
): ResultType {
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
  return fallback
}

function parseView(view: string | null, fallback: View): View {
  switch (view) {
    case View.List:
      return View.List
    case View.Table:
      return View.Table
  }
  return fallback
}

export const META_PREFIX = 'meta.'

// XXX: use @effect/schema for morphisms between url (querystring) and search state
export function parseSearchParams(
  qs: string,
  defaults?: Partial<Defaults>,
): SearchUrlState {
  const fallbacks = createFallbacks(defaults)
  const params = new URLSearchParams(qs)

  const searchString = params.get('q') || fallbacks.searchString

  const resultType = parseResultType(
    params.get('t'),
    params.get('mode'),
    fallbacks.resultType,
  )

  const view = parseView(params.get('v'), fallbacks.view)

  const bucketsInput = params.get('buckets') || params.get('b')
  const buckets = bucketsInput ? bucketsInput.split(',').sort() : fallbacks.buckets

  const order = parseOrder(params.get('o'), fallbacks.order)

  const base = { searchString, buckets, order, view }
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
        latestOnly: params.get('rev') !== 'all',
      }
    default:
      assertNever(resultType)
  }
}

function areBucketsEqual(left: readonly string[], right: readonly string[]) {
  if (!left.length && !right.length) return true
  if (left.length !== right.length) return false
  const leftCache: Record<(typeof left)[number], null> = left.reduce(
    (memo, l) => ({ ...memo, [l]: true }),
    {},
  )
  return right.every((r) => leftCache[r])
}

// XXX: return string?
function serializeSearchUrlState(
  state: SearchUrlState,
  defaults?: Partial<Defaults>,
): URLSearchParams {
  const fallbacks = createFallbacks(defaults)
  const params = new URLSearchParams()

  if (state.searchString && state.searchString !== fallbacks.searchString) {
    params.set('q', state.searchString)
  }

  if (state.resultType !== fallbacks.resultType) params.set('t', state.resultType)

  if (state.view !== fallbacks.view) params.set('v', state.view)

  if (!areBucketsEqual(state.buckets, fallbacks.buckets)) {
    params.set('b', state.buckets.join(','))
  }

  if (state.order !== fallbacks.order) params.set('o', state.order)

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
      if (!state.latestOnly) params.set('rev', 'all')
      break
    default:
      assertNever(state)
  }

  return params
}

function useUrlState(defaults?: Partial<Defaults>): SearchUrlState {
  const l = RR.useLocation()
  return React.useMemo(() => parseSearchParams(l.search, defaults), [l.search, defaults])
}

export function useMakeUrl(optBase?: string, defaults?: Partial<Defaults>) {
  const { urls } = NamedRoutes.use()
  const base = optBase || urls.search({})
  return React.useCallback(
    (state: SearchUrlState) => {
      const parts = [base]
      const qs = serializeSearchUrlState(state, defaults).toString()
      if (qs) parts.push(qs)
      return parts.join('?')
    },
    [base, defaults],
  )
}

function addMagicWildcardsKW(s: string): string {
  if (!s) return s
  // Check if the string already contains special Elasticsearch syntax:
  // - wildcards: * ?
  if (/\*|\?/.test(s)) return s
  // Append trailing wildcard for substring matching
  return `${s}*`
}

function addMagicWildcardsQS(s: string | null): string | null {
  if (!s) return s
  // Check if the string already contains special Elasticsearch syntax:
  // - field selector: ":" (colon)
  // - wildcards: * ?
  // - quotes: " '
  // - logic: AND OR + |
  // - grouping: ( ) [ ] { }
  // - fuzzy search: ~
  // - negaion: -
  if (/:|\*|\?|"|'|\bAND\b|\bOR\b|\+|\||\(|\)|\[|\]|\{|\}|\~|-/.test(s)) return s
  // Append trailing wildcard for substring matching
  return `${s}*`
}

export function useMagicWildcardsQS(s: string | null) {
  return React.useMemo(() => addMagicWildcardsQS(s), [s])
}

function useBaseSearchQuery({ searchString: s, buckets }: SearchUrlState) {
  const searchString = useMagicWildcardsQS(s)
  return GQL.useQuery(BASE_SEARCH_QUERY, { searchString, buckets })
}

function useFirstPageObjectsQuery({
  searchString: s,
  buckets,
  order,
  resultType,
  filter,
}: SearchUrlState) {
  const searchString = useMagicWildcardsQS(s)
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
  const searchString = useMagicWildcardsQS(state.searchString)
  return GQL.useQuery(
    FIRST_PAGE_PACKAGES_QUERY,
    {
      searchString,
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
      latestOnly: state.resultType === ResultType.QuiltPackage ? state.latestOnly : true,
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

export function useNextPageObjectsQuery(after: string, pause?: boolean) {
  const result = GQL.useQuery(NEXT_PAGE_OBJECTS_QUERY, { after }, { pause })
  const folded = GQL.fold(result, {
    data: ({ searchMoreObjects: data }, { fetching }) =>
      fetching ? addTag('fetching', {}) : addTag('data', { data }),
    fetching: () => addTag('fetching', {}),
    error: (error) => addTag('error', { error }),
  })
  return folded
}

export function useNextPagePackagesQuery(after: string, pause?: boolean) {
  const result = GQL.useQuery(NEXT_PAGE_PACKAGES_QUERY, { after }, { pause })
  const folded = GQL.fold(result, {
    data: ({ searchMorePackages: data }, { fetching }) =>
      fetching ? addTag('fetching', {}) : addTag('data', { data }),
    fetching: () => addTag('fetching', {}),
    error: (error) => addTag('error', { error }),
  })
  return folded
}

export type NextPageQueryResult =
  | ReturnType<typeof useNextPagePackagesQuery>
  | ReturnType<typeof useNextPageObjectsQuery>

interface NextPageQueryProps {
  after: string
  children: RenderFn<NextPageQueryResult>
}

export function NextPageObjectsQuery({ after, children }: NextPageQueryProps) {
  return children(useNextPageObjectsQuery(after))
}

export function NextPagePackagesQuery({ after, children }: NextPageQueryProps) {
  return children(useNextPagePackagesQuery(after))
}

const NO_FACETS: PackageUserMetaFacet[] = []

export const FacetsFilteringState = tagged.create(
  'app/containers/Search:FacetsFilteringState' as const,
  {
    Disabled: () => {},
    Enabled: (x: {
      value: string
      set: (value: string) => void
      isFiltered: boolean
      serverSide: boolean
    }) => x,
  },
)

export type FacetsFilteringStateInstance = tagged.InstanceOf<typeof FacetsFilteringState>

export const AvailableFiltersState = tagged.create(
  'app/containers/Search:AvailableFiltersState' as const,
  {
    Loading: () => {},
    Empty: () => {},
    Ready: (x: {
      filtering: FacetsFilteringStateInstance
      facets: {
        available: readonly PackageUserMetaFacet[]
        visible: FacetTree
        hidden: FacetTree
      }
      fetching: boolean
    }) => x,
  },
)

export type AvailableFiltersStateInstance = tagged.InstanceOf<
  typeof AvailableFiltersState
>

type RenderFn<T> = (arg: T) => JSX.Element | null

interface RenderProps<T> {
  children: RenderFn<T>
}

export function AvailablePackagesMetaFilters({
  children,
}: RenderProps<AvailableFiltersStateInstance>) {
  const model = useSearchUIModelContext(ResultType.QuiltPackage)

  const filter = PackagesSearchFilterIO.toGQL(model.state.filter)

  const searchString = useMagicWildcardsQS(model.state.searchString)

  const query = GQL.useQuery(META_FACETS_QUERY, {
    searchString,
    buckets: model.state.buckets,
    filter,
    latestOnly: model.state.latestOnly,
  })

  return GQL.fold(query, {
    data: ({ searchPackages: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
        case 'InvalidInput':
        case 'OperationError':
          return children(AvailableFiltersState.Empty())
        case 'PackagesSearchResultSet':
          return React.createElement(AvailablePackagesMetaFiltersReady, {
            facets: r.stats.userMeta,
            truncated: r.stats.userMetaTruncated,
            children,
          })
        default:
          assertNever(r)
      }
    },
    fetching: () => children(AvailableFiltersState.Loading()),
    error: () => children(AvailableFiltersState.Empty()),
  })
}

function AvailablePackagesMetaFiltersReady({
  facets,
  truncated,
  children,
}: RenderProps<AvailableFiltersStateInstance> & {
  facets: readonly PackageUserMetaFacet[]
  truncated: boolean
}) {
  const { filters } = useSearchUIModelContext(ResultType.QuiltPackage).state
    .userMetaFilters

  const available = React.useMemo(
    () => facets.filter((f) => !filters.has(f.path)),
    [facets, filters],
  )

  // server-side filtering required
  if (truncated) {
    return React.createElement(AvailablePackagesMetaFiltersServerFilter, {
      available,
      children,
    })
  }

  // client-side filtering required
  if (available.length >= FACETS_FILTER_THRESHOLD) {
    return React.createElement(AvailablePackagesMetaFiltersClientFilter, {
      available,
      children,
    })
  }

  if (!available.length) {
    return children(AvailableFiltersState.Empty())
  }

  // no filtering required
  return React.createElement(AvailablePackagesMetaFiltersGroup, {
    state: AvailableFiltersState.Ready({
      filtering: FacetsFilteringState.Disabled(),
      facets: {
        available,
        visible: EMPTY_FACET_TREE,
        hidden: EMPTY_FACET_TREE,
      },
      fetching: false,
    }),
    children,
  })
}

function AvailablePackagesMetaFiltersServerFilter({
  children,
  available,
}: RenderProps<AvailableFiltersStateInstance> & {
  available: readonly PackageUserMetaFacet[]
}) {
  const [path, setPath] = React.useState('')
  let pathNorm = path.trim().toLowerCase()
  // add wildcards to use substring matching by default
  if (pathNorm && !pathNorm.includes('*') && !pathNorm.includes('?')) {
    pathNorm = `*${pathNorm}*`
  }
  const [pathDebounced] = useDebounce(pathNorm, 500)

  if (pathDebounced) {
    return React.createElement(AvailablePackagesMetaFiltersServerFilterQuery, {
      path: pathDebounced,
      initial: available,
      pathState: { value: path, set: setPath },
      children,
    })
  }

  const state = AvailableFiltersState.Ready({
    filtering: FacetsFilteringState.Enabled({
      value: path,
      set: setPath,
      isFiltered: false,
      serverSide: true,
    }),
    facets: {
      available,
      visible: EMPTY_FACET_TREE,
      hidden: EMPTY_FACET_TREE,
    },
    fetching: false,
  })

  return React.createElement(AvailablePackagesMetaFiltersGroup, { state, children })
}

function AvailablePackagesMetaFiltersServerFilterQuery({
  path,
  initial,
  pathState: { value, set },
  children,
}: RenderProps<AvailableFiltersStateInstance> & {
  path: string
  initial: readonly PackageUserMetaFacet[]
  pathState: { value: string; set: (value: string) => void }
}) {
  const model = useSearchUIModelContext(ResultType.QuiltPackage)

  const filter = PackagesSearchFilterIO.toGQL(model.state.filter)

  const searchString = useMagicWildcardsQS(model.state.searchString)

  const query = GQL.useQuery(META_FACETS_FIND_QUERY, {
    searchString,
    buckets: model.state.buckets,
    filter,
    path,
    latestOnly: model.state.latestOnly,
  })

  const facets = React.useMemo(() => {
    const r = query.data?.searchPackages
    if (!r) return null
    switch (r.__typename) {
      case 'EmptySearchResultSet':
      case 'InvalidInput':
      case 'OperationError':
        return NO_FACETS
      case 'PackagesSearchResultSet':
        return r.filteredUserMetaFacets
      default:
        assertNever(r)
    }
  }, [query])

  const { filters } = model.state.userMetaFilters
  const available = React.useMemo(
    () => (facets ? facets.filter((f) => !filters.has(f.path)) : initial),
    [facets, filters, initial],
  )

  const state = AvailableFiltersState.Ready({
    filtering: FacetsFilteringState.Enabled({
      value,
      set,
      isFiltered: true,
      serverSide: true,
    }),
    facets: {
      available,
      visible: EMPTY_FACET_TREE,
      hidden: EMPTY_FACET_TREE,
    },
    fetching: query.fetching,
  })

  return React.createElement(AvailablePackagesMetaFiltersGroup, { state, children })
}

function AvailablePackagesMetaFiltersClientFilter({
  children,
  available,
}: RenderProps<AvailableFiltersStateInstance> & {
  available: readonly PackageUserMetaFacet[]
}) {
  const [path, setPath] = React.useState('')
  const pathNorm = path.trim().toLowerCase()

  const filtered = React.useMemo(
    () =>
      pathNorm
        ? available.filter((f) =>
            (f.path + PackageUserMetaFacetMap[f.__typename])
              .toLowerCase()
              .includes(pathNorm),
          )
        : available,
    [pathNorm, available],
  )

  const state = AvailableFiltersState.Ready({
    filtering: FacetsFilteringState.Enabled({
      value: path,
      set: setPath,
      isFiltered: filtered.length !== available.length,
      serverSide: false,
    }),
    facets: {
      available: filtered,
      visible: EMPTY_FACET_TREE,
      hidden: EMPTY_FACET_TREE,
    },
    fetching: false,
  })

  return React.createElement(AvailablePackagesMetaFiltersGroup, { state, children })
}

function AvailablePackagesMetaFiltersGroup({
  children,
  state,
}: RenderProps<AvailableFiltersStateInstance> & {
  state: AvailableFiltersStateInstance
}) {
  const available = AvailableFiltersState.match({
    Ready: (r) => r.facets.available,
    _: () => null,
  })(state)

  const grouped = React.useMemo(
    () => (available ? groupFacets(available, FACETS_VISIBLE) : null),
    [available],
  )

  const stateOut = React.useMemo(
    () =>
      AvailableFiltersState.match({
        Ready: ({ facets, ...r }) => {
          if (!grouped) return state
          const [visible, hidden] = grouped
          return AvailableFiltersState.Ready({
            ...r,
            facets: {
              ...facets,
              visible,
              hidden,
            },
          })
        },
        _: (s) => s,
      })(state),
    [state, grouped],
  )

  return children(stateOut)
}

export type SearchHitObject = Extract<
  GQL.DataForDoc<typeof FIRST_PAGE_OBJECTS_QUERY>['searchObjects'],
  { __typename: 'ObjectsSearchResultSet' }
>['firstPage']['hits'][number]

export type SearchHitPackage = Extract<
  GQL.DataForDoc<typeof FIRST_PAGE_PACKAGES_QUERY>['searchPackages'],
  { __typename: 'PackagesSearchResultSet' }
>['firstPage']['hits'][number]

export type SearchHit = SearchHitObject | SearchHitPackage

type PackageUserMetaFacetFull = Extract<
  GQL.DataForDoc<typeof BASE_SEARCH_QUERY>['searchPackages'],
  { __typename: 'PackagesSearchResultSet' }
>['stats']['userMeta'][number]

export type PackageUserMetaFacet = Pick<PackageUserMetaFacetFull, 'path' | '__typename'>

const PackageUserMetaFacetTypeDisplay = {
  NumberPackageUserMetaFacet: 'Number' as const,
  DatetimePackageUserMetaFacet: 'Date' as const,
  KeywordPackageUserMetaFacet: 'Keyword' as const,
  TextPackageUserMetaFacet: 'Text' as const,
  BooleanPackageUserMetaFacet: 'Boolean' as const,
}

export type FacetTree = KTree.Tree<PackageUserMetaFacet, string>
type FacetNode = KTree.Node<PackageUserMetaFacet, string>

export const EMPTY_FACET_TREE = KTree.Tree<PackageUserMetaFacet, string>([])

function normalizeFacetNode(node: FacetNode): FacetTree {
  return node._tag === 'Tree'
    ? node
    : KTree.fromLeaf(
        [`type:${PackageUserMetaFacetTypeDisplay[node.value.__typename]}`],
        node,
      )
}

const facetId = (f: PackageUserMetaFacet) => `${f.path}:${f.__typename}`

function resolveFacetConflict(existing: FacetNode, conflict: FacetNode): FacetNode {
  if (existing._tag === 'Leaf' && conflict._tag === 'Leaf') {
    const existingId = facetId(existing.value)
    const conflictId = facetId(conflict.value)
    // duplicate facet, should not happen
    // this would cause an infinite recursion if not handled
    if (existingId === conflictId) {
      Sentry.withScope((scope) => {
        const depth = JSONPointer.parse(existing.value.path).length
        const type = PackageUserMetaFacetTypeDisplay[existing.value.__typename]
        scope.setExtras({ depth, type })
        Sentry.captureMessage('Duplicate facet', 'warning')
      })
      // keep the facet encountered first
      return existing
    }
  }

  return KTree.merge(
    normalizeFacetNode(existing),
    normalizeFacetNode(conflict),
    resolveFacetConflict,
  )
}

export function groupFacets(
  facets: readonly PackageUserMetaFacet[],
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
    EMPTY_FACET_TREE,
  )
  if (!visible || grouped.children.size <= visible) return [grouped, EMPTY_FACET_TREE]
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

export const PackageUserMetaFacetTypeInfo = {
  Number: {
    hasExtents: true,
    inputType: Model.GQLTypes.PackageUserMetaFacetType.NUMBER,
  },
  Datetime: {
    hasExtents: true,
    inputType: Model.GQLTypes.PackageUserMetaFacetType.DATETIME,
  },
  KeywordEnum: {
    hasExtents: true,
    inputType: Model.GQLTypes.PackageUserMetaFacetType.KEYWORD,
  },
  KeywordWildcard: {
    hasExtents: false,
    inputType: Model.GQLTypes.PackageUserMetaFacetType.KEYWORD,
  },
  Text: {
    hasExtents: false,
    inputType: Model.GQLTypes.PackageUserMetaFacetType.TEXT,
  },
  Boolean: {
    hasExtents: false,
    inputType: Model.GQLTypes.PackageUserMetaFacetType.BOOLEAN,
  },
}

function oneOf<T extends string, L extends T[]>(
  comparisonList: L,
  subject: T,
): subject is L[number] {
  return comparisonList.some((compare) => compare === subject)
}

export function usePackageSystemMetaFacetExtents(field: keyof PackagesSearchFilter): {
  fetching: boolean
  extents: Extents | undefined
} {
  const model = useSearchUIModelContext(ResultType.QuiltPackage)
  return GQL.fold(model.baseSearchQuery, {
    data: ({ searchPackages: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
        case 'InvalidInput':
        case 'OperationError':
          return { fetching: false, extents: undefined }
        case 'PackagesSearchResultSet':
          if (oneOf(['workflow', 'modified', 'size', 'entries'], field)) {
            return { fetching: false, extents: r.stats[field] }
          }
          return { fetching: false, extents: undefined }
        default:
          assertNever(r)
      }
    },
    fetching: () => ({ fetching: true, extents: undefined }),
    error: () => ({ fetching: false, extents: undefined }),
  })
}

export function usePackageUserMetaFacetExtents(path: string): {
  fetching: boolean
  extents: Extents | undefined
} {
  const model = useSearchUIModelContext(ResultType.QuiltPackage)
  const activated = model.state.userMetaFilters.filters.get(path)
  invariant(activated, 'Requesting extents for inactive filter')

  const typeInfo = PackageUserMetaFacetTypeInfo[activated._tag]

  const searchString = useMagicWildcardsQS(model.state.searchString)

  const query = GQL.useQuery(
    META_FACET_QUERY,
    {
      searchString,
      buckets: model.state.buckets,
      filter: PackagesSearchFilterIO.toGQL(model.state.filter),
      latestOnly: model.state.latestOnly,
      path,
      type: typeInfo.inputType,
    },
    { pause: !typeInfo.hasExtents },
  )

  if (!typeInfo.hasExtents) {
    return { fetching: false, extents: undefined }
  }

  return GQL.fold(query, {
    data: ({ searchPackages: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
        case 'InvalidInput':
        case 'OperationError':
          return { fetching: false, extents: undefined }
        case 'PackagesSearchResultSet':
          const facet = r.filteredUserMetaFacets[0]
          let extents: Extents | undefined = undefined
          switch (facet?.__typename) {
            case 'NumberPackageUserMetaFacet':
              extents = facet.numberExtents
              break
            case 'DatetimePackageUserMetaFacet':
              extents = facet.datetimeExtents
              break
            case 'KeywordPackageUserMetaFacet':
              extents = facet.extents
              break
          }
          return { fetching: false, extents }

        default:
          assertNever(r)
      }
    },
    fetching: () => ({ fetching: true, extents: undefined }),
    error: () => ({ fetching: false, extents: undefined }),
  })
}

function useSearchUIModel(optBase?: string, defaults?: Partial<Defaults>) {
  const urlState = useUrlState(defaults)

  const baseSearchQuery = useBaseSearchQuery(urlState)
  const firstPageQuery = useFirstPageQuery(urlState)

  const makeUrl = useMakeUrl(optBase, defaults)

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
    (order: ResultOrder) => {
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
              latestOnly: true,
            }
          case ResultType.S3Object:
            return {
              ...s,
              resultType,
              filter: ObjectsSearchFilterIO.initialState,
              view: View.List,
            }
          default:
            return assertNever(resultType)
        }
      })
    },
    [updateUrlState],
  )

  const setView = React.useCallback(
    (view: View) => {
      updateUrlState((s) => ({ ...s, view }))
    },
    [updateUrlState],
  )

  const setBuckets = React.useCallback(
    (buckets: readonly string[]) => {
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
    (path: string, type: KnownPredicate['_tag']) =>
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
    (path: string, state: PredicateState<KnownPredicate>) => {
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.QuiltPackage, 'wrong result type')
        return { ...s, userMetaFilters: s.userMetaFilters.setFilter(path, state) }
      })
    },
    [updateUrlState],
  )

  const setPackagesLatestOnly = React.useCallback(
    (latestOnly: boolean) =>
      updateUrlState((s) => {
        invariant(s.resultType === ResultType.QuiltPackage, 'wrong result type')
        return { ...s, latestOnly }
      }),
    [updateUrlState],
  )

  const clearFilters = React.useCallback(() => {
    updateUrlState((s) => {
      switch (s.resultType) {
        case ResultType.QuiltPackage:
          return {
            ...s,
            filter: PackagesSearchFilterIO.initialState,
            userMetaFilters: new UserMetaFilters(),
          }
        case ResultType.S3Object:
          return {
            ...s,
            filter: ObjectsSearchFilterIO.initialState,
          }
        default:
          return assertNever(s)
      }
    })
  }, [updateUrlState])

  const reset = React.useCallback(() => {
    updateUrlState(({ resultType, order, view }) => {
      const base = {
        searchString: null,
        buckets: [],
        order,
        view,
      }
      switch (resultType) {
        case ResultType.QuiltPackage:
          return {
            ...base,
            resultType,
            filter: PackagesSearchFilterIO.initialState,
            userMetaFilters: new UserMetaFilters(),
            latestOnly: true,
          }
        case ResultType.S3Object:
          return {
            ...base,
            resultType,
            filter: ObjectsSearchFilterIO.initialState,
          }
        default:
          return assertNever(resultType)
      }
    })
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
        setView,

        activateObjectsFilter,
        deactivateObjectsFilter,
        setObjectsFilter,

        activatePackagesFilter,
        deactivatePackagesFilter,
        setPackagesFilter,

        activatePackagesMetaFilter,
        deactivatePackagesMetaFilter,
        setPackagesMetaFilter,

        setPackagesLatestOnly,

        clearFilters,
        reset,

        updateUrlState,
      },
      baseSearchQuery,
      firstPageQuery,
    },
    R.identity,
  )
}

export type SearchUIModel = ReturnType<typeof useSearchUIModel>

export const Context = React.createContext<SearchUIModel | null>(null)

export function SearchUIModelProvider({
  base,
  children,
  defaults,
}: React.PropsWithChildren<{ defaults?: Partial<Defaults>; base?: string }>) {
  const state = useSearchUIModel(base, defaults)
  return React.createElement(Context.Provider, { value: state }, children)
}

export function useSearchUIModelContext(
  type: ResultType.QuiltPackage,
): SearchUIModel & { state: PackagesSearchUrlState }
export function useSearchUIModelContext(
  type: ResultType.S3Object,
): SearchUIModel & { state: ObjectsSearchUrlState }
export function useSearchUIModelContext(): SearchUIModel
export function useSearchUIModelContext(type?: ResultType) {
  const model = React.useContext(Context)
  invariant(model, 'SearchUIModel accessed outside of provider')
  if (type) {
    invariant(model.state.resultType === type, `Expected result type ${type}`)
  }

  return model
}

export function useSearchUIModelContextUnsafe(): SearchUIModel | null {
  return React.useContext(Context)
}

export {
  SearchUIModelProvider as Provider,
  useSearchUIModelContext as use,
  useSearchUIModelContextUnsafe as useUnsafe,
}
