import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as URLS from 'constants/urls'
import * as Bookmarks from 'containers/Bookmarks'
import * as NamedRoutes from 'utils/NamedRoutes'

const useStyles = M.makeStyles({
  // Match the icon→label gap of the account menu (NavMenu's ItemContents).
  icon: {
    minWidth: 36,
  },
})

export function GlobalZone() {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const bookmarks = Bookmarks.use()
  const [bookmarksOpen, setBookmarksOpen] = React.useState(false)

  const toggleBookmarks = React.useCallback(() => {
    setBookmarksOpen((open) => {
      // Mirror the old drawer: opening marks the list as seen so new bookmarks
      // re-flag updates; closing clears the updates badge (hide()).
      if (open) bookmarks?.hide()
      else bookmarks?.show()
      return !open
    })
  }, [bookmarks])

  return (
    <M.List disablePadding dense>
      <M.ListItem button onClick={toggleBookmarks}>
        <M.ListItemIcon className={classes.icon}>
          <M.Badge color="secondary" variant="dot" invisible={!bookmarks?.hasUpdates}>
            <M.Icon>{bookmarksOpen ? 'bookmarks' : 'bookmark_border'}</M.Icon>
          </M.Badge>
        </M.ListItemIcon>
        <M.ListItemText primary="Bookmarks" />
        <M.Icon fontSize="small">{bookmarksOpen ? 'expand_less' : 'expand_more'}</M.Icon>
      </M.ListItem>
      <M.Collapse in={bookmarksOpen}>
        <Bookmarks.List />
      </M.Collapse>

      <M.ListItem button component={Link} to={urls.uriResolver('')}>
        <M.ListItemIcon className={classes.icon}>
          <M.Icon>link</M.Icon>
        </M.ListItemIcon>
        <M.ListItemText primary="URI" />
      </M.ListItem>

      <M.ListItem button component="a" href={URLS.docs} target="_blank">
        <M.ListItemIcon className={classes.icon}>
          <M.Icon>menu_book</M.Icon>
        </M.ListItemIcon>
        <M.ListItemText primary="Docs" />
      </M.ListItem>
    </M.List>
  )
}
