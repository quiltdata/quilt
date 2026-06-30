import * as React from 'react'
import * as M from '@material-ui/core'

import { BookmarksSection } from './BookmarksSection'
import { BucketZone } from './BucketZone'
import { Rail } from './Rail'

const useStyles = M.makeStyles((t) => ({
  root: {
    paddingTop: t.spacing(1),
    width: t.spacing(35),
  },
}))

// The "locations" rail: bookmarked handles and the bucket accordion.
export function RailB() {
  const classes = useStyles()
  return (
    <Rail className={classes.root}>
      <BookmarksSection />
      <M.Divider />
      <BucketZone />
    </Rail>
  )
}
