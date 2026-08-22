import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

// Shared chrome for the "Jump back in" tiles. The prototype these came from
// (frontdoor/v3-eval) drew them as translucent panels floating on a dark hero;
// here they're ordinary working surfaces -- white, delineated by a border
// rather than a shadow, since a resting tile doesn't float (the Overlay-Only
// Rule).
//
// The card itself has no hover treatment: clicking a tile's background does
// nothing, and the prototype's whole-card lift read as a click target that
// wasn't one. The things that do act -- the header link and the rows -- carry
// their own hover and focus states.
const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    height: '100%',
    padding: t.spacing(2),
  },
  head: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    gap: t.spacing(1),
    marginBottom: t.spacing(1),
  },
  // The header doubles as the tile's "see everything" link, so it takes the
  // link color rather than the muted heading color the non-linked head uses.
  headLink: {
    alignItems: 'center',
    color: t.palette.primary.main,
    display: 'flex',
    gap: t.spacing(1),
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  icon: {
    fontSize: t.typography.h6.fontSize,
  },
  title: {
    fontSize: t.typography.body2.fontSize,
    fontWeight: t.typography.fontWeightMedium,
  },
}))

interface TileCardProps {
  icon: string
  title: string
  /** When provided, the tile header becomes a link to this path. */
  href?: string
  children: React.ReactNode
}

export default function TileCard({ icon, title, href, children }: TileCardProps) {
  const classes = useStyles()
  const head = (
    <>
      <M.Icon className={classes.icon}>{icon}</M.Icon>
      <M.Typography component="h2" className={classes.title}>
        {title}
      </M.Typography>
    </>
  )
  return (
    <div className={classes.root}>
      {href ? (
        <Link to={href} className={classes.headLink}>
          {head}
        </Link>
      ) : (
        <div className={classes.head}>{head}</div>
      )}
      {children}
    </div>
  )
}
