import type { Hit as SearchTableHit } from 'containers/Search/Table/Table'
import type { SearchHitPackage } from 'containers/Search/model'

import type { containers_DataProduct_gql_DataProductQuery as DataProductQuery } from './gql/DataProduct.generated'

// Shaping the DP's in-hand package members into the search-hit rows the shared
// listing leaves consume. Pure, data-source-agnostic transforms — kept out of
// the component tree so their pin-matching / fallback semantics are unit
// testable.

type DataProduct = NonNullable<DataProductQuery['dataProduct']>
export type PackageMember = DataProduct['members']['packages'][number]

export type MemberRevision = NonNullable<
  NonNullable<PackageMember['package']>['revision']
>

// The members query dereferences `package.revision` at the default "latest" —
// GraphQL cannot pass a per-member pin inside one list selection. That latest
// revision stands in as the member's effective revision only when the member
// is unpinned, or its pin names that same revision (a full hash, or a >= 6
// char short-hash prefix); otherwise the stats in hand describe a different
// revision and must not be shown.
export function effectiveRevision(member: PackageMember): MemberRevision | null {
  const latest = member.package?.revision
  if (!latest) return null
  const pin = member.hashOrTag
  if (!pin) return latest
  return latest.hash === pin || (pin.length >= 6 && latest.hash.startsWith(pin))
    ? latest
    : null
}

// Members are a fixed list, not search results, so nothing ever highlights.
const NO_MATCH_LOCATIONS: SearchHitPackage['matchLocations'] = {
  __typename: 'SearchHitPackageMatchLocations',
  comment: false,
  meta: false,
  name: false,
  workflow: false,
}

// A member shaped as a search hit for the shared package-listing leaves, plus
// what the tab itself needs. `hit.name` stays the physical package name (the
// link builder alone keeps navigation DP-local); the virtual name rides in
// `id` and is rendered via `displayName`. When the effective revision is not
// in hand (see effectiveRevision), `modified` falls back to the package-level
// date and the revision-sourced cells (size, entries, comment, workflow,
// meta) render as unknown/empty.
export interface PackageItem {
  member: PackageMember
  modified: Date | null
  // null: the member's package didn't dereference (fallback row/card instead)
  hit: SearchHitPackage | null
  tableHit: SearchTableHit | null
}

export function toPackageItem(member: PackageMember): PackageItem {
  const pkg = member.package
  if (!pkg) return { member, modified: null, hit: null, tableHit: null }
  const rev = effectiveRevision(member)
  const modified = rev?.modified ?? pkg.modified
  const hit: SearchHitPackage = {
    __typename: 'SearchHitPackage',
    id: member.virtualName,
    bucket: member.bucket,
    name: member.name,
    pointer: member.hashOrTag ?? 'latest',
    hash: rev?.hash ?? member.hashOrTag ?? '',
    score: 0,
    // A nullish size renders as '?' and a nullish entries count as blank —
    // honest "unknown" cells for a pinned member (the fields are typed
    // non-null only because search always has them).
    size: rev?.totalBytes ?? (null as unknown as number),
    modified,
    totalEntriesCount: rev?.totalEntries ?? (null as unknown as number),
    comment: rev?.message ?? null,
    // The card leaf expects the search wire format: meta as a JSON string.
    meta: rev?.userMeta ? JSON.stringify(rev.userMeta) : null,
    workflow: rev?.workflow?.id ? { id: rev.workflow.id } : null,
    matchLocations: NO_MATCH_LOCATIONS,
    matchingEntries: [],
  }
  return { member, modified, hit, tableHit: { ...hit, meta: rev?.userMeta ?? null } }
}
