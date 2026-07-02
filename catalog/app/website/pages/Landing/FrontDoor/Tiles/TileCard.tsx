import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

// FrontDoor: shared "Jump back in" card chrome; adapts to light/dark palette.
const useStyles = M.makeStyles((t) => ({
  root: {
    background:
      t.palette.type === 'dark' ? 'rgba(255,255,255,.045)' : t.palette.common.white,
    border:
      t.palette.type === 'dark'
        ? '1px solid rgba(255,255,255,.09)'
        : '1px solid rgba(40,43,80,.12)',
    borderRadius: 12,
    boxShadow: t.palette.type === 'dark' ? 'none' : '0 4px 16px -8px rgba(40,43,80,.12)',
    height: '100%',
    padding: t.spacing(2),
    transition: 'all .18s',
    '&:hover': {
      background:
        t.palette.type === 'dark' ? 'rgba(255,255,255,.09)' : t.palette.common.white,
      boxShadow: t.palette.type === 'dark' ? 'none' : '0 8px 24px -8px rgba(40,43,80,.2)',
      transform: 'translateY(-2px)',
    },
  },
  head: {
    alignItems: 'center',
    color: t.palette.type === 'dark' ? '#fabdb3' : t.palette.secondary.main,
    display: 'flex',
    gap: t.spacing(1.25),
    marginBottom: t.spacing(1.25),
  },
  headLink: {
    alignItems: 'center',
    color: t.palette.type === 'dark' ? '#fabdb3' : t.palette.secondary.main,
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
