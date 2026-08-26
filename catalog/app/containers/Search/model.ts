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

// The two axes the `mo` param carries. They stay separate here because the param
// falls back per axis; the panel offers their combinations as one list
// (FACET_ORDERINGS).
export const FACET_ORDER_BY = ['name', 'type'] as const

export type FacetOrderBy = (typeof FACET_ORDER_BY)[number]

export const FACET_ORDER_DIRECTIONS = ['asc', 'desc'] as const

export type FacetOrderDirection = (typeof FACET_ORDER_DIRECTIONS)[number]

export interface FacetOrdering {
  by: FacetOrderBy
  direction: FacetOrderDirection
}

export const DEFAULT_FACET_ORDERING: FacetOrdering = { by: 'name', direction: 'asc' }

// One control, the way the result list's "Sort by" is one control -- and named
// with its arrows (PRESET_ORDERINGS), so a direction means the same thing in
// both places.
export const FACET_ORDERINGS: { label: string; ordering: FacetOrdering }[] = [
  { label: 'Name A → Z', ordering: { by: 'name', direction: 'asc' } },
  { label: 'Name Z → A', ordering: { by: 'name', direction: 'desc' } },
  { label: 'Type A → Z', ordering: { by: 'type', direction: 'asc' } },
  { label: 'Type Z → A', ordering: { by: 'type', direction: 'desc' } },
]

/** `<by>:<direction>` in the querystring: one param for two axes. */
export function serializeFacetOrdering(ordering: FacetOrdering): string {
  return `${ordering.by}:${ordering.direction}`
}

/**
 * Parse the `mo` param, falling back per axis.
 *
 * A hand-edited or stale URL is untrusted input, and a panel's display preference
 * is never worth failing a search over: an unrecognized half falls back to the
 * default for that axis alone, so `mo=type:sideways` still orders by type.
 */
export function parseFacetOrdering(
  input: string | null,
  fallback: FacetOrdering = DEFAULT_FACET_ORDERING,
): FacetOrdering {
  if (!input) return fallback
  const [by, direction] = input.split(':')
  return {
    by: (FACET_ORDER_BY as readonly string[]).includes(by)
      ? (by as FacetOrderBy)
      : fallback.by,
    direction: (FACET_ORDER_DIRECTIONS as readonly string[]).includes(direction)
      ? (direction as FacetOrderDirection)
      : fallback.direction,
  }
}

type Defaults = Omit<SearchUrlState, 'filter' | 'userMetaFilters'>

const createFallbacks = (defaults?: Partial<Defaults>): Defaults => ({
  searchString: defaults?.searchString || null,
  resultType: defaults?.resultType || DEFAULT_RESULT_TYPE,
  view: defaults?.view || DEFAULT_VIEW,
  buckets: defaults?.buckets || [],
  // `??` (not `||`): an explicit `null` ordering (relevance) is a real choice
  // that must survive as-is rather than falling back to DEFAULT_ORDERING.
  ordering: defaults?.ordering ?? DEFAULT_ORDERING,
  facetOrdering: defaults?.facetOrdering || DEFAULT_FACET_ORDERING,
})

// The single ordering vocabulary (Wave 2): a `PackageOrdering` wire expression —
// `sys:<field>:<dir>` | `usr:<json-pointer>:<type>:<dir>` | null (relevance).
// It replaces the former flat `order` enum + structured `sort` pair: one string
// carries both the global "Sort by" preset AND a per-column field sort, and it
// rides straight through to the packages `firstPage(ordering:)` arg. Object
// search has no field/pointer sorts, so it maps this expression back to the
// legacy `SearchResultOrder` enum at the query boundary (orderingToResultOrder,
// lossy: unmappable → BEST_MATCH). null = relevance/best-match everywhere.
export type Ordering = string | null

export const DEFAULT_ORDERING: Ordering = null

// The dropdown presets, as ordering expressions. These five map cleanly onto the
// object-search `SearchResultOrder` enum too (see orderingToResultOrder), so the
// same option list serves both result types; a package column sort produces a
// non-preset expression, surfaced as the "Column" option.
export const PRESET_ORDERINGS: { label: string; ordering: Ordering }[] = [
  { label: 'Best match', ordering: null },
  { label: 'Most recent first', ordering: 'sys:modified:desc' },
  { label: 'Least recent first', ordering: 'sys:modified:asc' },
  { label: 'A → Z', ordering: 'sys:name:asc' },
  { label: 'Z → A', ordering: 'sys:name:desc' },
]

