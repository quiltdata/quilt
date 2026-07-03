import * as JSONPointer from 'utils/JSONPointer'
import type { Json, JsonRecord } from 'utils/types'

// Client-side stand-ins for the search model's user-meta facets: the available
// meta paths, their types and the filter grammar are all derived from the
// loaded members' `userMeta` payloads — a fixed in-hand list, no ElasticSearch.
// The predicate tags are the subset inferable from JSON leaf values; they feed
// the shared table's Column shape (which uses them for alignment only here).

export type MetaPredicateType = 'Number' | 'Boolean' | 'Text'

export interface MetaColumnSpec {
  pointer: JSONPointer.Pointer
  // the pointer sans leading slash — same display rule as the search table
  title: string
  predicateType: MetaPredicateType
  // members carrying a value at this path
  count: number
}

export interface MetaColumns {
  // sorted by coverage (desc), then pointer (asc) — "leading" paths first
  specs: MetaColumnSpec[]
  // members with meta in hand at all — the denominator for the coverage
  // heuristic (pinned/undereferenced members don't dilute it)
  total: number
}

type LeafKind = 'number' | 'boolean' | 'other'

const isJsonRecord = (value: unknown): value is JsonRecord =>
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Error)

// Uniform numbers/booleans across members read as typed columns
// (right-aligned); anything mixed or stringly stays Text. Nulls don't sway the
// inference.
const inferPredicateType = (kinds: Set<LeafKind>): MetaPredicateType => {
  if (kinds.size !== 1) return 'Text'
  if (kinds.has('number')) return 'Number'
  if (kinds.has('boolean')) return 'Boolean'
  return 'Text'
}

// Flattens every meta object into JSON-pointer leaf paths (the shape the
// search facets use): plain non-empty objects recurse; everything else —
// scalars, arrays, empty objects — is a leaf value at its path.
export function deriveMetaColumns(
  metas: readonly (JsonRecord | Error | null | undefined)[],
): MetaColumns {
  const acc = new Map<JSONPointer.Pointer, { count: number; kinds: Set<LeafKind> }>()
  const record = (path: JSONPointer.Path, value: Json) => {
    const pointer = JSONPointer.stringify(path)
    let entry = acc.get(pointer)
    if (!entry) {
      entry = { count: 0, kinds: new Set() }
      acc.set(pointer, entry)
    }
    entry.count += 1
    if (typeof value === 'number') entry.kinds.add('number')
    else if (typeof value === 'boolean') entry.kinds.add('boolean')
    else if (value !== null) entry.kinds.add('other')
  }
  const walk = (value: Json, path: JSONPointer.Path) => {
    if (isJsonRecord(value) && Object.keys(value).length) {
      Object.entries(value).forEach(([k, v]) => walk(v, [...path, k]))
    } else if (path.length) {
      record(path, value)
    }
  }
  let total = 0
  metas.forEach((meta) => {
    if (!isJsonRecord(meta)) return
    total += 1
    walk(meta, [])
  })
  const specs = Array.from(acc, ([pointer, { count, kinds }]) => ({
    pointer,
    title: pointer.replace(/^\//, ''),
    predicateType: inferPredicateType(kinds),
    count,
  }))
  specs.sort((a, b) => b.count - a.count || a.pointer.localeCompare(b.pointer))
  return { specs, total }
}

// How many meta columns show by default (the "leading few" next to the base
// system-meta columns).
const DEFAULT_VISIBLE_META = 3

// Default-visible meta columns: paths present on most members — a strict
// majority of the members with meta in hand — capped at the leading few by
// coverage. The rest stay available through the Columns menu.
export function defaultVisibleMeta({
  specs,
  total,
}: MetaColumns): Set<JSONPointer.Pointer> {
  return new Set(
    specs
      .filter((s) => s.count * 2 > total)
      .slice(0, DEFAULT_VISIBLE_META)
      .map((s) => s.pointer),
  )
}

export interface MetaTermMatcher {
  // every spec pointer the term's key resolves to (empty: unresolved key —
  // matches nothing)
  pointers: JSONPointer.Pointer[]
  // lowercased; empty means "has any value at this path"
  value: string
}

export interface CompiledFilter {
  // lowercased free-text terms, AND-ed over the member's names
  nameTerms: string[]
  // AND-ed over the member's meta
  metaTerms: MetaTermMatcher[]
}

// The filter-field grammar: whitespace-separated terms; a term containing a
// colon is a meta term `key:value` (split at the first colon, so values may
// contain colons), everything else filters names. A meta key resolves against
// the derived paths by full path (pointer sans leading slash) or by last
// segment, case-insensitively.
export function compileFilter(
  input: string,
  specs: readonly MetaColumnSpec[],
): CompiledFilter {
  const nameTerms: string[] = []
  const metaTerms: MetaTermMatcher[] = []
  input
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .forEach((term) => {
      const colon = term.indexOf(':')
      if (colon === -1) {
        nameTerms.push(term)
        return
      }
      const key = term.slice(0, colon)
      const value = term.slice(colon + 1)
      const pointers = specs
        .filter(
          (s) =>
            s.title.toLowerCase() === key ||
            s.pointer.toLowerCase().split('/').pop() === key,
        )
        .map((s) => s.pointer)
      metaTerms.push({ pointers, value })
    })
  return { nameTerms, metaTerms }
}

// How a leaf value reads for substring matching: strings as-is, scalars via
// String, arrays/objects via JSON (so `tags:foo` finds "foo" inside a list);
// null matches only a bare presence check.
const leafToString = (value: Json): string => {
  switch (typeof value) {
    case 'string':
      return value
    case 'number':
    case 'boolean':
      return String(value)
    default:
      return value === null ? '' : JSON.stringify(value)
  }
}

// True when the member's meta satisfies every meta term: some resolved pointer
// holds a value containing the term's value (case-insensitive substring; an
// empty value is a presence check). Members without meta in hand (pinned
// fallback, undereferenced package) match only when there are no meta terms.
export function matchMeta(
  terms: readonly MetaTermMatcher[],
  meta: JsonRecord | Error | null | undefined,
): boolean {
  if (!terms.length) return true
  if (!isJsonRecord(meta)) return false
  return terms.every(({ pointers, value }) =>
    pointers.some((pointer) => {
      const v = JSONPointer.getValue(meta, pointer)
      if (v === undefined) return false
      return !value || leafToString(v).toLowerCase().includes(value)
    }),
  )
}
