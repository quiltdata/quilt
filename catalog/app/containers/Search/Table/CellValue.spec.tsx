import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'

import { bucketPackageTree } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import CellValue from './CellValue'
import { ColumnTag, type ColumnSystemMeta } from './useColumns'
import type { Hit } from './useResults'

jest.mock('constants/config', () => ({}))

const hitBase = {
  bucket: 'foo',
  name: 'pkg/name',
  hash: '1234567890abcdef',
  matchLocations: {
    name: false,
  },
  // ...mock rest of the data if necessary
} as Omit<Hit, 'pointer'>

const column = {
  tag: ColumnTag.SystemMeta as const,
  filter: 'name' as const,
  // ...mock rest of the data if necessary
} as ColumnSystemMeta

describe('containers/Search/Table/CellValue', () => {
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
})
