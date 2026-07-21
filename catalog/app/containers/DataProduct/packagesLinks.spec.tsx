import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  bucketFile,
  bucketPackageDetail,
  bucketPackageList,
  bucketPackageTree,
  dataProduct,
  dataProductPackage,
} from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as SearchHits from 'containers/Search/List/Hit'
import { ColumnTag, PackageRow } from 'containers/Search/Table/Table'
import type { Column, Hit, PackageLinkBuilder } from 'containers/Search/Table/Table'
import type { SearchHitPackage } from 'containers/Search/model'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('components/Preview', () => ({}))

// The DP Packages tab re-roots every listing-leaf link through the members'
// PackageLinkBuilder (see DataProduct useMemberLinks) so navigation stays under
// /data-products/:id — never a physical /b/<bucket>/ route. These leaves take
// `links` as OPTIONAL and silently fall back to bucket routes when it's
// omitted, so this pins the invariant: with the DP builder, every rendered
// href is DP-local; without it, they leak /b/ (the guarded footgun).

const NO_MATCH = {
  __typename: 'SearchHitPackageMatchLocations',
  comment: false,
  meta: false,
  name: false,
  workflow: false,
} as const

// A member's physical identity — the link builder alone keeps navigation
// DP-local, so if any leaf reached for a bucket route it would surface here.
const cardHit = {
  __typename: 'SearchHitPackage',
  id: 'virtual/name',
  bucket: 'phys-bucket',
  name: 'phys/pkg',
  pointer: 'latest',
  hash: '1234567890abcdef',
  score: 0,
  size: 42,
  modified: new Date('2020-01-01T00:00:00Z'),
  totalEntriesCount: 3,
  comment: null,
  meta: null,
  workflow: null,
  matchLocations: NO_MATCH,
  matchingEntries: [],
} as SearchHitPackage

const entry = {
  __typename: 'SearchHitPackageMatchingEntry',
  logicalKey: 'data/file.csv',
  physicalKey: 's3://phys-bucket/data/file.csv',
  size: 10,
  meta: null,
  matchLocations: {
    __typename: 'SearchHitPackageEntryMatchLocations',
    logicalKey: false,
    physicalKey: false,
    meta: false,
    contents: false,
  },
}

// One matching entry with a higher total forces the entries drawer to render
// its per-entry links AND the "N more entries" package-detail link — exercising
// the packageEntry / physicalObject / packageDetail builders too.
const tableHit = {
  ...cardHit,
  meta: null,
  matchingEntries: [entry],
} as unknown as Hit

const colState = { filtered: false, visible: true, inferred: false }

// name / hash / bucket cells exercise the packageRoot, manifest and bucket
// builders (hash + bucket go beyond the DP tab's default columns on purpose, to
// pin the whole seam, not only the columns in use today).
const columns = [
  {
    tag: ColumnTag.SystemMeta,
    filter: 'name',
    predicateType: 'KeywordWildcard',
    title: 'Name',
    fullTitle: 'Name',
    state: colState,
  },
  {
    tag: ColumnTag.SystemMeta,
    filter: 'hash',
    predicateType: 'Text',
    title: 'Hash',
    fullTitle: 'Hash',
    state: colState,
  },
  {
    tag: ColumnTag.Bucket,
    filter: 'bucket',
    title: 'Bucket',
    fullTitle: 'Bucket',
    state: colState,
  },
] as unknown as Column[]

// Mirror of DataProduct useMemberLinks: every target stays under
// /data-products/:id.
const dpLinks = (id: string, virtualName: string): PackageLinkBuilder => {
  const root = dataProductPackage.url(id, virtualName)
  return {
    packageRoot: () => root,
    packageDetail: () => root,
    packageEntry: (_handle, logicalKey) =>
      dataProductPackage.url(id, virtualName, logicalKey),
    manifest: () => root,
    physicalObject: () => root,
    bucket: () => dataProduct.url(id),
  }
}

// Bucket routes are provided so the *fallback* (links omitted) resolves to real
// /b/ urls — the negative test relies on them.
const routes = {
  dataProduct,
  dataProductPackage,
  bucketFile,
  bucketPackageDetail,
  bucketPackageList,
  bucketPackageTree,
}

function renderSubtrees(links?: PackageLinkBuilder) {
  return render(
    <MemoryRouter>
      <NamedRoutes.Provider routes={routes}>
        <SearchHits.Package
          hit={cardHit}
          displayName="virtual/name"
          links={links}
          noS3Links
        />
        <table>
          <tbody>
            <PackageRow
              hit={tableHit}
              columnsList={columns}
              displayName="virtual/name"
              links={links}
            />
          </tbody>
        </table>
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

// Expand the matching-entries drawer so the Entries seam renders its links too.
function expandEntries(container: HTMLElement) {
  const row = container.querySelector('tbody tr')
  if (row) fireEvent.click(row)
}

const hrefsOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('a[href]')).map(
    (a) => a.getAttribute('href') ?? '',
  )

describe('containers/DataProduct package listing links', () => {
  afterEach(cleanup)

  it('keeps every listing-leaf href DP-local when the DP link builder is passed', () => {
    const { container } = renderSubtrees(dpLinks('dp-1', 'virtual/name'))
    expandEntries(container)

    const hrefs = hrefsOf(container)
    expect(hrefs.length).toBeGreaterThan(0)
    hrefs.forEach((href) => {
      expect(href.startsWith('/data-products/')).toBe(true)
      expect(href.startsWith('/b/')).toBe(false)
    })
  })

  it('falls back to /b/ bucket routes when links is omitted (the guarded footgun)', () => {
    const { container } = renderSubtrees(undefined)
    expandEntries(container)

    const hrefs = hrefsOf(container)
    expect(hrefs.some((href) => href.startsWith('/b/'))).toBe(true)
    expect(hrefs.some((href) => href.startsWith('/data-products/'))).toBe(false)
  })
})
