import { describe, expect, it } from 'vitest'

import { BADGES, TERABYTE, deriveBadges, toMetrics, type Metrics } from './badges'

const NOW = new Date('2026-10-06T00:00:00Z')

const base: Metrics = {
  packages: 0,
  largestBytes: null,
  largestFiles: null,
  totalBytes: 0,
  buckets: 0,
  mostRevisions: 0,
  activeUsers: 0,
  firstPackageAt: null,
  firstMultiTbAt: null,
  firstWorkflowAt: null,
}

const derive = (m: Partial<Metrics>) =>
  Object.fromEntries(deriveBadges({ ...base, ...m }, NOW).map((b) => [b.id, b.state]))

const kinds = (m: Partial<Metrics>) =>
  Object.fromEntries(Object.entries(derive(m)).map(([id, s]) => [id, s.kind]))

describe('containers/Milestones/badges', () => {
  it('has unique ids', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
  })

  it('locks everything on an empty stack', () => {
    expect(new Set(Object.values(kinds({})))).toEqual(new Set(['locked']))
  })

  it('reads a failed query as unknown everywhere, not as zero', () => {
    expect(new Set(deriveBadges(null, NOW).map((b) => b.state.kind))).toEqual(
      new Set(['unknown']),
    )
  })

  it('earns package tiers at their exact threshold, up to a million', () => {
    expect(kinds({ packages: 99 })['packages-100']).toBe('locked')
    expect(kinds({ packages: 100 })['packages-100']).toBe('earned')
    expect(kinds({ packages: 999_999 })['packages-1000000']).toBe('locked')
    expect(kinds({ packages: 1_000_000 })['packages-1000000']).toBe('earned')
  })

  it('dates firsts by their own timestamps', () => {
    const at = new Date('2024-03-01T00:00:00Z')
    const s = derive({ packages: 1, firstPackageAt: at, firstWorkflowAt: at })
    expect(s['first-package']).toEqual({ kind: 'earned', at })
    expect(s['first-workflow']).toEqual({ kind: 'earned', at })
  })

  it('earns the terabyte package at exactly 10^12 bytes, dated', () => {
    const at = new Date('2025-01-02T00:00:00Z')
    expect(kinds({ largestBytes: TERABYTE - 1 })['terabyte-package']).toBe('locked')
    expect(
      derive({ largestBytes: TERABYTE, firstMultiTbAt: at })['terabyte-package'],
    ).toEqual({
      kind: 'earned',
      at,
    })
  })

  it('tracks volume, files, revisions, buckets and people as progress', () => {
    expect(derive({ totalBytes: 4 * TERABYTE })['packaged-10tb']).toEqual({
      kind: 'locked',
      value: 4 * TERABYTE,
      target: 10 * TERABYTE,
    })
    const s = kinds({
      totalBytes: 1000 * TERABYTE,
      largestFiles: 1_000_000,
      mostRevisions: 100,
      buckets: 10,
      activeUsers: 100,
    })
    expect(s['packaged-1pb']).toBe('earned')
    expect(s['million-files']).toBe('earned')
    expect(s['hundred-revisions']).toBe('earned')
    expect(s['ten-buckets']).toBe('earned')
    expect(s['team-100']).toBe('earned')
  })

  it('earns anniversaries on the day, dated a year after the first package', () => {
    const first = new Date('2025-10-06T00:00:00Z')
    expect(derive({ firstPackageAt: first })['anniversary-1']).toEqual({
      kind: 'earned',
      at: new Date('2026-10-06T00:00:00Z'),
    })
    expect(
      derive({ firstPackageAt: new Date('2025-10-08T00:00:00Z') })['anniversary-1'],
    ).toEqual({ kind: 'locked', value: 363, target: 365 })
  })

  it('does not earn an anniversary early across a leap day', () => {
    const state = (first: string, now: string) =>
      deriveBadges({ ...base, firstPackageAt: new Date(first) }, new Date(now)).find(
        (b) => b.id === 'anniversary-1',
      )!.state
    expect(state('2023-06-01T00:00:00Z', '2024-05-31T00:00:00Z')).toEqual({
      kind: 'locked',
      value: 364,
      target: 365,
    })
    expect(state('2023-06-01T00:00:00Z', '2024-06-01T00:00:00Z').kind).toBe('earned')
  })

  describe('toMetrics', () => {
    const at = new Date('2026-01-02T00:00:00Z')
    const query = (milestones: object) =>
      ({ milestones }) as Parameters<typeof toMetrics>[0]

    it('reads the stack milestones', () => {
      expect(
        toMetrics(
          query({
            __typename: 'StackMilestones',
            packages: 123_456,
            largestPackageBytes: 2e12,
            largestPackageFiles: 10,
            totalPackagedBytes: 3e12,
            bucketsWithPackages: 4,
            mostRevisions: 9,
            activeUsers: 12,
            firstPackageAt: at,
            firstMultiTerabyteAt: at,
            firstWorkflowPackageAt: null,
          }),
        ),
      ).toEqual({
        packages: 123_456,
        largestBytes: 2e12,
        largestFiles: 10,
        totalBytes: 3e12,
        buckets: 4,
        mostRevisions: 9,
        activeUsers: 12,
        firstPackageAt: at,
        firstMultiTbAt: at,
        firstWorkflowAt: null,
      })
    })

    it('reads an error as no metrics', () => {
      expect(toMetrics(query({ __typename: 'OperationError', message: 'x' }))).toBeNull()
    })
  })
})
