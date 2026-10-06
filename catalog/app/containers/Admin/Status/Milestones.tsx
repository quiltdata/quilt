import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'
import { readableBytes } from 'utils/string'

import COUNTS_QUERY from './gql/MilestoneCounts.generated'
import STATS_QUERY from './gql/MilestoneStats.generated'
import SINCE_QUERY from './gql/MilestoneSince.generated'
import { TERABYTE, deriveBadges, type Badge, type Metrics } from './badges'

type Total = { __typename: string; total?: number }

// `-1` is the registry's answer under secure search: no count, not zero.
function total(r: Total): number | null {
  if (r.__typename === 'EmptySearchResultSet') return 0
  if (r.__typename !== 'PackagesSearchResultSet' || r.total == null) return null
  return r.total >= 0 ? r.total : null
}

type Stats = {
  __typename: string
  stats?: { size?: { max: number }; modified: { min: Date } }
}

const stats = (r: Stats) => (r.__typename === 'PackagesSearchResultSet' ? r.stats : null)

// ponytail: reads today's viewer-scoped search (capped at 10,000, blind under
// secure search); the shipped version reads one exact admin field instead.
function useMetrics(): Metrics | undefined {
  const counts = GQL.useQuery(COUNTS_QUERY)
  const c = GQL.fold(counts, {
    data: (d) => ({ packages: total(d.packages), revisions: total(d.revisions) }),
    fetching: () => undefined,
    error: () => ({ packages: null, revisions: null }),
  })
  // The registry asserts on stats for an empty result, so only ask when there is something.
  const statsQuery = GQL.useQuery(STATS_QUERY, undefined, {
    pause: !c || c.revisions === 0,
  })
  const s = GQL.fold(statsQuery, {
    data: (d) => stats(d.searchPackages) ?? null,
    fetching: () => undefined,
    error: () => null,
  })
  const largestBytes = s?.size?.max ?? null
  const sinceQuery = GQL.useQuery(
    SINCE_QUERY,
    { minBytes: TERABYTE },
    { pause: largestBytes === null || largestBytes < TERABYTE },
  )
  const since = GQL.fold(sinceQuery, {
    data: (d) => stats(d.searchPackages)?.modified.min ?? null,
    fetching: () => undefined,
    error: () => null,
  })

  if (!c) return undefined
  if (c.revisions !== 0 && s === undefined) return undefined
  return {
    packages: c.packages,
    largestBytes,
    firstPackageAt: s?.modified.min ? new Date(s.modified.min) : null,
    firstMultiTbAt: since ? new Date(since) : null,
  }
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
  },
  caveat: {
    color: t.palette.text.secondary,
    marginBottom: t.spacing(2),
  },
  grid: {
    display: 'grid',
    gap: t.spacing(2),
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  },
  badge: {
    alignItems: 'center',
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(0.5),
    padding: t.spacing(2),
    textAlign: 'center',
  },
  earned: {
    borderColor: t.palette.warning.main,
  },
  icon: {
    fontSize: 40,
  },
  iconEarned: {
    color: t.palette.warning.main,
  },
  iconMuted: {
    color: t.palette.text.disabled,
  },
  progress: {
    alignSelf: 'stretch',
  },
}))

function progressLabel(b: Badge, value: number, target: number) {
  if (b.id === 'multi-tb') {
    return (
      <>
        Largest: {readableBytes(value)} of {readableBytes(target)}
      </>
    )
  }
  return `${value.toLocaleString('en-US')} / ${target.toLocaleString('en-US')}`
}

function BadgeTile({ badge }: { badge: Badge }) {
  const classes = useStyles()
  const { state } = badge
  const icon =
    state.kind === 'earned'
      ? 'emoji_events'
      : state.kind === 'locked'
        ? 'lock'
        : 'help_outline'
  return (
    <div
      className={`${classes.badge} ${state.kind === 'earned' ? classes.earned : ''}`}
      data-testid={`badge-${badge.id}`}
      data-state={state.kind}
    >
      <M.Icon
        className={`${classes.icon} ${state.kind === 'earned' ? classes.iconEarned : classes.iconMuted}`}
        aria-hidden
      >
        {icon}
      </M.Icon>
      <M.Typography variant="subtitle2">{badge.title}</M.Typography>
      <M.Typography variant="caption" color="textSecondary">
        {state.kind === 'earned' &&
          (state.at ? `Earned ${dateFns.format(state.at, 'MMM d, yyyy')}` : 'Earned')}
        {state.kind === 'locked' && progressLabel(badge, state.value, state.target)}
        {state.kind === 'unknown' && state.reason}
      </M.Typography>
      {state.kind === 'locked' && (
        <M.LinearProgress
          className={classes.progress}
          variant="determinate"
          value={Math.min(100, (100 * state.value) / state.target)}
        />
      )}
    </div>
  )
}

export default function Milestones() {
  const classes = useStyles()
  const metrics = useMetrics()
  return (
    <M.Paper variant="outlined" className={classes.root} id="milestones">
      <M.Typography variant="h5" gutterBottom>
        Milestones
      </M.Typography>
      <M.Typography variant="body2" className={classes.caveat}>
        Preview. Counted from search across the buckets you can read; search counts stop
        at 10,000, so higher tiers show as unknown.
      </M.Typography>
      {metrics ? (
        <div className={classes.grid}>
          {deriveBadges(metrics).map((b) => (
            <BadgeTile key={b.id} badge={b} />
          ))}
        </div>
      ) : (
        <M.LinearProgress />
      )}
    </M.Paper>
  )
}
