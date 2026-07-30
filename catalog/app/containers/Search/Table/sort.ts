import assertNever from 'utils/assertNever'

import * as SearchUIModel from '../model'

import { ColumnTag } from './useColumns'
import type { Column, ColumnSystemMeta } from './useColumns'

// Map a system column's stable `filter` id to its `PackageSystemField` enum
// value. COMMENT is deliberately absent: it is a `text` field with no keyword
// subfield and ships unsortable (see change package-metadata-sort,
// d-unsupported-error). Any filter not listed here is not a sortable system
// field.
const SYSTEM_SORT_FIELDS: Partial<
  Record<ColumnSystemMeta['filter'], SearchUIModel.PackageSystemField>
> = {
  name: SearchUIModel.PackageSystemField.NAME,
  modified: SearchUIModel.PackageSystemField.MODIFIED,
  size: SearchUIModel.PackageSystemField.SIZE,
  entries: SearchUIModel.PackageSystemField.ENTRIES,
  hash: SearchUIModel.PackageSystemField.HASH,
  workflow: SearchUIModel.PackageSystemField.WORKFLOW,
}

// The `PackageSortField` a column maps to, or null when the column is not
// sortable: buckets are non-field, COMMENT/unlisted system fields are
// unsupported, and user-meta pointers whose stored ES subfield can't be sorted
// (analyzed text) are excluded via the facet's `sortable` signal. Gating on
// `sortable` — not on the render type — is deliberate: a high-cardinality
// keyword renders as a Text facet (predicateType 'Text') but sorts natively,
// so predicateType would wrongly hide the affordance (see qhq-spls.2). The
// all-revisions mode gate lives at the call site — it depends on model state,
// not the column alone.
export function getColumnSortField(
  column: Column,
): SearchUIModel.PackageSort['field'] | null {
  switch (column.tag) {
    case ColumnTag.Bucket:
      return null
    case ColumnTag.SystemMeta: {
      const system = SYSTEM_SORT_FIELDS[column.filter]
      return system ? { system, userMeta: null } : null
    }
    case ColumnTag.UserMeta:
      if (!column.sortable) return null
      return { system: null, userMeta: column.filter }
    default:
      return assertNever(column)
  }
}

// Does the active `sort.field` target this column? Preset sorts (sort.field
// null) never light up a column — they live in the global dropdown.
export function isColumnSorted(
  field: SearchUIModel.PackageSort['field'],
  active: SearchUIModel.PackageSort | null,
): boolean {
  if (!field || !active?.field) return false
  return active.field.system === field.system && active.field.userMeta === field.userMeta
}