const FACETS_VISIBLE = 5
// don't show facet filter if under this threshold
const FACETS_FILTER_THRESHOLD = 10
// don't offer the ordering switcher below this: at a handful of fields the order
// is self-evident and the control could not change anything a reader would notice.
export const FACET_ORDERING_THRESHOLD = 8

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
  // The single ordering expression (see `Ordering`). Shared by both result
  // types so it lives in the base and is defaultable per mount; packages send it
  // to `firstPage(ordering:)` verbatim, objects map it to the enum boundary.
  ordering: Ordering
  view: View
  // How the metadata filter panel is ordered. Display state, like `view`: it
  // rides the querystring so a shared link reproduces what the sender saw, but it
  // deliberately stays out of `Route.ts`'s schema, which is the Assistant's JSON
  // API and describes the *search*, not one panel's presentation.
  facetOrdering: FacetOrdering
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

// The legacy `SearchResultOrder` enum, still the wire vocabulary for the objects
// `firstPage(order:)` arg and the legacy `o=` querystring. Not part of the model
// state anymore — only the boundary codecs below touch it. Re-exported as
// `GQLResultOrder` for the boundary tests.
type ResultOrder = Model.GQLTypes.SearchResultOrder
const ResultOrderEnum = Model.GQLTypes.SearchResultOrder
export const GQLResultOrder = Model.GQLTypes.SearchResultOrder

// The legacy system-field tokens as they appeared in the old `o=`/`s=` forms,
// mapped to their Wave-2 ordering expression. Kept only so old URLs (produced
// in-tree before Wave 2) keep working. New URLs use expressions directly.
const LEGACY_ORDER_TO_ORDERING: Record<string, Ordering> = {
  [ResultOrderEnum.BEST_MATCH]: null,
  [ResultOrderEnum.NEWEST]: 'sys:modified:desc',
  [ResultOrderEnum.OLDEST]: 'sys:modified:asc',
  [ResultOrderEnum.LEX_ASC]: 'sys:name:asc',
  [ResultOrderEnum.LEX_DESC]: 'sys:name:desc',
}

// Legacy `s=` structured forms (pre-Wave-2): `s=<PRESET>`, `s=<DIR><SYSTEM>`
// (e.g. `-MODIFIED`), `s=<DIR>meta:<pointer>` (e.g. `+meta:/x`). Mapped to a
// Wave-2 ordering expression. Returns undefined when the input is not a legacy
// form (so the caller can fall through to other sources).
const LEGACY_SORT_META_PREFIX = 'meta:'
const LEGACY_SYSTEM_FIELDS = new Set([
  'NAME',
  'MODIFIED',
  'SIZE',
  'HASH',
  'WORKFLOW',
  'ENTRIES',
])

function parseLegacySort(input: string): Ordering | undefined {
  // preset: bare SearchResultOrder value, no direction prefix
  if (input in LEGACY_ORDER_TO_ORDERING) return LEGACY_ORDER_TO_ORDERING[input]

  const dirChar = input.slice(0, 1)
  const dir = dirChar === '+' ? 'asc' : dirChar === '-' ? 'desc' : null
  if (dir === null) return undefined
  const rest = input.slice(1)

  // user-meta field: `meta:<json-pointer>` → `usr:<pointer>:keyword:<dir>`.
  // The legacy form carried no facet type; keyword is the safe default (the
  // server resolves the actual stored subfield).
  if (rest.startsWith(LEGACY_SORT_META_PREFIX)) {
    const pointer = rest.slice(LEGACY_SORT_META_PREFIX.length)
    if (!pointer) return undefined
    return `usr:${pointer}:keyword:${dir}`
  }

  // system field: bare PackageSystemField value → `sys:<field>:<dir>`
  if (LEGACY_SYSTEM_FIELDS.has(rest)) return `sys:${rest.toLowerCase()}:${dir}`

  return undefined
}

// A Wave-2 ordering expression as it appears in the new `s=` querystring. It is
// stored verbatim (the server is the grammar authority — the catalog does not
// re-validate the expression, only recognizes the two structural prefixes to
// distinguish it from a legacy form).
function isOrderingExpression(input: string): boolean {
  return input.startsWith('sys:') || input.startsWith('usr:')
}

