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
              writeFile: false,
              downloadObject: false,
              createPackage: false,
            },
            blocks: {
              code: false,
            },
          },
        }),
      ),
    }))

    const { result } = renderHook(() => useFeatures())

    expect(result.current).toEqual({
      add: false,
      get: false,
      organize: { delete: false },
      createPackage: false,
    })
  })

  it('should return all features enabled when all permissions are true', () => {
    prefsHook.mockImplementationOnce(() => ({
      prefs: BucketPreferences.Result.Ok(
        extendDefaults({
          ui: {
            actions: {
              writeFile: true,
              downloadObject: true,
              createPackage: true,
              deleteObject: true,
            },
            blocks: {
              code: true,
            },
          },
        }),
      ),
    }))

    const { result } = renderHook(() => useFeatures())

    expect(result.current).toEqual({
      add: true,
      get: { code: true },
      organize: { delete: true },
      createPackage: true,
    })
  })
})
