import * as React from 'react'
import { describe, it, expect, vi, afterEach, type Mock } from 'vitest'
import { render, cleanup } from '@testing-library/react'

import type * as CatalogSettings from 'utils/CatalogSettings'

import Overview from './index'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('./Overview', () => ({
  default: () => <div>LEGACY</div>,
}))

vi.mock('./v2/Overview', () => ({
  default: () => <div>V2</div>,
}))

const settingsHook: Mock<() => CatalogSettings.CatalogSettings | null> = vi.fn(() => null)

// `useBetaEnabled` carries the unset-means-on default, so the mock delegates to
// the real `isBetaEnabled` rather than restating it — otherwise these tests
// assert the mock's opinion of the default, not the module's.
vi.mock('utils/CatalogSettings', async () => {
  const actual = await vi.importActual<typeof CatalogSettings>('utils/CatalogSettings')
  return {
    use: () => settingsHook(),
    isBetaEnabled: actual.isBetaEnabled,
    useBetaEnabled: () => actual.isBetaEnabled(settingsHook()),
  }
})

describe('Bucket/Overview', () => {
  afterEach(cleanup)

  it('renders v2 Overview when the beta flag is on', () => {
    settingsHook.mockReturnValue({ beta: true })
    const { queryByText } = render(<Overview />)
    expect(queryByText('V2')).toBeTruthy()
    expect(queryByText('LEGACY')).toBeFalsy()
  })

  it('renders legacy Overview when the beta flag is explicitly off', () => {
    settingsHook.mockReturnValue({ beta: false })
    const { queryByText } = render(<Overview />)
    expect(queryByText('LEGACY')).toBeTruthy()
    expect(queryByText('V2')).toBeFalsy()
  })

  it('renders v2 Overview when the beta flag is unset', () => {
    settingsHook.mockReturnValue({})
    const { queryByText } = render(<Overview />)
    expect(queryByText('V2')).toBeTruthy()
    expect(queryByText('LEGACY')).toBeFalsy()
  })

  it('renders v2 Overview when there are no catalog settings', () => {
    settingsHook.mockReturnValue(null)
    const { queryByText } = render(<Overview />)
    expect(queryByText('V2')).toBeTruthy()
    expect(queryByText('LEGACY')).toBeFalsy()
  })
})
