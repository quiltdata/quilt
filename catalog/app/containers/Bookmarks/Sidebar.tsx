import type { S3 } from 'aws-sdk'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as AddToPackage from 'containers/AddToPackage'
import { usePackageCreationDialog } from 'containers/Bucket/PackageDialog/PackageCreationForm'
import {
  useBucketListing,
  BucketListingResult,
} from 'containers/Bucket/requests/bucketListing'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as s3paths from 'utils/s3paths'

import { useBookmarks } from './Provider'

function useHeadFile() {
  const s3: S3 = AWS.S3.use()
  return React.useCallback(
    async ({ bucket, key, version }: s3paths.S3HandleBase): Promise<Model.S3File> => {
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
  headFile: (h: s3paths.S3HandleBase) => Promise<Model.S3File>,
) {
  return React.useCallback(
    async (handles: s3paths.S3HandleBase[]) => {
      const requests = handles.map((handle) =>
        s3paths.isDir(handle.key)
          ? bucketListing({ bucket: handle.bucket, path: handle.key })
          : headFile(handle),
      )
      const responses = await Promise.all(requests)
      return responses.reduce(
        (memo, response) =>
          isBucketListingResult(response)
            ? [...memo, ...response.files]
            : [...memo, response],
        [] as Model.S3File[],
      )
    },
    [bucketListing, headFile],
  )
}

const useDrawerStyles = M.makeStyles((t) => ({
  root: {
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
  iconWrapper: {
    minWidth: t.spacing(4),
  },
  listWrapper: {
    margin: t.spacing(2, 0, 0),
    maxHeight: '80vh',
    overflowY: 'auto',
  },
}))

interface DrawerProps {
  error: Error | null
  handles: s3paths.S3HandleBase[]
  loading: boolean
  onClose?: () => void
  onPackage: () => void
  open?: boolean
  onRemove: (handle: s3paths.S3HandleBase) => void
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
          <M.List dense>
            {handles.map((h) => (
              <M.ListItem>
                <M.ListItemIcon className={classes.iconWrapper}>
                  <M.Icon fontSize="small">
                    {s3paths.isDir(h.key) ? 'folder_open' : 'insert_drive_file'}
                  </M.Icon>
                </M.ListItemIcon>
                <M.ListItemText primary={`s3://${h.bucket}/${h.key}`} />
                <M.ListItemSecondaryAction>
                  <M.IconButton size="small" edge="end" onClick={() => onRemove(h)}>
                    <M.Icon fontSize="inherit">clear</M.Icon>
                  </M.IconButton>
                </M.ListItemSecondaryAction>
              </M.ListItem>
            ))}
          </M.List>
        </M.Paper>
        {error && (
          <Lab.Alert className={classes.error} severity="error">
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
            disabled={loading}
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
  bucket: string
}

export default function Sidebar({ bucket }: SidebarProps) {
  const bookmarks = useBookmarks()
  const addToPackage = AddToPackage.use()
  const entries = bookmarks?.groups.bookmarks?.entries
  const list: s3paths.S3HandleBase[] = React.useMemo(
    () => (entries ? Object.values(entries) : []),
    [entries],
  )
  const [error, setError] = React.useState<Error | null>(null)
  const [traversing, setTraversing] = React.useState(false)
  const bucketListing = useBucketListing()
  const headFile = useHeadFile()
  const handlesToS3Files = useHandlesToS3Files(bucketListing, headFile)
  const createDialog = usePackageCreationDialog({
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })
  const handleRemove = React.useCallback(
    (handle: s3paths.S3HandleBase) => {
      const isLastBookmark = list.length === 1
      bookmarks?.remove('bookmarks', handle)
      if (isLastBookmark) bookmarks?.hide()
    },
    [bookmarks, list],
  )
  const handleClear = React.useCallback(() => {
    bookmarks?.clear('bookmarks')
    bookmarks?.hide()
  }, [bookmarks])
  const handleSubmit = React.useCallback(async () => {
    if (!addToPackage) throw new Error('Add to Package is not ready')
    setTraversing(true)
    try {
      const files = await handlesToS3Files(list)
      files.forEach(addToPackage?.append)
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
  }, [addToPackage, bookmarks, createDialog, handlesToS3Files, list])
  const isOpened = bookmarks?.isOpened
  return (
    <>
      <Drawer
        error={error}
        handles={list}
        loading={traversing}
        onClose={bookmarks?.hide}
        onPackage={handleSubmit}
        onRemove={handleRemove}
        onClear={handleClear}
        open={isOpened}
      />
      {createDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}
    </>
  )
}
