import * as React from 'react'
import * as M from '@material-ui/core'

import { List } from './List'
import { useBookmarks } from './Provider'

const useStyles = M.makeStyles((t) => ({
  pane: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '80vw',
    width: t.spacing(45),
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    padding: t.spacing(1, 1, 1, 2),
  },
  title: {
    ...t.typography.h6,
  },
}))

// Right-anchored bookmarks pane, opened from the sidebar's "Bookmarks" item via
// the provider's isOpened/show/hide state.
export function Drawer() {
  const classes = useStyles()
  const bookmarks = useBookmarks()
  if (!bookmarks) return null
  return (
    <M.Drawer anchor="right" open={bookmarks.isOpened} onClose={bookmarks.hide}>
      <div className={classes.pane}>
        <div className={classes.header}>
          <span className={classes.title}>Bookmarks</span>
          <M.IconButton onClick={bookmarks.hide} aria-label="Close bookmarks">
            <M.Icon>close</M.Icon>
          </M.IconButton>
        </div>
        <M.Divider />
        <List />
      </div>
    </M.Drawer>
  )
}
