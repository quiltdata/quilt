import * as React from 'react'
import * as M from '@material-ui/core'

import { extractCriteria } from './extractCriteria'

// The "interpreted plan" panel shown when the bar routes to Qurator. It mirrors
// the prototype's interaction shape (criteria preview, then a primary action
// that opens the REAL Assistant rather than rendering a simulated answer), but
// not its skin: the prototype drew a dark panel with cobalt gradients on a dark
// hero, and this is a working surface on a light page.
//
// Qurator's identity is carried by the Amber Indicator, which is a stroke and a
// mark -- the badge takes an amber border and amber glyph on the paper ground,
// never an amber wash. The criteria are neutral readouts, not status, so they
// are ordinary outlined chips rather than Info-blue.
const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    marginTop: t.spacing(2),
    overflow: 'hidden',
  },
  top: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    gap: t.spacing(1),
    padding: t.spacing(2),
  },
  qicon: {
    alignItems: 'center',
    border: `1px solid ${t.palette.secondary.main}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.secondary.main,
    display: 'grid',
    height: t.spacing(4),
    placeItems: 'center',
    width: t.spacing(4),
  },
  qiconGlyph: {
    fontSize: t.typography.body1.fontSize,
  },
  title: {
    fontSize: t.typography.body1.fontSize,
    fontWeight: t.typography.fontWeightMedium,
  },
  tag: {
    background: t.palette.action.selected,
    borderRadius: t.shape.borderRadius,
    color: t.palette.text.secondary,
    fontSize: t.typography.caption.fontSize,
    padding: t.spacing(0.5, 1),
  },
  right: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    fontSize: t.typography.caption.fontSize,
    gap: t.spacing(0.5),
    marginLeft: 'auto',
  },
  rightIcon: {
    fontSize: t.typography.caption.fontSize,
  },
  interp: {
    padding: t.spacing(2),
  },
  lbl: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    fontSize: t.typography.caption.fontSize,
    gap: t.spacing(0.5),
    letterSpacing: '.07em',
    marginBottom: t.spacing(1),
    textTransform: 'uppercase',
  },
  crit: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
  },
  pillKey: {
    color: t.palette.text.secondary,
    fontWeight: t.typography.fontWeightMedium,
    marginRight: t.spacing(0.5),
  },
  lblIcon: {
    color: t.palette.text.secondary,
    fontSize: t.typography.caption.fontSize,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    padding: t.spacing(0, 2, 2),
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
          <M.Icon className={classes.qiconGlyph}>auto_awesome</M.Icon>
        </span>
        <M.Typography className={classes.title}>Qurator</M.Typography>
        <span className={classes.tag}>Claude · Bedrock · your permissions</span>
        <span className={classes.right}>
          <M.Icon className={classes.rightIcon}>bolt</M.Icon>auto-routed
        </span>
      </div>
      <div className={classes.interp}>
        <div className={classes.lbl}>
          <M.Icon className={classes.lblIcon}>tips_and_updates</M.Icon>
          Interpreted as — edit before running
        </div>
        <div className={classes.crit}>
          {criteria.map((c) => (
            <M.Chip
              key={`${c.key}-${c.value}`}
              variant="outlined"
              label={
                <>
                  <span className={classes.pillKey}>{c.key}:</span>
                  {c.value}
                </>
              }
            />
          ))}
        </div>
      </div>
      <div className={classes.actions}>
        <M.Button
          color="primary"
          variant="contained"
          startIcon={<M.Icon>auto_awesome</M.Icon>}
          onClick={onRun}
        >
          Run with Qurator
        </M.Button>
        <M.Button
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
