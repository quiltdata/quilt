import type { containers_Milestones_gql_MilestonesQuery as MilestonesQuery } from './gql/Milestones.generated'

export const TERABYTE = 1e12

const DAY_MS = 24 * 60 * 60 * 1000

export interface Metrics {
  packages: number
  largestBytes: number | null
  largestFiles: number | null
  totalBytes: number
  buckets: number
  mostRevisions: number
  activeUsers: number
  firstPackageAt: Date | null
  firstMultiTbAt: Date | null
  firstWorkflowAt: Date | null
}

/** `null` = the registry couldn't say; every badge reads unknown. */
export function toMetrics({ milestones: m }: MilestonesQuery): Metrics | null {
  if (m.__typename !== 'StackMilestones') return null
  return {
    packages: m.packages,
    largestBytes: m.largestPackageBytes,
    largestFiles: m.largestPackageFiles,
    totalBytes: m.totalPackagedBytes,
    buckets: m.bucketsWithPackages,
    mostRevisions: m.mostRevisions,
    activeUsers: m.activeUsers,
    firstPackageAt: m.firstPackageAt,
    firstMultiTbAt: m.firstMultiTerabyteAt,
    firstWorkflowAt: m.firstWorkflowPackageAt,
  }
}

export type BadgeState =
  | { kind: 'earned'; at: Date | null }
  | { kind: 'locked'; value: number; target: number }
  | { kind: 'unknown' }

export type Unit = 'count' | 'bytes' | 'days'

export const CATEGORIES = ['Packages', 'Volume', 'Practice', 'Team', 'Time'] as const

export type Category = (typeof CATEGORIES)[number]

export interface BadgeDef {
  id: string
  title: string
  /** What earned it, as one sentence a teammate can read out of context. */
  description: string
  category: Category
  icon: string
  unit: Unit
  rule: (m: Metrics, now: Date) => BadgeState
}

export interface Badge extends Omit<BadgeDef, 'rule'> {
  state: BadgeState
}

const reach = (
  value: number | null,
  target: number,
  at: Date | null = null,
): BadgeState =>
  value !== null && value >= target
    ? { kind: 'earned', at }
    : { kind: 'locked', value: value ?? 0, target }

const first = (at: Date | null): BadgeState =>
  at ? { kind: 'earned', at } : { kind: 'locked', value: 0, target: 1 }

const anniversary = (since: Date | null, years: number, now: Date): BadgeState => {
  const target = Math.round(years * 365.25)
  if (!since) return { kind: 'locked', value: 0, target }
  const days = Math.floor((now.getTime() - since.getTime()) / DAY_MS)
  if (days < target) return { kind: 'locked', value: days, target }
  const at = new Date(since)
  at.setUTCFullYear(at.getUTCFullYear() + years)
  return { kind: 'earned', at }
}

const n = (x: number) => x.toLocaleString('en-US')

const packageTier = (target: number): BadgeDef => ({
  id: `packages-${target}`,
  title: `${n(target)} packages`,
  description: `${n(target)} named packages across this catalog's buckets.`,
  category: 'Packages',
  icon: 'layers',
  unit: 'count',
  rule: (m) => reach(m.packages, target),
})

const volumeTier = (id: string, title: string, bytes: number): BadgeDef => ({
  id,
  title,
  description: `${title} across every package revision in this catalog.`,
  category: 'Volume',
  icon: 'storage',
  unit: 'bytes',
  rule: (m) => reach(m.totalBytes, bytes),
})

export const BADGES: readonly BadgeDef[] = [
  {
    id: 'first-package',
    title: 'First package',
    description: 'The first package was pushed to this catalog.',
    category: 'Packages',
    icon: 'inbox',
    unit: 'count',
    rule: (m) => first(m.firstPackageAt),
  },
  ...[100, 1_000, 10_000, 100_000, 1_000_000].map(packageTier),
  {
    id: 'terabyte-package',
    title: 'Terabyte package',
    description: 'A single package revision of 1 TB or more.',
    category: 'Volume',
    icon: 'sd_storage',
    unit: 'bytes',
    rule: (m) => reach(m.largestBytes, TERABYTE, m.firstMultiTbAt),
  },
  volumeTier('packaged-10tb', '10 TB packaged', 10 * TERABYTE),
  volumeTier('packaged-100tb', '100 TB packaged', 100 * TERABYTE),
  volumeTier('packaged-1pb', '1 PB packaged', 1000 * TERABYTE),
  {
    id: 'million-files',
    title: 'Million-file package',
    description: 'A single package revision holding 1,000,000 files or more.',
    category: 'Practice',
    icon: 'folder_special',
    unit: 'count',
    rule: (m) => reach(m.largestFiles, 1_000_000),
  },
  {
    id: 'first-workflow',
    title: 'Validated by workflow',
    description: 'The first package that passed a metadata workflow.',
    category: 'Practice',
    icon: 'verified_user',
    unit: 'count',
    rule: (m) => first(m.firstWorkflowAt),
  },
  {
    id: 'hundred-revisions',
    title: '100 revisions',
    description: 'One package revised 100 times.',
    category: 'Practice',
    icon: 'history',
    unit: 'count',
    rule: (m) => reach(m.mostRevisions, 100),
  },
  {
    id: 'ten-buckets',
    title: '10 buckets',
    description: 'Packages live in 10 or more buckets.',
    category: 'Practice',
    icon: 'view_module',
    unit: 'count',
    rule: (m) => reach(m.buckets, 10),
  },
  {
    id: 'team-10',
    title: '10 people',
    description: '10 active people use this catalog.',
    category: 'Team',
    icon: 'group',
    unit: 'count',
    rule: (m) => reach(m.activeUsers, 10),
  },
  {
    id: 'team-100',
    title: '100 people',
    description: '100 active people use this catalog.',
    category: 'Team',
    icon: 'groups',
    unit: 'count',
    rule: (m) => reach(m.activeUsers, 100),
  },
  {
    id: 'anniversary-1',
    title: '1 year of packages',
    description: 'A year since the first package was pushed.',
    category: 'Time',
    icon: 'event',
    unit: 'days',
    rule: (m, now) => anniversary(m.firstPackageAt, 1, now),
  },
  {
    id: 'anniversary-5',
    title: '5 years of packages',
    description: 'Five years since the first package was pushed.',
    category: 'Time',
    icon: 'event_available',
    unit: 'days',
    rule: (m, now) => anniversary(m.firstPackageAt, 5, now),
  },
]

export function deriveBadges(m: Metrics | null, now: Date = new Date()): Badge[] {
  return BADGES.map(({ rule, ...def }) => ({
    ...def,
    state: m ? rule(m, now) : { kind: 'unknown' },
  }))
}

export const isEarned = (b: Badge): b is Badge & { state: { kind: 'earned' } } =>
  b.state.kind === 'earned'