// URL sentinel for an EXPLICIT relevance (null) ordering that differs from a
// non-null mount default (e.g. picking "Best match" on the bucket list, whose
// default is `sys:modified:desc`). Without it, a null ordering would serialize
// absent and re-parse back to the mount default, silently discarding the
// choice. Not a valid ordering expression, so it never collides with one.
const ORDERING_RELEVANCE_SENTINEL = 'relevance'

// Resolve the ordering from the querystring, honoring the precedence
// (d-order-precedence): new-vocabulary `s` wins → legacy-form `s` maps → else
// legacy `o` maps → else the mount default. `s` is always the ordering param;
// `o` is read only as a legacy fallback.
export function parseOrdering(
  s: string | null,
  o: string | null,
  fallback: Ordering,
): Ordering {
  if (s) {
    if (s === ORDERING_RELEVANCE_SENTINEL) return null
    if (isOrderingExpression(s)) return s
    const legacy = parseLegacySort(s)
    if (legacy !== undefined) return legacy
  }
  if (o && o in LEGACY_ORDER_TO_ORDERING) return LEGACY_ORDER_TO_ORDERING[o]
  return fallback
}

// Serialize the ordering to the `s=` param. Called only when the ordering
// differs from the mount default; a null ordering that differs from the default
// is an explicit relevance choice and serializes to the sentinel so it round-
// trips. The legacy `o=` param is never written anymore.
export function serializeOrdering(ordering: Ordering): string {
  return ordering ?? ORDERING_RELEVANCE_SENTINEL
}

// Objects search has no field/pointer sorts — map the ordering expression back
// to the legacy `SearchResultOrder` enum for its `firstPage(order:)` arg. Lossy
// by design: only the five presets map; anything else (a `usr:` pointer sort, or
// a system field objects can't honor) falls back to BEST_MATCH.
const ORDERING_TO_RESULT_ORDER: Record<string, ResultOrder> = {
  'sys:modified:desc': ResultOrderEnum.NEWEST,
  'sys:modified:asc': ResultOrderEnum.OLDEST,
  'sys:name:asc': ResultOrderEnum.LEX_ASC,
  'sys:name:desc': ResultOrderEnum.LEX_DESC,
}

export function orderingToResultOrder(ordering: Ordering): ResultOrder {
  if (!ordering) return ResultOrderEnum.BEST_MATCH
  return ORDERING_TO_RESULT_ORDER[ordering] ?? ResultOrderEnum.BEST_MATCH
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

  const facetOrdering = parseFacetOrdering(params.get('mo'), fallbacks.facetOrdering)

  const bucketsInput = params.get('buckets') || params.get('b')
  const buckets = bucketsInput ? bucketsInput.split(',').sort() : fallbacks.buckets

  const ordering = parseOrdering(params.get('s'), params.get('o'), fallbacks.ordering)

  const base = { searchString, buckets, ordering, view, facetOrdering }
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
// Exported for the round-trip spec: parse/serialize is the URL contract that
// catalog, registry and MCP all share, so it's guarded directly.
export function serializeSearchUrlState(
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

  // Omitted at the default, like every other param here, so a plain search URL
  // stays clean and only a deliberate reorder shows up in the link.
  if (
    state.facetOrdering.by !== fallbacks.facetOrdering.by ||
    state.facetOrdering.direction !== fallbacks.facetOrdering.direction
  ) {
    params.set('mo', serializeFacetOrdering(state.facetOrdering))
  }

  if (!areBucketsEqual(state.buckets, fallbacks.buckets)) {
    params.set('b', state.buckets.join(','))
  }

  // The ordering serializes to `s=` (both result types), absent when it equals
  // the mount default. A non-default null (explicit relevance) round-trips via
  // the sentinel that serializeOrdering emits.
  if (state.ordering !== fallbacks.ordering) {
    params.set('s', serializeOrdering(state.ordering))
  }

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
  if (/:|\*|\?|"|'|\bAND\b|\bOR\b|\+|\||\(|\)|\[|\]|\{|\}|~|-/.test(s)) return s
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
  ordering,
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
    { searchString, buckets, order: orderingToResultOrder(ordering), filter: gqlFilter },
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
      ordering: state.ordering,
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
      // How the tree above is ordered, plus the setter the panel's switcher
      // drives. Lives here rather than in the panel because the ordering decides
      // the visible/hidden split, which happens in the model.
      ordering: {
        value: FacetOrdering
        set: (value: FacetOrdering) => void
        // Whether to offer the control at all. Decided here because it turns on how
        // many fields *exist*, not how many currently match the filter box --
        // `facets.available` is the post-filter list on the client-filter path, so
        // gating on it would unmount the control mid-search, exactly while a reader
        // is hunting for a field.
        offered: boolean
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
    totalAvailable: available.length,
    state: AvailableFiltersState.Ready({
      filtering: FacetsFilteringState.Disabled(),
      facets: {
        available,
        visible: EMPTY_FACET_TREE,
        hidden: EMPTY_FACET_TREE,
      },
      ordering: PLACEHOLDER_ORDERING,
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
    ordering: PLACEHOLDER_ORDERING,
    fetching: false,
  })

  return React.createElement(AvailablePackagesMetaFiltersGroup, {
    state,
    children,
    totalAvailable: available.length,
  })
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
    ordering: PLACEHOLDER_ORDERING,
    fetching: query.fetching,
  })

  return React.createElement(AvailablePackagesMetaFiltersGroup, {
    state,
    children,
    // Neither count alone is the pre-filter total on this path: `available` is
    // the server-filtered result (so it vanishes the control as matches narrow),
    // and `initial` is the truncated list minus applied filters (so it withholds
    // the control when a text query returns far more than the truncated list
    // held). Offer whenever either is large enough.
    totalAvailable: Math.max(initial.length, available.length),
  })
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
    ordering: PLACEHOLDER_ORDERING,
    fetching: false,
  })

  return React.createElement(AvailablePackagesMetaFiltersGroup, {
    state,
    children,
    totalAvailable: available.length,
  })
}

