import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'
import { readableBytes } from 'utils/string'

import MILESTONES_QUERY from './gql/Milestones.generated'
import {
  NO_METRICS,
  TERABYTE,
  deriveBadges,
  toMetrics,
  type Badge,
  type Metrics,
} from './badges'

// Viewer-scoped search: capped at 10,000 and blind to counts under secure search.
function useMetrics(): Metrics | undefined {
  const result = GQL.useQuery(MILESTONES_QUERY, { minBytes: TERABYTE })
  return GQL.fold(result, {
    data: toMetrics,
    fetching: () => undefined,
    error: () => NO_METRICS,
  })
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
  icon: {
    fontSize: 40,
  },
  iconEarned: {
    color: t.palette.primary.main,
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
      className={classes.badge}
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
          aria-label={`${badge.title} progress`}
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
        Preview. Counted from search across the buckets you can read, dated by the
        earliest revision it still finds. Search counts stop at 10,000, so higher tiers
        show as unknown, and secure search hides counts altogether.
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
