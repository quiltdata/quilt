import * as React from 'react'
import { describe, it, expect, vi, afterEach, type Mock } from 'vitest'
import { render, cleanup } from '@testing-library/react'

import * as BucketPreferences from 'utils/BucketPreferences'
import { parse } from 'utils/BucketPreferences/BucketPreferences'

import Overview from './index'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('./Overview', () => ({
  default: () => <div>LEGACY</div>,
}))

vi.mock('./v2/Overview', () => ({
  default: () => <div>V2</div>,
}))

const prefsHook: Mock<() => { prefs: BucketPreferences.Result }> = vi.fn(() => ({
  prefs: BucketPreferences.Result.Init(),
}))

vi.mock('utils/BucketPreferences', async () => ({
  ...(await vi.importActual('utils/BucketPreferences')),
  use: () => prefsHook(),
}))

function mkPrefs(overviewV2: boolean): BucketPreferences.Result {
  const prefs = parse(`ui:\n  blocks:\n    overviewV2: ${overviewV2}\n`, 'test-bucket')
  return BucketPreferences.Result.Ok(prefs)
}

describe('Bucket/Overview', () => {
  afterEach(cleanup)

  it('renders v2 Overview when overviewV2 preference is true', () => {
    prefsHook.mockReturnValue({ prefs: mkPrefs(true) })
    const { queryByText } = render(<Overview />)
    expect(queryByText('V2')).toBeTruthy()
    expect(queryByText('LEGACY')).toBeFalsy()
  })

  it('renders legacy Overview when overviewV2 preference is false', () => {
    prefsHook.mockReturnValue({ prefs: mkPrefs(false) })
    const { queryByText } = render(<Overview />)
    expect(queryByText('LEGACY')).toBeTruthy()
    expect(queryByText('V2')).toBeFalsy()
  })

  it('renders neither v2 nor legacy while prefs are pending', () => {
    prefsHook.mockReturnValue({ prefs: BucketPreferences.Result.Pending() })
    const { queryByText } = render(<Overview />)
    expect(queryByText('V2')).toBeFalsy()
    expect(queryByText('LEGACY')).toBeFalsy()
  })

  it('renders neither v2 nor legacy while prefs are uninitialized', () => {
    prefsHook.mockReturnValue({ prefs: BucketPreferences.Result.Init() })
    const { queryByText } = render(<Overview />)
    expect(queryByText('V2')).toBeFalsy()
    expect(queryByText('LEGACY')).toBeFalsy()
  })
})
