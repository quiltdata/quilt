import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

// FrontDoor v3-eval: shared dark "Jump back in" card chrome matching the prototype.
const useStyles = M.makeStyles((t) => ({
  root: {
    background: 'rgba(255,255,255,.045)',
    border: '1px solid rgba(255,255,255,.09)',
    borderRadius: 12,
    height: '100%',
    padding: t.spacing(2),
    transition: 'all .18s',
    '&:hover': {
      background: 'rgba(255,255,255,.09)',
      transform: 'translateY(-2px)',
    },
  },
  head: {
    alignItems: 'center',
    color: '#fabdb3',
    display: 'flex',
    gap: t.spacing(1.25),
    marginBottom: t.spacing(1.25),
  },
  headLink: {
    alignItems: 'center',
    color: '#fabdb3',
    display: 'flex',
    gap: t.spacing(1.25),
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  title: {
    fontSize: 13.5,
    fontWeight: 500,
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
