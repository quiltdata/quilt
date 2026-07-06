import { renderHook } from '@testing-library/react-hooks'
import { beforeEach, describe, it, expect, vi, type Mock } from 'vitest'

import * as BucketPreferences from 'utils/BucketPreferences'
import { extendDefaults } from 'utils/BucketPreferences/BucketPreferences'

import { useFeatures } from './useFeatures'

vi.mock('constants/config', () => ({ default: {} }))

const prefsHook: Mock<() => { prefs: BucketPreferences.Result }> = vi.fn(() => ({
  prefs: BucketPreferences.Result.Init(),
}))

vi.mock('utils/BucketPreferences', async () => ({
  ...(await vi.importActual('utils/BucketPreferences')),
  use: () => prefsHook(),
}))

describe('useFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when preferences are loading', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Pending(),
    }))

    const { result } = renderHook(() => useFeatures())

    expect(result.current).toBeNull()
  })

  it('should return all features disabled when all permissions are false', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Ok(
        extendDefaults({
          ui: {
            actions: {
              downloadObject: false,
            },
            blocks: {
              code: false,
              qurator: false,
            },
          },
        }),
      ),
    }))

    const { result } = renderHook(() => useFeatures(false))

    expect(result.current).toEqual({
      get: false,
      organize: { delete: false },
      qurator: false,
    })
  })

  it('should return all features enabled when all permissions are true', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Ok(
        extendDefaults({
          ui: {
            actions: {
              downloadObject: true,
              deleteObject: true,
            },
            blocks: {
              code: true,
              qurator: true,
            },
          },
        }),
      ),
    }))

    const { result } = renderHook(() => useFeatures(false))

    expect(result.current).toEqual({
      get: { code: true },
      organize: { delete: true },
      qurator: true,
    })
  })

  it('should return get as false when file is deleted', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Ok(
        extendDefaults({
          ui: {
            actions: {
              downloadObject: true,
            },
            blocks: {
              code: true,
              qurator: true,
            },
          },
        }),
      ),
    }))

    const { result } = renderHook(() => useFeatures(true))

    expect(result.current).toEqual({
      get: false,
      organize: false,
      qurator: true,
    })
  })
})
