import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RECENT_PACKAGES_STORAGE_KEY, readRecentPackages } from './useRecentPackages'

describe('website/pages/Landing/FrontDoor/useRecentPackages', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: vi.fn(() => {
          store = {}
        }),
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value
        }),
      },
    })
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('returns [] when the storage key is empty', () => {
    expect(readRecentPackages()).toEqual([])
  })

  it('returns [] when the stored value is not valid JSON', () => {
    window.localStorage.setItem(RECENT_PACKAGES_STORAGE_KEY, '{not json')
    expect(readRecentPackages()).toEqual([])
  })

  it('returns only well-shaped recent-package entries', () => {
    window.localStorage.setItem(
      RECENT_PACKAGES_STORAGE_KEY,
      JSON.stringify([
        { bucket: 'b', name: 'a/pkg', title: 'A package' },
        { nope: true },
        42,
      ]),
    )
    expect(readRecentPackages()).toEqual([
      { bucket: 'b', name: 'a/pkg', title: 'A package' },
    ])
  })
})
