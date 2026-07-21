import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { bucketPackageTree } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import CellValue from './CellValue'
import type { PackageLinkBuilder } from './links'
import { ColumnTag, type ColumnBucket, type ColumnSystemMeta } from './useColumns'
import type { Hit } from './useResults'

vi.mock('constants/config', () => ({ default: {} }))

const hitBase = {
  bucket: 'foo',
  name: 'pkg/name',
  hash: '1234567890abcdef',
  matchLocations: {
    name: false,
  },
  // ...mock the rest of the data if necessary
} as Omit<Hit, 'pointer'>

const column = {
  tag: ColumnTag.SystemMeta as const,
  filter: 'name' as const,
  // ...mock the rest of the data if necessary
} as ColumnSystemMeta

const stubLinks: PackageLinkBuilder = {
  packageRoot: ({ name }, pointer) => `/dp/id/packages/${name}@${pointer}`,
  packageDetail: ({ name }) => `/dp/id/packages/${name}/detail`,
  packageEntry: ({ name }, logicalKey) => `/dp/id/packages/${name}/${logicalKey}`,
  manifest: ({ hash }) => `/dp/id/manifests/${hash}`,
  physicalObject: ({ key }) => `/dp/id/objects/${key}`,
  bucket: (bucket) => `/dp/id/buckets/${bucket}`,
}

describe('containers/Search/Table/CellValue', () => {
  afterEach(cleanup)

  it('renders with pointer "latest"', () => {
    const hit = { ...hitBase, pointer: 'latest' }

    const { getByRole } = render(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketPackageTree }}>
          <CellValue column={column} hit={hit} />
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    expect(getByRole('link').getAttribute('href')).toBe('/b/foo/packages/pkg/name')
  })

  it('renders with pointer "123456"', () => {
    const hit = { ...hitBase, pointer: '123456' }

    const { getByRole } = render(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketPackageTree }}>
          <CellValue column={column} hit={hit} />
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    expect(getByRole('link').getAttribute('href')).toBe(
      '/b/foo/packages/pkg/name/tree/1234567890abcdef/',
    )
  })

  it('renders displayName while keeping the physical link target', () => {
    const hit = { ...hitBase, pointer: 'latest' }

    const { getByRole } = render(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketPackageTree }}>
          <CellValue column={column} hit={hit} displayName="virtual/name" />
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    const link = getByRole('link')
    expect(link.textContent).toBe('virtual/name')
    expect(link.getAttribute('href')).toBe('/b/foo/packages/pkg/name')
  })

  it('builds the name link with the provided PackageLinkBuilder', () => {
    const hit = { ...hitBase, pointer: 'latest' }

    const { getByRole } = render(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketPackageTree }}>
          <CellValue column={column} hit={hit} links={stubLinks} />
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    expect(getByRole('link').getAttribute('href')).toBe('/dp/id/packages/pkg/name@latest')
  })

  it('builds the bucket link with the provided PackageLinkBuilder', () => {
    const hit = { ...hitBase, pointer: 'latest' }
    const bucketColumn = {
      tag: ColumnTag.Bucket as const,
      filter: 'bucket' as const,
      // ...mock the rest of the data if necessary
    } as ColumnBucket

    const { getByRole } = render(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketPackageTree }}>
          <CellValue column={bucketColumn} hit={hit} links={stubLinks} />
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    const link = getByRole('link')
    expect(link.textContent).toBe('foo')
    expect(link.getAttribute('href')).toBe('/dp/id/buckets/foo')
  })
})
