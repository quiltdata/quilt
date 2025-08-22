import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import {
  TurnedInNotOutlined as IconTurnedInNotOutlined,
  TurnedInOutlined as IconTurnedInOutlined,
  DeleteOutlined as IconDeleteOutlined,
  EditOutlined as IconEditOutlined,
  CheckOutlined as IconCheckOutlined,
} from '@material-ui/icons'

import * as NamedRoutes from 'utils/NamedRoutes'

import { viewModeToSelectOption } from '../../viewModes'
import type { ViewModes, FileType } from '../../viewModes'
import type { FileHandle } from '../types'

import * as Context from './ContextFile'

const LIST_ITEM_TYPOGRAPHY_PROPS = { noWrap: true } as const

// NOTE: 'div' is a workaround for hardcoded MUI types
interface MenuItemProps extends Omit<M.ListItemProps<'div'>, 'button'> {
  icon?: React.ReactElement
  children: React.ReactNode
}

function MenuItem({ icon, children, ...props }: MenuItemProps) {
  return (
    <M.ListItem {...props} button>
      {icon && <M.ListItemIcon>{icon}</M.ListItemIcon>}
      <M.ListItemText
        inset={!icon}
        primary={children}
        primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
      />
    </M.ListItem>
  )
}

interface LinkItemProps extends Omit<M.ListItemProps<typeof RRDom.Link>, 'button'> {
  icon?: React.ReactElement
  children: React.ReactNode
}

function LinkItem({ icon, children, ...props }: LinkItemProps) {
  return (
    <M.ListItem {...props} button component={RRDom.Link}>
      <M.ListItemIcon>{icon}</M.ListItemIcon>
      <M.ListItemText
        primary={children}
        primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
      />
    </M.ListItem>
  )
}

function BookmarksItem() {
  const { toggleBookmark, isBookmarked } = Context.use()

  return isBookmarked ? (
    <MenuItem icon={<IconTurnedInOutlined />} onClick={toggleBookmark}>
      Remove from bookmarks
    </MenuItem>
  ) : (
    <MenuItem icon={<IconTurnedInNotOutlined />} onClick={toggleBookmark}>
      Add to bookmarks
    </MenuItem>
  )
}

function EditorItem() {
  const { editFile } = Context.use()

  return (
    <MenuItem icon={<IconEditOutlined />} onClick={editFile}>
      Edit text content
    </MenuItem>
  )
}

interface ViewItemProps {
  handle: FileHandle
  mode: FileType
  selected: boolean
}

function ViewItem({ handle, mode, selected }: ViewItemProps) {
  const { urls } = NamedRoutes.use()
  const { bucket, key, version } = handle
  const label = viewModeToSelectOption(mode).toString()

  return selected ? (
    <MenuItem icon={<IconCheckOutlined />} disabled>
      {label}
    </MenuItem>
  ) : (
    <LinkItem to={urls.bucketFile(bucket, key, { version, mode })}>{label}</LinkItem>
  )
}

const useDeleteItemStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.error.main,
  },
}))

function DeleteItem() {
  const classes = useDeleteItemStyles()
  const { confirmDelete } = Context.use()

  return (
    <MenuItem
      className={classes.root}
      icon={<IconDeleteOutlined color="error" />}
      onClick={confirmDelete}
    >
      Delete
    </MenuItem>
  )
}

const useStyles = M.makeStyles((t) => ({
  error: {
    color: t.palette.error.main,
  },
  subList: {
    '& + &': {
      borderTop: `1px solid ${t.palette.divider}`,
    },
  },
}))

interface BucketFileOptionsProps {
  viewModes?: ViewModes
}

export default function BucketFileOptions({ viewModes }: BucketFileOptionsProps) {
  const classes = useStyles()
  const { handle, canEdit } = Context.use()
  const bookmarks = Context.use()

  return (
    <>
      {bookmarks && (
        <M.List dense className={classes.subList}>
          <BookmarksItem />
        </M.List>
      )}

      {canEdit && (
        <M.List dense className={classes.subList}>
          <EditorItem />
        </M.List>
      )}

      {viewModes && viewModes.modes.length > 0 && (
        <M.List
          dense
          subheader={<M.ListSubheader inset>View as</M.ListSubheader>}
          className={classes.subList}
        >
          {viewModes.modes.map((mode) => (
            <ViewItem
              key={mode}
              handle={handle}
              mode={mode}
              selected={mode === viewModes.mode}
            />
          ))}
        </M.List>
      )}

      <M.List dense className={classes.subList}>
        <DeleteItem />
      </M.List>
    </>
  )
}
