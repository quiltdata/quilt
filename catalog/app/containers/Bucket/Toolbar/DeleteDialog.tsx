import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { Error as IconError } from '@material-ui/icons'

import Code from 'components/Code'
import { deleteObject, useFilesListing } from 'containers/Bucket/requests'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import Log from 'utils/Logging'

const useDeleteDialogStyles = M.makeStyles({
  deleted: {
    textDecoration: 'line-through',
  },
})

type FileStatus = 'pending' | 'success' | 'error'

interface ResolvedObject {
  handle: Model.S3.S3ObjectLocation
  status: FileStatus
  error?: any
}

export type DeleteResult = {
  deleted: boolean
}

export interface DeleteDialogProps {
  close: (result: DeleteResult) => void
  handles: Model.S3.S3ObjectLocation[]
}

export default function DeleteDialog({ close, handles }: DeleteDialogProps) {
  const classes = useDeleteDialogStyles()
  const [submitting, setSubmitting] = React.useState(false)
  const [resolvedObjects, setResolvedObjects] = React.useState<ResolvedObject[] | null>(
    null,
  )

  const hasErrors = React.useMemo(
    () => resolvedObjects?.some((obj) => obj.status === 'error') ?? false,
    [resolvedObjects],
  )

  const isComplete = React.useMemo(
    () => resolvedObjects?.every((obj) => obj.status !== 'pending') ?? false,
    [resolvedObjects],
  )

  const hasSuccessfulDeletions = React.useMemo(
    () => resolvedObjects?.some((obj) => obj.status === 'success') ?? false,
    [resolvedObjects],
  )

  const s3 = AWS.S3.use()
  const getFiles = useFilesListing()

  React.useEffect(() => {
    async function resolveHandles() {
      const filesMap = await getFiles(handles)
      const resolved = Object.values(filesMap)
      setResolvedObjects(
        resolved.map((handle) => ({ handle, status: 'pending' as FileStatus })),
      )
    }
    resolveHandles()
  }, [getFiles, handles])

  const onSubmit = React.useCallback(async () => {
    setSubmitting(true)

    if (resolvedObjects) {
      const results = await Promise.all(
        resolvedObjects.map(async ({ handle }) => {
          try {
            await deleteObject({ s3, handle })
            return { status: 'success' as FileStatus, error: undefined }
          } catch (error) {
            Log.error('Failed to delete object:', error)
            return { status: 'error' as FileStatus, error }
          }
        }),
      )

      setResolvedObjects((prev) =>
        prev!.map((item, index) => ({
          ...item,
          status: results[index].status,
          error: results[index].error,
        })),
      )
    }

    setSubmitting(false)
  }, [s3, resolvedObjects])

  const title = React.useMemo(() => {
    if (!isComplete) return 'Delete objects?'
    return hasErrors ? 'Some files could not be deleted' : 'Files deleted successfully'
  }, [isComplete, hasErrors])

  return (
    <>
      <M.DialogTitle>{title}</M.DialogTitle>
      <M.DialogContent>
        {resolvedObjects ? (
          <M.List dense disablePadding>
            {resolvedObjects.map(
              ({ handle: { bucket, key, version }, status, error }) => (
                <M.ListItem key={`${bucket}${key}${version}`} disableGutters>
                  {status === 'error' && (
                    <M.Tooltip title={error.message}>
                      <M.ListItemIcon>
                        <IconError color="error" />
                      </M.ListItemIcon>
                    </M.Tooltip>
                  )}
                  <M.ListItemText
                    primary={
                      <Code className={cx(status === 'success' && classes.deleted)}>
                        s3://{bucket}/{key}
                      </Code>
                    }
                    secondary={version}
                  />
                </M.ListItem>
              ),
            )}
          </M.List>
        ) : (
          <M.CircularProgress size={64} />
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button
          onClick={() => close({ deleted: hasSuccessfulDeletions })}
          color="primary"
          variant="outlined"
        >
          {isComplete ? 'Close' : 'Cancel'}
        </M.Button>
        {!isComplete && (
          <M.Button
            color="primary"
            disabled={submitting}
            variant="contained"
            onClick={onSubmit}
          >
            Submit
          </M.Button>
        )}
      </M.DialogActions>
    </>
  )
}
