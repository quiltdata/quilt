import type { S3 } from 'aws-sdk'
import * as React from 'react'

import type * as Model from 'model'

import RehydrateDialog from './RehydrateDialog'
import type { RestoreStatus } from './loaders/restore'

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
  // Optimistic "restoring" hold: after S3 accepts a new restore (202 Accepted),
  // we render the in-progress branch immediately even before the next HEAD
  // catches up. Cleared once HEAD confirms ongoing=true.
  const [optimisticRestoring, setOptimisticRestoring] = React.useState(false)

  React.useEffect(() => {
    if (!optimisticRestoring) return
    // Server-confirmed in-progress restore — no longer need to hold optimistically.
    if (restore?.ongoing === true) setOptimisticRestoring(false)
  }, [optimisticRestoring, restore])

  const openDialog = React.useCallback(() => setDialogOpen(true), [])
  const closeDialog = React.useCallback(() => setDialogOpen(false), [])

  const handleSubmitted = React.useCallback(
    (alreadyRestored: boolean) => {
      // For the 200 OK path, the parent's reload will flip out of "archived"
      // entirely once HEAD reports the live restored copy; no optimistic hold
      // needed. For the 202 path, hold optimistically until HEAD confirms.
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
