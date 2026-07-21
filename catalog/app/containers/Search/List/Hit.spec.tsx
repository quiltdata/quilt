import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'

import { bucketPackageTree } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import type { SearchHitPackage } from '../model'
import type { PackageLinkBuilder } from '../Table/links'

import { Package } from './Hit'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('components/Preview', () => ({}))

const hitBase = {
  id: 'unique-id',
  bucket: 'foo',
  name: 'pkg/name',
  hash: '1234567890abcdef',
  modified: new Date(),
  // ...mock the rest of the data if necessary
} as Omit<SearchHitPackage, 'pointer'>

describe('containers/Search/List/Hit/Package', () => {
  afterEach(cleanup)

  it('renders with pointer "latest"', () => {
    const hit = { ...hitBase, pointer: 'latest' }

    const { getByRole } = render(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketPackageTree }}>
          <Package hit={hit} />
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
          <Package hit={hit} />
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    expect(getByRole('link').getAttribute('href')).toBe(
      '/b/foo/packages/pkg/name/tree/1234567890abcdef/',
    )
  })

  it('renders displayName while keeping the physical link target', () => {
    const hit = { ...hitBase, pointer: 'latest' }

    const { getByRole, getByText } = render(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketPackageTree }}>
          <Package hit={hit} displayName="virtual/name" />
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    expect(getByText('virtual/name')).toBeTruthy()
    expect(getByRole('link').getAttribute('href')).toBe('/b/foo/packages/pkg/name')
  })

  it('builds the link with the provided PackageLinkBuilder', () => {
    const hit = { ...hitBase, pointer: 'latest' }
    const links: PackageLinkBuilder = {
      packageRoot: ({ name }, pointer) => `/dp/id/packages/${name}@${pointer}`,
      packageDetail: ({ name }) => `/dp/id/packages/${name}/detail`,
      packageEntry: ({ name }, logicalKey) => `/dp/id/packages/${name}/${logicalKey}`,
      manifest: ({ hash }) => `/dp/id/manifests/${hash}`,
      physicalObject: ({ key }) => `/dp/id/objects/${key}`,
      bucket: (bucket) => `/dp/id/buckets/${bucket}`,
    }

    const { getByRole } = render(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketPackageTree }}>
          <Package hit={hit} links={links} />
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    expect(getByRole('link').getAttribute('href')).toBe('/dp/id/packages/pkg/name@latest')
  })
})
