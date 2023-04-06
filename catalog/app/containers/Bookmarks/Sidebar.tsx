import path from 'path'

import type { S3 } from 'aws-sdk'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as style from 'constants/style'
import * as AddToPackage from 'containers/AddToPackage'
import { usePackageCreationDialog } from 'containers/Bucket/PackageDialog/PackageCreationForm'
import {
  useBucketListing,
  BucketListingResult,
} from 'containers/Bucket/requests/bucketListing'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as s3paths from 'utils/s3paths'
import { trimCenter } from 'utils/string'
import type * as workflows from 'utils/workflows'

import { useBookmarks } from './Provider'

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

// TODO: add entry with size from <Listing /> but try to re-use existing types
function useHeadFile() {
  const s3: S3 = AWS.S3.use()
  return React.useCallback(
    async ({
      bucket,
      key,
      version,
    }: Model.S3.S3ObjectLocation): Promise<Model.S3File> => {
      const { ContentLength: size } = await s3
        .headObject({ Bucket: bucket, Key: key, VersionId: version })
        .promise()
      return { bucket, key, size: size || 0, version }
    },
    [s3],
  )
}

function isBucketListingResult(
  r: BucketListingResult | Model.S3File,
): r is BucketListingResult {
  return !!(r as BucketListingResult).files
}

function useHandlesToS3Files(
  bucketListing: (r: $TSFixMe) => Promise<BucketListingResult>,
  headFile: (h: Model.S3.S3ObjectLocation) => Promise<Model.S3File>,
) {
  return React.useCallback(
    async (handles: Model.S3.S3ObjectLocation[]) => {
      const requests = handles.map((handle) =>
        s3paths.isDir(handle.key)
          ? bucketListing({
              bucket: handle.bucket,
              path: s3paths.ensureNoSlash(handle.key),
              delimiter: false,
              drain: true,
            })
          : headFile(handle),
      )
      const responses = await Promise.all(requests)
      return responses.reduce(
        (memo, response) =>
          isBucketListingResult(response)
            ? response.files.reduce(
                (acc, file) => ({
                  ...acc,
                  [path.relative(path.join(response.path, '..'), file.key)]: file,
                }),
                memo,
              )
            : {
                ...memo,
                // TODO: handle the same key from another bucket
                [path.basename(response.key)]: response,
              },
        {} as Record<string, Model.S3File>,
      )
    },
    [bucketListing, headFile],
  )
}

const useDrawerStyles = M.makeStyles((t) => ({
  root: {
    maxWidth: '60vw',
    padding: t.spacing(4),
  },
  actions: {
    margin: t.spacing(3, 0, 0),
  },
  button: {
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  error: {
    margin: t.spacing(1, 0, 2),
  },
  listWrapper: {
    margin: t.spacing(2, 0, 0),
    maxHeight: '80vh',
    overflowY: 'auto',
  },
}))

interface DrawerProps {
  error: Error | null
  handles: Model.S3.S3ObjectLocation[]
  loading: boolean
  onClose?: () => void
  onPackage?: () => void
  open?: boolean
  onRemove: (handle: Model.S3.S3ObjectLocation) => void
  onClear: () => void
}

function Drawer({
  error,
  handles,
  loading,
  onClear,
  onClose,
  onPackage,
  onRemove,
  open,
}: DrawerProps) {
  const classes = useDrawerStyles()
  return (
    <M.Drawer anchor="left" open={open} onClose={onClose}>
      <div className={classes.root}>
        <M.Typography variant="h4">Bookmarks</M.Typography>
        <M.Paper className={classes.listWrapper}>
          {handles.length ? (
            <M.List dense>
              {handles.map((handle) => (
                <BookmarkItem handle={handle} onRemove={() => onRemove(handle)} />
              ))}
            </M.List>
          ) : (
            <NoBookmarks />
          )}
        </M.Paper>
        {error && (
          <Lab.Alert className={classes.error} severity="error">
            <Lab.AlertTitle>{error.name}</Lab.AlertTitle>
            {error.message}
          </Lab.Alert>
        )}
        <div className={classes.actions}>
          <M.Button
            className={classes.button}
            color="primary"
            disabled={loading || !handles.length}
            onClick={onClear}
            variant="outlined"
          >
            Clear bookmarks
          </M.Button>
          <M.Button
            className={classes.button}
            color="primary"
            disabled={loading || !handles.length || !onPackage}
            onClick={onPackage}
            startIcon={loading && <M.CircularProgress size={16} />}
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
  bucket?: string
}

export default function Sidebar({ bucket = '' }: SidebarProps) {
  const bookmarks = useBookmarks()
  const addToPackage = AddToPackage.use()
  const entries = bookmarks?.groups.main.entries
  const handles: Model.S3.S3ObjectLocation[] = React.useMemo(
    () => (entries ? Object.values(entries) : []),
    [entries],
  )
  const [error, setError] = React.useState<Error | null>(null)
  const [traversing, setTraversing] = React.useState(false)
  const bucketListing = useBucketListing()
  const headFile = useHeadFile()
  const handlesToS3Files = useHandlesToS3Files(bucketListing, headFile)
  const [successor, setSuccessor] = React.useState({
    slug: bucket,
  } as workflows.Successor)
  const createDialog = usePackageCreationDialog({
    name: 'createPackageFromBookmarks',
    src: { bucket },
    delayHashing: true,
    disableStateDisplay: true,
    successor,
    onSuccessor: setSuccessor,
  })
  const handleRemove = React.useCallback(
    (handle: Model.S3.S3ObjectLocation) => {
      const isLastBookmark = handles.length === 1
      bookmarks?.remove('main', handle)
      if (isLastBookmark) bookmarks?.hide()
    },
    [bookmarks, handles],
  )
  const handleClear = React.useCallback(() => {
    bookmarks?.clear('main')
    bookmarks?.hide()
  }, [bookmarks])
  const handleSubmit = React.useCallback(async () => {
    if (!addToPackage) throw new Error('Add to Package is not ready')
    setTraversing(true)
    try {
      const files = await handlesToS3Files(handles)
      addToPackage?.merge(files)
      setTraversing(false)
      createDialog.open()
      bookmarks?.hide()
    } catch (e) {
      if (e instanceof Error) {
        setTraversing(false)
        setError(e)
      } else {
        throw e
      }
    }
  }, [addToPackage, bookmarks, createDialog, handlesToS3Files, handles])
  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <Drawer
        error={error}
        handles={handles}
        loading={traversing}
        onClose={bookmarks?.hide}
        onPackage={bucket ? handleSubmit : undefined}
        onRemove={handleRemove}
        onClear={handleClear}
        open={bookmarks?.isOpened}
      />
      {createDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}
    </M.MuiThemeProvider>
  )
}
