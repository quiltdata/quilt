import * as React from 'react'

import type * as Model from 'model'

import * as BucketPreferences from 'utils/BucketPreferences'
import type { ArchiveInfo } from 'utils/glacier'
import RehydrateDialog from './RehydrateDialog'

interface MessageAction {
  label: string
  onClick: () => void
}

interface MessageData {
  heading: React.ReactNode
  body: React.ReactNode
  action?: MessageAction
}

interface ArchivedMessageProps {
  handle: Model.S3.S3ObjectLocation
  archive?: ArchiveInfo
  // The host (PreviewDisplay) owns how the message looks and whether to surface
  // the action (e.g. it drops it when downloads are disabled); this component
  // only manages the rehydrate dialog + optimistic state and hands back content.
  children: (msg: MessageData) => React.ReactNode
}

export default function ArchivedMessage({
  handle,
  archive,
  children,
}: ArchivedMessageProps) {
  const { prefs } = BucketPreferences.use()
  // Per-bucket button control (default on); hidden until prefs resolve Ok.
  const canRestore = BucketPreferences.Result.match(
    { Ok: ({ ui: { actions } }) => actions.restore, _: () => false },
    prefs,
  )

  const [dialogOpen, setDialogOpen] = React.useState(false)
  // Optimistic hold: a 202 flips to "in progress" and stays. Rehydration takes
  // hours and the HEAD is browser-cached, so there's no in-session polling — a
  // later page load picks up the real state.
  const [optimisticRestoring, setOptimisticRestoring] = React.useState(false)

  // Clear the optimistic hold when navigating to another object.
  React.useEffect(() => {
    setOptimisticRestoring(false)
  }, [handle.bucket, handle.key, handle.version])

  const openDialog = React.useCallback(() => setDialogOpen(true), [])
  const closeDialog = React.useCallback(() => setDialogOpen(false), [])

  const handleSubmitted = React.useCallback(() => setOptimisticRestoring(true), [])

  const showInProgress = optimisticRestoring || archive?.restore?.ongoing === true

  if (showInProgress) {
    return (
      <>
        {children({
          heading: 'Restore in progress',
          body: 'Restoring from Glacier — this can take minutes to hours depending on the retrieval tier and storage class. Refresh the page to check progress.',
        })}
      </>
    )
  }

  return (
    <>
      {children({
        heading: 'Object Archived',
        body: 'This file is in S3 Glacier — preview is not available until you rehydrate it.',
        action: canRestore ? { label: 'Rehydrate', onClick: openDialog } : undefined,
      })}
      <RehydrateDialog
        open={dialogOpen}
        onClose={closeDialog}
        handle={handle}
        storageClass={archive?.storageClass}
        onSubmitted={handleSubmitted}
      />
    </>
  )
}
