import * as React from 'react'
import * as M from '@material-ui/core'

import * as Bookmarks from 'containers/Bookmarks'

import { SectionHeader } from './SectionHeader'

const useStyles = M.makeStyles((t) => ({
  // Keep a long bookmarks list from crowding out the bucket list below it.
  list: {
    maxHeight: t.spacing(40),
    overflowY: 'auto',
  },
}))

export function BookmarksSection() {
  const classes = useStyles()
  const bookmarks = Bookmarks.use()
  const [expanded, setExpanded] = React.useState(false)

  const toggle = React.useCallback(() => {
    setExpanded((open) => {
      // Mirror the old drawer: opening marks the list as seen so new bookmarks
      // re-flag updates; closing clears the updates badge (hide()).
      if (open) bookmarks?.hide()
      else bookmarks?.show()
      return !open
    })
  }, [bookmarks])

  return (
    <>
      <SectionHeader
        title="Bookmarks"
        expanded={expanded}
        onToggle={toggle}
        badge={!!bookmarks?.hasUpdates}
      />
      <M.Collapse in={expanded} className={classes.list}>
        <Bookmarks.List />
      </M.Collapse>
    </>
  )
}
