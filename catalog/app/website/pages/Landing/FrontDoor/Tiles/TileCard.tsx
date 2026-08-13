import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

// Shared chrome for the "Jump back in" tiles. The prototype these came from
// (frontdoor/v3-eval) drew them as translucent panels floating on a dark hero;
// here they're ordinary working surfaces -- white, delineated by a border
// rather than a shadow, since a resting tile doesn't float (the Overlay-Only
// Rule).
const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    height: '100%',
    padding: t.spacing(2),
    transition: t.transitions.create(['background-color', 'border-color'], {
      duration: 150,
    }),
    '&:hover': {
      backgroundColor: t.palette.action.hover,
      borderColor: t.palette.text.secondary,
    },
  },
  head: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    gap: t.spacing(1.25),
    marginBottom: t.spacing(1.25),
  },
  // The header doubles as the tile's "see everything" link, so it takes the
  // link color rather than the muted heading color the non-linked head uses.
  headLink: {
    alignItems: 'center',
    color: t.palette.primary.main,
    display: 'flex',
    gap: t.spacing(1.25),
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  title: {
    fontSize: 13.5,
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
      <M.Icon style={{ fontSize: 19 }}>{icon}</M.Icon>
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
