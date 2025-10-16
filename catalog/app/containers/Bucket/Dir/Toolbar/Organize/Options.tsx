import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as Format from 'utils/format'
import assertNever from 'utils/assertNever'

import * as Context from './Context'

const LIST_ITEM_TYPOGRAPHY_PROPS = { noWrap: true }

interface MenuItemProps {
  className?: string
  icon: React.ReactElement
  primary: string
  onClick: () => void
}

function MenuItem({ className, icon, primary, onClick }: MenuItemProps) {
  return (
    <M.ListItem button onClick={onClick} className={className}>
      <M.ListItemIcon>{icon}</M.ListItemIcon>
      <M.ListItemText
        primary={primary}
        primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
      />
    </M.ListItem>
  )
}

const useStyles = M.makeStyles((t) => ({
  error: {
    color: t.palette.error.main,
  },
}))

export default function OrganizeOptions() {
  const classes = useStyles()
  const {
    toggleBookmarks,
    bookmarkStatus,
    openSelectionPopup,
    clearSelection,
    confirmDeleteSelected,
    selectionCount,
  } = Context.use()

  const bookmarkIcon = React.useMemo(() => {
    switch (bookmarkStatus) {
      case 'all':
        return <Icons.TurnedInOutlined />
      case 'partial':
        return <Icons.BookmarksOutlined />
      case 'none':
        return <Icons.TurnedInNotOutlined />
      default:
        return assertNever(bookmarkStatus)
    }
  }, [bookmarkStatus])

  const bookmarkText = React.useMemo(() => {
    switch (bookmarkStatus) {
      case 'all':
        return 'Remove from bookmarks'
      case 'partial':
        return 'Add all to bookmarks'
      case 'none':
        return 'Add to bookmarks'
      default:
        return assertNever(bookmarkStatus)
    }
  }, [bookmarkStatus])

  return (
    <>
      <M.ListSubheader inset component="div" disableSticky>
        <Format.Plural
          value={selectionCount}
          one="One selected item"
          other={(n) => `${n} selected items`}
        />
      </M.ListSubheader>

      <M.Divider />

      <M.List dense>
        <MenuItem icon={bookmarkIcon} onClick={toggleBookmarks} primary={bookmarkText} />
      </M.List>

      <M.Divider />

      <M.List dense>
        <MenuItem
          icon={<Icons.EditOutlined />}
          onClick={openSelectionPopup}
          primary="Manage selection"
        />
        <MenuItem
          icon={<Icons.ClearOutlined />}
          onClick={clearSelection}
          primary="Clear selection"
        />
      </M.List>

      <M.Divider />

      <M.List dense>
        <MenuItem
          className={classes.error}
          icon={<Icons.DeleteOutlined color="error" />}
          onClick={confirmDeleteSelected}
          primary="Delete selected items"
        />
      </M.List>
    </>
  )
}
