import type { S3 } from 'aws-sdk'
import * as React from 'react'

import type * as Model from 'model'

import type { RestoreStatus } from 'containers/Bucket/requests/restore'
import RehydrateDialog from './RehydrateDialog'

interface RenderMessageProps {
  heading: React.ReactNode
  body: React.ReactNode
  action?: React.ReactNode
}

interface RenderActionProps {
  label: string
  onClick: () => void
}

interface ArchivedMessageProps {
  handle: Model.S3.S3ObjectLocation
  restore?: RestoreStatus
  storageClass?: S3.StorageClass
  renderMessage: (props: RenderMessageProps) => React.ReactNode
  renderAction: (props: RenderActionProps) => React.ReactNode
  noDownload?: boolean
}

export default function ArchivedMessage({
  handle,
  restore,
  storageClass,
  renderMessage,
  renderAction,
  noDownload,
}: ArchivedMessageProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  // Optimistic hold: a 202 flips to "in progress" and stays. Rehydration takes
  // hours and the HEAD is browser-cached, so there's no in-session polling — a
  // later page load picks up the real state.
  const [optimisticRestoring, setOptimisticRestoring] = React.useState(false)

  const openDialog = React.useCallback(() => setDialogOpen(true), [])
  const closeDialog = React.useCallback(() => setDialogOpen(false), [])

  const handleSubmitted = React.useCallback((alreadyRestored: boolean) => {
    // 202: a new restore started — hold the in-progress message optimistically.
    // 200 (already restored): a later page load re-reads the HEAD and flips out
    // of "archived".
    if (!alreadyRestored) setOptimisticRestoring(true)
  }, [])

  const showInProgress = optimisticRestoring || restore?.ongoing === true

  if (showInProgress) {
    return (
      <>
        {renderMessage({
          heading: 'Restore in progress',
          body: 'Restoring from Glacier — this can take minutes to hours depending on the retrieval tier and storage class. Refresh the page to check progress.',
        })}
      </>
    )
  }

  return (
    <>
      {renderMessage({
        heading: 'Object Archived',
        body: 'This file is in S3 Glacier — preview is not available until you rehydrate it.',
        action: !noDownload && renderAction({ label: 'Rehydrate', onClick: openDialog }),
      })}
      <RehydrateDialog
        open={dialogOpen}
        onClose={closeDialog}
        handle={handle}
        storageClass={storageClass}
        onSubmitted={handleSubmitted}
      />
    </>
  )
}
