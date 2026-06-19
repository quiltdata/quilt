import * as React from 'react'
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
  title: {
    fontSize: 13.5,
    fontWeight: 500,
  },
}))

interface TileCardProps {
  icon: string
  title: string
  children: React.ReactNode
}

export default function TileCard({ icon, title, children }: TileCardProps) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <div className={classes.head}>
        <M.Icon style={{ fontSize: 19 }}>{icon}</M.Icon>
        <M.Typography component="h2" className={classes.title}>
          {title}
        </M.Typography>
      </div>
      {children}
    </div>
  )
}
