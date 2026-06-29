import * as React from 'react'
import * as M from '@material-ui/core'

import { AccountZone } from './AccountZone'
import { BucketZone } from './BucketZone'
import { GlobalZone } from './GlobalZone'

// Rail width, in theme.spacing() units (× 8px = 280px). Exported so the
// collapsible follow-on can offset the main content by the same amount.
export const SIDEBAR_WIDTH = 35

const useStyles = M.makeStyles((t) => ({
  root: {
    borderRight: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    // Fills the row beneath the full-width header (flex stretch); the bucket
    // zone scrolls internally so the pinned zones stay visible.
    minHeight: 0,
    paddingTop: t.spacing(2),
    width: t.spacing(SIDEBAR_WIDTH),
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
