import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Column from 'components/Layout/Column'
import { readableBytes } from 'utils/string'

import { CATEGORIES, isEarned, type Badge } from './badges'
import Medallion from './Medallion'
import { ShareButton } from './ShareMenu'
import { earnedOn } from './share'
import useMilestones from './useMilestones'

const MEDALLION = 56

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3),
    [Column.down('sm')]: {
      padding: t.spacing(2),
    },
  },
  summary: {
    color: t.palette.text.secondary,
    marginBottom: t.spacing(1),
  },
  category: {
    ...t.typography.subtitle2,
    color: t.palette.text.secondary,
    margin: t.spacing(3, 0, 1),
  },
  // Four tracks per tile, shared across each row through subgrid, so medallions,
  // titles, descriptions and status lines sit on the same lines tile to tile
  // whatever their text wraps to. All `auto`: a fixed track can't absorb the
  // tile's padding, and an `fr` track would size to the tallest tile in the
  // whole category rather than its row.
  grid: {
    display: 'grid',
    columnGap: t.spacing(2),
    gridAutoRows: 'auto auto auto auto',
    gridTemplateColumns: 'repeat(auto-fill, minmax(184px, 1fr))',
    rowGap: 0,
  },
  tile: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'grid',
    gridRow: 'span 4',
    gridTemplateRows: 'subgrid',
    justifyItems: 'center',
    marginBottom: t.spacing(2),
    padding: t.spacing(2, 2, 1.5),
    position: 'relative',
    rowGap: t.spacing(1),
    // Under Layout's sticky ContentBar (64px); JSS drops a unitless scroll-margin.
    scrollMarginTop: `${64 + t.spacing(2)}px`,
    textAlign: 'center',
    '&:target': {
      borderColor: t.palette.secondary.main,
      boxShadow: `inset 0 0 0 1px ${t.palette.secondary.main}`,
    },
  },
  share: {
    position: 'absolute',
    right: t.spacing(0.5),
    top: t.spacing(0.5),
  },
  title: {
    ...t.typography.subtitle2,
    alignSelf: 'start',
  },
  description: {
    ...t.typography.caption,
    alignSelf: 'start',
    color: t.palette.text.secondary,
  },
  // One 20px line for every state, so earned and locked status sit level.
  status: {
    ...t.typography.caption,
    alignSelf: 'end',
    color: t.palette.text.secondary,
    lineHeight: '20px',
    width: '100%',
  },
  earnedStatus: {
    alignItems: 'center',
    color: t.palette.text.primary,
    display: 'flex',
    gap: t.spacing(0.5),
    height: 20,
    justifyContent: 'center',
  },
  progress: {
    marginBottom: t.spacing(0.5),
  },
}))

function progressLabel(b: Badge, value: number, target: number) {
  switch (b.unit) {
    case 'bytes':
      return (
        <>
          {readableBytes(value)} of {readableBytes(target)}
        </>
      )
    case 'days':
      return `${value.toLocaleString('en-US')} of ${target.toLocaleString('en-US')} days`
    default:
      return `${value.toLocaleString('en-US')} of ${target.toLocaleString('en-US')}`
  }
}

function Status({ badge }: { badge: Badge }) {
  const classes = useStyles()
  const { state } = badge
  switch (state.kind) {
    case 'earned':
      return (
        <span className={classes.earnedStatus}>
          <M.Icon style={{ fontSize: 14, lineHeight: 1 }}>check</M.Icon>
          {earnedOn(state.at) ? `Earned ${earnedOn(state.at)}` : 'Earned'}
        </span>
      )
    case 'locked':
      return (
        <>
          <M.LinearProgress
            aria-label={`${badge.title} progress`}
            className={classes.progress}
            value={Math.min(100, (100 * state.value) / state.target)}
            variant="determinate"
          />
          {progressLabel(badge, state.value, state.target)}
        </>
      )
    default:
      return <>Unavailable right now</>
  }
}

function Tile({ badge }: { badge: Badge }) {
  const classes = useStyles()
  return (
    <section
      aria-label={badge.title}
      className={classes.tile}
      data-state={badge.state.kind}
      data-testid={`badge-${badge.id}`}
      id={badge.id}
    >
      <Medallion icon={badge.icon} state={badge.state.kind} size={MEDALLION} />
      {isEarned(badge) && <ShareButton badge={badge} className={classes.share} />}
      <div className={classes.title}>{badge.title}</div>
      <div className={classes.description}>{badge.description}</div>
      <div className={classes.status}>
        <Status badge={badge} />
      </div>
    </section>
  )
}

interface PanelProps {
  className?: string
  heading?: 'h1' | 'h2'
}

export default function Panel({ className, heading = 'h2' }: PanelProps) {
  const classes = useStyles()
  const badges = useMilestones()

  // Scroll to a shared badge once the tiles exist; the browser's own hash jump
  // fires before the query has rendered them.
  React.useEffect(() => {
    if (!badges || !window.location.hash) return
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
  }, [badges])

  return (
    <M.Paper variant="outlined" className={cx(classes.root, className)} id="milestones">
      <M.Typography variant="h5" component={heading} gutterBottom>
        Milestones
      </M.Typography>
      {badges ? (
        <>
          <M.Typography variant="body2" className={classes.summary}>
            {badges.filter(isEarned).length} of {badges.length} earned · counted across
            every bucket in this catalog
          </M.Typography>
          {CATEGORIES.map((category) => {
            const group = R.filter((b: Badge) => b.category === category, badges)
            return (
              <React.Fragment key={category}>
                <h3 className={classes.category}>{category}</h3>
                <div className={classes.grid}>
                  {group.map((b) => (
                    <Tile key={b.id} badge={b} />
                  ))}
                </div>
              </React.Fragment>
            )
          })}
        </>
      ) : (
        <M.LinearProgress aria-label="Loading milestones" />
      )}
    </M.Paper>
  )
}
