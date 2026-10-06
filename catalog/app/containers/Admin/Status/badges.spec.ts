import { describe, expect, it } from 'vitest'

import { NO_METRICS, TERABYTE, deriveBadges, toMetrics, type Metrics } from './badges'

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

  it('earns the top tiers from an exact count', () => {
    const s = states({ packages: 1_000_000 })
    expect(s['packages-100000']).toBe('earned')
    expect(s['packages-1000000']).toBe('earned')
    expect(states({ packages: 999_999 })['packages-1000000']).toBe('locked')
  })

  it('marks everything count-based unknown when counts are unavailable', () => {
    const s = states({ packages: null })
    expect(s.first).toBe('unknown')
    expect(s['packages-100']).toBe('unknown')
    expect(s['multi-tb']).toBe('unknown')
  })

  it('earns the first package from its date when the count is hidden', () => {
    expect(states({ packages: null, firstPackageAt: new Date() }).first).toBe('earned')
  })

  it('decides multi-terabyte from sizes, not counts', () => {
    expect(states({ packages: 5, largestBytes: null })['multi-tb']).toBe('unknown')
    expect(states({ packages: null, largestBytes: 5e11 })['multi-tb']).toBe('locked')
  })

  describe('toMetrics', () => {
    const at = new Date('2026-01-02T00:00:00Z')
    const query = (milestones: object) =>
      ({ admin: { milestones } }) as Parameters<typeof toMetrics>[0]

    it('reads the stack milestones', () => {
      expect(
        toMetrics(
          query({
            __typename: 'StackMilestones',
            packages: 123_456,
            largestPackageBytes: 2e12,
            firstPackageAt: at,
            firstMultiTerabyteAt: at,
          }),
        ),
      ).toEqual({
        packages: 123_456,
        largestBytes: 2e12,
        firstPackageAt: at,
        firstMultiTbAt: at,
      })
    })

    it('reads an error as unknown, not zero', () => {
      expect(toMetrics(query({ __typename: 'OperationError', message: 'x' }))).toEqual(
        NO_METRICS,
      )
    })
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
