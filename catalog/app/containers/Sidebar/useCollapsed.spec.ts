import { act, renderHook } from '@testing-library/react-hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import useCollapsed, { COLLAPSED_STORAGE_KEY } from './useCollapsed'

describe('containers/Sidebar/useCollapsed', () => {
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

  it('starts expanded when nothing is stored', () => {
    const { result } = renderHook(() => useCollapsed())
    expect(result.current[0]).toBe(false)
  })

  it('restores a stored collapsed preference', () => {
    store[COLLAPSED_STORAGE_KEY] = '1'
    const { result } = renderHook(() => useCollapsed())
    expect(result.current[0]).toBe(true)
  })

  it('toggles and persists the new state', () => {
    const { result } = renderHook(() => useCollapsed())
    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)
    expect(store[COLLAPSED_STORAGE_KEY]).toBe('1')
    act(() => result.current[1]())
    expect(result.current[0]).toBe(false)
    expect(store[COLLAPSED_STORAGE_KEY]).toBe('0')
  })

  // Private mode / quota: the preference is best-effort, never a crash.
  it('still toggles when storage throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('denied')
        },
        setItem: () => {
          throw new Error('denied')
        },
        clear: () => {},
      },
    })
    const { result } = renderHook(() => useCollapsed())
    expect(result.current[0]).toBe(false)
    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)
  })
})
