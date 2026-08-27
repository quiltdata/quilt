import * as React from 'react'
import { describe, it, expect, vi, afterEach, type Mock } from 'vitest'
import { render, cleanup } from '@testing-library/react'

import Overview from './index'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('./Overview', () => ({
  default: () => <div>LEGACY</div>,
}))

vi.mock('./v2/Overview', () => ({
  default: () => <div>V2</div>,
}))

const useFeature: Mock<() => boolean> = vi.fn(() => false)

vi.mock('utils/features', () => ({
  useFeature: () => useFeature(),
}))

describe('Bucket/Overview', () => {
  afterEach(cleanup)

  it('renders the current Overview by default', () => {
    useFeature.mockReturnValue(false)
    const { queryByText } = render(<Overview />)
    expect(queryByText('V2')).toBeTruthy()
    expect(queryByText('LEGACY')).toBeFalsy()
  })

  it('renders the legacy Overview when the legacy-ui feature is on', () => {
    useFeature.mockReturnValue(true)
    const { queryByText } = render(<Overview />)
    expect(queryByText('LEGACY')).toBeTruthy()
    expect(queryByText('V2')).toBeFalsy()
  })
})
