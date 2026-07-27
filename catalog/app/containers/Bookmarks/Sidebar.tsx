import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import * as PD from 'containers/Bucket/PackageDialog'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as s3paths from 'utils/s3paths'
import { trimCenter } from 'utils/string'

import { useBookmarks } from './Provider'

function CreatePackageInBucket({
  children,
  bucket,
  handles,
  bookmarks: { hide },
}: Required<CreatePackageProps>) {
  const dst = React.useMemo(() => ({ bucket }), [bucket])
  const createDialog = PD.useCreateDialog({
    delayHashing: true,
    disableStateDisplay: true,
    dst,
  })
  const onClick = React.useCallback(() => {
    createDialog.open({ files: PD.FromHandles(handles) })
    hide()
  }, [createDialog, handles, hide])
  return (
    <>
      {createDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}
      <>{children(onClick)}</>
    </>
  )
}

interface CreatePackageProps {
  bucket?: string
  handles: Model.S3.S3ObjectLocation[]
  bookmarks: NonNullable<ReturnType<typeof useBookmarks>>
  children: (onClick?: () => void) => React.ReactNode
}

function CreatePackage({ bucket, children, handles, bookmarks }: CreatePackageProps) {
  if (!bucket || !handles.length) return <>{children()}</>

  return <CreatePackageInBucket {...{ bookmarks, bucket, handles, children }} />
}

const useBookmarksItemStyles = M.makeStyles((t) => ({
  iconWrapper: {
    minWidth: t.spacing(4),
  },
}))

interface BookmarkItemProps {
  handle: Model.S3.S3ObjectLocation
  onRemove: () => void
}

function BookmarkItem({ handle, onRemove }: BookmarkItemProps) {
  const classes = useBookmarksItemStyles()
  const { urls } = NamedRoutes.use()
  const to = urls.bucketFile(handle.bucket, handle.key)
  const title = `s3://${handle.bucket}/${handle.key}`
  return (
    <M.ListItem>
      <M.ListItemIcon className={classes.iconWrapper}>
        <M.Icon fontSize="small">
          {s3paths.isDir(handle.key) ? 'folder_open' : 'insert_drive_file'}
        </M.Icon>
      </M.ListItemIcon>
      <M.ListItemText>
        <StyledLink to={to}>{trimCenter(title, 66)}</StyledLink>
      </M.ListItemText>
      <M.ListItemSecondaryAction>
        <M.IconButton size="small" edge="end" onClick={onRemove}>
          <M.Icon fontSize="inherit">clear</M.Icon>
        </M.IconButton>
      </M.ListItemSecondaryAction>
    </M.ListItem>
  )
}

const useNoBookmarksStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2, 3),
  },
  desc: {
    marginTop: t.spacing(1),
  },
}))

function NoBookmarks() {
  const classes = useNoBookmarksStyles()
  return (
    <div className={classes.root}>
      <M.Typography variant="h5">No bookmarks selected</M.Typography>
      <M.Typography className={classes.desc}>
        For topping up bookmarks you can navigate to "Bucket" tab, select files or
        directories and click "Add to bookmarks"
      </M.Typography>
    </div>
  )
}

const useDrawerStyles = M.makeStyles((t) => ({
  root: {
    maxWidth: '60vw',
    padding: t.spacing(4),
  },
  actions: {
    display: 'flex',
    margin: t.spacing(3, 0, 0),
    gap: t.spacing(1),
  },
  listWrapper: {
    margin: t.spacing(2, 0, 0),
    maxHeight: '80vh',
    overflowY: 'auto',
  },
}))

interface DrawerProps {
  handles: Model.S3.S3ObjectLocation[]
  onClose?: () => void
  onPackage?: () => void
  open?: boolean
  onRemove: (handle: Model.S3.S3ObjectLocation) => void
  onClear: () => void
}

function Drawer({ handles, onClear, onClose, onRemove, onPackage, open }: DrawerProps) {
  const classes = useDrawerStyles()
  return (
    <M.Drawer anchor="left" open={open} onClose={onClose}>
      <div className={classes.root}>
        <M.Typography variant="h4">Bookmarks</M.Typography>
        <M.Paper className={classes.listWrapper}>
          {handles.length ? (
            <M.List dense>
              {handles.map((handle) => (
                <BookmarkItem
                  handle={handle}
                  onRemove={() => onRemove(handle)}
                  key={handle.bucket + handle.key}
                />
              ))}
            </M.List>
          ) : (
            <NoBookmarks />
          )}
        </M.Paper>
        <div className={classes.actions}>
          <M.Button
            color="primary"
            disabled={!handles.length}
            onClick={onClear}
            variant="outlined"
          >
            Clear bookmarks
          </M.Button>
          <M.Button
            color="primary"
            disabled={!onPackage}
            onClick={onPackage}
            variant="contained"
          >
            Create package
          </M.Button>
        </div>
      </div>
    </M.Drawer>
  )
}

interface SidebarProps {
  bookmarks: NonNullable<ReturnType<typeof useBookmarks>>
  bucket?: string
}

export default function Sidebar({ bookmarks, bucket }: SidebarProps) {
  const entries = bookmarks.groups.main.entries
  const handles: Model.S3.S3ObjectLocation[] = React.useMemo(
    () => (entries ? Object.values(entries) : []),
    [entries],
  )
  const handleRemove = React.useCallback(
    (handle: Model.S3.S3ObjectLocation) => {
      const isLastBookmark = handles.length === 1
      bookmarks.remove('main', handle)
      if (isLastBookmark) bookmarks.hide()
    },
    [bookmarks, handles],
  )
  const handleClear = React.useCallback(() => {
    bookmarks.clear('main')
    bookmarks.hide()
  }, [bookmarks])

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <CreatePackage bookmarks={bookmarks} bucket={bucket} handles={handles}>
        {(onPackage) => (
          <Drawer
            handles={handles}
            onClose={bookmarks.hide}
            onRemove={handleRemove}
            onPackage={onPackage}
            onClear={handleClear}
            open={bookmarks.isOpened}
          />
        )}
      </CreatePackage>
    </M.MuiThemeProvider>
  )
}