// Every `Ready` path funnels through here before the tree reaches the panel, so
// this is the one place the ordering can own both the sort and the split.
function AvailablePackagesMetaFiltersGroup({
  children,
  state,
  totalAvailable,
}: RenderProps<AvailableFiltersStateInstance> & {
  state: AvailableFiltersStateInstance
  // The count *before* any filtering, which the caller still has. `state.facets
  // .available` is already narrowed on the client-filter path.
  totalAvailable: number
}) {
  // From the URL, not local state, so a shared link reproduces the panel the
  // sender was looking at and a reload does not silently reorder it.
  const model = useSearchUIModelContext(ResultType.QuiltPackage)
  const ordering = model.state.facetOrdering
  const setOrdering = model.actions.setFacetOrdering

  const available = AvailableFiltersState.match({
    Ready: (r) => r.facets.available,
    _: () => null,
  })(state)

  const grouped = React.useMemo(
    () => (available ? groupFacets(available, FACETS_VISIBLE, ordering) : null),
    [available, ordering],
  )

  const offered = totalAvailable >= FACET_ORDERING_THRESHOLD

  const orderingState = React.useMemo(
    () => ({ value: ordering, set: setOrdering, offered }),
    [ordering, setOrdering, offered],
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
            ordering: orderingState,
          })
        },
        _: (s) => s,
      })(state),
    [state, grouped, orderingState],
  )

  return children(stateOut)
}

export type SearchHitObject = Extract<
  GQL.DataForDoc<typeof FIRST_PAGE_OBJECTS_QUERY>['searchObjects'],
  { __typename: 'ObjectsSearchResultSet' }
>['firstPage']['hits'][number]

// `firstPage` is a union now (PackagesFirstPageResult): extract the success
// page arm before reaching for `hits` (see change package-metadata-sort,
// d-unsupported-error / d-typed-value).
export type SearchHitPackage = Extract<
  Extract<
    GQL.DataForDoc<typeof FIRST_PAGE_PACKAGES_QUERY>['searchPackages'],
    { __typename: 'PackagesSearchResultSet' }
  >['firstPage'],
  { __typename: 'PackagesSearchResultSetPage' }
>['hits'][number]

export type SearchHit = SearchHitObject | SearchHitPackage

type PackageUserMetaFacetFull = Extract<
  GQL.DataForDoc<typeof BASE_SEARCH_QUERY>['searchPackages'],
  { __typename: 'PackagesSearchResultSet' }
>['stats']['userMeta'][number]

export type PackageUserMetaFacet = Pick<
  PackageUserMetaFacetFull,
  'path' | '__typename' | 'sortable'
>

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

/**
 * The `visible`, `hidden` and `ordering` fields of a `Ready` state are all filled
 * in by `AvailablePackagesMetaFiltersGroup`, which every path funnels through
 * before the panel renders. Upstream constructors carry placeholders until it
 * does; this setter is unreachable rather than inert, since the real one always
 * replaces it.
 */
