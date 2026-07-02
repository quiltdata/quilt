import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { extractCriteria } from './extractCriteria'

// FrontDoor v3-eval: dark "interpreted plan" panel shown when the bar routes to
// Qurator. Mirrors the prototype's interaction shape (criteria preview + primary
// action), but the primary action opens the REAL Assistant rather than rendering
// a simulated answer.
const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.type === 'dark' ? '#1c1947' : t.palette.common.white,
    border:
      t.palette.type === 'dark'
        ? '1px solid rgba(255,255,255,.1)'
        : '1px solid rgba(40,43,80,.1)',
    borderRadius: 16,
    boxShadow: t.palette.type === 'dark' ? 'none' : '0 16px 44px -16px rgba(40,43,80,.3)',
    marginTop: t.spacing(1.75),
    overflow: 'hidden',
  },
  top: {
    alignItems: 'center',
    borderBottom:
      t.palette.type === 'dark'
        ? '1px solid rgba(255,255,255,.08)'
        : '1px solid rgba(40,43,80,.1)',
    display: 'flex',
    gap: t.spacing(1.5),
    padding: t.spacing(1.875, 2.25),
  },
  qicon: {
    alignItems: 'center',
    background: 'linear-gradient(225deg,#6a93ff,#5471f1)',
    borderRadius: 8,
    display: 'grid',
    height: 30,
    placeItems: 'center',
    width: 30,
  },
  title: {
    fontSize: 14.5,
    fontWeight: 500,
  },
  tag: {
    background:
      t.palette.type === 'dark' ? 'rgba(255,255,255,.08)' : 'rgba(40,43,80,.07)',
    borderRadius: 10,
    color: t.palette.text.secondary,
    fontSize: 11,
    padding: t.spacing(0.375, 1.125),
  },
  right: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    fontSize: 12,
    gap: t.spacing(0.75),
    marginLeft: 'auto',
  },
  interp: {
    padding: t.spacing(2, 2.25),
  },
  lbl: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    fontSize: 11,
    gap: t.spacing(0.875),
    letterSpacing: '.07em',
    marginBottom: t.spacing(1.25),
    textTransform: 'uppercase',
  },
  crit: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
  },
  pill: {
    alignItems: 'center',
    background:
      t.palette.type === 'dark' ? 'rgba(106,147,255,.14)' : 'rgba(84,113,241,.1)',
    border:
      t.palette.type === 'dark'
        ? '1px solid rgba(106,147,255,.32)'
        : '1px solid rgba(84,113,241,.28)',
    borderRadius: 18,
    color: t.palette.type === 'dark' ? '#dbe4ff' : '#3a4bb3',
    display: 'inline-flex',
    fontSize: 13,
    gap: t.spacing(0.75),
    padding: t.spacing(0.75, 1.375),
  },
  pillKey: {
    color: t.palette.type === 'dark' ? '#6a93ff' : '#5471f1',
    fontWeight: 500,
  },
  lblIcon: {
    color: t.palette.type === 'dark' ? '#6a93ff' : '#5471f1',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1.25),
    padding: t.spacing(0, 2.25, 2),
  },
  btn: {
    borderRadius: 22,
    fontSize: 13.5,
    fontWeight: 500,
    padding: t.spacing(1.25, 2.25),
    textTransform: 'none',
    transition: 'transform .15s, filter .2s',
    '&:hover': {
      filter: 'brightness(1.07)',
      transform: 'translateY(-1px)',
    },
  },
  primary: {
    background: 'linear-gradient(225deg,#6a93ff,#5471f1)',
    color: t.palette.common.white,
    '&:hover': {
      background: 'linear-gradient(225deg,#6a93ff,#5471f1)',
    },
  },
  ghost: {
    background:
      t.palette.type === 'dark' ? 'rgba(255,255,255,.07)' : 'rgba(40,43,80,.05)',
    border:
      t.palette.type === 'dark'
        ? '1px solid rgba(255,255,255,.14)'
        : '1px solid rgba(40,43,80,.18)',
    color: t.palette.text.primary,
  },
}))

interface QuratorPanelProps {
  query: string
  onRun: () => void
  onJustSearch: () => void
}

export default function QuratorPanel({ query, onRun, onJustSearch }: QuratorPanelProps) {
  const classes = useStyles()
  const criteria = React.useMemo(() => extractCriteria(query), [query])

  return (
    <M.Paper className={classes.root} elevation={0} aria-label="Qurator plan">
      <div className={classes.top}>
        <span className={classes.qicon}>
          <M.Icon style={{ fontSize: 18 }}>auto_awesome</M.Icon>
        </span>
        <M.Typography className={classes.title}>Qurator</M.Typography>
        <span className={classes.tag}>Claude · Bedrock · your permissions</span>
        <span className={classes.right}>
          <M.Icon style={{ fontSize: 14 }}>bolt</M.Icon>auto-routed
        </span>
      </div>
      <div className={classes.interp}>
        <div className={classes.lbl}>
          <M.Icon className={classes.lblIcon} style={{ fontSize: 14 }}>
            tips_and_updates
          </M.Icon>
          Interpreted as — edit before running
        </div>
        <div className={classes.crit}>
          {criteria.map((c) => (
            <span className={classes.pill} key={`${c.key}-${c.value}`}>
              <span className={classes.pillKey}>{c.key}:</span>
              {c.value}
            </span>
          ))}
        </div>
      </div>
      <div className={classes.actions}>
        <M.Button
          className={cx(classes.btn, classes.primary)}
          variant="contained"
          startIcon={<M.Icon>auto_awesome</M.Icon>}
          onClick={onRun}
        >
          Run with Qurator
        </M.Button>
        <M.Button
          className={cx(classes.btn, classes.ghost)}
          startIcon={<M.Icon>search</M.Icon>}
          onClick={onJustSearch}
        >
          Just search instead
        </M.Button>
      </div>
    </M.Paper>
  )
}
