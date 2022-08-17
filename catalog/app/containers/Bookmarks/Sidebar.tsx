import type { S3 } from 'aws-sdk'
import * as React from 'react'
import * as M from '@material-ui/core'

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

const useDrawerStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(1, 2),
  },
}))

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

interface DrawerProps {
  handles: s3paths.S3HandleBase[]
  onClose?: () => void
  onPackage: () => void
  open?: boolean
}

function Drawer({ handles, onClose, onPackage, open }: DrawerProps) {
  const classes = useDrawerStyles()
  return (
    <M.Drawer anchor="left" open={open} onClose={onClose}>
      <div className={classes.root}>
        <M.List>
          {handles.map(({ bucket, key }) => (
            <M.ListItem>
              <M.ListItemIcon>
                <M.Icon>
                  {s3paths.isDir(key) ? 'folder_outlined' : 'insert_drive_file_outlined'}
                </M.Icon>
              </M.ListItemIcon>
              <M.ListItemText>
                s3://{bucket}/{key}
              </M.ListItemText>
            </M.ListItem>
          ))}
        </M.List>
        <M.Button color="primary" variant="contained" onClick={onPackage}>
          Create package
        </M.Button>
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
  const bucketListing = useBucketListing()
  const headFile = useHeadFile()
  const handlesToS3Files = useHandlesToS3Files(bucketListing, headFile)
  const createDialog = usePackageCreationDialog({
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })
  const handleSubmit = React.useCallback(async () => {
    if (!addToPackage) throw new Error('Add to Package is not ready')
    const files = await handlesToS3Files(list)
    files.forEach(addToPackage?.append)
    createDialog.open()
    bookmarks?.hide()
  }, [addToPackage, bookmarks, createDialog, handlesToS3Files, list])
  const isOpened = bookmarks?.isOpened
  return (
    <>
      <Drawer
        open={isOpened}
        onClose={bookmarks?.hide}
        handles={list}
        onPackage={handleSubmit}
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
