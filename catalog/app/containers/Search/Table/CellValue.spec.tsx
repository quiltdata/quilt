import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { bucketPackageTree } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import CellValue from './CellValue'
import { ColumnTag, type ColumnSystemMeta } from './useColumns'
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

const commentColumn = {
  tag: ColumnTag.SystemMeta as const,
  filter: 'comment' as const,
  // ...mock the rest of the data if necessary
} as ColumnSystemMeta

const renderComment = (comment: string) => {
  const hit = {
    ...hitBase,
    pointer: 'latest',
    comment,
    matchLocations: { ...hitBase.matchLocations, comment: false },
  } as Hit
  return render(
    <MemoryRouter>
      <NamedRoutes.Provider routes={{ bucketPackageTree }}>
        <CellValue column={commentColumn} hit={hit} />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
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

  it('renders a commit message', () => {
    const { container } = renderComment('a real commit message')

    expect(container.textContent).toBe('a real commit message')
  })

  // The registry serializes a package with no commit message as the string
  // 'None', which must read as absent rather than as that literal text.
  it('renders a "None" commit message as no value', () => {
    const { container } = renderComment('None')

    expect(container.textContent).toBe('')
  })

  it('renders an empty commit message as no value', () => {
    const { container } = renderComment('')

    expect(container.textContent).toBe('')
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
