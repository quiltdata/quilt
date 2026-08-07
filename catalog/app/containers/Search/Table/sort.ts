import assertNever from 'utils/assertNever'

import * as SearchUIModel from '../model'

import { ColumnTag } from './useColumns'
import type { Column, ColumnSystemMeta } from './useColumns'

export type SortDirection = 'asc' | 'desc'

// The sortable system fields, by their stable lowercase `filter` id (which is
// already the `sys:` field token — see Search/constants.ts). COMMENT is
// deliberately absent: it is a `text` field with no keyword subfield and ships
// unsortable (see change package-metadata-sort, d-unsupported-error). Any
// filter not listed here is not a sortable system field.
const SORTABLE_SYSTEM_FIELDS: ReadonlySet<ColumnSystemMeta['filter']> = new Set([
  'name',
  'modified',
  'size',
  'entries',
  'hash',
  'workflow',
])

// The facet-type token (`number | datetime | keyword | text | boolean`) a
// user-meta column's render type maps to, derived from the authoritative facet
// map so the two never drift. A demoted high-cardinality keyword renders as
// 'Text' yet is sortable — its token is `text`, which the server resolves
// against the pointer's keyword-backed storage (the ruled contingent-best-effort
// semantics), so no special-case is needed here.
function facetTypeToken(predicateType: SearchUIModel.KnownPredicate['_tag']): string {
  return SearchUIModel.PackageUserMetaFacetTypeInfo[predicateType].inputType.toLowerCase()
}

// The `PackageOrdering` field part a column maps to — everything but the
// direction: `sys:<field>` or `usr:<pointer>:<type>`. null when the column is
// not sortable: buckets are non-field, COMMENT/unlisted system fields are
// unsupported, and user-meta pointers whose stored ES subfield can't be sorted
// (analyzed text) are excluded via the facet's `sortable` signal. Gating on
// `sortable` — not on the render type — is deliberate: a high-cardinality
// keyword renders as a Text facet (predicateType 'Text') but sorts natively,
// so predicateType would wrongly hide the affordance (see qhq-spls.2). The
// all-revisions mode gate lives at the call site — it depends on model state,
// not the column alone.
export function getColumnOrderingBase(column: Column): string | null {
  switch (column.tag) {
    case ColumnTag.Bucket:
      return null
    case ColumnTag.SystemMeta:
      return SORTABLE_SYSTEM_FIELDS.has(column.filter) ? `sys:${column.filter}` : null
    case ColumnTag.UserMeta:
      if (!column.sortable) return null
      return `usr:${column.filter}:${facetTypeToken(column.predicateType)}`
    default:
      return assertNever(column)
  }
}

// Compose a full ordering expression from a column's field-part base + direction.
export function orderingForColumn(base: string, direction: SortDirection): string {
  return `${base}:${direction}`
}

// The active ordering's state relative to a column: whether it targets this
// column and, if so, its direction. A preset/relevance ordering never lights up
// a column — those live in the global dropdown.
export function columnSortState(
  base: string | null,
  ordering: SearchUIModel.Ordering,
): { active: boolean; descending: boolean } {
  if (!base || !ordering) return { active: false, descending: false }
  if (ordering === orderingForColumn(base, 'asc'))
    return { active: true, descending: false }
  if (ordering === orderingForColumn(base, 'desc'))
    return { active: true, descending: true }
  return { active: false, descending: false }
}
