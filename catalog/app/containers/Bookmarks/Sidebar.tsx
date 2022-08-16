import type { S3 } from 'aws-sdk'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as AddToPackage from 'containers/AddToPackage'
import { usePackageCreationDialog } from 'containers/Bucket/PackageDialog/PackageCreationForm'
import {
  useBucketListing,
  BucketListingResult,
} from 'containers/Bucket/requests/bucketListing'
import * as AWS from 'utils/AWS'
import type { S3HandleBase } from 'utils/s3paths'
import type * as Model from 'model'

import { useBookmarks } from './Provider'

// TODO: endsWith → s3paths.isDir

const useSidebarStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(1, 2),
  },
}))

function useHeadFile() {
  const s3: S3 = AWS.S3.use()
  return React.useCallback(
    async ({ bucket, key, version }: S3HandleBase): Promise<Model.S3File> => {
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
  headFile: (h: S3HandleBase) => Promise<Model.S3File>,
) {
  return React.useCallback(
    async (handles: S3HandleBase[]) => {
      const requests = handles.map((handle) =>
        handle.key.endsWith('/')
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

// TODO: bucket
export default function Sidebar() {
  const bookmarks = useBookmarks()
  const classes = useSidebarStyles()
  const addToPackage = AddToPackage.use()
  const entries = bookmarks?.groups.bookmarks?.entries
  const list: S3HandleBase[] = React.useMemo(
    () => (entries ? Object.values(entries) : []),
    [entries],
  )
  const bucketListing = useBucketListing()
  const headFile = useHeadFile()
  const handlesToS3Files = useHandlesToS3Files(bucketListing, headFile)
  const createDialog = usePackageCreationDialog({
    bucket: 'fiskus-sandbox-dev',
    delayHashing: true,
    disableStateDisplay: true,
  })
  const handleSubmit = React.useCallback(async () => {
    if (!addToPackage) throw new Error('Add to Package is not ready')
    const files = await handlesToS3Files(list)
    files.forEach(addToPackage?.append)
    createDialog.open()
    // bookmarks?.hide() // TODO: move handleSubmit outside M.Drawer
  }, [addToPackage, createDialog, handlesToS3Files, list])
  const isOpened = bookmarks?.isOpened
  return (
    <M.Drawer anchor="left" open={isOpened} onClose={bookmarks?.hide}>
      <div className={classes.root}>
        <M.List>
          {list.map((file) => (
            <M.ListItem>
              <M.ListItemIcon>
                <M.Icon>
                  {file.key.endsWith('/')
                    ? 'folder_outlined'
                    : 'insert_drive_file_outlined'}
                </M.Icon>
              </M.ListItemIcon>
              <M.ListItemText>
                s3://{file.bucket}/{file.key}
              </M.ListItemText>
            </M.ListItem>
          ))}
        </M.List>
        <M.Button color="primary" variant="contained" onClick={handleSubmit}>
          Create package
        </M.Button>

        {createDialog.render({
          successTitle: 'Package created',
          successRenderMessage: ({ packageLink }) => (
            <>Package {packageLink} successfully created</>
          ),
          title: 'Create package',
        })}
      </div>
    </M.Drawer>
  )
}
