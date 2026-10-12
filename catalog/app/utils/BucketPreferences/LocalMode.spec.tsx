import * as React from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import { Result } from './BucketPreferences'
import { localModePreferences } from './LocalProvider'
import { Override, useForBucket } from './Provider'

vi.mock('constants/config', () => ({ default: { mode: 'LOCAL' } }))
vi.mock('utils/AWS', () => ({ S3: { use: () => ({}) } }))

describe('utils/BucketPreferences/useForBucket in LOCAL mode', () => {
  it("returns local mode's prefs, not the viewed bucket's override", () => {
    const viewed = Result.Pending()
    const wrapper = ({ children }: React.PropsWithChildren<{}>) => (
      <Override prefs={viewed}>{children}</Override>
    )
    const { result } = renderHook(() => useForBucket('other'), { wrapper })
    expect(result.current).toBe(localModePreferences.prefs)
  })
})
