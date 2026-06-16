import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    fontWeight: t.typography.fontWeightMedium,
    marginBottom: t.spacing(1),
  },
}))

interface SectionTitleProps {
  children: React.ReactNode
}

export default function SectionTitle({ children }: SectionTitleProps) {
  const classes = useStyles()
  return (
    <M.Typography variant="subtitle1" className={classes.root}>
      {children}
    </M.Typography>
  )
}
