import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'

import { bucketPackageTree } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import type { SearchHitPackage } from '../model'

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
})
