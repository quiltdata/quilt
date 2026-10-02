import * as Eff from 'effect'
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

const HAIKU = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
const OPUS = 'us.anthropic.claude-opus-4-5-20251101-v1:0'
const KEY = 'QUILT_BEDROCK_MODEL_ID'

const governed = vi.hoisted(() => ({ current: null as any }))

vi.mock('./ModelChoice', async (importActual) => ({
  ...(await importActual<typeof import('./ModelChoice')>()),
  useGoverned: () => governed.current,
}))

import { useModelIdOverride } from './Assistant'

function setup() {
  const box: { current: ReturnType<typeof useModelIdOverride> | null } = { current: null }
  function Harness() {
    box.current = useModelIdOverride()
    return null
  }
  const { rerender } = render(<Harness />)
  return {
    sent: () => Eff.Effect.runSync(box.current![0]),
    model: () => box.current![2],
    rerender: () => rerender(<Harness />),
  }
}

describe('components/Assistant/Model/Assistant useModelIdOverride', () => {
  beforeEach(() => {
    localStorage.clear()
    governed.current = null
  })
  afterEach(cleanup)

  it('ungoverned, sends and keeps a stored override, as before', () => {
    localStorage.setItem(KEY, 'moonshot.kimi-k3-v1:0')
    const h = setup()
    expect(h.sent()).toBe('moonshot.kimi-k3-v1:0')
    expect(localStorage.getItem(KEY)).toBe('moonshot.kimi-k3-v1:0')
  })

  it('governed, never sends a stored non-member and drops it from storage', () => {
    localStorage.setItem(KEY, 'moonshot.kimi-k3-v1:0')
    governed.current = { allowlist: [HAIKU, OPUS], default: OPUS }
    const h = setup()
    expect(h.sent()).toBe(OPUS)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('drops a stored non-member once the governed set arrives', () => {
    localStorage.setItem(KEY, 'moonshot.kimi-k3-v1:0')
    const h = setup()
    governed.current = { allowlist: [HAIKU, OPUS], default: OPUS }
    h.rerender()
    expect(h.sent()).toBe(OPUS)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('governed, a picked model is sent and remembered', () => {
    governed.current = { allowlist: [HAIKU, OPUS], default: OPUS }
    const h = setup()
    act(() => h.model().select(HAIKU))
    expect(h.sent()).toBe(HAIKU)
    expect(h.model().current).toBe(HAIKU)
    expect(localStorage.getItem(KEY)).toBe(HAIKU)
  })
})
