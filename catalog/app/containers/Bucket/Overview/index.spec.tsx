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

vi.mock('utils/CatalogSettings', () => ({
  use: () => settingsHook(),
}))

describe('Bucket/Overview', () => {
  afterEach(cleanup)

  it('renders v2 Overview when the beta flag is on', () => {
    settingsHook.mockReturnValue({ beta: true })
    const { queryByText } = render(<Overview />)
    expect(queryByText('V2')).toBeTruthy()
    expect(queryByText('LEGACY')).toBeFalsy()
  })

  it('renders legacy Overview when the beta flag is off', () => {
    settingsHook.mockReturnValue({ beta: false })
    const { queryByText } = render(<Overview />)
    expect(queryByText('LEGACY')).toBeTruthy()
    expect(queryByText('V2')).toBeFalsy()
  })

  it('renders legacy Overview when there are no catalog settings', () => {
    settingsHook.mockReturnValue(null)
    const { queryByText } = render(<Overview />)
    expect(queryByText('LEGACY')).toBeTruthy()
    expect(queryByText('V2')).toBeFalsy()
  })
})
