import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import {
  TurnedInNotOutlined as IconTurnedInNotOutlined,
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
import type { ViewModes } from '../../viewModes'

const LIST_ITEM_TYPOGRAPHY_PROPS = { noWrap: true } as const

// 'div' is a workaround for hardcoded MUI types
interface MenuItemProps extends Omit<M.ListItemProps<'div'>, 'button'> {
  icon?: React.ReactElement
  primary: string
}

function MenuItem({ icon, primary, ...props }: MenuItemProps) {
  return (
    <M.ListItem {...props} button>
      {icon && <M.ListItemIcon>{icon}</M.ListItemIcon>}
      <M.ListItemText
        inset={!icon}
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

interface BucketFileOptionsProps {
  handle: FileHandle
  viewModes?: ViewModes
}

export default function BucketFileOptions({ handle, viewModes }: BucketFileOptionsProps) {
  const classes = useStyles()

  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()

  const bookmarks = Bookmarks.use()
  const editorState = FileEditor.useState(handle)

  const confirm = useConfirm({
    title: `Delete "${handle.key}"`,
    submitTitle: 'Delete',
    onSubmit: () => {
      // TODO: Implement delete logic
      // console.log('Delete file:', handle)
    },
  })

  const handleAddToBookmarks = React.useCallback(() => {
    if (!bookmarks) return
    bookmarks.append('main', handle)
  }, [bookmarks, handle])

  const handleEditFile = React.useCallback(() => {
    if (!FileEditor.isSupportedFileType(handle.key)) return
    editorState.onEdit(editorState.types[0])
  }, [editorState, handle.key])

  const handleViewModeChange = React.useCallback(
    (mode: string) => {
      const { bucket, key, version } = handle
      history.push(urls.bucketFile(bucket, key, { version, mode }))
    },
    [handle, history, urls],
  )

  // TODO: modes = viewModels.map(viewModeToSelectOption)

  const handleDeleteFile = React.useCallback(() => {
    confirm.open()
  }, [confirm])

  const isBookmarked = React.useMemo(
    () => bookmarks?.isBookmarked('main', handle),
    [bookmarks, handle],
  )

  const canEdit = FileEditor.isSupportedFileType(handle.key)

  return (
    <>
      {confirm.render(<></>)}

      {bookmarks && (
        <>
          <M.List dense>
            <MenuItem
              icon={<IconTurnedInNotOutlined />}
              primary={isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
              onClick={handleAddToBookmarks}
            />
          </M.List>
          <M.Divider />
        </>
      )}

      {canEdit && (
        <>
          <M.List dense>
            <MenuItem
              icon={<IconEditOutlined />}
              primary="Edit text content"
              onClick={handleEditFile}
            />
          </M.List>
          <M.Divider />
        </>
      )}

      {viewModes && viewModes.modes.length > 0 && (
        <>
          <M.List dense subheader={<M.ListSubheader inset>View as</M.ListSubheader>}>
            {viewModes.modes.map((mode) => (
              <MenuItem
                key={mode}
                icon={mode === viewModes.mode ? <IconCheckOutlined /> : undefined}
                primary={viewModeToSelectOption(mode).toString()}
                onClick={() => handleViewModeChange(mode)}
              />
            ))}
          </M.List>
          <M.Divider />
        </>
      )}

      {/* Dangerous actions */}
      <M.List dense>
        <MenuItem
          className={classes.error}
          icon={<IconDeleteOutlined color="error" />}
          primary="Delete"
          onClick={handleDeleteFile}
        />
      </M.List>
    </>
  )
}
