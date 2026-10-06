// Search `total` stops counting here: the registry never sets
// `track_total_hits`, so ES reports 10,000 for anything larger.
export const SEARCH_TOTAL_CAP = 10_000

export const TERABYTE = 1e12

export interface Metrics {
  /** Named packages (bucket + name); null when unknown (secure search, error). */
  packages: number | null
  /** Largest revision in bytes; null when unknown or no packages. */
  largestBytes: number | null
  firstPackageAt: Date | null
  firstMultiTbAt: Date | null
}

export type BadgeState =
  | { kind: 'earned'; at: Date | null }
  | { kind: 'locked'; value: number; target: number }
  | { kind: 'unknown'; reason: string }

export interface Badge {
  id: string
  title: string
  state: BadgeState
}

const COUNT_TIERS = [100, 1_000, 10_000, 100_000, 1_000_000]

function countBadge(packages: number | null, target: number): BadgeState {
  if (packages === null) return { kind: 'unknown', reason: 'Package count unavailable' }
  if (packages >= target) return { kind: 'earned', at: null }
  if (packages >= SEARCH_TOTAL_CAP) {
    return { kind: 'unknown', reason: 'Search counts stop at 10,000' }
  }
  return { kind: 'locked', value: packages, target }
}

export function deriveBadges(m: Metrics): Badge[] {
  const first: BadgeState =
    m.packages === null
      ? { kind: 'unknown', reason: 'Package count unavailable' }
      : m.packages > 0
        ? { kind: 'earned', at: m.firstPackageAt }
        : { kind: 'locked', value: 0, target: 1 }

  const multiTb: BadgeState =
    m.largestBytes !== null && m.largestBytes >= TERABYTE
      ? { kind: 'earned', at: m.firstMultiTbAt }
      : m.packages === 0
        ? { kind: 'locked', value: 0, target: TERABYTE }
        : m.largestBytes === null
          ? { kind: 'unknown', reason: 'Package sizes unavailable' }
          : { kind: 'locked', value: m.largestBytes, target: TERABYTE }

  return [
    { id: 'first', title: 'First package', state: first },
    ...COUNT_TIERS.map((t) => ({
      id: `packages-${t}`,
      title: `${t.toLocaleString('en-US')} packages`,
      state: countBadge(m.packages, t),
    })),
    { id: 'multi-tb', title: 'First multi-terabyte package', state: multiTb },
  ]
}
