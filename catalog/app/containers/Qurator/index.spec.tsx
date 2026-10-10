import { act, renderHook } from '@testing-library/react-hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('components/Assistant', () => ({}))
vi.mock('components/Assistant/UI/Chat/Chat', () => ({ default: () => null }))
vi.mock('components/Intercom', () => ({}))

import { useInstallable, useKeyboardFrame } from './index'

function fakeViewport(height: number, offsetTop = 0) {
  const listeners: Record<string, () => void> = {}
  const vv = {
    height,
    offsetTop,
    scale: 1,
    addEventListener: (e: string, f: () => void) => {
      listeners[e] = f
    },
    removeEventListener: () => {},
  }
  vi.stubGlobal('visualViewport', vv)
  return { vv, fire: (e: string) => listeners[e]?.() }
}

describe('containers/Qurator useKeyboardFrame', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('leaves the CSS height alone without a keyboard', () => {
    fakeViewport(window.innerHeight)
    expect(renderHook(() => useKeyboardFrame()).result.current).toBeUndefined()
  })

  it('fits the page to the visible viewport while the keyboard is up', () => {
    const { vv, fire } = fakeViewport(window.innerHeight)
    const { result } = renderHook(() => useKeyboardFrame())
    act(() => {
      vv.height = window.innerHeight - 300
      vv.offsetTop = 120
      fire('resize')
    })
    expect(result.current).toEqual({
      height: window.innerHeight - 300,
      transform: 'translateY(120px)',
    })
    act(() => {
      vv.height = window.innerHeight
      vv.offsetTop = 0
      fire('resize')
    })
    expect(result.current).toBeUndefined()
  })

  it('ignores a pinch-zoom', () => {
    const { vv, fire } = fakeViewport(window.innerHeight)
    const { result } = renderHook(() => useKeyboardFrame())
    act(() => {
      vv.scale = 2
      vv.height = window.innerHeight / 2
      fire('resize')
    })
    expect(result.current).toBeUndefined()
  })
})

describe('containers/Qurator useInstallable', () => {
  const installTags = () => document.head.querySelectorAll('link[rel="manifest"]').length

  afterEach(() => vi.unstubAllGlobals())

  it('adds nothing and registers no worker without the assistant', () => {
    const register = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } })
    renderHook(() => useInstallable(false))
    expect(installTags()).toBe(0)
    expect(register).not.toHaveBeenCalled()
  })

  it('makes the page installable while mounted, and only this page', () => {
    const register = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } })
    const { unmount } = renderHook(() => useInstallable(true))
    expect(installTags()).toBe(1)
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/qurator' })
    unmount()
    expect(installTags()).toBe(0)
  })
})
