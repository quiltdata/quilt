import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import { extractCriteria } from './extractCriteria'

// The "interpreted plan" panel shown when the bar routes to Qurator. It mirrors
// the prototype's interaction shape (criteria preview, then a primary action
// that opens the REAL Assistant rather than rendering a simulated answer), but
// not its skin: the prototype drew a dark panel with cobalt gradients on a dark
// hero, and this is a working surface on a light page. Qurator's identity is
// carried by the Amber Indicator; the criteria are readouts, so they take the
// Info wash.
const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    marginTop: t.spacing(1.75),
    overflow: 'hidden',
  },
  top: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    gap: t.spacing(1.5),
    padding: t.spacing(1.875, 2.25),
  },
  qicon: {
    alignItems: 'center',
    background: fade(t.palette.secondary.main, 0.15),
    border: `1px solid ${t.palette.secondary.main}`,
    borderRadius: 8,
    color: t.palette.secondary.main,
    display: 'grid',
    height: 30,
    placeItems: 'center',
    width: 30,
  },
  title: {
    fontSize: 14.5,
    fontWeight: t.typography.fontWeightMedium,
  },
  tag: {
    background: t.palette.action.selected,
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
    background: t.palette.info.light,
    border: `1px solid ${t.palette.info.main}`,
    borderRadius: 18,
    color: t.palette.text.primary,
    display: 'inline-flex',
    fontSize: 13,
    gap: t.spacing(0.75),
    padding: t.spacing(0.75, 1.375),
  },
  pillKey: {
    color: t.palette.info.main,
    fontWeight: t.typography.fontWeightMedium,
  },
  lblIcon: {
    color: t.palette.text.secondary,
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
    fontWeight: t.typography.fontWeightMedium,
    padding: t.spacing(1.25, 2.25),
    textTransform: 'none',
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
          className={classes.btn}
          color="primary"
          variant="contained"
          startIcon={<M.Icon>auto_awesome</M.Icon>}
          onClick={onRun}
        >
          Run with Qurator
        </M.Button>
        <M.Button
          className={classes.btn}
          variant="outlined"
          startIcon={<M.Icon>search</M.Icon>}
          onClick={onJustSearch}
        >
          Just search instead
        </M.Button>
      </div>
    </M.Paper>
  )
}
