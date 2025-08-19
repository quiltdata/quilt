import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'
import {
  TurnedInNotOutlined as IconTurnedInNotOutlined,
  DeleteOutlined as IconDeleteOutlined,
  EditOutlined as IconEditOutlined,
  ClearOutlined as IconClearOutlined,
} from '@material-ui/icons'

import { useConfirm } from 'components/Dialog'
import * as Bookmarks from 'containers/Bookmarks'
import * as Dialogs from 'utils/Dialogs'
import * as Format from 'utils/format'

import * as Selection from '../../Selection'

const LIST_ITEM_TYPOGRAPHY_PROPS = { noWrap: true } as const

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

  const slt = Selection.use()
  invariant(
    slt.inited && !slt.isEmpty,
    'Selection must be used within a Selection.Provider, and something must be selected',
  )
  const bookmarks = Bookmarks.use()
  const dialogs = Dialogs.use()

  const confirm = useConfirm({
    title: 'Delete selected items',
    submitTitle: 'Delete',
    onSubmit: () => {
      // TODO: Implement delete logic
      // console.log('Delete selected items:', Selection.toHandlesList(slt.selection))
    },
  })

  const handleAddToBookmarks = React.useCallback(() => {
    if (!bookmarks) return
    const handles = Selection.toHandlesList(slt.selection)
    handles.forEach((handle) => {
      bookmarks.append('main', handle)
    })
  }, [bookmarks, slt])

  const handleManageSelection = React.useCallback(
    () => dialogs.open(({ close }) => <Selection.Popup close={close} />),
    [dialogs],
  )

  const handleClearSelection = React.useCallback(() => {
    slt.clear()
  }, [slt])

  const handleDeleteSelected = React.useCallback(() => {
    if (slt.isEmpty) return
    confirm.open()
  }, [confirm, slt])

  return (
    <>
      {confirm.render(<></>)}

      <M.ListSubheader inset component="div" disableSticky>
        <Format.Plural
          value={slt.totalCount}
          one="One selected item"
          other={(n) => `${n} selected items`}
        />
      </M.ListSubheader>

      <M.Divider />

      {bookmarks && (
        <>
          <M.List dense>
            <MenuItem
              icon={<IconTurnedInNotOutlined />}
              onClick={handleAddToBookmarks}
              primary="Add to bookmarks"
            />
          </M.List>
          <M.Divider />
        </>
      )}

      <M.List dense>
        <MenuItem
          icon={<IconEditOutlined />}
          onClick={handleManageSelection}
          primary="Manage selection"
        />
        <MenuItem
          icon={<IconClearOutlined />}
          onClick={handleClearSelection}
          primary="Clear selection"
        />
      </M.List>

      <M.Divider />

      <M.List dense>
        <MenuItem
          className={classes.error}
          icon={<IconDeleteOutlined color="error" />}
          onClick={handleDeleteSelected}
          primary="Delete selected items"
        />
      </M.List>
    </>
  )
}
