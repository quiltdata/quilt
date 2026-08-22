import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: t.spacing(1),
    // Fixed height so every section header (with or without an action) lines up,
    // and side-by-side columns start their content at the same vertical offset.
    minHeight: t.spacing(4),
  },
  title: {
    fontWeight: t.typography.fontWeightMedium,
  },
}))

interface SectionHeaderProps {
  action?: React.ReactNode
  children: React.ReactNode
}

export default function SectionHeader({ action, children }: SectionHeaderProps) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <M.Typography variant="subtitle1" className={classes.title}>
        {children}
      </M.Typography>
      {action}
    </div>
  )
}
