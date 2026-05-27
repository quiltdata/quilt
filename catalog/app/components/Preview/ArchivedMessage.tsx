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
  onReload?: () => void
  noDownload?: boolean
}

export default function ArchivedMessage({
  handle,
  restore,
  storageClass,
  renderMessage,
  renderAction,
  onReload,
  noDownload,
}: ArchivedMessageProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  // Optimistic hold: after a 202, show the in-progress branch immediately,
  // before HEAD catches up. Cleared once HEAD confirms ongoing.
  const [optimisticRestoring, setOptimisticRestoring] = React.useState(false)

  React.useEffect(() => {
    if (!optimisticRestoring) return
    if (restore?.ongoing === true) setOptimisticRestoring(false)
  }, [optimisticRestoring, restore])

  const openDialog = React.useCallback(() => setDialogOpen(true), [])
  const closeDialog = React.useCallback(() => setDialogOpen(false), [])

  const handleSubmitted = React.useCallback(
    (alreadyRestored: boolean) => {
      // 200 OK: parent reload flips out of "archived" once HEAD sees the live
      // copy. 202: hold optimistically until HEAD confirms.
      if (!alreadyRestored) setOptimisticRestoring(true)
      onReload?.()
    },
    [onReload],
  )

  const showInProgress = optimisticRestoring || restore?.ongoing === true

  if (showInProgress) {
    return (
      <>
        {renderMessage({
          heading: 'Restore in progress',
          body: 'Restoring from Glacier — the exact time depends on the tier and storage class you picked. Refresh to check status.',
          action:
            !!onReload && renderAction({ label: 'Check status', onClick: onReload }),
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
