import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

const useStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(2),
  },
}))

interface FixtureNoticeProps {
  children: React.ReactNode
  className?: string
}

// Data products render fixture rows on three surfaces — the volume grid, a
// product's own screens, and the admin connections list — and each is shaped
// exactly like the real thing. Unlabelled, an invented access request or a
// fabricated connection error reads as the operator's own. Remove all three
// call sites with the fixture adapter.
export default function FixtureNotice({ children, className }: FixtureNoticeProps) {
  const classes = useStyles()
  return (
    <Lab.Alert severity="info" className={className ?? classes.root}>
      {children}
    </Lab.Alert>
  )
}
