import * as React from 'react'
import * as M from '@material-ui/core'
import {
  TurnedInNotOutlined as IconTurnedInNotOutlined,
  DeleteOutlined as IconDeleteOutlined,
  EditOutlined as IconEditOutlined,
  ClearOutlined as IconClearOutlined,
} from '@material-ui/icons'

import * as Format from 'utils/format'

import * as Context from './ContextDir'

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

export default function BucketDirOptions() {
  const classes = useStyles()
  const {
    addSelectedToBookmarks,
    openSelectionPopup,
    clearSelection,
    confirmDeleteSelected,
    selectionCount,
  } = Context.use()

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
        <MenuItem
          icon={<IconTurnedInNotOutlined />}
          onClick={addSelectedToBookmarks}
          primary="Add to bookmarks"
        />
      </M.List>

      <M.Divider />

      <M.List dense>
        <MenuItem
          icon={<IconEditOutlined />}
          onClick={openSelectionPopup}
          primary="Manage selection"
        />
        <MenuItem
          icon={<IconClearOutlined />}
          onClick={clearSelection}
          primary="Clear selection"
        />
      </M.List>

      <M.Divider />

      <M.List dense>
        <MenuItem
          className={classes.error}
          icon={<IconDeleteOutlined color="error" />}
          onClick={confirmDeleteSelected}
          primary="Delete selected items"
        />
      </M.List>
    </>
  )
}
