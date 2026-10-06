import type { containers_Admin_Status_gql_MilestonesQuery as MilestonesQuery } from './gql/Milestones.generated'

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

export const NO_METRICS: Metrics = {
  packages: null,
  largestBytes: null,
  firstPackageAt: null,
  firstMultiTbAt: null,
}

export function toMetrics({
  packages: p,
  revisions: r,
  multiTb: tb,
}: MilestonesQuery): Metrics {
  if (p.__typename === 'EmptySearchResultSet') return { ...NO_METRICS, packages: 0 }
  const all = r.__typename === 'PackagesSearchResultSet' ? r.stats : null
  return {
    // `-1` is the registry's answer under secure search: no count, not zero.
    packages: p.__typename === 'PackagesSearchResultSet' && p.total >= 0 ? p.total : null,
    largestBytes: all?.size.max ?? null,
    firstPackageAt: all?.modified.min ?? null,
    firstMultiTbAt:
      tb.__typename === 'PackagesSearchResultSet' ? tb.stats.modified.min : null,
  }
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