const PLACEHOLDER_ORDERING = {
  value: DEFAULT_FACET_ORDERING,
  set: () => {},
  offered: false,
}

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

const FACET_KEY_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

// Fields of one kind sit together, in the order a reader is likeliest to want
// them: the bounded, pickable types first (a keyword has a value list; a date and
// a number have a range), then free text, which can only be matched. A subtree is
// not one type, so it sorts after every leaf rather than claiming a bucket.
const FACET_TYPE_RANK: Record<PackageUserMetaFacet['__typename'], number> = {
  KeywordPackageUserMetaFacet: 0,
  DatetimePackageUserMetaFacet: 1,
  NumberPackageUserMetaFacet: 2,
  BooleanPackageUserMetaFacet: 3,
  TextPackageUserMetaFacet: 4,
}

const SUBTREE_RANK = 5

/**
 * Order sibling entries.
 *
 * By name: the key alone, so the level reads alphabetically.
 *
 * By type: the *leaf's own data type* first, then name within each type. It has to
 * read the node rather than the key -- a flat scalar field's key is `path:<name>`
 * with no type in it, so comparing keys made "by type" identical to "by name" on
 * exactly the common case (a package whose metadata is all top-level scalars).
 */
function compareFacetEntries(
  ordering: FacetOrdering,
  [aKey, aNode]: [string, FacetNode],
  [bKey, bNode]: [string, FacetNode],
): number {
  // The direction turns the names around, never the type buckets: "Type, Z → A"
  // means the names run backwards inside a type, not that free text now outranks a
  // keyword. Reversing the buckets too would make one pair of controls read as two
  // unrelated axes.
  if (ordering.by === 'type') {
    const rank = (n: FacetNode) =>
      n._tag === 'Leaf' ? FACET_TYPE_RANK[n.value.__typename] : SUBTREE_RANK
    const byType = rank(aNode) - rank(bNode)
    if (byType !== 0) return byType
  }
  const byName = FACET_KEY_COLLATOR.compare(aKey, bKey)
  return ordering.direction === 'desc' ? -byName : byName
}

/**
 * Sort every level of the tree, not just the top.
 *
 * The facets arrive in the aggregation's own order -- roughly the order fields
 * were first encountered while scanning documents -- which reads as arbitrary to
 * anyone looking for a field by name. Sorting here rather than at the render site
 * is what makes the *visible/hidden split* meaningful too: `groupFacets` promotes
 * the first `visible` children, so without a sort the five promoted filters are
 * whichever five the index happened to see first.
 */
function sortFacetTree(tree: FacetTree, ordering: FacetOrdering): FacetTree {
  const sorted = Array.from(tree.children)
    .map(([k, node]): [string, FacetNode] => [
      k,
      node._tag === 'Tree' ? sortFacetTree(node, ordering) : node,
    ])
    .sort((a, b) => compareFacetEntries(ordering, a, b))
  return KTree.Tree(sorted)
}

export function groupFacets(
  facets: readonly PackageUserMetaFacet[],
  visible?: number,
  ordering: FacetOrdering = DEFAULT_FACET_ORDERING,
): [FacetTree, FacetTree] {
  const merged = facets.reduce(
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
  const grouped = sortFacetTree(merged, ordering)
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

  // Set the ordering expression (null = relevance). One setter for both the
  // global "Sort by" dropdown and the per-column header sorts — they are one
  // logical "sort by" surfaced in two places, and now share one state field, so
  // whichever acts last wins with no reconciliation needed. Works for both
  // result types (objects map it to the enum at the query boundary).
  const setOrdering = React.useCallback(
    (ordering: Ordering) => {
      updateUrlState((s) => ({ ...s, ordering }))
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

  const setFacetOrdering = React.useCallback(
    (facetOrdering: FacetOrdering) => {
      updateUrlState((s) => ({ ...s, facetOrdering }))
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
    // `facetOrdering` survives a reset for the same reason `view` and `ordering`
    // do: reset clears what you searched for, not how you like the panel arranged.
    updateUrlState(({ resultType, ordering, view, facetOrdering }) => {
      const base = {
        searchString: null,
        buckets: [],
        ordering,
        view,
        facetOrdering,
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
        setOrdering,
        setResultType,
        setBuckets,
        setView,
        setFacetOrdering,

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
