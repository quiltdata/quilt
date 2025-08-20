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

import { useConfirm } from 'components/Dialog'
import * as Bookmarks from 'containers/Bookmarks'
import * as FileEditor from 'components/FileEditor'
import * as NamedRoutes from 'utils/NamedRoutes'

import type { FileHandle } from '../types'
import { viewModeToSelectOption } from '../../viewModes'
import type { ViewModes, FileType } from '../../viewModes'

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

interface BookmarksItemProps {
  bookmarks: NonNullable<ReturnType<typeof Bookmarks.use>>
  handle: FileHandle
}

function BookmarksItem({ bookmarks, handle }: BookmarksItemProps) {
  const toggle = React.useCallback(
    () => bookmarks.toggle('main', handle),
    [bookmarks, handle],
  )
  return bookmarks.isBookmarked('main', handle) ? (
    <MenuItem icon={<IconTurnedInOutlined />} onClick={toggle}>
      Remove from bookmarks
    </MenuItem>
  ) : (
    <MenuItem icon={<IconTurnedInNotOutlined />} onClick={toggle}>
      Add to bookmarks
    </MenuItem>
  )
}

interface EditorItemProps {
  editorState: FileEditor.EditorState
}

function EditorItem({ editorState }: EditorItemProps) {
  const handleEditFile = React.useCallback(() => {
    editorState.onEdit(editorState.types[0])
  }, [editorState])
  return (
    <MenuItem icon={<IconEditOutlined />} onClick={handleEditFile}>
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

interface DeleteItemProps {
  handle: FileHandle
}

function DeleteItem({ handle }: DeleteItemProps) {
  const classes = useDeleteItemStyles()
  const confirm = useConfirm({
    title: `Delete "${handle.key}"`,
    submitTitle: 'Delete',
    onSubmit: () => {
      // FIXME: Implement delete logic
      // console.log('Delete file:', handle)
    },
  })
  const handleClick = React.useCallback(
    (event) => {
      event.stopPropagation()
      confirm.open()
    },
    [confirm],
  )
  return (
    <>
      {confirm.render(<></>)}
      <MenuItem
        className={classes.root}
        icon={<IconDeleteOutlined color="error" />}
        onClick={handleClick}
      >
        Delete
      </MenuItem>
    </>
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
  editorState: FileEditor.EditorState
  handle: FileHandle
  viewModes?: ViewModes
}

export default function BucketFileOptions({
  editorState,
  handle,
  viewModes,
}: BucketFileOptionsProps) {
  const classes = useStyles()
  const bookmarks = Bookmarks.use()

  return (
    <>
      {bookmarks && (
        <M.List dense className={classes.subList}>
          <BookmarksItem bookmarks={bookmarks} handle={handle} />
        </M.List>
      )}

      {FileEditor.isSupportedFileType(handle.key) && (
        <M.List dense className={classes.subList}>
          <EditorItem editorState={editorState} />
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
        <DeleteItem handle={handle} />
      </M.List>
    </>
  )
}
