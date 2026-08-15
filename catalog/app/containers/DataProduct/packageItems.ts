import type { Hit as SearchTableHit } from 'containers/Search/Table/Table'
import type { SearchHitPackage } from 'containers/Search/model'

import type { containers_DataProduct_gql_DataProductQuery as DataProductQuery } from './gql/DataProduct.generated'

// Shaping the DP's in-hand package members into the search-hit rows the shared
// listing leaves consume. Pure, data-source-agnostic transforms — kept out of
// the component tree so their pin-matching / fallback semantics are unit
// testable.

type DataProductRaw = NonNullable<DataProductQuery['dataProduct']>
type Members = Extract<DataProductRaw['members'], { __typename: 'DataProductMembers' }>
export type PackageMember = Members['packages'][number]

export type MemberRevision = NonNullable<PackageMember['resolvedRevision']>

// The revision this member resolved to, straight from the registry: the pin
// when the member is pinned, latest-at-resolution when it is not.
//
// This used to be a client-side guess. The query could only dereference
// `package.revision` at "latest" (GraphQL has no per-list-item arguments), so
// the client compared that hash against the member's pin and discarded the
// stats when they disagreed — which meant a pinned member showed blank size,
// entries, comment and meta whenever it was not also the latest revision.
// `resolvedRevision` is the server answering the question directly, so those
// cells are now populated for pinned members too.
export const effectiveRevision = (member: PackageMember): MemberRevision | null =>
  member.resolvedRevision ?? null

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
// `id` and is rendered via `displayName`. When the member did not resolve to a
// revision at all, `modified` falls back to the package-level date and the
// revision-sourced cells (size, entries, comment, workflow, meta) render as
// unknown/empty.
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
