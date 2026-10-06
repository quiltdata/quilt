import { describe, expect, it } from 'vitest'

import { TERABYTE, deriveBadges, type Metrics } from './badges'

const base: Metrics = {
  packages: 0,
  largestBytes: null,
  firstPackageAt: null,
  firstMultiTbAt: null,
}

const states = (m: Partial<Metrics>) =>
  Object.fromEntries(deriveBadges({ ...base, ...m }).map((b) => [b.id, b.state.kind]))

describe('containers/Admin/Status/badges', () => {
  it('locks everything on an empty stack', () => {
    expect(new Set(Object.values(states({})))).toEqual(new Set(['locked']))
  })

  it('earns tiers at their exact threshold', () => {
    expect(states({ packages: 99 })['packages-100']).toBe('locked')
    expect(states({ packages: 100 })['packages-100']).toBe('earned')
    expect(states({ packages: 100 })['packages-1000']).toBe('locked')
  })

  it('says unknown above the search cap instead of locking', () => {
    const s = states({ packages: 10_000 })
    expect(s['packages-10000']).toBe('earned')
    expect(s['packages-100000']).toBe('unknown')
    expect(s['packages-1000000']).toBe('unknown')
  })

  it('marks everything count-based unknown when counts are unavailable', () => {
    const s = states({ packages: null })
    expect(s.first).toBe('unknown')
    expect(s['packages-100']).toBe('unknown')
    expect(s['multi-tb']).toBe('unknown')
  })

  it('earns multi-terabyte at exactly 10^12 bytes, with its date', () => {
    const at = new Date('2026-01-02T00:00:00Z')
    expect(states({ packages: 1, largestBytes: TERABYTE - 1 })['multi-tb']).toBe('locked')
    const badge = deriveBadges({
      ...base,
      packages: 1,
      largestBytes: TERABYTE,
      firstMultiTbAt: at,
    }).find((b) => b.id === 'multi-tb')
    expect(badge?.state).toEqual({ kind: 'earned', at })
  })
})
