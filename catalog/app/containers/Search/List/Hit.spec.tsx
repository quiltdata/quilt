import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import * as M from '@material-ui/core'
import { render, cleanup, fireEvent } from '@testing-library/react'

import { bucketFile, bucketPackageTree } from 'constants/routes'
import * as style from 'constants/style'
import * as NamedRoutes from 'utils/NamedRoutes'

import type { SearchHitObject, SearchHitPackage } from '../model'

import { Package, Object as HitObject } from './Hit'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('components/Preview', () => ({}))

// jsdom has no execCommand, and what matters here is the value handed to the
// clipboard -- the whole point of the affordance is that it's the FULL id, not
// the truncated thing on screen.
const { copyToClipboard } = vi.hoisted(() => ({ copyToClipboard: vi.fn() }))
vi.mock('utils/clipboard', () => ({ default: copyToClipboard }))

const hitBase = {
  id: 'unique-id',
  bucket: 'foo',
  name: 'pkg/name',
  hash: '1234567890abcdef',
  modified: new Date(),
  // ...mock the rest of the data if necessary
} as Omit<SearchHitPackage, 'pointer'>

const renderIn = (ui: React.ReactNode) =>
  render(
    // The ambient app theme, as app.tsx provides it: the id readouts style
    // themselves from the theme's `typography.monospace` extension.
    <M.MuiThemeProvider theme={style.appTheme}>
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketPackageTree, bucketFile }}>
          {ui}
        </NamedRoutes.Provider>
      </MemoryRouter>
    </M.MuiThemeProvider>,
  )

describe('containers/Search/List/Hit/Package', () => {
  afterEach(() => {
    cleanup()
    copyToClipboard.mockClear()
  })

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

  // The verification moment: a scientist citing this package needs the exact
  // hash. Truncated + proportional + no copy is what sent them to screenshots.
  describe('the revision hash', () => {
    const hit = { ...hitBase, pointer: '123456' }

    it('renders truncated, in the mono face (Mono Identity Rule)', () => {
      const { getByText } = renderIn(<Package hit={hit} showRevision />)
      const shown = getByText('12345678')
      expect(getComputedStyle(shown).fontFamily).toMatch(/Roboto Mono/)
    })

    it('copies the FULL hash, not the truncated display value', () => {
      const { getByRole } = renderIn(<Package hit={hit} showRevision />)
      fireEvent.click(getByRole('button', { name: 'Copy revision hash' }))
      expect(copyToClipboard).toHaveBeenCalledWith('1234567890abcdef')
    })

    it('confirms in place after copying', () => {
      const { getByRole, getByText } = renderIn(<Package hit={hit} showRevision />)
      fireEvent.click(getByRole('button', { name: 'Copy revision hash' }))
      expect(getByText('check')).toBeTruthy()
    })

    it('is absent when the hit does not show a revision', () => {
      const { queryByRole } = renderIn(<Package hit={hit} />)
      expect(queryByRole('button', { name: 'Copy revision hash' })).toBeNull()
    })
  })
})

describe('containers/Search/List/Hit/Object', () => {
  afterEach(() => {
    cleanup()
    copyToClipboard.mockClear()
  })

  const objectHit = {
    id: 'object-id',
    bucket: 'foo',
    key: 'path/to/object.csv',
    version: 'abcdefghijklmnop',
    size: 0,
    deleted: false,
    modified: new Date(),
  } as SearchHitObject

  it('copies the FULL version id behind its truncated readout', () => {
    const { getByRole, getByText } = renderIn(<HitObject hit={objectHit} />)
    expect(getByText('v.abcd')).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Copy version ID' }))
    expect(copyToClipboard).toHaveBeenCalledWith('abcdefghijklmnop')
  })
})
