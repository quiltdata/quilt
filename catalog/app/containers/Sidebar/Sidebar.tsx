import * as React from 'react'
import * as M from '@material-ui/core'

import { AccountZone } from './AccountZone'
import { BucketZone } from './BucketZone'
import { GlobalZone } from './GlobalZone'

const useStyles = M.makeStyles((t) => ({
  root: {
    borderRight: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    // Fills the row beneath the full-width header (flex stretch); the bucket
    // zone scrolls internally so the pinned zones stay visible.
    minHeight: 0,
    paddingTop: t.spacing(1),
    width: t.spacing(35),
  },
  // The bucket accordion owns the flexible space and scrolls; the global links
  // and account zones are pinned beneath it.
  bucket: {
    display: 'flex',
    flex: '1 1 0',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'auto',
  },
  pinned: {
    flex: '0 0 auto',
    padding: t.spacing(1, 0),
  },
}))

export function Sidebar() {
  const classes = useStyles()
  return (
    <nav className={classes.root}>
      <div className={classes.bucket}>
        <BucketZone />
      </div>
      <M.Divider />
      <div className={classes.pinned}>
        <GlobalZone />
      </div>
      <M.Divider />
      <div className={classes.pinned}>
        <AccountZone />
      </div>
    </nav>
  )
}
