import * as React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

const query = vi.hoisted(() => ({ current: {} as any }))

vi.mock('utils/GraphQL', async (importActual) => ({
  ...(await importActual<typeof import('utils/GraphQL')>()),
  useQuery: () => query.current,
}))

import { isStale, resolve, useGoverned } from './ModelChoice'

function readGoverned() {
  let out: ReturnType<typeof useGoverned> | undefined
  function Harness() {
    out = useGoverned()
    return null
  }
  render(React.createElement(Harness))
  return out!
}

const FALLBACK = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
const HAIKU = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
const OPUS = 'us.anthropic.claude-opus-4-5-20251101-v1:0'

describe('components/Assistant/Model/ModelChoice', () => {
  describe('ungoverned', () => {
    it('honours any override, as before', () => {
      expect(resolve(null, 'moonshot.kimi-k3-v1:0', FALLBACK)).toBe(
        'moonshot.kimi-k3-v1:0',
      )
    })
    it('falls back without one', () => {
      expect(resolve(null, '', FALLBACK)).toBe(FALLBACK)
    })
    it('never calls an override stale', () => {
      expect(isStale(null, 'anything')).toBe(false)
    })
  })

  describe('governed', () => {
    const governed = { allowlist: [HAIKU, OPUS], default: OPUS }

    it('honours an allowed override', () => {
      expect(resolve(governed, HAIKU, FALLBACK)).toBe(HAIKU)
    })
    it('replaces a disallowed override with the admin default', () => {
      expect(resolve(governed, 'moonshot.kimi-k3-v1:0', FALLBACK)).toBe(OPUS)
      expect(isStale(governed, 'moonshot.kimi-k3-v1:0')).toBe(true)
    })
    it('keeps an allowed override', () => {
      expect(isStale(governed, HAIKU)).toBe(false)
    })
    it('uses the stack fallback when allowed and no default is set', () => {
      expect(resolve({ allowlist: [HAIKU, FALLBACK], default: null }, '', FALLBACK)).toBe(
        FALLBACK,
      )
    })
    it('otherwise uses the first allowed model, never one outside the set', () => {
      expect(resolve({ allowlist: [HAIKU, OPUS], default: null }, '', FALLBACK)).toBe(
        HAIKU,
      )
    })
  })
})

describe('components/Assistant/Model/ModelChoice useGoverned', () => {
  afterEach(cleanup)

  it('is unsettled while the read is in flight', () => {
    query.current = { fetching: true }
    expect(readGoverned()).toEqual({ governed: null, settled: false })
  })

  // A turn waits for `settled`, so a failed read must settle or Qurator hangs.
  it('settles ungoverned when the read fails', () => {
    query.current = { fetching: false, error: new Error('boom') }
    expect(readGoverned()).toEqual({ governed: null, settled: true })
  })

  it('settles ungoverned when no admin has saved a set, or the field is refused', () => {
    query.current = { fetching: false, data: { config: { quratorModels: null } } }
    expect(readGoverned()).toEqual({ governed: null, settled: true })
    cleanup()
    query.current = {
      fetching: false,
      data: { config: { quratorModels: { allowlist: null, default: null } } },
    }
    expect(readGoverned()).toEqual({ governed: null, settled: true })
  })

  it('settles governed with the saved set', () => {
    query.current = {
      fetching: false,
      data: { config: { quratorModels: { allowlist: [HAIKU, OPUS], default: OPUS } } },
    }
    expect(readGoverned()).toEqual({
      governed: { allowlist: [HAIKU, OPUS], default: OPUS },
      settled: true,
    })
  })
})
