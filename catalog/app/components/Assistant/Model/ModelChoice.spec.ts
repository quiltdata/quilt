import { describe, it, expect, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

import { isStale, resolve } from './ModelChoice'

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
